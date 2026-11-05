/* Muzzaga · mejoras de calidad de la maqueta (materiales PBR, luces, cantina y mobiliario).
   Se llama una vez, antes de que la escena marque qué proyecta sombras. El frente del club
   (piso, barra, cocina, baños y mesas) lo arma premium-club.js con la distribución real. */
(function () {
  function enhance(ctx) {
    const {
      THREE,
      scene,
      renderer,
      std,
      box,
      plane,
      sign,
      ctex,
      W,
      IMG,
      DS,
      solid,
      wood,
      person,
    } = ctx;
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const rand = (function (a) {
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })(2026);

    const steel = std(0x15171c, { metalness: 0.85, roughness: 0.3 });
    const brass = std(0xb9893f, { metalness: 0.9, roughness: 0.28 });
    const glowOf = (r, g, b, k) => {
      const m = new THREE.MeshBasicMaterial({ toneMapped: false });
      m.color.setRGB(r * k, g * k, b * k);
      return m;
    };
    const ledWarm = glowOf(1, 0.72, 0.38, 2.2),
      ledOrange = glowOf(1, 0.5, 0.15, 1.7),
      ledWhite = glowOf(1, 0.97, 0.9, 2.4);
    const mesh = (geo, mat, x, y, z, parent) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      (parent || scene).add(m);
      return m;
    };
    const cyl = (rt, rb, h, seg) =>
      new THREE.CylinderGeometry(rt, rb, h, seg || 16);
    const blobTex = ctx.ctex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, "rgba(0,0,0,.9)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    });
    const blobMat = new THREE.MeshBasicMaterial({
      map: blobTex,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      toneMapped: false,
    });
    const blob = (x, z, w, d) => {
      const m = mesh(new THREE.PlaneGeometry(w, d), blobMat, x, 0.04, z);
      m.rotation.x = -Math.PI / 2;
      m.userData.noCast = true;
    };

    turf();
    metalWalls();
    ledAccents();
    courtLighting();
    decor();
    people();

    /* ---- césped sintético: fibra, franjas de corte y relieve (las líneas blancas se conservan) ---- */
    function turf() {
      const seen = new Set();
      scene.traverse((o) => {
        if (
          !o.isMesh ||
          o.geometry.type !== "PlaneGeometry" ||
          o.geometry.parameters.width !== 10 ||
          o.geometry.parameters.height !== 20
        )
          return;
        const m = o.material,
          img = m.map && m.map.image;
        if (!img || seen.has(img)) {
          if (img && m.bumpMap === null) m.bumpMap = seen.bump;
          return;
        }
        seen.add(img);
        const g = img.getContext("2d"),
          w = img.width,
          h = img.height;
        for (let i = 0; i < 20; i++) {
          g.fillStyle = i % 2 ? "rgba(255,255,255,.028)" : "rgba(0,0,40,.04)";
          g.fillRect(0, (i * h) / 20, w, h / 20);
        }
        for (let i = 0; i < 26000; i++) {
          g.fillStyle =
            rand() < 0.5 ? "rgba(130,170,255,.035)" : "rgba(0,10,70,.05)";
          g.fillRect(rand() * w, rand() * h, 1, 1);
        }
        m.map.needsUpdate = true;
        const bump = ctx.ctex(w, h, (b, bw, bh) => {
          b.fillStyle = "#909090";
          b.fillRect(0, 0, bw, bh);
          for (let i = 0; i < 60000; i++) {
            const v = (120 + rand() * 60) | 0;
            b.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
            b.fillRect(rand() * bw, rand() * bh, 1, 2);
          }
        });
        bump.encoding = THREE.LinearEncoding;
        seen.bump = bump;
        m.bumpMap = bump;
        m.bumpScale = 0.3;
        m.roughness = 0.7;
        m.envMapIntensity = 0.5;
        m.needsUpdate = true;
      });
    }

    /* ---- paredes interiores: chapa trapezoidal con relieve y reflejo ---- */
    function metalWalls() {
      const dark = ctx.darkMat;
      const bump = ctx.ctex(
        32,
        8,
        (g, w, h) => {
          const gr = g.createLinearGradient(0, 0, w, 0);
          gr.addColorStop(0, "#000");
          gr.addColorStop(0.35, "#999");
          gr.addColorStop(0.5, "#fff");
          gr.addColorStop(1, "#000");
          g.fillStyle = gr;
          g.fillRect(0, 0, w, h);
        },
        1,
        1,
      );
      bump.encoding = THREE.LinearEncoding;
      if (!dark.userData.foto) { dark.bumpMap = bump; dark.bumpScale = 0.9; } // la chapa de foto ya trae su relieve
      dark.metalness = 0.66;
      dark.roughness = 0.34;
      dark.envMapIntensity = 1.3;
      dark.needsUpdate = true;
      // zócalos metálicos
      box(0.07, 0.2, 35.6, -13.82, 0.1, 0, steel, { parent: W.left });
      box(0.07, 0.2, 35.6, 13.82, 0.1, 0, steel, { parent: W.right });
      box(27.6, 0.2, 0.07, 0, 0.1, -17.82, steel, { parent: W.back });
    }

    /* ---- acentos LED naranja en las paredes ---- */
    function ledAccents() {
      box(0.04, 0.07, 35.6, -13.8, 5.45, 0, ledOrange, { parent: W.left });
      box(0.04, 0.07, 35.6, 13.8, 5.45, 0, ledOrange, { parent: W.right });
      box(27.6, 0.07, 0.04, 0, 5.45, -17.8, ledOrange, { parent: W.back });
      box(27.6, 0.07, 0.04, 0, 5.45, 17.8, ledOrange, { parent: W.front });
    }

    /* ---- iluminación deportiva: focos blancos sobre cada cancha + barras LED en las vigas ---- */
    function courtLighting() {
      [-6.5, 6.5].forEach((cx) => {
        const sp = new THREE.SpotLight(0xf3f7ff, 1.9, 36, 0.95, 0.85, 1.3);
        sp.position.set(cx, 7.6, -6);
        sp.target.position.set(cx, 0, -6);
        scene.add(sp, sp.target);
        [-5, 5].forEach((dx) =>
          box(0.1, 0.05, 15, cx + dx, 2.96, -6, ledWhite),
        );
      });
    }

    /* ---- gente: jugadores descansando en los bancos (los de la barra y las mesas los pone premium-club.js) ---- */
    function people() {
      if (!person) return;
      const LOOKS = [
        { s: 0xf26a1b, k: 0xe4b48c, h: 0x2a1d14, o: {} }, { s: 0x2f6fd6, k: 0xc68a63, h: 0x111111, o: {} },
        { s: 0xffffff, k: 0xd9a47c, h: 0x5a3b22, o: { skirt: 0x2d3340, pony: true, band: 0xf26a1b } }, { s: 0x1f9d6b, k: 0x9a6a47, h: 0x111111, o: {} },
        { s: 0x3a3f4b, k: 0xe4b48c, h: 0xb08a4a, o: { skirt: 0xffffff } }, { s: 0xd9534f, k: 0xc68a63, h: 0x2a1d14, o: {} },
        { s: 0x8a4fd1, k: 0xe4b48c, h: 0x5a3b22, o: { pony: true, skirt: 0x222833 } }, { s: 0xf4c430, k: 0x9a6a47, h: 0x111111, o: {} },
      ];
      let n = 0;
      const mk = (x, y, z, ry, act, seat) => {
        const L = LOOKS[n++ % LOOKS.length], p = person(L.s, L.k, undefined, L.h, undefined, L.o);
        p.position.set(x, y, z); p.rotation.y = ry; p.userData.act = act; if (seat) p.userData.legL.rotation.x = p.userData.legR.rotation.x = -1.5;
        scene.add(p); return p;
      };
      [-2.85, -1.95, 1.95, 2.85].forEach((x, i) => mk(x, -0.32, 5.55, Math.PI, i % 2 ? 'talk' : 'drink', true));
    }

    /* ---- plantas, cuadros con fotos reales y umbrales ---- */
    function decor() {
      const leaf = std(0x2f7a3a, { roughness: 0.7 }),
        pot = std(0x3a3d44, { roughness: 0.8 });
      [
        [-13.2, 6.6],
      ].forEach(([x, z]) => {
        mesh(cyl(0.3, 0.22, 0.5, 14), pot, x, 0.25, z);
        for (let i = 0; i < 9; i++) {
          const a = i * 0.7,
            l = mesh(
              new THREE.SphereGeometry(0.14, 8, 6),
              leaf,
              x + Math.sin(a) * 0.14,
              0.85 + (i % 3) * 0.16,
              z + Math.cos(a) * 0.14,
            );
          l.scale.set(0.8, 2.6, 0.5);
          l.rotation.set(Math.cos(a) * 0.5, a, Math.sin(a) * 0.5);
        }
        solid(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
        blob(x, z, 1.5, 1.5);
      });
      [
        ["canchasVista", 12.2],
        ["lounge", 15.2],
      ].forEach(([k, z]) => {
        const img = IMG[k];
        if (!img || !img.naturalWidth) return;
        const tex = ctx.ctex(320, 220, (g, w, h) =>
          g.drawImage(img, 0, 0, w, h),
        );
        box(0.05, 1.12, 1.52, -13.8, 2.4, z, steel, { parent: W.left });
        plane(
          1.4,
          1.0,
          -13.77,
          2.4,
          z,
          Math.PI / 2,
          new THREE.MeshBasicMaterial({
            map: tex,
            toneMapped: false,
            side: DS,
          }),
          W.left,
        );
      });
    }
  }

  window.MuzzagaScene = { enhance };
})();
