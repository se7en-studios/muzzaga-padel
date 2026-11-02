/* Muzzaga · personas de la maqueta (v2, más realistas).
   Humanos con jerarquía de articulaciones (cadera, rodilla, hombro, codo, muñeca, cuello) y detalle:
   cara con párpados, pestañas, brillo en los ojos, nariz y labios modelados, orejas; pelo en capas con
   mechones; ropa con costuras, bordes y tejido (bump); zapatillas con lengüeta y cordones; manos con
   falanges; relojes y anteojos en algunos. Estatura y complexión varían por persona.
   La malla se fusiona por articulación y material (pocos draw calls). Mantiene la interfaz de la maqueta:
   legL, legR, arm, armL, up (+ rodillas, codos, cuello y animaciones propias). */
(function () {
  const people = [];
  let T = null;
  let fabric = null;
  const mCache = new Map();

  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  function addPart(list, geo, mat, x, y, z, o) {
    o = o || {};
    const m = new T.Matrix4().compose(
      v3(x, y, z),
      new T.Quaternion().setFromEuler(
        new T.Euler(o.rx || 0, o.ry || 0, o.rz || 0),
      ),
      v3(o.sx || 1, o.sy || 1, o.sz || 1),
    );
    list.push({ geo, mat, m });
  }
  function bake(list, parent) {
    const by = new Map();
    list.forEach((p) => {
      const g = p.geo.clone();
      g.applyMatrix4(p.m);
      if (!by.has(p.mat)) by.set(p.mat, []);
      by.get(p.mat).push(g);
    });
    by.forEach((gs, mat) => {
      parent.add(
        new T.Mesh(T.BufferGeometryUtils.mergeBufferGeometries(gs), mat),
      );
      gs.forEach((g) => g.dispose());
    });
  }
  const sph = (r, w, h) => new T.SphereGeometry(r, w || 14, h || 10);
  const cyl = (a, b, h, s) => new T.CylinderGeometry(a, b, h, s || 12);
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const tor = (r, t, a) => new T.TorusGeometry(r, t, 8, a || 18);

  /* ---- materiales ---- */
  function fabricTex() {
    if (fabric) return fabric;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#808080";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 900; i++) {
      const v = (100 + Math.random() * 80) | 0;
      g.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
      g.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
    }
    g.strokeStyle = "rgba(0,0,0,.28)";
    g.lineWidth = 1;
    for (let i = -64; i < 64; i += 3) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 64, 64);
      g.stroke();
    }
    fabric = new T.CanvasTexture(c);
    fabric.wrapS = fabric.wrapT = T.RepeatWrapping;
    fabric.repeat.set(20, 20);
    return fabric;
  }
  const cached = (key, make) => {
    if (!mCache.has(key)) mCache.set(key, make());
    return mCache.get(key);
  };
  const cloth = (hex, rough) =>
    cached(
      "c" + hex + "_" + (rough || 0),
      () =>
        new T.MeshStandardMaterial({
          color: hex,
          roughness: rough || 0.82,
          bumpMap: fabricTex(),
          bumpScale: 0.045,
        }),
    );
  const plain = (hex, rough, metal) =>
    cached(
      "p" + hex + "_" + rough + "_" + (metal || 0),
      () =>
        new T.MeshStandardMaterial({
          color: hex,
          roughness: rough,
          metalness: metal || 0,
        }),
    );
  const tint = (hex, toward, k) =>
    new T.Color(hex).lerp(new T.Color(toward), k);
  const skinMat = (hex, k, toward) =>
    cached("s" + hex + "_" + (toward || 0) + "_" + k, () => {
      const c = tint(hex, toward || hex, k);
      return new T.MeshStandardMaterial({
        color: c,
        roughness: 0.55,
        emissive: new T.Color(hex).multiplyScalar(0.1),
      });
    });
  const lighten = (hex, k) =>
    new T.Color(hex).lerp(new T.Color(0xffffff), k).getHex();

  function mats(shirt, skin, shorts, hairC, cap, o, seed) {
    const K = {
      skin: skinMat(skin, 0),
      warm: skinMat(skin, 0.22, 0xc8605a),
      dark: skinMat(skin, 0.3, 0x7a4234),
    };
    K.shirt = cloth(shirt);
    K.shorts = cloth(shorts);
    K.shortsDark = cloth(tint(shorts, 0x000000, 0.35).getHex());
    K.skirt = !!o.skirt;
    K.skirtMat = cloth(o.skirt || 0x222833);
    const hc = hairC === undefined ? 0x2a1d14 : hairC;
    K.hairMat = plain(hc, 0.5, 0.12);
    K.hair2 = plain(lighten(hc, 0.12), 0.45, 0.15);
    K.capMat = cloth(cap || 0x222222, 0.8);
    K.band = !!o.band;
    K.bandMat = cloth(o.band || 0xffffff, 0.85);
    K.white = cloth(0xf2f2f2, 0.8);
    K.sole = plain(0x1c1d21, 0.9);
    K.accent = plain(0xf26a1b, 0.55);
    K.trim = cloth(0xf2f2f2, 0.8);
    const shoeCols = [0xf1f1f1, 0x1d2026, 0xf26a1b, 0x2f6fd6];
    K.shoe = plain(shoeCols[seed % 4], 0.55);
    K.shoeWhite = plain(0xf1f1f1, 0.55);
    K.eyeWhite = plain(0xf7f7f7, 0.25);
    K.iris = plain([0x3a2a1c, 0x2f5d3a, 0x2f4f7a, 0x4a3622][seed % 4], 0.25);
    K.pupil = plain(0x050505, 0.2);
    K.catch = new T.MeshBasicMaterial({ color: 0xffffff });
    K.lash = plain(0x120d0b, 0.9);
    K.lip = plain(0x8a423c, 0.45);
    K.lip2 = plain(0x9d5148, 0.4);
    K.mouth = plain(0x3a1612, 0.8);
    K.teeth = plain(0xf5efe6, 0.35);
    K.cupMat = plain(0xf1ece2, 0.5);
    K.grip = plain(0x16181c, 0.8);
    K.frame = plain(0x1d2026, 0.4, 0.3);
    K.sockStripe = plain(0xf26a1b, 0.7);
    K.glass = plain(0x15181d, 0.3, 0.6);
    K.watchBand = plain(0x14161b, 0.7);
    K.watchFace = new T.MeshBasicMaterial({ color: 0x9ad7ff });
    return K;
  }

  /* ---- piernas ---- */
  function legs(g, K, fem) {
    [-1, 1].forEach((sd) => {
      const leg = new T.Group();
      leg.position.set(sd * (fem ? 0.095 : 0.09), 0.84, 0);
      g.add(leg);
      const shin = new T.Group();
      shin.position.y = -0.42;
      leg.add(shin);
      const a = [],
        b = [];
      addPart(a, cyl(0.074, 0.058, 0.42, 14), K.skin, 0, -0.21, 0);
      addPart(a, sph(0.058), K.skin, 0, -0.42, 0);
      if (K.skirt) addPart(a, cyl(0.086, 0.086, 0.2, 14), K.shorts, 0, -0.1, 0);
      else {
        addPart(a, cyl(0.093, 0.085, 0.27, 16), K.shorts, 0, -0.135, 0);
        addPart(a, box(0.006, 0.26, 0.05), K.white, sd * 0.092, -0.135, 0);
        addPart(a, cyl(0.086, 0.086, 0.012, 16), K.shortsDark, 0, -0.268, 0);
      }
      addPart(b, cyl(0.057, 0.04, 0.34, 12), K.skin, 0, -0.17, 0);
      addPart(b, sph(0.05), K.skin, 0, -0.1, -0.014, { sy: 1.5 });
      addPart(b, cyl(0.044, 0.047, 0.14, 12), K.white, 0, -0.28, 0);
      addPart(b, cyl(0.0465, 0.0465, 0.014, 12), K.sockStripe, 0, -0.235, 0);
      addPart(b, box(0.104, 0.028, 0.27), K.sole, 0, -0.345, 0.05);
      addPart(b, box(0.108, 0.02, 0.255), K.shoeWhite, 0, -0.322, 0.05);
      addPart(b, sph(0.062), K.shoe, 0, -0.312, 0.045, {
        sx: 0.95,
        sy: 0.72,
        sz: 1.75,
      });
      addPart(b, sph(0.048), K.shoeWhite, 0, -0.322, 0.15, { sy: 0.7 });
      addPart(b, box(0.05, 0.05, 0.016), K.shoeWhite, 0, -0.287, 0.04, {
        rx: -0.5,
      });
      addPart(b, box(0.04, 0.045, 0.018), K.shoe, 0, -0.3, -0.075);
      for (let i = 0; i < 3; i++)
        addPart(
          b,
          box(0.056, 0.005, 0.01),
          K.white,
          0,
          -0.296 + i * 0.004,
          0.06 + i * 0.035,
          { rx: -0.45 },
        );
      addPart(b, sph(0.009), K.white, -0.018, -0.275, 0.025);
      addPart(b, sph(0.009), K.white, 0.018, -0.275, 0.025);
      bake(a, leg);
      bake(b, shin);
      g.userData[sd < 0 ? "legL" : "legR"] = leg;
      g.userData[sd < 0 ? "kneeL" : "kneeR"] = shin;
    });
  }

  /* ---- torso ---- */
  function torso(up, K, fem, bw) {
    const t = [];
    const pts = [
      [0.001, -0.02],
      [0.13, -0.02],
      [0.135, 0.06],
      [0.128, 0.16],
      [0.138, 0.28],
      [0.16, 0.4],
      [0.162, 0.46],
      [0.14, 0.52],
      [0.06, 0.565],
      [0.001, 0.57],
    ].map((p) => new T.Vector2(p[0], p[1]));
    const sx = (fem ? 1.12 : 1.24) * bw;
    addPart(t, new T.LatheGeometry(pts, 20), K.shirt, 0, 0, 0, { sx, sz: 0.8 });
    addPart(t, tor(0.134, 0.008, 24), K.trim, 0, -0.018, 0, {
      rx: Math.PI / 2,
      sx,
      sy: 0.8,
    });
    [-1, 1].forEach((sd) =>
      addPart(t, box(0.008, 0.4, 0.05), K.accent, sd * 0.158 * sx, 0.26, 0, {
        rz: sd * 0.02,
      }),
    );
    if (K.skirt) {
      addPart(t, cyl(0.14, 0.26, 0.24, 22), K.skirtMat, 0, -0.06, 0, {
        sz: 0.9,
      });
      addPart(t, cyl(0.142, 0.142, 0.03, 20), K.shortsDark, 0, 0.065, 0, {
        sz: 0.82,
      });
    } else {
      addPart(t, cyl(0.138, 0.142, 0.17, 20), K.shorts, 0, 0.0, 0, {
        sz: 0.82,
        sx: (fem ? 1.08 : 1) * bw,
      });
      addPart(t, cyl(0.143, 0.143, 0.03, 20), K.shortsDark, 0, 0.078, 0, {
        sz: 0.82,
        sx: (fem ? 1.08 : 1) * bw,
      });
    }
    addPart(t, tor(0.058, 0.012, 20), K.trim, 0, 0.55, 0.0, {
      rx: Math.PI / 2,
    });
    addPart(t, box(0.014, 0.1, 0.006), K.trim, 0, 0.5, 0.128);
    addPart(t, cyl(0.045, 0.052, 0.1, 12), K.skin, 0, 0.6, 0);
    addPart(t, sph(0.012), K.warm, 0, 0.58, 0.04, { sy: 1.4 });
    [-1, 1].forEach((sd) =>
      addPart(
        t,
        sph(0.066, 12, 10),
        K.shirt,
        sd * (fem ? 0.19 : 0.21) * bw,
        0.5,
        0,
      ),
    );
    if (!fem) addPart(t, box(0.075, 0.034, 0.006), K.accent, -0.07, 0.4, 0.133);
    bake(t, up);
  }

  /* ---- cabeza ---- */
  function face(head, K, o) {
    const f = [],
      eyes = new T.Group(),
      e = [],
      lids = [];
    addPart(f, sph(0.1, 26, 20), K.skin, 0, 0.12, 0, { sx: 0.92, sy: 1.1 });
    addPart(f, sph(0.07, 18, 14), K.skin, 0, 0.05, 0.02, {
      sx: 1.0,
      sy: 0.85,
      sz: 0.95,
    });
    addPart(f, sph(0.03), K.skin, 0, 0.022, 0.075);
    addPart(f, sph(0.022), K.skin, 0, 0.135, 0.09, { sx: 2.6, sy: 0.7 });
    [-1, 1].forEach((sd) => {
      addPart(f, sph(0.03), K.warm, sd * 0.054, 0.085, 0.074);
      addPart(f, sph(0.026), K.skin, sd * 0.098, 0.115, 0, {
        sx: 0.45,
        sy: 1,
        sz: 0.8,
      });
      addPart(f, sph(0.014), K.warm, sd * 0.1, 0.113, 0.004, { sx: 0.4 });
      addPart(f, sph(0.024), K.dark, sd * 0.037, 0.125, 0.081, {
        sx: 1.1,
        sy: 0.8,
        sz: 0.55,
      });
      addPart(
        f,
        box(0.026, 0.008, 0.012),
        K.hairMat,
        sd * 0.045,
        0.152,
        0.091,
        { rz: -sd * 0.18 },
      );
      addPart(f, box(0.024, 0.008, 0.012), K.hairMat, sd * 0.024, 0.15, 0.094, {
        rz: sd * 0.12,
      });
      addPart(e, sph(0.0165), K.eyeWhite, sd * 0.037, 0, 0.088);
      addPart(e, sph(0.0098), K.iris, sd * 0.037, 0, 0.1);
      addPart(e, sph(0.0048), K.pupil, sd * 0.037, 0, 0.108);
      addPart(e, sph(0.0026, 6, 5), K.catch, sd * 0.037 + 0.004, 0.004, 0.111);
      addPart(
        lids,
        new T.SphereGeometry(0.0182, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.46),
        K.skin,
        sd * 0.037,
        0.125,
        0.088,
        { rx: -0.32 },
      );
      addPart(lids, box(0.03, 0.003, 0.006), K.lash, sd * 0.037, 0.141, 0.1, {
        rx: -0.2,
      });
    });
    addPart(f, cyl(0.006, 0.011, 0.05, 8), K.skin, 0, 0.108, 0.098, {
      rx: -0.3,
    });
    addPart(f, sph(0.0145), K.skin, 0, 0.082, 0.113);
    [-1, 1].forEach((sd) => {
      addPart(f, sph(0.0055, 6, 5), K.mouth, sd * 0.008, 0.076, 0.123);
      addPart(f, sph(0.0085), K.skin, sd * 0.014, 0.084, 0.108);
    });
    addPart(f, box(0.042, 0.005, 0.006), K.mouth, 0, 0.052, 0.098);
    addPart(f, sph(0.02, 10, 6), K.lip, 0, 0.0565, 0.098, {
      sx: 1.0,
      sy: 0.3,
      sz: 0.55,
    });
    addPart(f, sph(0.022, 10, 6), K.lip2, 0, 0.0455, 0.098, {
      sx: 1.0,
      sy: 0.34,
      sz: 0.6,
    });
    [-1, 1].forEach((sd) =>
      addPart(f, sph(0.005, 6, 5), K.warm, sd * 0.024, 0.052, 0.097),
    );
    bake(f, head);
    bake(lids, head);
    eyes.position.y = 0.125;
    bake(e, eyes);
    head.add(eyes);
    head.userData.eyes = eyes;
    if (o.glasses) {
      const gl = [];
      [-1, 1].forEach((sd) => {
        addPart(gl, tor(0.027, 0.003, 18), K.glass, sd * 0.04, 0.128, 0.102);
        addPart(gl, box(0.004, 0.004, 0.1), K.glass, sd * 0.098, 0.13, 0.05);
      });
      addPart(gl, box(0.025, 0.004, 0.004), K.glass, 0, 0.134, 0.103);
      bake(gl, head);
    }
    if (o.beard) {
      const bd = [];
      addPart(bd, sph(0.072, 14, 10), K.hairMat, 0, 0.04, 0.03, {
        sx: 1.0,
        sy: 0.62,
        sz: 0.88,
      });
      addPart(bd, box(0.044, 0.008, 0.012), K.hairMat, 0, 0.062, 0.104);
      bake(bd, head);
    }
  }

  function hair(head, K, style, cap, seed) {
    const h = [];
    if (style !== "bald") {
      addPart(
        h,
        new T.SphereGeometry(0.106, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.6),
        K.hairMat,
        0,
        0.125,
        -0.012,
        { sx: 0.97, sy: 1.04, sz: 1.06 },
      );
      for (let i = 0; i < 5; i++)
        addPart(
          h,
          new T.SphereGeometry(
            0.108,
            10,
            8,
            i * 2.1 + seed,
            0.45,
            0.3,
            Math.PI * 0.32,
          ),
          K.hair2,
          0,
          0.126,
          -0.012,
          { sx: 0.97, sy: 1.045, sz: 1.065 },
        );
    }
    if (style === "short") {
      for (let i = -2; i <= 2; i++)
        addPart(
          h,
          sph(0.026, 8, 6),
          K.hairMat,
          i * 0.03,
          0.172 - Math.abs(i) * 0.004,
          0.082 - Math.abs(i) * 0.006,
          { sx: 1.5, sy: 0.7 },
        );
      [-1, 1].forEach((sd) =>
        addPart(h, box(0.012, 0.05, 0.03), K.hairMat, sd * 0.096, 0.1, 0.02),
      );
    }
    if (style === "long") {
      addPart(h, sph(0.108, 14, 10), K.hairMat, 0, 0.01, -0.07, {
        sx: 0.95,
        sy: 1.5,
        sz: 0.7,
      });
      [-1, 1].forEach((sd) => {
        addPart(h, box(0.022, 0.17, 0.07), K.hairMat, sd * 0.097, 0.04, -0.02);
        addPart(h, sph(0.022, 8, 6), K.hairMat, sd * 0.05, 0.178, 0.075, {
          sx: 1.6,
          sy: 0.6,
        });
      });
      addPart(h, sph(0.06, 10, 8), K.hair2, 0, 0.0, -0.12, {
        sx: 0.7,
        sy: 1.8,
        sz: 0.4,
      });
    }
    if (style === "pony") {
      addPart(h, sph(0.044, 10, 8), K.hairMat, 0, 0.05, -0.135, {
        sx: 0.9,
        sy: 2.4,
        sz: 0.9,
      });
      addPart(h, sph(0.032, 8, 6), K.hair2, 0, -0.02, -0.15, { sy: 2.2 });
      addPart(h, tor(0.032, 0.008, 12), K.accent, 0, 0.12, -0.115, {
        rx: Math.PI / 2,
      });
      for (let i = -1; i <= 1; i++)
        addPart(h, sph(0.026, 8, 6), K.hairMat, i * 0.035, 0.172, 0.082, {
          sx: 1.5,
          sy: 0.7,
        });
    }
    if (style === "curly")
      for (let i = 0; i < 34; i++) {
        const a = i * 2.4, layer = i % 2, r = (0.07 + (i % 3) * 0.012) * (layer ? 0.7 : 1);
        addPart(h, sph(0.03, 8, 6), i % 5 ? K.hairMat : K.hair2, Math.sin(a) * r, 0.15 + layer * 0.03 + (i % 4) * 0.012, Math.cos(a) * r * 0.9 - 0.012);
      }
    if (cap) {
      addPart(
        h,
        new T.SphereGeometry(0.113, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        K.capMat,
        0,
        0.13,
        0,
        { sy: 0.9 },
      );
      addPart(h, box(0.16, 0.012, 0.12), K.capMat, 0, 0.138, 0.13);
    }
    if (K.band && !cap)
      addPart(
        h,
        new T.TorusGeometry(0.106, 0.013, 8, 22),
        K.bandMat,
        0,
        0.15,
        0,
        { rx: Math.PI / 2 },
      );
    if (h.length) bake(h, head);
  }

  /* ---- brazos y manos ---- */
  function arms(up, K, g, racket, fem, bw, racketTex, DS, watch) {
    [-1, 1].forEach((sd) => {
      const arm = new T.Group();
      arm.position.set(sd * (fem ? 0.2 : 0.222) * bw, 0.5, 0);
      up.add(arm);
      const elbow = new T.Group();
      elbow.position.y = -0.28;
      arm.add(elbow);
      const hand = new T.Group();
      hand.position.y = -0.27;
      elbow.add(hand);
      const a = [],
        b = [],
        c = [];
      addPart(a, cyl(0.06, 0.054, 0.16, 14), K.shirt, 0, -0.08, 0);
      addPart(a, cyl(0.0575, 0.0575, 0.012, 14), K.accent, 0, -0.158, 0);
      addPart(a, cyl(0.046, 0.04, 0.27, 12), K.skin, 0, -0.135, 0);
      addPart(a, sph(0.042), K.skin, 0, -0.28, 0);
      addPart(b, cyl(0.038, 0.031, 0.25, 12), K.skin, 0, -0.125, 0);
      addPart(b, cyl(0.035, 0.035, 0.045, 12), K.bandMat, 0, -0.215, 0);
      addPart(b, sph(0.026), K.skin, 0, -0.2, 0.012, { sx: 0.7, sy: 1.2 });
      if (watch && sd < 0) {
        addPart(b, cyl(0.0385, 0.0385, 0.018, 14), K.watchBand, 0, -0.185, 0);
        addPart(b, box(0.03, 0.006, 0.03), K.watchFace, 0, -0.185, 0.04);
      }
      addPart(c, box(0.072, 0.088, 0.03), K.skin, 0, -0.045, 0);
      addPart(c, sph(0.016), K.skin, sd * 0.03, -0.012, 0.004, { sx: 1.4 });
      addPart(c, box(0.018, 0.034, 0.022), K.skin, sd * 0.045, -0.03, 0.014, {
        rz: sd * 0.5,
      });
      addPart(c, box(0.016, 0.03, 0.02), K.skin, sd * 0.053, -0.058, 0.026, {
        rz: sd * 0.7,
        rx: 0.4,
      });
      const curl = racket && sd > 0 ? 0.9 : 0.25;
      for (let i = 0; i < 4; i++) {
        const x = -0.0255 + i * 0.017,
          ln = i === 1 || i === 2 ? 1.08 : 0.95;
        addPart(
          c,
          box(0.0155, 0.034 * ln, 0.02),
          K.skin,
          x,
          -0.098,
          0.004 + curl * 0.012,
          { rx: curl * 0.55 },
        );
        addPart(
          c,
          box(0.0145, 0.03 * ln, 0.018),
          K.skin,
          x,
          -0.128 * ln + 0.006,
          0.012 + curl * 0.03,
          { rx: curl * 1.15 },
        );
      }
      bake(a, arm);
      bake(b, elbow);
      bake(c, hand);
      elbow.rotation.x = -0.35;
      arm.userData.elbow = elbow;
      arm.userData.hand = hand;
      g.userData[sd < 0 ? "armL" : "arm"] = arm;
      g.userData[sd < 0 ? "elbowL" : "elbowR"] = elbow;
      g.userData[sd < 0 ? "handL" : "handR"] = hand;
      if (sd > 0) {
        g.userData.cup = cup(K, hand);
        if (racket) g.userData.racket = padel(hand, K, racketTex, DS);
      }
    });
  }

  function cup(K, hand) {
    const c = new T.Group(),
      l = [];
    addPart(l, cyl(0.036, 0.028, 0.095, 12), K.cupMat, 0, -0.07, 0.04);
    addPart(l, cyl(0.037, 0.037, 0.02, 12), K.accent, 0, -0.06, 0.04);
    bake(l, c);
    c.visible = false;
    hand.add(c);
    return c;
  }

  function padel(hand, K, racketTex, DS) {
    const r = new T.Group(),
      l = [];
    addPart(l, cyl(0.017, 0.017, 0.2, 10), K.grip, 0, -0.1, 0);
    addPart(l, cyl(0.02, 0.02, 0.025, 10), K.grip, 0, -0.205, 0);
    addPart(l, cyl(0.014, 0.014, 0.1, 8), K.frame, 0, -0.26, 0);
    addPart(l, tor(0.125, 0.012, 30), K.frame, 0, -0.43, 0, {
      sx: 0.85,
      sy: 1.15,
    });
    bake(l, r);
    const face = new T.Mesh(
      new T.PlaneGeometry(0.25, 0.3),
      new T.MeshBasicMaterial({
        map: racketTex,
        transparent: true,
        alphaTest: 0.1,
        side: DS,
      }),
    );
    face.position.set(0, -0.43, 0);
    r.add(face);
    r.position.set(0, -0.03, 0.04);
    hand.add(r);
    return r;
  }

  /* ---- persona completa ---- */
  function build(ctx, shirt, skin, shorts, hairC, cap, o) {
    T = ctx.THREE;
    o = o || {};
    const hasShorts = ctx.hasShorts;
    skin = skin || 0xe4b48c;
    shorts = shorts || 0x232733;
    const seed = (people.length * 7 + ((shirt || 0) >> 4)) % 97,
      fem = !!(o.skirt || o.pony),
      bw = 0.96 + (seed % 5) * 0.03;
    const K = mats(shirt, skin, shorts, hairC, cap, o, seed);
    const g = new T.Group(),
      up = new T.Group();
    up.position.y = 0.84;
    g.add(up);
    legs(g, K, fem);
    torso(up, K, fem, bw);
    const head = new T.Group();
    head.position.y = 0.6;
    up.add(head);
    face(head, K, {
      glasses: o.glasses || seed % 7 === 0,
      beard: o.beard || (!fem && seed % 9 === 3 && !cap),
    });
    hair(
      head,
      K,
      o.hairStyle ||
        (o.pony
          ? "pony"
          : o.skirt
            ? "long"
            : hairC === 0x111111
              ? "curly"
              : "short"),
      cap,
      seed,
    );
    arms(
      up,
      K,
      g,
      hasShorts && o.racket !== false,
      fem,
      bw,
      ctx.racket,
      ctx.DS,
      seed % 2 === 0,
    );
    g.scale.setScalar((fem ? 0.94 : 0.98) + (seed % 9) * 0.012);
    g.userData.up = up;
    g.userData.head = head;
    g.userData.eyes = head.userData.eyes;
    g.userData.ph = Math.random() * 6.28;
    g.userData.blink = 2 + Math.random() * 3;
    people.push(g);
    return g;
  }

  /* ---- animaciones ---- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (u) => u * u * (3 - 2 * u);
  function drink(u, t, ph) {
    const c = (t + ph) % 8,
      k =
        c < 4.5
          ? 0
          : c < 5.6
            ? ease((c - 4.5) / 1.1)
            : c < 6.6
              ? 1
              : c < 7.6
                ? 1 - ease((c - 6.6) / 1.0)
                : 0;
    u.arm.rotation.x = -0.45 - 0.5 * k;
    u.elbowR.rotation.x = -1.0 - 1.35 * k;
    u.armL.rotation.x = -0.5;
    u.elbowL.rotation.x = -1.0;
    u.head.rotation.x = -0.12 * k + Math.sin(t * 0.7 + ph) * 0.03;
    u.cup.visible = true;
  }
  function talk(u, t, ph) {
    u.armL.rotation.x = -0.55 + Math.sin(t * 1.9 + ph) * 0.3;
    u.elbowL.rotation.x = -1.15 + Math.sin(t * 3.1 + ph) * 0.4;
    u.armL.rotation.z = 0.2;
    u.arm.rotation.x = -0.4;
    u.elbowR.rotation.x = -0.9 + Math.sin(t * 2.3 + ph) * 0.15;
    u.head.rotation.x = Math.sin(t * 2.4 + ph) * 0.06;
    u.head.rotation.y = Math.sin(t * 0.6 + ph) * 0.3;
  }
  function coffee(u, t) {
    u.arm.rotation.x = -0.95 + Math.sin(t * 3.2) * 0.16;
    u.elbowR.rotation.x = -1.2 + Math.sin(t * 3.2) * 0.25;
    u.armL.rotation.x = -0.9;
    u.elbowL.rotation.x = -1.1;
    u.up.rotation.x = 0.12;
    u.head.rotation.x = 0.25 + Math.sin(t * 0.8) * 0.05;
  }
  function serve(u, t, ph) {
    u.arm.rotation.x = -0.85;
    u.elbowR.rotation.x = -1.05;
    u.armL.rotation.x = -0.85;
    u.elbowL.rotation.x = -1.05;
    u.head.rotation.y = Math.sin(t * 0.8 + ph) * 0.35;
    u.up.rotation.x = 0.05;
  }
  function reception(u, t, ph) {
    u.arm.rotation.x = -0.6 + Math.sin(t * 1.4 + ph) * 0.1;
    u.elbowR.rotation.x = -1.2;
    u.armL.rotation.x = -0.25;
    u.elbowL.rotation.x = -0.5;
    u.head.rotation.y = Math.sin(t * 0.5 + ph) * 0.4;
    u.head.rotation.x = 0.1;
  }
  const ACTS = { drink, talk, coffee, serve, reception };

  function tick(dt, t, still) {
    people.forEach((g) => {
      const u = g.userData,
        ph = u.ph;
      const seated = u.legL.rotation.x < -0.8;
      ["L", "R"].forEach((s) => {
        const leg = u["leg" + s];
        u["knee" + s].rotation.x = seated
          ? 1.5
          : clamp(leg.rotation.x, 0, 2) * 1.25 + 0.05;
      });
      if (u.act && !still && ACTS[u.act]) ACTS[u.act](u, t, ph);
      else if (u.cup) u.cup.visible = false;
      if (!still) {
        u.up.scale.y = 1 + Math.sin(t * 1.7 + ph) * 0.005;
        u.up.rotation.z = Math.sin(t * 0.9 + ph) * 0.02;
        u.blink -= dt;
        if (u.blink < 0) u.blink = 2.6 + Math.random() * 3;
        u.eyes.scale.y = u.blink < 0.12 ? 0.12 : 1;
      }
      if (u.look && !still) u.head.rotation.y = Math.sin(t * 0.45 + ph) * 0.35;
      g.updateMatrixWorld(true);
    });
  }

  /* bandeja con vasos que lleva el bartender (cuelga del torso, a la altura de la cintura) */
  function addTray(ctx, g) {
    T = ctx.THREE;
    const l = [],
      tray = new T.Group();
    addPart(
      l,
      cyl(0.2, 0.2, 0.015, 24),
      ctx.std(0x2a2d33, { metalness: 0.7, roughness: 0.35 }),
      0,
      0,
      0,
    );
    [-0.09, 0, 0.09].forEach((x, i) =>
      addPart(
        l,
        cyl(0.03, 0.024, 0.09, 12),
        ctx.std(i === 1 ? 0xf26a1b : 0xf1ece2, { roughness: 0.4 }),
        x,
        0.05,
        i === 1 ? 0.05 : -0.04,
      ),
    );
    bake(l, tray);
    tray.position.set(0, 0.2, 0.3);
    g.userData.up.add(tray);
  }

  window.MuzzagaPeople = {
    addTray,
    build: (ctx, ...a) => {
      ctx.hasShorts = a[2] !== undefined;
      return build(ctx, ...a);
    },
    tick,
  };
})();
