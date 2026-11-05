/* Muzzaga · personajes 3D (Flow → Meshy → Blender): jugador, jugadora, veterano, bartender, clienta y cliente.
   Cada personaje sigue a un muñeco de la maqueta (que se oculta) y copia su posición y giro; la animación la elige
   según lo que hace el muñeco: corre, camina, está parado, sentado, toma algo, charla o festeja el punto.
   Todas las animaciones salen de un solo archivo (mismo esqueleto Mixamo para los seis). Si algo no carga,
   quedan los muñecos de siempre. */
(function () {
  function install(ctx) {
    const { THREE, scene, onFrame } = ctx;
    if (!THREE.GLTFLoader || !THREE.SkeletonUtils || !onFrame) return;
    const NAMES = ['jugador', 'jugadora', 'veterano', 'bartender', 'clienta', 'cliente'];
    const FEMALE = { jugadora: true, clienta: true };
    const HEIGHT = 1.74;
    // en celular los personajes no proyectan sombra: el pase de sombras vuelve a animar cada malla y es lo que más pesa
    const mobile = innerWidth < 860 || matchMedia('(pointer:coarse)').matches;
    const loader = new THREE.GLTFLoader();
    const load = (url) => new Promise((ok, fail) => loader.load(url, ok, undefined, fail));

    // muñecos de la maqueta (los arma person()): hijos directos de la escena con piernas y torso
    const proxies = scene.children.filter((o) => o.userData && o.userData.legL && o.userData.up);
    if (!proxies.length) return;

    const base = window.MZ_BASE || ''; // en la web: /recorrido/
    Promise.all([load(base + 'modelos/animaciones.json')].concat(NAMES.map((n) => load(base + 'modelos/personajes/' + n + '.json'))))
      .then(([anim, ...models]) => start(anim.animations, models.map((g) => g.scene)))
      .catch((e) => console.warn('personajes 3D', e));

    function start(clipList, bases) {
      const clips = {};
      clipList.forEach((c) => { clips[c.name] = c; });
      const base = {};
      NAMES.forEach((n, i) => {
        const s = bases[i];
        s.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(s);
        s.userData.k = HEIGHT / Math.max(0.5, box.max.y - box.min.y);
        s.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = !mobile; o.receiveShadow = !mobile; o.frustumCulled = false;
            if (o.material) { o.material.roughness = 0.8; o.material.metalness = 0; o.material.envMapIntensity = 0.8; }
          }
        });
        base[n] = s;
      });

      // dónde queda la cadera al arrancar cada animación (para centrar al personaje sobre su muñeco o su silla)
      const offsets = {};
      (function () {
        const probe = THREE.SkeletonUtils.clone(base.jugador);
        probe.scale.setScalar(base.jugador.userData.k);
        const hips = findBone(probe, 'Hips'), v = new THREE.Vector3(), mixer = new THREE.AnimationMixer(probe);
        Object.keys(clips).forEach((name) => {
          mixer.stopAllAction();
          mixer.clipAction(clips[name]).reset().play();
          mixer.update(0);
          probe.updateMatrixWorld(true);
          hips.getWorldPosition(v);
          offsets[name] = v.clone();
        });
        mixer.stopAllAction();
        mixer.uncacheRoot(probe);
      })();

      // a quién le toca cada personaje
      const pools = { cancha: ['jugador', 'jugadora', 'veterano', 'jugadora', 'jugador', 'veterano', 'jugadora', 'jugador'], mesa: ['clienta', 'cliente', 'veterano', 'jugadora', 'jugador'], banco: ['jugador', 'jugadora', 'veterano', 'jugadora'], calle: ['cliente', 'clienta'] };
      const idx = { cancha: 0, mesa: 0, banco: 0, calle: 0 };
      const pick = (pool) => pools[pool][idx[pool]++ % pools[pool].length];
      const racket = makeRacket();

      const crowd = proxies.map((proxy, i) => {
        const ud = proxy.userData, p = proxy.position;
        const seated = ud.legL.rotation.x < -0.8;
        const onCourt = !seated && Math.abs(p.x) < 12.2 && p.z < 4.4 && p.z > -16.6;
        const street = p.x < -20;
        const staff = ud.act === 'serve' || ud.act === 'reception';
        const name = staff ? 'bartender' : onCourt ? pick('cancha') : street ? pick('calle') : seated ? pick(p.z < 7 ? 'banco' : 'mesa') : pick('mesa');
        const holder = new THREE.Group(), m = THREE.SkeletonUtils.clone(base[name]);
        m.scale.setScalar(base[name].userData.k);
        holder.add(m);
        scene.add(holder);
        const mixer = new THREE.AnimationMixer(m);
        let seatClip = null;
        if (seated) {
          seatClip = ud.act === 'drink' ? 'Sit_and_Drink' : p.z < 7 && i % 2 ? 'Sitting_Clap' : FEMALE[name] ? 'Chair_Sit_Idle_F' : 'Chair_Sit_Idle_M';
        }
        const c = { proxy, holder, m, mixer, name, seated, seatClip, onCourt, cur: null, act: null, last: p.clone(), spd: 0, arm: findBone(m, 'RightArm'), hand: findBone(m, 'RightHand') };
        if (onCourt && c.hand) attachRacket(c, racket);
        proxy.visible = false;
        return c;
      });

      const play = (c, clip) => {
        if (c.cur === clip || !clips[clip]) return;
        const a = c.mixer.clipAction(clips[clip]);
        a.reset().fadeIn(c.cur ? 0.25 : 0).play();
        if (!c.cur) a.time = Math.random() * clips[clip].duration;
        if (c.act) c.act.fadeOut(0.25);
        c.cur = clip; c.act = a;
        // centra la cadera: sobre la silla si está sentado, sobre el muñeco si está parado
        const o = offsets[clip] || new THREE.Vector3();
        c.m.position.set(-o.x, c.seated ? Math.max(0, 0.5 - o.y) : 0, -o.z);
      };

      const q = new THREE.Quaternion(), qp = new THREE.Quaternion(), axis = new THREE.Vector3();
      onFrame((dt) => {
        if (!dt) return;
        crowd.forEach((c) => {
          const p = c.proxy.position, ud = c.proxy.userData;
          const d = Math.hypot(p.x - c.last.x, p.z - c.last.z);
          if (d < 2) c.spd += (d / dt - c.spd) * Math.min(1, dt * 8);
          c.last.copy(p);
          let clip;
          if (c.seated) clip = c.seatClip;
          else if (c.onCourt && ud.arm && ud.arm.rotation.x < -2.0) clip = 'Victory_Fist_Pump';
          else if (c.spd > 2.4) clip = 'Running';
          else if (c.spd > 0.35) clip = 'Walking';
          else clip = ud.act === 'drink' ? 'Stand_and_Drink' : ud.act === 'talk' ? 'Stand_and_Chat' : 'Idle_4';
          play(c, clip);
          c.holder.position.set(p.x, 0, p.z);
          c.holder.quaternion.copy(c.proxy.quaternion);
          c.mixer.update(dt);
          // golpe de pádel: el brazo derecho acompaña el swing del muñeco
          if (c.onCourt && c.arm && ud.arm && clip !== 'Victory_Fist_Pump') {
            const swing = THREE.MathUtils.clamp(ud.arm.rotation.x + 0.75, -1.6, 2.2);
            if (Math.abs(swing) > 0.05) {
              c.holder.updateMatrixWorld(true);
              axis.set(1, 0, 0).applyQuaternion(c.holder.quaternion);
              q.setFromAxisAngle(axis, -swing * 0.9);
              c.arm.parent.getWorldQuaternion(qp);
              c.arm.quaternion.premultiply(qp.clone().invert().multiply(q).multiply(qp));
            }
          }
          c.holder.updateMatrixWorld(true);
        });
      });
    }

    function findBone(root, suffix) {
      let found = null;
      root.traverse((o) => { if (!found && o.isBone && o.name.replace(/^mixamorig:?/, '') === suffix) found = o; });
      return found;
    }

    function makeRacket() {
      const g = new THREE.Group();
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 24), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.4 }));
      head.rotation.x = Math.PI / 2; head.position.y = 0.32; g.add(head);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 24), new THREE.MeshStandardMaterial({ color: 0xf26a1b, roughness: 0.4 }));
      rim.position.y = 0.32; g.add(rim);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      handle.position.y = 0.09; g.add(handle);
      return g;
    }
    function attachRacket(c, proto) {
      const r = proto.clone();
      c.hand.add(r);
      c.m.updateMatrixWorld(true);
      const s = new THREE.Vector3();
      c.hand.getWorldScale(s);
      r.scale.setScalar(1 / Math.max(1e-4, s.x));
      r.traverse((o) => { if (o.isMesh) o.castShadow = !mobile; });
    }
  }

  window.MuzzagaGente = { install };
})();
