/* Muzzaga · distribución real del frente del club, armada con fotos del lugar.
   Piso de epoxi gris, columnas azules, barra con techito colgado y LED azul, cocina detrás de la barra,
   baños de hombres y mujeres (cada uno con sus duchas) al lado de la cocina, y mesas con sillas negras en lugar del living.
   Coordenadas: x de -14 (pared de la entrada) a 14, z de 4.2 (frente de las canchas) a 18 (pared del frente). */
(function () {
  function install(ctx) {
    const { THREE, scene, std, box, plane, ctex, W, IMG, DS, solid, wood, person } = ctx;
    const tx = ctx.itex || (() => null); // texturas de foto (Google Flow); null si no cargaron
    const mobile = innerWidth < 860;
    const merge = (geos) => THREE.BufferGeometryUtils.mergeBufferGeometries(geos);
    const mesh = (geo, mat, x, y, z, parent) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      (parent || scene).add(m);
      return m;
    };
    const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg || 12);
    const glowOf = (r, g, b) => { const m = new THREE.MeshBasicMaterial({ toneMapped: false }); m.color.setRGB(r, g, b); return m; };
    const rand = (function (a) {
      return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })(1987);

    /* ---- materiales sacados de las fotos ---- */
    const yesoT = tx('yeso-oscuro', 0.5, 0.5), aceroT = tx('acero', 1, 1), nogalT = tx('nogal', 1, 1), puertaT = tx('madera-puerta', 1, 1);
    const charcoal = yesoT ? std(0xffffff, { map: yesoT, roughness: 0.92 }) : std(0x26282d, { roughness: 0.92 });          // bloques de cocina y baños por fuera
    const blackMetal = std(0x121317, { metalness: 0.55, roughness: 0.42 });
    const navy = std(0x1d2c6b, { metalness: 0.5, roughness: 0.45 }); // columnas reticuladas
    const steel = aceroT ? std(0xffffff, { map: aceroT, metalness: 0.85, roughness: 0.3 }) : std(0xb8bdc4, { metalness: 0.85, roughness: 0.3 });
    const darkWood = nogalT ? std(0xffffff, { map: nogalT, roughness: 0.38 }) : std(0x3b281b, { roughness: 0.38 });
    const doorWood = puertaT ? std(0xffffff, { map: puertaT, roughness: 0.55 }) : std(0x8a6340, { roughness: 0.55 });
    const white = std(0xf2f0ec, { roughness: 0.25 });
    const ledWarm = glowOf(2.2, 1.55, 0.75);
    const ledBlue = glowOf(0.35, 0.6, 2.6);

    // porcelanato beige tipo mármol (baños) y cerámica blanca (cocina y piso de baños)
    const tileTex = (base, vein, grout, n) => ctex(512, 512, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let i = 0; i < n; i++) {
        g.strokeStyle = vein; g.lineWidth = 0.6 + rand() * 1.4; g.globalAlpha = 0.25 + rand() * 0.35;
        g.beginPath(); let x = rand() * w, y = rand() * h; g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (rand() - 0.3) * 90; y += (rand() - 0.5) * 70; g.lineTo(x, y); }
        g.stroke();
      }
      g.globalAlpha = 1; g.fillStyle = grout;
      for (let k = 0; k <= 2; k++) { g.fillRect(k * 256 - 2, 0, 4, h); g.fillRect(0, k * 256 - 2, w, 4); }
    }, 1, 1);
    const beigeTex = tileTex('#d8cbb2', '#fbf6ec', 'rgba(150,135,110,.7)', 26);
    const floorTex = tileTex('#d9d9d4', '#ffffff', 'rgba(140,140,135,.55)', 8);
    const beige = std(0xffffff, { map: tx('porcelanato-beige', 1, 1) || beigeTex, roughness: 0.22 });
    const floorTile = std(0xffffff, { map: tx('porcelanato-gris', 1, 1) || floorTex, roughness: 0.3 });
    // las baldosas miden 0,6 m: la textura (2 × 2 baldosas) se repite cada 1,2 m en coordenadas del mundo
    function worldUV(geo, ox, oy, oz) {
      const p = geo.attributes.position, uv = geo.attributes.uv, n = geo.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + ox, y = p.getY(i) + oy, z = p.getZ(i) + oz;
        const ny = Math.abs(n.getY(i)) > 0.5, nx = Math.abs(n.getX(i)) > 0.5;
        uv.setXY(i, (ny || !nx ? x : z) / 1.2, (ny ? z : y) / 1.2);
      }
      uv.needsUpdate = true;
      return geo;
    }

    /* ---- piso de epoxi gris con vetas claras y reflejo (reemplaza la madera) ---- */
    (function () {
      const S = mobile ? 1024 : 2048;
      const tex = tx('epoxi', 27.7 / 3, 13.8 / 3) || ctex(S, S / 2, (g, w, h) => {
        g.fillStyle = '#80858b'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 260; i++) {
          const x = rand() * w, y = rand() * h, r = (30 + rand() * 160) * (w / 2048);
          const light = rand() < 0.55, gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, light ? 'rgba(185,190,196,.22)' : 'rgba(70,74,80,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        // marcas de uso: trazos claros y finos como en las fotos
        for (let i = 0; i < 70; i++) {
          g.strokeStyle = 'rgba(205,210,214,' + (0.03 + rand() * 0.07) + ')'; g.lineWidth = (2 + rand() * 4) * (w / 2048);
          g.beginPath(); let x = rand() * w, y = rand() * h; g.moveTo(x, y);
          for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 140 * (w / 2048); y += (rand() - 0.5) * 60 * (w / 2048); g.quadraticCurveTo(x + 20, y - 10, x, y); }
          g.stroke();
        }
      });
      tex.anisotropy = 8;
      const m = wood.material;
      m.map = tex; m.bumpMap = null; m.color.set(0xffffff);
      m.roughness = 0.24; m.metalness = 0.05; m.envMapIntensity = 0.9; m.needsUpdate = true;
    })();

    /* ---- columnas reticuladas azules entre el pasillo y las mesas ---- */
    (function () {
      const H = 6.0, parts = [];
      [-0.17, 0.17].forEach((dx) => parts.push(new THREE.BoxGeometry(0.11, H, 0.11).translate(dx, H / 2, 0)));
      for (let y = 0.5; y < H; y += 0.55) parts.push(new THREE.BoxGeometry(0.34, 0.07, 0.07).translate(0, y, 0));
      const geo = merge(parts);
      [-10.6, -4.2, 4.6].forEach((x) => { mesh(geo, navy, x, 0, 6.85); solid(x - 0.25, x + 0.25, 6.75, 6.95); });
    })();

    /* ---- muros: segmento recto con una cara de adentro y otra de afuera ---- */
    // a lo largo de x (z fijo) o de z (x fijo); `inside` = signo del lado de adentro (+1 o -1)
    function wall(x1, z1, x2, z2, h, inMat, outMat, inside, y0) {
      const alongX = z1 === z2, len = alongX ? x2 - x1 : z2 - z1, t = 0.15, y = (y0 || 0) + h / 2;
      const cx = alongX ? (x1 + x2) / 2 : x1, cz = alongX ? z1 : (z1 + z2) / 2;
      const geo = worldUV(new THREE.BoxGeometry(alongX ? len : t, h, alongX ? t : len), cx, y, cz);
      const mats = [outMat, outMat, charcoal, outMat, outMat, outMat];
      if (alongX) mats[inside > 0 ? 4 : 5] = inMat; else mats[inside > 0 ? 0 : 1] = inMat;
      const m = new THREE.Mesh(geo, mats); m.position.set(cx, y, cz); scene.add(m);
      if (!y0) { if (alongX) solid(x1, x2, z1 - t, z1 + t); else solid(x1 - t, x1 + t, z1, z2); }
      return m;
    }
    // revestimiento sobre las paredes del galpón (se baja junto con la pared cuando la cámara la mira)
    function lining(w, h, x, y, z, ry, mat, parent) {
      const geo = new THREE.PlaneGeometry(w, h);
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 100) / 1.2, (p.getY(i) + y) / 1.2);
      const m = mesh(geo, mat, x, y, z, parent); m.rotation.y = ry; m.userData.noCast = true;
      return m;
    }
    // caja revestida con baldosas del tamaño real
    const tileBox = (w, h, d, x, y, z, mat, o) => { const m = mesh(worldUV(new THREE.BoxGeometry(w, h, d), x, y, z), mat, x, y, z); if (o && o.solid) solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2); return m; };
    function door(x, z, ry, open) {
      const piv = new THREE.Group(); piv.position.set(x, 0, z); piv.rotation.y = ry + (open || 0); scene.add(piv);
      mesh(new THREE.BoxGeometry(0.9, 2.15, 0.045), doorWood, 0.45, 1.08, 0, piv);
      mesh(new THREE.BoxGeometry(0.12, 0.03, 0.06), steel, 0.8, 1.02, 0.04, piv);
      return piv;
    }
    function panelSign(text, w, x, y, z, ry) {
      const tex = ctex(512, 140, (g, cw, ch) => {
        g.fillStyle = '#12151b'; g.fillRect(0, 0, cw, ch); g.fillStyle = '#f26a1b'; g.fillRect(0, ch - 10, cw, 10);
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '92px "Bebas Neue",Impact,sans-serif'; g.fillText(text, cw / 2, ch * 0.7);
      });
      const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); m.color.setScalar(1.1);
      const s = plane(w, w * 140 / 512, x, y, z, ry, m);
      return s;
    }

    /* ======== cocina: bloque oscuro detrás de la barra, abierto arriba para verla desde la maqueta ======== */
    const KX1 = -4, KX2 = 5, KZ = 15.2, KH = 3.2;
    const kitchenTile = std(0xffffff, { map: tx('porcelanato-gris', 1, 1) || floorTex, roughness: 0.25 });
    wall(KX1, KZ, 3.55, KZ, KH, kitchenTile, charcoal, 1);
    wall(4.45, KZ, KX2, KZ, KH, kitchenTile, charcoal, 1);
    wall(3.55, KZ, 4.45, KZ, KH - 2.25, kitchenTile, charcoal, 1, 2.25);  // dintel de la puerta
    wall(KX1, KZ, KX1, 17.85, KH, kitchenTile, charcoal, 1);
    lining(8.9, KH, 0.5, KH / 2, 17.76, Math.PI, kitchenTile, W.front);
    const kf = mesh(worldUV(new THREE.BoxGeometry(8.9, 0.02, 2.55), 0.5, 0.02, 16.55), floorTile, 0.5, 0.02, 16.55);
    kf.userData.noCast = true;
    door(3.55, KZ - 0.03, 0, -0.55);   // detrás de la barra, del lado de los baños
    // mesada de acero, anafe con campana, isla de trabajo y horno de pizza
    box(5.6, 0.9, 0.65, -0.8, 0.45, 17.45, steel, { solid: true });
    box(5.6, 0.04, 0.7, -0.8, 0.92, 17.43, std(0xdfe3e8, { metalness: 0.9, roughness: 0.22 }));
    [[1.05, 17.3], [1.45, 17.3], [1.05, 17.6], [1.45, 17.6]].forEach(([x, z]) => mesh(cyl(0.11, 0.11, 0.03, 16), blackMetal, x, 0.95, z));
    box(1.3, 0.45, 0.75, 1.25, 2.25, 17.4, steel); box(0.3, 0.9, 0.3, 1.25, 2.9, 17.6, steel);
    box(2.3, 0.88, 0.7, -0.9, 0.44, 16.15, steel, { solid: true });
    box(2.35, 0.04, 0.74, -0.9, 0.9, 16.15, std(0xdfe3e8, { metalness: 0.9, roughness: 0.22 }));
    box(1.7, 0.8, 1.4, 3.75, 0.4, 16.95, std(0x8c4a33, { roughness: 0.85 }), { solid: true });
    const dome = mesh(new THREE.SphereGeometry(0.82, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0xa9583c, { roughness: 0.9 }), 3.75, 0.8, 16.95);
    dome.castShadow = true;
    box(0.5, 0.32, 0.06, 3.75, 0.95, 16.22, std(0xff7a1a, { emissive: 0xff6a00, emissiveIntensity: 1.6 }));
    box(0.7, 1.9, 0.65, -3.45, 0.95, 17.4, std(0xe8eaec, { metalness: 0.6, roughness: 0.3 }), { solid: true }); // heladera de la cocina

    /* ======== barra: mostrador negro con LED azul, banquetas y techito colgado ======== */
    const BZ = 13.4, BX1 = -3.2, BX2 = 3.8, bw = BX2 - BX1, bcx = (BX1 + BX2) / 2;
    box(bw, 1.04, 0.8, bcx, 0.52, BZ, blackMetal, { solid: true });
    box(bw + 0.2, 0.05, 0.95, bcx, 1.07, BZ - 0.05, darkWood);
    box(bw, 0.025, 0.03, bcx, 1.02, BZ - 0.43, ledBlue);   // tira LED bajo el canto
    box(bw, 0.025, 0.03, bcx, 0.04, BZ - 0.43, ledBlue);   // y al pie del mostrador
    // vuelta de la barra hasta la pared de la cocina, del lado de las mesas
    const RZ1 = BZ + 0.4, RZ2 = KZ - 0.08, rcx = BX1 + 0.4;
    box(0.8, 1.04, RZ2 - RZ1, rcx, 0.52, (RZ1 + RZ2) / 2, blackMetal, { solid: true });
    box(0.95, 0.05, RZ2 - RZ1 + 0.05, rcx - 0.05, 1.07, (RZ1 + RZ2) / 2 - 0.02, darkWood);
    [1.02, 0.04].forEach((y) => box(0.03, 0.025, RZ2 - RZ1, BX1 - 0.03, y, (RZ1 + RZ2) / 2, ledBlue));
    // reflejo azul en el piso, como en la foto
    const washTex = ctex(16, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(70,110,255,.9)'); gr.addColorStop(1, 'rgba(70,110,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const wash = mesh(new THREE.PlaneGeometry(bw + 0.6, 2.2), new THREE.MeshBasicMaterial({ map: washTex, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), bcx, 0.045, BZ - 1.5);
    wash.rotation.x = -Math.PI / 2; wash.rotation.z = Math.PI; wash.userData.noCast = true;
    // placa en el frente del mostrador
    const plaque = ctex(512, 80, (g, w, h) => { g.fillStyle = '#12151b'; g.fillRect(0, 0, w, h); g.fillStyle = '#f26a1b'; g.fillRect(0, h - 5, w, 5); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '56px "Bebas Neue",Impact,sans-serif'; g.fillText('MUZZAGA · CANTINA', w / 2, 58); });
    plane(2.4, 0.375, bcx, 0.62, BZ - 0.415, Math.PI, new THREE.MeshBasicMaterial({ map: plaque, toneMapped: false }));
    // banquetas altas de metal negro
    (function () {
      const parts = [cyl(0.17, 0.17, 0.04, 18).translate(0, 0.76, 0), new THREE.TorusGeometry(0.15, 0.012, 6, 18).rotateX(Math.PI / 2).translate(0, 0.28, 0)];
      [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(([x, z]) => parts.push(cyl(0.013, 0.013, 0.76, 6).translate(x, 0.38, z)));
      const geo = merge(parts), xs = [-2.5, -1.4, -0.3, 0.8], inst = new THREE.InstancedMesh(geo, blackMetal, xs.length), o = new THREE.Object3D();
      xs.forEach((x, i) => { o.position.set(x, 0, BZ - 0.95); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); solid(x - 0.2, x + 0.2, BZ - 1.15, BZ - 0.75); });
      scene.add(inst);
    })();
    // techito: placa oscura colgada de las vigas, con lámparas colgantes
    const CY = 3.3;
    box(8.4, 0.22, 2.75, 0.6, CY + 0.11, 13.85, blackMetal);
    box(8.44, 0.04, 0.04, 0.6, CY + 0.02, 12.48, ledWarm);
    [[-3.3, 12.75], [4.5, 12.75], [-3.3, 14.95], [4.5, 14.95]].forEach(([x, z]) => mesh(cyl(0.012, 0.012, 2.6, 6), blackMetal, x, CY + 1.52, z));
    [-1.7, 0.6, 2.9].forEach((x) => {
      mesh(cyl(0.006, 0.006, 0.55, 6), blackMetal, x, CY - 0.27, 13.3);
      const s = mesh(cyl(0.09, 0.24, 0.2, 22, 1), std(0x1a1c21, { metalness: 0.7, roughness: 0.35, side: DS }), x, CY - 0.6, 13.3);
      s.userData.noCast = true;
      mesh(new THREE.SphereGeometry(0.07, 12, 10), ledWarm, x, CY - 0.67, 13.3);
    });
    [-0.6, 2.2].forEach((x) => { const l = new THREE.PointLight(0xffb468, 0.9, 8, 2); l.position.set(x, 2.5, 13.4); scene.add(l); });
    // letrero luminoso arriba del techito
    const neon = ctex(512, 160, (g, w, h) => { g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.fillStyle = '#ff7a2a'; g.font = '130px "Bebas Neue",Impact,sans-serif'; g.fillText('CANTINA', w / 2, 122); });
    const nm = new THREE.MeshBasicMaterial({ map: neon, transparent: true, alphaTest: 0.3, toneMapped: false, side: DS }); nm.color.setScalar(2.4);
    plane(2.2, 0.69, 0.6, CY + 0.6, 12.6, Math.PI, nm); box(2.4, 0.8, 0.04, 0.6, CY + 0.6, 12.64, blackMetal);

    /* ---- cosas sobre la barra: vitrina, terminal de cobro y cafetera ---- */
    (function () {
      const top = 1.095;
      const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false });
      const dg = new THREE.Group(); dg.position.set(-2.2, top, BZ + 0.05); scene.add(dg);
      mesh(new THREE.BoxGeometry(1.0, 0.4, 0.44), glass, 0, 0.22, 0, dg);
      mesh(new THREE.BoxGeometry(1.04, 0.03, 0.48), blackMetal, 0, 0.015, 0, dg);
      mesh(new THREE.BoxGeometry(0.96, 0.02, 0.4), ledWarm, 0, 0.41, 0, dg);
      const pastry = [0xd79a45, 0xb9742f, 0xe6b45e];
      for (let i = 0; i < 9; i++) mesh(i % 2 ? new THREE.SphereGeometry(0.06, 10, 8) : cyl(0.06, 0.07, 0.05, 12), std(pastry[i % 3], { roughness: 0.55 }), -0.38 + (i % 5) * 0.19, 0.075 + (i > 4 ? 0.16 : 0), i > 4 ? 0.08 : -0.08, dg);
      const tab = new THREE.Group(); tab.position.set(1.7, top, BZ - 0.2); tab.rotation.y = Math.PI; scene.add(tab);
      mesh(cyl(0.035, 0.05, 0.2, 10), blackMetal, 0, 0.1, 0, tab);
      const scr = mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshBasicMaterial({ map: ctx.textTex([{ t: 'MUZZAGA', s: 70, c: '#f26a1b' }, { t: 'Turnos y cantina', s: 30, f: 'Poppins,sans-serif', c: '#fff' }], 300, 200, { bg: '#0e1116' }), toneMapped: false }), 0, 0.28, 0, tab);
      scr.rotation.x = -0.35;
      const cm = new THREE.Group(); cm.position.set(3.1, top, BZ + 0.1); scene.add(cm);
      mesh(new THREE.BoxGeometry(0.64, 0.42, 0.42), steel, 0, 0.21, 0, cm);
      mesh(new THREE.BoxGeometry(0.66, 0.03, 0.44), std(0xb9893f, { metalness: 0.9, roughness: 0.28 }), 0, 0.435, 0, cm);
      [-0.16, 0.16].forEach((x) => mesh(cyl(0.045, 0.045, 0.06), blackMetal, x, 0.3, 0.2, cm));
    })();

    /* ---- contrabarra: heladeras exhibidoras, estante con productos, tele y trofeos ---- */
    (function () {
      const fz = 14.8, cols = [0x2f8f4e, 0xd8b030, 0x3e72d9, 0xe0e0e0, 0xd9534f, 0x6b3a1a];
      const xs = [-1.1, -0.2];
      xs.forEach((x) => {
        box(0.84, 1.9, 0.6, x, 0.95, fz, std(0xeef0f2, { metalness: 0.4, roughness: 0.3 }), { solid: true });
        box(0.8, 1.7, 0.02, x, 1.0, fz - 0.31, std(0x0d0f12, { roughness: 0.2 }));
        box(0.8, 0.05, 0.03, x, 1.86, fz - 0.32, ledWarm);
      });
      const inst = new THREE.InstancedMesh(cyl(0.045, 0.05, 0.28, 10), std(0xffffff, { roughness: 0.25, metalness: 0.1 }), 36), o = new THREE.Object3D(), c = new THREE.Color();
      let n = 0;
      xs.forEach((x) => [0.45, 0.95, 1.45].forEach((y) => { for (let i = 0; i < 6; i++) { o.position.set(x - 0.34 + i * 0.136, y, fz - 0.36); o.updateMatrix(); inst.setMatrixAt(n, o.matrix); inst.setColorAt(n++, c.setHex(cols[(i + (y > 1 ? 2 : 0)) % cols.length])); } }));
      scene.add(inst);
      const door = new THREE.MeshStandardMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.18, roughness: 0.04, depthWrite: false });
      xs.forEach((x) => mesh(new THREE.PlaneGeometry(0.8, 1.7), door, x, 1.0, fz - 0.42).rotation.y = Math.PI);
      // heladera chica de gaseosas y estante con productos (como en la foto)
      box(0.6, 1.25, 0.55, 0.75, 0.625, fz + 0.02, std(0xf4f6f8, { roughness: 0.3 }), { solid: true });
      box(0.54, 0.9, 0.02, 0.75, 0.7, fz - 0.26, std(0x7fd0a0, { emissive: 0x2a7a50, emissiveIntensity: 0.5, roughness: 0.2 }));
      box(1.3, 1.62, 0.04, 1.9, 0.81, fz + 0.28, blackMetal);
      [1.26, 2.54].forEach((x) => box(0.03, 1.62, 0.4, x, 0.81, fz + 0.1, blackMetal));
      [0.525, 0.945, 1.365, 1.62].forEach((y) => box(1.3, 0.03, 0.4, 1.9, y, fz + 0.1, blackMetal));
      solid(1.25, 2.55, fz - 0.1, fz + 0.3);
      const goods = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), std(0xffffff, { roughness: 0.5 }), 30), gc = [0xd9534f, 0xf4f4f4, 0xd8b030, 0x3e72d9, 0xf26a1b];
      for (let i = 0; i < 30; i++) { o.position.set(1.36 + (i % 10) * 0.12, 0.62 + Math.floor(i / 10) * 0.42, fz + 0.1); o.updateMatrix(); goods.setMatrixAt(i, o.matrix); goods.setColorAt(i, c.setHex(gc[(i * 7) % 5])); }
      scene.add(goods);
      // matafuegos
      mesh(cyl(0.09, 0.09, 0.5, 12), std(0xc62828, { roughness: 0.4 }), 2.75, 0.85, fz + 0.15);
      // tele de la marca, a la izquierda de la barra
      const tv = ctex(512, 288, (g, w, h) => {
        g.fillStyle = '#0b0d12'; g.fillRect(0, 0, w, h); g.fillStyle = '#f26a1b'; g.fillRect(0, h - 10, w, 10);
        if (IMG.badge && IMG.badge.naturalWidth) g.drawImage(IMG.badge, 36, 54, 150, 150);
        g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = '86px "Bebas Neue",Impact,sans-serif'; g.fillText('MUZZAGA', 212, 130);
        g.fillStyle = '#f26a1b'; g.font = '56px "Bebas Neue",Impact,sans-serif'; g.fillText('PÁDEL', 212, 184);
        g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '500 24px Poppins,sans-serif'; g.fillText('Turnos · Torneos · Cantina', 212, 226);
      });
      box(1.2, 0.72, 0.06, -2.2, 1.95, KZ - 0.11, blackMetal);
      const tvm = new THREE.MeshBasicMaterial({ map: tv, toneMapped: false }); tvm.color.setScalar(1.1);
      plane(1.12, 0.63, -2.2, 1.95, KZ - 0.145, Math.PI, tvm);
      // trofeos arriba de las heladeras
      const gold = std(0xe0b030, { metalness: 0.75, roughness: 0.28 });
      [-1.3, -0.65, 0.0].forEach((x, i) => { mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), blackMetal, x, 1.93, fz); mesh(cyl(0.02, 0.02, 0.16), gold, x, 2.04, fz); mesh(cyl(0.11 - i * 0.01, 0.05, 0.2, 14), gold, x, 2.22, fz); });
    })();

    /* ---- carta en la pared de la cocina que mira a las mesas ---- */
    (function () {
      const food = [['Pizza muzza', '$18.000'], ['Pizza napo', '$20.000'], ['Tostados', '$14.000'], ['Empanada', '$2.000']];
      const drinks = ['Cerveza bien fría', 'Gaseosas', 'Café y té'];
      const menu = ctex(1024, 480, (g, w, h) => {
        g.fillStyle = '#12151b'; g.fillRect(0, 0, w, h); g.fillStyle = '#f26a1b'; g.fillRect(0, 0, w, 140);
        g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = '104px "Bebas Neue",Impact,sans-serif'; g.fillText('LA CARTA', 44, 108);
        g.textAlign = 'right'; g.font = '600 30px Poppins,sans-serif'; g.fillText('CANTINA · MUZZAGA PÁDEL', w - 44, 84);
        const col = (x, title, rows, price) => {
          g.textAlign = 'left'; g.fillStyle = '#f26a1b'; g.font = '52px "Bebas Neue",Impact,sans-serif'; g.fillText(title, x, 208);
          rows.forEach((r, i) => {
            const y = 262 + i * 56; g.fillStyle = '#fff'; g.font = '500 34px Poppins,sans-serif'; g.textAlign = 'left'; g.fillText(price ? r[0] : r, x, y);
            if (price) { g.textAlign = 'right'; g.fillStyle = '#f26a1b'; g.font = '600 34px Poppins,sans-serif'; g.fillText(r[1], x + 420, y); }
            g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, y + 14, 420, 2);
          });
        };
        col(44, 'COMIDA', food, true); col(548, 'BEBIDAS', drinks, false);
        g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'right'; g.font = '500 26px Poppins,sans-serif'; g.fillText('Opciones sin TACC · pedí en la barra', w - 44, 452);
      });
      const mm = new THREE.MeshBasicMaterial({ map: menu, toneMapped: false }); mm.color.setScalar(1.15);
      plane(2.3, 1.08, KX1 - 0.085, 1.95, 16.55, -Math.PI / 2, mm);
      box(0.04, 1.18, 2.4, KX1 - 0.1, 1.95, 16.55, blackMetal);
    })();

    /* ======== baños: pasillito de entrada con una pared enfrente; a la izquierda hombres, a la derecha mujeres ========
       (mirando desde las mesas: hombres hacia x 14, mujeres hacia la cocina). Cada baño tiene mesada con dos bachas,
       espejo ovalado, dos inodoros y dos duchas con cortina gris. Un baño es el reflejo del otro respecto de x = 9.5. */
    const BX0 = 5, BXE = 14, BZ0 = 11.5, BH = 3.0, MID = 9.5, VX1 = 7.6, VX2 = 11.4, VZ = 12.7, EX1 = 8.95, EX2 = 10.1;
    const paint = std(0x4d5361, { roughness: 0.85 });   // pintura gris azulada del pasillito (foto de la silueta)
    // frente: entrada central al pasillito
    wall(BX0, BZ0, VX1, BZ0, BH, beige, charcoal, 1);
    wall(VX1, BZ0, EX1, BZ0, BH, paint, charcoal, 1);
    wall(EX1, BZ0, EX2, BZ0, BH - 2.25, paint, charcoal, 1, 2.25);
    wall(EX2, BZ0, VX2, BZ0, BH, paint, charcoal, 1);
    wall(VX2, BZ0, BXE - 0.15, BZ0, BH, beige, charcoal, 1);
    // pared de enfrente del pasillito y las dos puertas de los costados
    wall(VX1, VZ, VX2, VZ, BH, beige, paint, 1);
    [VX1, VX2].forEach((x) => { wall(x, 12.5, x, VZ, BH, paint, beige, x === VX1 ? 1 : -1); wall(x, 11.6, x, 12.5, BH - 2.25, paint, beige, x === VX1 ? 1 : -1, 2.25); });
    // costado compartido con la cocina, tabique entre los dos baños y revestimiento de las paredes del galpón
    wall(BX0, BZ0, BX0, KZ, BH, beige, charcoal, 1);
    wall(BX0, KZ, BX0, 17.85, KH, beige, kitchenTile, 1);
    wall(MID, VZ, MID, 17.85, BH, beige, beige, 1);
    lining(BXE - BX0 - 0.2, BH, (BX0 + BXE) / 2, BH / 2, 17.76, Math.PI, beige, W.front);
    lining(17.85 - BZ0, BH, 13.76, BH / 2, (BZ0 + 17.85) / 2, -Math.PI / 2, beige, W.right);
    const bf = mesh(worldUV(new THREE.BoxGeometry(BXE - BX0 - 0.2, 0.02, 17.85 - BZ0), (BX0 + BXE) / 2, 0.02, (BZ0 + 17.85) / 2), floorTile, (BX0 + BXE) / 2, 0.02, (BZ0 + 17.85) / 2);
    bf.userData.noCast = true;
    panelSign('BAÑOS', 1.0, (EX1 + EX2) / 2, 2.62, BZ0 - 0.09, Math.PI);
    door(VX1, 11.6, -Math.PI / 2, -0.5);   // mujeres (la de hombres la anima premium-entrance.js)

    // siluetas negras con paleta en la pared de enfrente, como la de la foto
    function silhouette(female) {
      return ctex(256, 512, (g) => {
        g.clearRect(0, 0, 256, 512); g.fillStyle = '#0d0e11';
        g.beginPath(); g.arc(78, 60, 34, 0, 7); g.fill();                        // cabeza
        if (female) { g.beginPath(); g.ellipse(46, 74, 12, 30, 0.5, 0, 7); g.fill(); }   // colita
        g.fillRect(52, 100, 54, female ? 150 : 290);                            // torso (y piernas)
        if (female) {                                                           // pollera y piernas
          g.beginPath(); g.moveTo(54, 230); g.lineTo(118, 230); g.lineTo(134, 330); g.lineTo(36, 330); g.closePath(); g.fill();
          g.fillRect(56, 320, 18, 170); g.fillRect(84, 320, 18, 170);
        }
        g.save(); g.translate(100, 130); g.rotate(-0.42); g.fillRect(0, -11, 104, 22); g.restore();   // brazo
        g.beginPath(); g.arc(205, 72, 40, 0, 7); g.fill(); g.fillRect(176, 92, 14, 30);           // paleta
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(190 + (i % 4) * 10, 52 + Math.floor(i / 4) * 14, 3.4, 0, 7); g.fill(); }
        g.globalCompositeOperation = 'source-over';
      });
    }
    [[VX1 + 0.55, true], [VX2 - 0.55, false]].forEach(([x, female]) => {
      const m = new THREE.MeshBasicMaterial({ map: silhouette(female), transparent: true, alphaTest: 0.4 });
      const s = plane(0.75, 1.5, x, 1.5, VZ - 0.085, Math.PI, m);
      if (!female) s.scale.x = -1;   // el de hombres mira hacia su puerta
    });

    // interior de cada baño, armado para el de mujeres y reflejado para el de hombres
    const curtain = std(0x6c727c, { roughness: 0.75, side: DS });
    const benchWood = std(0x8a5a2e, { roughness: 0.5 });
    [1, -1].forEach((sd) => {
      const X = (x) => (sd > 0 ? x : 2 * MID - x), lo = (a, b) => Math.min(X(a), X(b)), hi = (a, b) => Math.max(X(a), X(b));
      const sol = (x1, x2, z1, z2) => solid(lo(x1, x2), hi(x1, x2), z1, z2);
      // mesada con dos bachas y espejo ovalado de madera
      box(0.55, 0.85, 2.2, X(5.35), 0.425, 13.4, std(0xe6ddcb, { roughness: 0.35 }));
      sol(5.05, 5.65, 12.3, 14.5);
      [12.85, 13.95].forEach((z) => {
        const b = mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), white, X(5.38), 0.92, z); b.scale.y = 0.45; b.rotation.x = Math.PI;
        mesh(cyl(0.015, 0.015, 0.16, 8), steel, X(5.18), 0.98, z);
      });
      [[new THREE.CircleGeometry(0.5, 32), std(0x9fb3c2, { metalness: 0.95, roughness: 0.05 }), 5.09], [new THREE.TorusGeometry(0.5, 0.035, 8, 36), std(0x8a4a22, { roughness: 0.4 }), 5.1]].forEach(([geo, mat, x]) => {
        const m = mesh(geo, mat, X(x), 1.65, 13.4); m.scale.set(1.3, 0.75, 1); m.rotation.y = sd * Math.PI / 2;
      });
      box(0.12, 0.34, 0.26, X(5.1), 1.45, 14.75, white);                   // toallero de papel
      mesh(cyl(0.16, 0.14, 0.5, 14), blackMetal, X(5.35), 0.25, 11.9);     // tacho
      // dos inodoros en cubículos con puerta de madera, contra la pared del fondo
      const SZ = 16.35;
      tileBox(0.06, BH, 17.85 - SZ, X(6.2), BH / 2, (SZ + 17.85) / 2, beige);
      // pared que separa la parte de los inodoros de la de las duchas (se pasa por adelante, al lado de la mesada)
      tileBox(0.1, BH, 17.85 - 13.65, X(7.25), BH / 2, (13.65 + 17.85) / 2, beige, { solid: true });
      [[5.15, 6.2], [6.2, 7.25]].forEach(([x1, x2], i) => {
        const cx = X((x1 + x2) / 2);
        tileBox(0.3, BH, 0.06, X(x1 + 0.15), BH / 2, SZ, beige);
        tileBox(0.75, BH - 2.05, 0.06, X(x2 - 0.375), (BH + 2.05) / 2, SZ, beige);   // sobre la puerta
        const d = new THREE.Group(); d.position.set(lo(x2 - 0.75, x2), 0, SZ); d.rotation.y = i === 0 ? 0.55 * sd : 0; scene.add(d);
        mesh(new THREE.BoxGeometry(0.73, 1.95, 0.04), doorWood, 0.365, 1.05, 0, d);
        mesh(cyl(0.16, 0.12, 0.38, 14), white, cx, 0.19, 17.45);
        mesh(cyl(0.2, 0.18, 0.06, 16), white, cx, 0.42, 17.42);
        box(0.4, 0.38, 0.18, cx, 0.62, 17.72, white);
        sol(x1, x2, SZ, 17.85);
      });
      // dos duchas separadas por una columna, con cortina gris recogida y alfombra
      tileBox(0.2, BH, 17.85 - SZ, X(8.37), BH / 2, (SZ + 17.85) / 2, beige, { solid: true });
      const sf = mesh(new THREE.PlaneGeometry(2.1, 17.8 - SZ), std(0xc9c9c4, { roughness: 0.5 }), X(8.37), 0.035, (SZ + 17.8) / 2);
      sf.rotation.x = -Math.PI / 2; sf.userData.noCast = true;
      [[7.82, -1], [8.93, 1]].forEach(([x, out]) => {
        mesh(cyl(0.012, 0.012, 1.0, 8), white, X(x), 2.2, SZ).rotation.z = Math.PI / 2;
        const g = new THREE.PlaneGeometry(0.4, 1.9, 10, 1), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 34) * 0.05);
        g.computeVertexNormals();
        mesh(g, curtain, X(x + out * 0.3), 1.22, SZ);
        mesh(cyl(0.012, 0.012, 1.0, 6), blackMetal, X(x), 1.6, 17.74);
        mesh(cyl(0.06, 0.03, 0.05, 12), blackMetal, X(x), 2.12, 17.7).rotation.x = Math.PI / 2.4;
        box(0.18, 0.05, 0.06, X(x), 1.15, 17.74, blackMetal);
        mesh(cyl(0.05, 0.05, 0.01, 12), steel, X(x), 0.045, 17.0);
        box(0.5, 0.015, 0.4, X(x), 0.045, SZ - 0.4, std(0xb08a5a, { roughness: 1 }));
      });
      // banco de madera contra el tabique
      box(0.4, 0.06, 2.2, X(9.2), 0.45, 14.7, benchWood);
      [13.75, 15.65].forEach((z) => box(0.34, 0.42, 0.06, X(9.2), 0.21, z, benchWood));
      sol(9.0, 9.45, 13.6, 15.8);
    });
    // una luz cálida para los dos baños (en celular se omite para no pasarse del límite de luces)
    if (!mobile) { const l = new THREE.PointLight(0xfff0d8, 0.7, 10, 2); l.position.set(MID, 2.7, 15); scene.add(l); }

    /* ======== mesas y sillas: tapa de madera oscura, estructura y sillas negras (como en la foto) ======== */
    const chairSpots = [];
    (function () {
      const topG = new THREE.BoxGeometry(1.2, 0.035, 0.75).translate(0, 0.75, 0);
      const fr = [];
      [[-0.57, -0.345], [0.57, -0.345], [-0.57, 0.345], [0.57, 0.345]].forEach(([x, z]) => fr.push(new THREE.BoxGeometry(0.03, 0.73, 0.03).translate(x, 0.365, z)));
      [-0.345, 0.345].forEach((z) => fr.push(new THREE.BoxGeometry(1.14, 0.05, 0.02).translate(0, 0.705, z)));
      [-0.57, 0.57].forEach((x) => fr.push(new THREE.BoxGeometry(0.02, 0.05, 0.69).translate(x, 0.705, 0)));
      const frameG = merge(fr);
      // silla apilable: mira hacia +z, respaldo atrás
      const ch = [new THREE.BoxGeometry(0.44, 0.04, 0.42).translate(0, 0.46, 0), new THREE.BoxGeometry(0.42, 0.22, 0.03).rotateX(-0.12).translate(0, 0.8, -0.2)];
      [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]].forEach(([x, z]) => ch.push(cyl(0.011, 0.011, 0.46, 6).translate(x, 0.23, z)));
      [-0.19, 0.19].forEach((x) => ch.push(cyl(0.011, 0.011, 0.42, 6).translate(x, 0.67, -0.2)));
      const chairG = merge(ch);
      const tables = [];
      [-12.2, -9.0, -5.8].forEach((x) => [8.8, 11.5, 14.2, 16.9].forEach((z) => tables.push([x, z])));
      [-2.3, 0.7, 3.7].forEach((x) => tables.push([x, 9.6]));
      const tops = new THREE.InstancedMesh(topG, darkWood, tables.length), frames = new THREE.InstancedMesh(frameG, blackMetal, tables.length);
      const chairs = new THREE.InstancedMesh(chairG, std(0x18191d, { roughness: 0.6 }), tables.length * 4), o = new THREE.Object3D();
      let n = 0;
      tables.forEach(([x, z], i) => {
        o.position.set(x, 0, z); o.rotation.set(0, (rand() - 0.5) * 0.04, 0); o.updateMatrix();
        tops.setMatrixAt(i, o.matrix); frames.setMatrixAt(i, o.matrix);
        [[-0.3, -1], [0.3, -1], [-0.3, 1], [0.3, 1]].forEach(([dx, sd]) => {
          const out = 0.58 + rand() * 0.12, ry = (sd < 0 ? 0 : Math.PI) + (rand() - 0.5) * 0.25;
          o.position.set(x + dx, 0, z + sd * out); o.rotation.set(0, ry, 0); o.updateMatrix(); chairs.setMatrixAt(n++, o.matrix);
          chairSpots.push({ x: x + dx, z: z + sd * out, ry });
        });
        solid(x - 0.62, x + 0.62, z - 0.85, z + 0.85);
      });
      scene.add(tops, frames, chairs);
    })();

    /* ---- gente: clientes en algunas mesas y en la barra (los personajes nuevos los reemplazan después) ---- */
    if (person) {
      const LOOKS = [
        { s: 0xf26a1b, k: 0xe4b48c, h: 0x2a1d14, o: {} }, { s: 0x2f6fd6, k: 0xc68a63, h: 0x111111, o: {} },
        { s: 0xffffff, k: 0xd9a47c, h: 0x5a3b22, o: { skirt: 0x2d3340, pony: true, band: 0xf26a1b } }, { s: 0x1f9d6b, k: 0x9a6a47, h: 0x111111, o: {} },
        { s: 0x3a3f4b, k: 0xe4b48c, h: 0xb08a4a, o: { skirt: 0xffffff } }, { s: 0xd9534f, k: 0xc68a63, h: 0x2a1d14, o: {} },
      ];
      let k = 0;
      const mk = (x, y, z, ry, act, seat) => {
        const L = LOOKS[k++ % LOOKS.length], p = person(L.s, L.k, undefined, L.h, undefined, L.o);
        p.position.set(x, y, z); p.rotation.y = ry; p.userData.act = act;
        if (seat) p.userData.legL.rotation.x = p.userData.legR.rotation.x = -1.5;
        scene.add(p); return p;
      };
      [0, 1, 9, 22, 23, 31, 41, 50, 53].forEach((i, j) => { const c = chairSpots[i]; if (c) mk(c.x, -0.34, c.z, c.ry, j % 2 ? 'talk' : 'drink', true); });
      mk(2.0, 0, 12.25, 0, 'talk'); mk(3.0, 0, 12.3, -0.3, 'drink');
    }
  }

  window.MuzzagaClub = { install };
})();
