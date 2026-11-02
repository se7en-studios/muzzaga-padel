/* Muzzaga · personas de la maqueta.
   Humanos con jerarquía de articulaciones (cadera, rodilla, hombro, codo, muñeca, cuello),
   cara (ojos, cejas, nariz, orejas, boca), pelo, manos con dedos, zapatillas y ropa deportiva.
   La malla se fusiona por articulación y material para mantener pocos draw calls.
   Mantiene la interfaz de la maqueta (legL, legR, arm, armL, up) y suma rodillas, codos, cuello y
   animaciones propias (caminar, sentarse, tomar algo, charlar, preparar café, servir). */
(function () {
  const people = [];
  let THREE_,
    M = null;

  const v3 = (x, y, z) => new THREE_.Vector3(x, y, z);
  function addPart(list, geo, mat, x, y, z, o) {
    o = o || {};
    const m = new THREE_.Matrix4().compose(
      v3(x, y, z),
      new THREE_.Quaternion().setFromEuler(
        new THREE_.Euler(o.rx || 0, o.ry || 0, o.rz || 0),
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
        new THREE_.Mesh(
          THREE_.BufferGeometryUtils.mergeBufferGeometries(gs),
          mat,
        ),
      );
      gs.forEach((g) => g.dispose());
    });
  }
  const sph = (r, w, h) => new THREE_.SphereGeometry(r, w || 14, h || 10);
  const cyl = (a, b, h, s) => new THREE_.CylinderGeometry(a, b, h, s || 12);
  const box = (w, h, d) => new THREE_.BoxGeometry(w, h, d);

  function legs(ctx, g, K) {
    const out = [];
    [-1, 1].forEach((sd) => {
      const leg = new THREE_.Group();
      leg.position.set(sd * 0.09, 0.84, 0);
      g.add(leg);
      const shin = new THREE_.Group();
      shin.position.y = -0.42;
      leg.add(shin);
      const a = [],
        b = [];
      addPart(a, cyl(0.072, 0.058, 0.42), K.skin, 0, -0.21, 0);
      addPart(a, sph(0.057), K.skin, 0, -0.42, 0);
      addPart(
        a,
        cyl(
          K.skirt ? 0.086 : 0.09,
          K.skirt ? 0.084 : 0.083,
          K.skirt ? 0.2 : 0.27,
          14,
        ),
        K.shorts,
        0,
        K.skirt ? -0.1 : -0.135,
        0,
      );
      addPart(b, cyl(0.056, 0.04, 0.34), K.skin, 0, -0.17, 0);
      addPart(b, sph(0.05), K.skin, 0, -0.1, -0.012, { sy: 1.5 });
      addPart(b, cyl(0.043, 0.046, 0.13), K.white, 0, -0.285, 0);
      addPart(b, box(0.105, 0.03, 0.27), K.sole, 0, -0.343, 0.05);
      addPart(b, box(0.108, 0.012, 0.22), K.accent, 0, -0.326, 0.05);
      addPart(b, sph(0.062), K.shoe, 0, -0.318, 0.045, {
        sx: 0.95,
        sy: 0.7,
        sz: 1.75,
      });
      addPart(b, sph(0.048), K.white, 0, -0.325, 0.15, { sy: 0.7 });
      for (let i = 0; i < 3; i++)
        addPart(
          b,
          box(0.05, 0.006, 0.01),
          K.white,
          0,
          -0.28 + 0.0,
          0.0 + i * 0.045 + 0.02,
          { rx: -0.35 },
        );
      bake(a, leg);
      bake(b, shin);
      leg.userData.knee = shin;
      g.userData[sd < 0 ? "legL" : "legR"] = leg;
      g.userData[sd < 0 ? "kneeL" : "kneeR"] = shin;
      out.push(leg);
    });
  }

  function torso(ctx, up, K, fem) {
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
    ].map((p) => new THREE_.Vector2(p[0], p[1]));
    addPart(t, new THREE_.LatheGeometry(pts, 18), K.shirt, 0, 0, 0, {
      sx: fem ? 1.12 : 1.24,
      sz: 0.8,
    });
    if (K.skirt)
      addPart(t, cyl(0.14, 0.26, 0.24, 20), K.skirtMat, 0, -0.06, 0, {
        sz: 0.9,
      });
    else
      addPart(t, cyl(0.138, 0.142, 0.17, 18), K.shorts, 0, 0.0, 0, {
        sz: 0.82,
        sx: fem ? 1.08 : 1,
      });
    addPart(
      t,
      new THREE_.TorusGeometry(0.056, 0.012, 8, 18),
      K.trim,
      0,
      0.55,
      0.0,
      { rx: Math.PI / 2 },
    );
    addPart(t, cyl(0.045, 0.052, 0.1), K.skin, 0, 0.6, 0);
    [-1, 1].forEach((sd) =>
      addPart(t, sph(0.066, 12, 10), K.shirt, sd * (fem ? 0.19 : 0.21), 0.5, 0),
    );
    if (fem)
      [-1, 1].forEach((sd) =>
        addPart(t, sph(0.07), K.shirt, sd * 0.06, 0.4, 0.085, {
          sy: 0.9,
          sz: 0.8,
        }),
      );
    addPart(t, box(0.075, 0.034, 0.006), K.accent, -0.07, 0.4, 0.132);
    bake(t, up);
  }

  function face(head, K) {
    const f = [],
      eyes = new THREE_.Group(),
      e = [];
    addPart(f, sph(0.1, 24, 18), K.skin, 0, 0.12, 0, { sx: 0.92, sy: 1.1 });
    addPart(f, sph(0.07, 16, 12), K.skin, 0, 0.05, 0.02, {
      sx: 1.0,
      sy: 0.85,
      sz: 0.95,
    });
    [-1, 1].forEach((sd) => {
      addPart(f, sph(0.03), K.skin, sd * 0.052, 0.085, 0.075);
      addPart(f, sph(0.026), K.skin, sd * 0.098, 0.115, 0, {
        sx: 0.45,
        sy: 1,
        sz: 0.8,
      });
      addPart(
        f,
        box(0.046, 0.008, 0.012),
        K.hairMat,
        sd * 0.037,
        0.152,
        0.092,
        { rz: -sd * 0.1 },
      );
      addPart(e, sph(0.0175), K.eyeWhite, sd * 0.037, 0, 0.088);
      addPart(e, sph(0.0105), K.iris, sd * 0.037, 0, 0.1);
      addPart(e, sph(0.005), K.pupil, sd * 0.037, 0, 0.108);
    });
    addPart(
      f,
      new THREE_.ConeGeometry(0.018, 0.045, 10),
      K.skin,
      0,
      0.1,
      0.108,
      { rx: Math.PI / 2 },
    );
    addPart(f, box(0.044, 0.007, 0.008), K.lip, 0, 0.052, 0.099);
    addPart(f, box(0.03, 0.006, 0.008), K.lip2, 0, 0.043, 0.098);
    bake(f, head);
    eyes.position.y = 0.125;
    bake(e, eyes);
    head.add(eyes);
    head.userData.eyes = eyes;
  }

  function hair(head, K, style, cap) {
    const h = [];
    if (style !== "bald")
      addPart(
        h,
        new THREE_.SphereGeometry(
          0.106,
          20,
          14,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.6,
        ),
        K.hairMat,
        0,
        0.125,
        -0.012,
        { sx: 0.97, sy: 1.04, sz: 1.06 },
      );
    if (style === "short") {
      addPart(h, sph(0.045, 10, 8), K.hairMat, 0, 0.18, 0.075, {
        sx: 1.6,
        sy: 0.6,
      });
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
      [-1, 1].forEach((sd) =>
        addPart(h, box(0.022, 0.17, 0.07), K.hairMat, sd * 0.097, 0.04, -0.02),
      );
    }
    if (style === "pony") {
      addPart(h, sph(0.044, 10, 8), K.hairMat, 0, 0.05, -0.135, {
        sx: 0.9,
        sy: 2.4,
        sz: 0.9,
      });
      addPart(
        h,
        new THREE_.TorusGeometry(0.032, 0.008, 6, 10),
        K.accent,
        0,
        0.12,
        -0.115,
        { rx: Math.PI / 2 },
      );
    }
    if (style === "curly")
      for (let i = 0; i < 16; i++) {
        const a = i * 2.4,
          r = 0.075 + (i % 3) * 0.01;
        addPart(
          h,
          sph(0.04, 8, 6),
          K.hairMat,
          Math.sin(a) * r,
          0.16 + (i % 4) * 0.014,
          Math.cos(a) * r * 0.9 - 0.01,
        );
      }
    if (cap) {
      addPart(
        h,
        new THREE_.SphereGeometry(
          0.113,
          18,
          10,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2,
        ),
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
        new THREE_.TorusGeometry(0.106, 0.013, 8, 22),
        K.bandMat,
        0,
        0.15,
        0,
        { rx: Math.PI / 2 },
      );
    if (h.length) bake(h, head);
  }

  function arms(ctx, up, K, g, racket, fem, racketTex, DS) {
    [-1, 1].forEach((sd) => {
      const arm = new THREE_.Group();
      arm.position.set(sd * (fem ? 0.2 : 0.222), 0.5, 0);
      up.add(arm);
      const elbow = new THREE_.Group();
      elbow.position.y = -0.28;
      arm.add(elbow);
      const hand = new THREE_.Group();
      hand.position.y = -0.27;
      elbow.add(hand);
      const a = [],
        b = [],
        c = [];
      addPart(a, cyl(0.06, 0.054, 0.16), K.shirt, 0, -0.08, 0);
      addPart(a, cyl(0.046, 0.04, 0.27), K.skin, 0, -0.135, 0);
      addPart(a, sph(0.042), K.skin, 0, -0.28, 0);
      addPart(b, cyl(0.038, 0.031, 0.25), K.skin, 0, -0.125, 0);
      addPart(b, cyl(0.035, 0.035, 0.045), K.bandMat, 0, -0.215, 0);
      addPart(c, box(0.07, 0.085, 0.028), K.skin, 0, -0.045, 0);
      addPart(c, box(0.018, 0.048, 0.022), K.skin, sd * 0.043, -0.03, 0.012, {
        rz: sd * 0.5,
      });
      for (let i = 0; i < 4; i++)
        addPart(
          c,
          box(0.0155, 0.056, 0.02),
          K.skin,
          -0.0255 + i * 0.017,
          -0.105,
          0.0,
          { rx: racket && sd > 0 ? 0.7 : 0.15 },
        );
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
    const c = new THREE_.Group(),
      l = [];
    addPart(l, cyl(0.036, 0.028, 0.095, 12), K.cupMat, 0, -0.07, 0.04);
    addPart(l, cyl(0.037, 0.037, 0.02, 12), K.accent, 0, -0.06, 0.04);
    bake(l, c);
    c.visible = false;
    hand.add(c);
    return c;
  }

  function padel(hand, K, racketTex, DS) {
    const r = new THREE_.Group(),
      l = [];
    addPart(l, cyl(0.017, 0.017, 0.2, 10), K.grip, 0, -0.1, 0);
    addPart(l, cyl(0.02, 0.02, 0.025, 10), K.grip, 0, -0.205, 0);
    addPart(l, cyl(0.014, 0.014, 0.1, 8), K.frame, 0, -0.26, 0);
    addPart(
      l,
      new THREE_.TorusGeometry(0.125, 0.012, 8, 30),
      K.frame,
      0,
      -0.43,
      0,
      { sx: 0.85, sy: 1.15 },
    );
    bake(l, r);
    const face = new THREE_.Mesh(
      new THREE_.PlaneGeometry(0.25, 0.3),
      new THREE_.MeshBasicMaterial({
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

  function mats(ctx, shirt, skin, shorts, hairC, cap, o) {
    const s = ctx.std,
      K = {
        skin: s(skin, { roughness: 0.55 }),
        shirt: s(shirt, { roughness: 0.8 }),
        shorts: s(shorts, { roughness: 0.85 }),
      };
    K.skirt = !!o.skirt;
    K.skirtMat = s(o.skirt || 0x222833, { roughness: 0.85 });
    K.hairMat = s(hairC === undefined ? 0x2a1d14 : hairC, {
      roughness: 0.65,
      metalness: 0.05,
    });
    K.capMat = s(cap || 0x222222, { roughness: 0.75 });
    K.band = !!o.band;
    K.bandMat = s(o.band || 0xffffff, { roughness: 0.8 });
    K.white = s(0xf4f4f4, { roughness: 0.7 });
    K.shoe = s(0xf1f1f1, { roughness: 0.5 });
    K.sole = s(0x1c1d21, { roughness: 0.9 });
    K.accent = s(0xf26a1b, { roughness: 0.55 });
    K.trim = s(0xf4f4f4, { roughness: 0.7 });
    K.eyeWhite = s(0xf7f7f7, { roughness: 0.3 });
    K.iris = s(0x3a2a1c, { roughness: 0.3 });
    K.pupil = s(0x050505, { roughness: 0.2 });
    K.lip = s(0x8a423c, { roughness: 0.5 });
    K.lip2 = s(0x9d5148, { roughness: 0.45 });
    K.cupMat = s(0xf1ece2, { roughness: 0.5 });
    K.grip = s(0x16181c, { roughness: 0.8 });
    K.frame = s(0x1d2026, { roughness: 0.4, metalness: 0.3 });
    return K;
  }

  function build(ctx, shirt, skin, shorts, hairC, cap, o) {
    THREE_ = ctx.THREE;
    o = o || {};
    skin = skin || 0xe4b48c;
    shorts = shorts || 0x232733;
    const K = mats(ctx, shirt, skin, shorts, hairC, cap, o),
      fem = !!(o.skirt || o.pony);
    const g = new THREE_.Group(),
      up = new THREE_.Group();
    up.position.y = 0.84;
    g.add(up);
    legs(ctx, g, K);
    torso(ctx, up, K, fem);
    const head = new THREE_.Group();
    head.position.y = 0.6;
    up.add(head);
    face(head, K);
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
    );
    arms(
      ctx,
      up,
      K,
      g,
      shorts !== undefined &&
        ctx.racketOn !== false &&
        o.racket !== false &&
        ctx.hasShorts,
      fem,
      ctx.racket,
      ctx.DS,
    );
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
    THREE_ = ctx.THREE;
    const l = [], tray = new THREE_.Group();
    addPart(l, cyl(0.2, 0.2, 0.015, 24), ctx.std(0x2a2d33, { metalness: 0.7, roughness: 0.35 }), 0, 0, 0);
    [-0.09, 0, 0.09].forEach((x, i) => addPart(l, cyl(0.03, 0.024, 0.09, 12), ctx.std(i === 1 ? 0xf26a1b : 0xf1ece2, { roughness: 0.4 }), x, 0.05, i === 1 ? 0.05 : -0.04));
    bake(l, tray); tray.position.set(0, 0.2, 0.3); g.userData.up.add(tray);
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
