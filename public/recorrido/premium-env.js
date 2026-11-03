/* Muzzaga · entorno de la maqueta (árboles, casas, autos, calle).
   Reemplaza las copas y volúmenes de prototipo por formas orgánicas y detalles de barrio,
   sin mover nada de lugar: cada árbol, casa y auto conserva su posición y escala. */
(function () {
  function install(ctx) {
    const { THREE, scene, std, movers } = ctx;
    const U = THREE.BufferGeometryUtils;
    const mat4 = (x, y, z, sx, sy, sz, ry) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0)),
        new THREE.Vector3(sx || 1, sy || 1, sz || 1),
      );
    const merge = (parts, parent) => {
      const by = new Map();
      parts.forEach((p) => {
        const g = p.geo.clone();
        g.applyMatrix4(p.m);
        if (!by.has(p.mat)) by.set(p.mat, []);
        by.get(p.mat).push(g);
      });
      by.forEach((gs, mat) => {
        const mesh = new THREE.Mesh(U.mergeBufferGeometries(gs), mat);
        parent.add(mesh);
        gs.forEach((g) => g.dispose());
      });
    };
    const blob = (r, seed) => {
      const g = new THREE.SphereGeometry(r, 14, 10),
        p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i),
          n =
            1 +
            0.09 * Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 + seed * 1.3) +
            0.05 * Math.sin(y * 4.3 + seed * 0.7);
        p.setXYZ(i, x * n, y * n, z * n);
      }
      g.computeVertexNormals();
      return g;
    };
    const leaf = (hex) =>
      std(hex, { roughness: 0.92, emissive: 0x1d3a0e, emissiveIntensity: 0.3 });
    const LEAF = [leaf(0x2f5a2c), leaf(0x4c8a35), leaf(0x7ab53f)];
    const bark = std(0x4b3a2c, { roughness: 0.95 });

    /* ---- árboles: copa redonda con volumen o álamo alto ---- */
    let n = 0;
    scene.children
      .filter((g) => g.isGroup)
      .forEach((g) => {
        const ico = g.children.filter(
          (c) => c.isMesh && c.geometry.type === "IcosahedronGeometry",
        );
        if (ico.length < 3) return;
        ico.forEach((c) => g.remove(c));
        const parts = [],
          seed = n++,
          poplar = seed % 3 === 2;
        const add = (r, x, y, z, tone, sx, sy, sz) =>
          parts.push({
            geo: blob(r, seed * 1.7 + parts.length),
            mat: LEAF[tone],
            m: mat4(x, y, z, sx, sy, sz),
          });
        if (poplar) {
          for (let i = 0; i < 6; i++) {
            const t = i / 5;
            add(
              0.8 - t * 0.35,
              Math.sin(i * 2.1) * 0.12,
              2.6 + i * 0.72,
              Math.cos(i * 1.7) * 0.12,
              t < 0.35 ? 0 : t < 0.75 ? 1 : 2,
              1,
              1.35,
              1,
            );
          }
        } else {
          for (let i = 0; i < 6; i++) {
            const a = i * 1.05 + seed;
            add(
              0.85 + (i % 2) * 0.15,
              Math.sin(a) * 0.95,
              2.75 + (i % 3) * 0.12,
              Math.cos(a) * 0.95,
              0,
              1,
              0.85,
              1,
            );
          }
          for (let i = 0; i < 4; i++) {
            const a = i * 1.6 + seed;
            add(
              0.8,
              Math.sin(a) * 0.55,
              3.55,
              Math.cos(a) * 0.55,
              1,
              1,
              0.9,
              1,
            );
          }
          add(0.72, 0.05, 4.2, 0, 2, 1, 0.9, 1);
          add(0.5, 0.7, 3.95, -0.2, 2, 1, 0.9, 1);
        }
        merge(parts, g);
        if (!poplar)
          [
            [0.3, 0.6],
            [-0.3, 2.2],
          ].forEach(([dx, rz]) => {
            const b = new THREE.Mesh(
              new THREE.CylinderGeometry(0.04, 0.07, 0.9, 6),
              bark,
            );
            b.position.set(dx, 2.5, 0);
            b.rotation.z = dx > 0 ? -0.7 : 0.7;
            g.add(b);
          });
      });

    /* ---- casas: puerta, chimenea, marcos, luz de porche, jardín y cerco vivo ---- */
    const door = std(0x4a3426, { roughness: 0.7 }),
      brick = std(0x8a4a38, { roughness: 0.95 }),
      trim = std(0xf1ece2, { roughness: 0.6 }),
      hedge = std(0x3f6b2f, { roughness: 1 }),
      lawn = std(0x4f6a35, { roughness: 1 }),
      stone = std(0xb9b4a8, { roughness: 0.9 });
    const lampMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    lampMat.color.setRGB(2.4, 1.7, 0.8);
    scene.children
      .filter((g) => g.isGroup)
      .forEach((g) => {
        const roof = g.children.find(
            (c) => c.isMesh && c.geometry.type === "ConeGeometry",
          ),
          boxes = g.children.filter(
            (c) => c.isMesh && c.geometry.type === "BoxGeometry",
          );
        if (!roof || !boxes.length) return;
        const body = boxes.reduce((a, b) =>
          a.geometry.parameters.width * a.geometry.parameters.depth >
          b.geometry.parameters.width * b.geometry.parameters.depth
            ? a
            : b,
        );
        const { width: w, height: h, depth: d } = body.geometry.parameters,
          parts = [],
          zf = d / 2;
      if (h < 2.5 || w < 6) return; // solo volúmenes del tamaño de una casa (no la máquina de café, que también tiene un cono)
        const P = (geo, mat, x, y, z) =>
          parts.push({ geo, mat, m: mat4(x, y, z) });
        P(new THREE.BoxGeometry(0.95, 2.0, 0.08), door, 0, 1.0, zf + 0.04);
        P(new THREE.BoxGeometry(1.15, 0.1, 0.14), trim, 0, 2.05, zf + 0.06);
        P(new THREE.BoxGeometry(1.4, 0.16, 0.7), stone, 0, 0.08, zf + 0.4);
        P(new THREE.SphereGeometry(0.09, 8, 6), lampMat, 0.85, 2.15, zf + 0.12);
        P(
          new THREE.BoxGeometry(0.55, 1.4, 0.55),
          brick,
          w * 0.22,
          h + 1.1,
          -d * 0.12,
        );
        P(
          new THREE.BoxGeometry(0.7, 0.1, 0.7),
          stone,
          w * 0.22,
          h + 1.85,
          -d * 0.12,
        );
        [-1, 1].forEach((k) => {
          P(
            new THREE.BoxGeometry(1.16, 1.28, 0.05),
            trim,
            k * w * 0.25,
            h * 0.55,
            zf + 0.005,
          );
          P(
            new THREE.BoxGeometry(1.3, 0.08, 0.14),
            trim,
            k * w * 0.25,
            h * 0.55 - 0.68,
            zf + 0.08,
          );
        });
        P(new THREE.BoxGeometry(w + 1.2, 0.7, 0.45), hedge, 0, 0.35, zf + 2.4);
        merge(parts, g);
        const yard = new THREE.Mesh(
          new THREE.PlaneGeometry(w + 6, d + 7),
          lawn,
        );
        yard.rotation.x = -Math.PI / 2;
        yard.position.set(0, 0.014, 1.2);
        yard.userData.noCast = true;
        g.add(yard);
      });

    /* ---- autos en movimiento: faros y luces traseras con resplandor y charco de luz ---- */
    const glowTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const x = c.getContext("2d"),
        gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,230,170,1)");
      gr.addColorStop(0.4, "rgba(255,190,100,.4)");
      gr.addColorStop(1, "rgba(255,170,60,0)");
      x.fillStyle = gr;
      x.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const spr = (r, g, b, k) =>
      new THREE.SpriteMaterial({
        map: glowTex,
        color: new THREE.Color(r * k, g * k, b * k),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        toneMapped: false,
      });
    const head = spr(1, 0.92, 0.72, 1.4),
      tail = spr(1, 0.12, 0.08, 1.1);
    const poolM = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: new THREE.Color(1.1, 0.95, 0.7),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
      opacity: 0.55,
    });
    (movers || [])
      .filter((g) => g.userData && g.userData.v && !g.userData.legL)
      .forEach((g) => {
        [-0.55, 0.55].forEach((x) => {
          const a = new THREE.Sprite(head);
          a.position.set(x, 0.72, 2.25);
          a.scale.setScalar(0.9);
          g.add(a);
          const b = new THREE.Sprite(tail);
          b.position.set(x, 0.72, -2.25);
          b.scale.setScalar(0.6);
          g.add(b);
        });
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.2), poolM);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(0, 0.035, 4.2);
        g.add(pool);
      });

    /* ---- calle: cebra, línea de frenado y alcantarilla ---- */
    const paint = std(0xe9e6dc, { roughness: 0.8 }),
      zebra = [];
    for (let i = 0; i < 8; i++)
      zebra.push({
        geo: new THREE.BoxGeometry(0.5, 0.012, 3.2),
        mat: paint,
        m: mat4(-31.9 + i * 0.9, 0.024, 22),
      });
    zebra.push({
      geo: new THREE.BoxGeometry(6.6, 0.012, 0.3),
      mat: paint,
      m: mat4(-28.6, 0.024, 19.9),
    });
    merge(zebra, scene);
    const mh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.02, 20),
      std(0x2a2b2f, { metalness: 0.6, roughness: 0.5 }),
    );
    mh.position.set(-27.4, 0.03, 10);
    scene.add(mh);
  }

  window.MuzzagaEnv = { install };
})();
