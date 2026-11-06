/* Muzzaga · entrada del club y puertas con movimiento.
   Puerta corrediza de vidrio (se abre y se cierra), puerta del vestuario que gira, felpudo, macetas,
   balizas y luces de camino hacia la calle. Con "reducir movimiento" las puertas quedan cerradas. */
(function () {
  function install(ctx) {
    const { THREE, scene, std, box, ctex, onFrame, reduceMotion } = ctx;
    const steel = std(0x15171c, { metalness: 0.85, roughness: 0.3 });
    const warm = new THREE.MeshBasicMaterial({ toneMapped: false });
    warm.color.setRGB(2.2, 1.6, 0.8);
    const mesh = (geo, mat, x, y, z, parent) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      (parent || scene).add(m);
      return m;
    };
    const ease = (u) => u * u * (3 - 2 * u),
      clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    /* 0 = cerrada, 1 = abierta: sube, se queda y baja dentro de un ciclo de `period` segundos */
    const cycle = (t, period, offset, rise, hold) => {
      const c = (t + offset) % period,
        s = period - 2 * rise - hold - 1;
      if (c < s) return 0;
      const a = c - s;
      return a < rise
        ? ease(a / rise)
        : a < rise + hold
          ? 1
          : a < 2 * rise + hold
            ? 1 - ease((a - rise - hold) / rise)
            : 0;
    };

    /* ---- puerta corrediza de vidrio en la entrada (pared izquierda, z 5.2 a 8.4) ---- */
    box(0.2, 0.14, 3.5, -14.3, 2.78, 6.8, steel);
    box(0.2, 0.05, 3.4, -14.3, 2.7, 6.8, warm);
    const glass = new THREE.MeshStandardMaterial({
      color: 0xbfe3ff,
      transparent: true,
      opacity: 0.2,
      roughness: 0.05,
      metalness: 0,
      depthWrite: false,
    });
    const leaves = [-1, 1].map((sd) => {
      const g = new THREE.Group();
      g.position.set(-14.3, 0, 6.8 + sd * 0.8);
      scene.add(g);
      mesh(new THREE.BoxGeometry(0.03, 2.62, 1.56), glass, 0, 1.33, 0, g);
      [
        [0.05, 2.66, 0.05, 0, 1.33, -0.78],
        [0.05, 2.66, 0.05, 0, 1.33, 0.78],
        [0.05, 0.05, 1.6, 0, 2.66, 0],
        [0.05, 0.05, 1.6, 0, 0.02, 0],
      ].forEach(([w, h, d, x, y, z]) =>
        mesh(new THREE.BoxGeometry(w, h, d), steel, x, y, z, g),
      );
      mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 1.1, 8),
        steel,
        -0.05,
        1.1,
        -sd * 0.7,
        g,
      );
      return { g, sd };
    });
    const sticker = ctex(256, 96, (g, w, h) => {
      g.fillStyle = "#12151b";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#f26a1b";
      g.fillRect(0, h - 6, w, 6);
      g.textAlign = "center";
      g.fillStyle = "#fff";
      g.font = '60px "Bebas Neue",Impact,sans-serif';
      g.fillText("ABIERTO", w / 2, 52);
      g.fillStyle = "#f26a1b";
      g.font = "500 20px Poppins,sans-serif";
      g.fillText("14:00 a 00:30", w / 2, 80);
    });
    const sm = new THREE.MeshBasicMaterial({
      map: sticker,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    sm.color.setScalar(1.15);
    const sp = mesh(
      new THREE.PlaneGeometry(0.5, 0.19),
      sm,
      -0.02,
      1.55,
      0.78,
      leaves[1].g,
    );
    sp.rotation.y = -Math.PI / 2;

    /* ---- puerta de madera del baño de hombres (costado del pasillito), con bisagra en el marco ---- */
    const piv = new THREE.Group();
    piv.position.set(11.4, 0, 11.6);
    scene.add(piv);
    mesh(
      new THREE.BoxGeometry(0.88, 2.2, 0.045),
      std(0x9a6a3c, { roughness: 0.55 }),
      0.45,
      1.15,
      0,
      piv,
    );
    mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), steel, 0.8, 1.05, 0, piv);
    for (let i = 0; i < 4; i++)
      mesh(
        new THREE.BoxGeometry(0.015, 2.12, 0.052),
        std(0x6e4a28, { roughness: 0.6 }),
        0.15 + i * 0.2,
        1.15,
        0,
        piv,
      );

    onFrame((dt, t) => {
      const o = reduceMotion ? 0 : cycle(t, 14, 0, 0.9, 3.2),
        k = reduceMotion ? 0 : cycle(t, 19, 6, 0.8, 2.4);
      leaves.forEach((l) => {
        l.g.position.z = 6.8 + l.sd * (0.8 + 1.4 * o);
        l.g.updateMatrixWorld(true);
      });
      piv.rotation.y = -Math.PI / 2 + 1.35 * k;
      piv.updateMatrixWorld(true);
    });

    /* ---- felpudo, macetas, balizas y luces de camino ---- */
    const mat = ctex(256, 128, (g, w, h) => {
      g.fillStyle = "#1b1d22";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#f26a1b";
      g.lineWidth = 6;
      g.strokeRect(8, 8, w - 16, h - 16);
      g.textAlign = "center";
      g.fillStyle = "#fff";
      g.font = '56px "Bebas Neue",Impact,sans-serif';
      g.fillText("BIENVENIDOS", w / 2, h / 2 + 18);
    });
    const rug = mesh(
      new THREE.PlaneGeometry(2.2, 1.1),
      new THREE.MeshStandardMaterial({ map: mat, roughness: 1 }),
      -15.2,
      0.03,
      6.8,
    );
    rug.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    const pot = std(0x2d3037, { roughness: 0.7 }),
      green = std(0x3f6b2f, {
        roughness: 0.95,
        emissive: 0x1d3a0e,
        emissiveIntensity: 0.3,
      });
    [4.4, 9.2].forEach((z) => {
      box(0.9, 0.6, 0.9, -15.2, 0.3, z, pot, { solid: true });
      for (let i = 0; i < 4; i++)
        mesh(
          new THREE.SphereGeometry(0.32 - i * 0.03, 10, 8),
          green,
          -15.2 + Math.sin(i * 2) * 0.12,
          0.8 + i * 0.12,
          z + Math.cos(i * 2) * 0.12,
        );
    });
    [4.8, 8.8].forEach((z) => {
      mesh(
        new THREE.CylinderGeometry(0.09, 0.1, 0.9, 12),
        steel,
        -18.2,
        0.45,
        z,
      );
      mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12),
        warm,
        -18.2,
        0.92,
        z,
      );
    });
    const stud = new THREE.BoxGeometry(0.22, 0.02, 0.07);
    for (let i = 0; i < 6; i++)
      [5.75, 7.85].forEach((z) => mesh(stud, warm, -15.7 - i * 1.15, 0.035, z));
    const pool = new THREE.CanvasTexture(
      (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const x = c.getContext("2d"),
          gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, "rgba(255,190,110,.9)");
        gr.addColorStop(1, "rgba(255,150,60,0)");
        x.fillStyle = gr;
        x.fillRect(0, 0, 64, 64);
        return c;
      })(),
    );
    const pm = new THREE.MeshBasicMaterial({
      map: pool,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const lp = mesh(new THREE.PlaneGeometry(5, 5), pm, -15.4, 0.05, 6.8);
    lp.rotation.x = -Math.PI / 2;
    [
      [-15.8, 5.8],
      [-14.9, 7.8],
    ].forEach(([x, z]) =>
      mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12), warm, x, 3.15, z),
    );
  }

  window.MuzzagaEntrance = { install };
})();
