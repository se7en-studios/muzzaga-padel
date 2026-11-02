/* Muzzaga · mejoras de calidad de la maqueta (materiales PBR, luces, cantina y mobiliario).
   Se llama una vez, antes de que la escena marque qué proyecta sombras. No cambia la
   distribución: solo reemplaza materiales y completa los espacios vacíos. */
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
    const chairSpots = [];
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

    woodFloor();
    turf();
    metalWalls();
    ledAccents();
    courtLighting();
    coffeeBar();
    fridges();
    signage();
    pendants();
    seating();
    decor();
    people();

    /* ---- piso de madera: tablas con vetas, juntas escalonadas, relieve y reflejo ---- */
    function woodFloor() {
      const S = 1024,
        rows = 16,
        rh = S / rows,
        boards = [];
      for (let r = 0; r < rows; r++) {
        let x = -rand() * 420;
        while (x < S) {
          const len = 380 + rand() * 280;
          boards.push({
            r,
            x,
            len,
            h: 24 + rand() * 9,
            s: 36 + rand() * 14,
            l: 36 + rand() * 16,
            knot: rand() < 0.12,
          });
          x += len;
        }
      }
      const draw = (bump) => (g, w, h) => {
        g.fillStyle = bump ? "#bdbdbd" : "#6b4526";
        g.fillRect(0, 0, w, h);
        boards.forEach((b) => {
          const y = b.r * rh;
          g.fillStyle = bump
            ? "#c8c8c8"
            : "hsl(" + b.h + "," + b.s + "%," + b.l + "%)";
          g.fillRect(b.x, y, b.len, rh);
          for (let k = 0; k < 16; k++) {
            const gy = y + rand() * rh;
            g.strokeStyle = bump
              ? "rgba(0,0,0," + (0.05 + rand() * 0.1) + ")"
              : "rgba(60,30,10," + (0.05 + rand() * 0.14) + ")";
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(b.x, gy);
            g.bezierCurveTo(
              b.x + b.len * 0.3,
              gy + (rand() - 0.5) * 5,
              b.x + b.len * 0.65,
              gy + (rand() - 0.5) * 5,
              b.x + b.len,
              gy,
            );
            g.stroke();
          }
          if (b.knot) {
            g.fillStyle = bump ? "rgba(0,0,0,.25)" : "rgba(70,35,12,.45)";
            g.beginPath();
            g.ellipse(
              b.x + b.len * (0.2 + rand() * 0.6),
              y + rh / 2,
              9,
              4,
              0,
              0,
              7,
            );
            g.fill();
          }
          g.fillStyle = bump ? "#202020" : "rgba(25,12,4,.7)";
          g.fillRect(b.x, y, 2.5, rh);
        });
        for (let r = 0; r < rows; r++) {
          g.fillStyle = bump ? "#202020" : "rgba(25,12,4,.65)";
          g.fillRect(0, r * rh, w, 2.5);
        }
      };
      const map = ctx.ctex(S, S, draw(false), 7.7, 4.8),
        bump = ctx.ctex(S, S, draw(true), 7.7, 4.8);
      bump.encoding = THREE.LinearEncoding;
      map.anisotropy = bump.anisotropy = aniso;
      const m = wood.material;
      m.map = map;
      m.bumpMap = bump;
      m.bumpScale = 1.6;
      m.roughness = 0.38;
      m.metalness = 0;
      m.envMapIntensity = 1.2;
      m.needsUpdate = true;
      // junta metálica entre la madera y el cemento
      box(27.7, 0.025, 0.07, 0, 0.03, 4.2, brass);
    }

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
      dark.bumpMap = bump;
      dark.bumpScale = 0.9;
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
        const sp = new THREE.SpotLight(0xf3f7ff, 1.2, 36, 1.0, 0.9, 1.3);
        sp.position.set(cx, 7.6, -6);
        sp.target.position.set(cx, 0, -6);
        scene.add(sp, sp.target);
        [-5, 5].forEach((dx) =>
          box(0.1, 0.05, 15, cx + dx, 2.96, -6, ledWhite),
        );
      });
    }

    /* ---- barra: máquina de café, molinillo, vitrina con pasteles y terminal de cobro ---- */
    function coffeeBar() {
      const top = 1.165,
        grp = new THREE.Group();
      grp.position.set(0.4, top, 15.45);
      scene.add(grp);
      const add = (geo, mat, x, y, z) => mesh(geo, mat, x, y, z, grp);
      add(new THREE.BoxGeometry(0.64, 0.42, 0.42), steel, 0, 0.21, 0);
      add(new THREE.BoxGeometry(0.66, 0.03, 0.44), brass, 0, 0.435, 0);
      [-0.16, 0.16].forEach((x) => {
        add(cyl(0.045, 0.045, 0.06), steel, x, 0.3, 0.2);
        add(new THREE.BoxGeometry(0.05, 0.03, 0.14), steel, x, 0.27, 0.3);
      });
      add(new THREE.BoxGeometry(0.5, 0.02, 0.18), steel, 0, 0.1, 0.27);
      add(new THREE.BoxGeometry(0.05, 0.03, 0.02), ledOrange, 0.24, 0.38, 0.22);
      [-0.2, 0, 0.2].forEach((x) =>
        add(
          cyl(0.035, 0.03, 0.05, 12),
          std(0xf4f1ea, { roughness: 0.3 }),
          x,
          0.135,
          0.27,
        ),
      );
      add(cyl(0.012, 0.012, 0.22, 8), steel, 0.3, 0.3, 0.14);
      add(cyl(0.07, 0.09, 0.42, 14), steel, 0.55, 0.21, 0);
      add(
        new THREE.ConeGeometry(0.12, 0.18, 14),
        std(0x1a1c20, { transparent: true, opacity: 0.7 }),
        0.55,
        0.5,
        0,
      );
      solid(-0.2, 1.2, 15.0, 15.9);

      const dg = new THREE.Group();
      dg.position.set(5.6, top, 15.4);
      scene.add(dg);
      const glass = new THREE.MeshStandardMaterial({
        color: 0xcfe8ff,
        transparent: true,
        opacity: 0.16,
        roughness: 0.05,
        metalness: 0,
        depthWrite: false,
      });
      mesh(new THREE.BoxGeometry(1.0, 0.4, 0.44), glass, 0, 0.22, 0, dg);
      mesh(new THREE.BoxGeometry(1.04, 0.03, 0.48), steel, 0, 0.015, 0, dg);
      mesh(new THREE.BoxGeometry(0.96, 0.02, 0.4), ledWarm, 0, 0.41, 0, dg);
      const pastry = [0xd79a45, 0xb9742f, 0xe6b45e];
      for (let i = 0; i < 9; i++) {
        const c = pastry[i % 3];
        mesh(
          i % 2
            ? new THREE.SphereGeometry(0.06, 10, 8)
            : cyl(0.06, 0.07, 0.05, 12),
          std(c, { roughness: 0.55 }),
          -0.38 + (i % 5) * 0.19,
          0.075 + (i > 4 ? 0.16 : 0),
          i > 4 ? 0.08 : -0.08,
          dg,
        );
      }
      sign(
        [{ t: "EMPANADAS · PIZZAS", s: 56, c: "#f26a1b" }],
        0.9,
        0.16,
        5.6,
        top + 0.5,
        15.64,
        Math.PI,
        { bg: "#14161c" },
      );

      const tab = new THREE.Group();
      tab.position.set(2.6, top, 14.95);
      scene.add(tab);
      mesh(cyl(0.035, 0.05, 0.2, 10), steel, 0, 0.1, 0, tab);
      const scr = mesh(
        new THREE.PlaneGeometry(0.3, 0.2),
        new THREE.MeshBasicMaterial({
          map: ctx.textTex(
            [
              { t: "MUZZAGA", s: 70, c: "#f26a1b" },
              {
                t: "Turnos y cantina",
                s: 30,
                f: "Poppins,sans-serif",
                c: "#fff",
              },
            ],
            300,
            200,
            { bg: "#0e1116" },
          ),
          toneMapped: false,
        }),
        0,
        0.28,
        0,
        tab,
      );
      scr.rotation.x = -0.35;
      scr.material.color.setScalar(1.3);
      blob(0.4, 15.5, 1.6, 0.9);
      blob(5.6, 15.4, 1.5, 0.8);
    }

    /* ---- heladeras exhibidoras: puerta de vidrio y botellas de colores ---- */
    function fridges() {
      const cols = [0x2f8f4e, 0xd8b030, 0x3e72d9, 0xe0e0e0, 0xd9534f, 0x6b3a1a];
      const inst = new THREE.InstancedMesh(
          cyl(0.045, 0.05, 0.28, 10),
          std(0xffffff, { roughness: 0.25, metalness: 0.1 }),
          36,
        ),
        tmp = new THREE.Object3D(),
        c = new THREE.Color();
      let n = 0;
      [-0.3, 0.7].forEach((x) =>
        [0.55, 1.0, 1.45].forEach((y) => {
          for (let i = 0; i < 6; i++) {
            tmp.position.set(x - 0.34 + i * 0.136, y, 17.07);
            tmp.updateMatrix();
            inst.setMatrixAt(n, tmp.matrix);
            inst.setColorAt(
              n++,
              c.setHex(cols[(i + (y > 1 ? 2 : 0)) % cols.length]),
            );
          }
        }),
      );
      scene.add(inst);
      const door = new THREE.MeshStandardMaterial({
        color: 0xbfe0ff,
        transparent: true,
        opacity: 0.16,
        roughness: 0.04,
        depthWrite: false,
      });
      [-0.3, 0.7].forEach((x) => {
        mesh(
          new THREE.PlaneGeometry(0.84, 1.8),
          door,
          x,
          0.95,
          17.0,
        ).rotation.y = Math.PI;
        [0.4, 0.86, 1.32, 1.78].forEach((y) =>
          box(0.84, 0.02, 0.18, x, y, 17.06, steel),
        );
        box(0.88, 0.06, 0.04, x, 1.88, 16.99, ledWarm);
        box(0.03, 1.0, 0.03, x + 0.4, 0.95, 16.97, steel);
      });
    }

    /* ---- señalética: carta, pantalla de marca, letrero luminoso y placa de la barra (sin superposiciones) ---- */
    function signage() {
      const drop = (parent, x, y, z) => parent.children.slice().forEach(o => { if (o.isMesh && Math.abs(o.position.x - x) < 0.2 && Math.abs(o.position.y - y) < 0.2 && Math.abs(o.position.z - z) < 0.2) parent.remove(o); });
      drop(W.front, 2.8, 3.0, 17.82); drop(W.front, -0.3, 3.0, 17.82); drop(scene, 0.9, 1.5, 15.0); drop(scene, -0.1, 1.35, 15.15);
      const glow = (m, k) => { m.material.color.setScalar(k); return m; };

      // carta
      const food = [['Pizza muzza', '$18.000'], ['Pizza napo', '$20.000'], ['Tostados', '$14.000'], ['Empanada', '$2.000']];
      const drinks = ['Cerveza bien fría', 'Gaseosas', 'Café y té'];
      const menu = ctx.ctex(1024, 480, (g, w, h) => {
        g.fillStyle = '#12151b'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#f26a1b'; g.fillRect(0, 0, w, 140);
        g.fillStyle = '#ffffff'; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.font = '104px "Bebas Neue",Impact,sans-serif'; g.fillText('LA CARTA', 44, 108);
        g.textAlign = 'right'; g.font = '600 30px Poppins,sans-serif'; g.fillText('CANTINA · MUZZAGA PÁDEL', w - 44, 84);
        const col = (x, title, rows, price) => {
          g.textAlign = 'left'; g.fillStyle = '#f26a1b'; g.font = '52px "Bebas Neue",Impact,sans-serif'; g.fillText(title, x, 208);
          rows.forEach((r, i) => {
            const y = 262 + i * 56; g.fillStyle = '#ffffff'; g.font = '500 34px Poppins,sans-serif'; g.textAlign = 'left'; g.fillText(price ? r[0] : r, x, y);
            if (price) { g.textAlign = 'right'; g.fillStyle = '#f26a1b'; g.font = '600 34px Poppins,sans-serif'; g.fillText(r[1], x + 420, y); }
            g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, y + 14, 420, 2);
          });
        };
        col(44, 'COMIDA', food, true); col(548, 'BEBIDAS', drinks, false);
        g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'right'; g.font = '500 26px Poppins,sans-serif'; g.fillText('Opciones sin TACC · pedí en la barra', w - 44, 452);
      });
      glow(plane(3.2, 1.5, 2.8, 3.15, 17.8, Math.PI, new THREE.MeshBasicMaterial({ map: menu, toneMapped: false }), W.front), 1.15);
      box(3.3, 1.6, 0.05, 2.8, 3.15, 17.84, steel, { parent: W.front }); box(3.0, 0.03, 0.05, 2.8, 2.33, 17.75, ledWarm, { parent: W.front });

      // pantalla de marca (reemplaza al cartel azul)
      const tv = ctx.ctex(512, 288, (g, w, h) => {
        g.fillStyle = '#0b0d12'; g.fillRect(0, 0, w, h); g.fillStyle = '#f26a1b'; g.fillRect(0, h - 10, w, 10);
        if (IMG.badge && IMG.badge.naturalWidth) g.drawImage(IMG.badge, 36, 54, 150, 150);
        g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.font = '86px "Bebas Neue",Impact,sans-serif'; g.fillText('MUZZAGA', 212, 130);
        g.fillStyle = '#f26a1b'; g.font = '56px "Bebas Neue",Impact,sans-serif'; g.fillText('PÁDEL', 212, 184);
        g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '500 24px Poppins,sans-serif'; g.fillText('Turnos · Torneos · Cantina', 212, 226);
      });
      glow(plane(2.1, 1.18, -0.3, 3.0, 17.8, Math.PI, new THREE.MeshBasicMaterial({ map: tv, toneMapped: false }), W.front), 1.1);
      box(2.22, 1.3, 0.06, -0.3, 3.0, 17.84, steel, { parent: W.front });

      // letrero luminoso sobre el horno
      const neon = ctx.ctex(512, 160, (g, w, h) => { g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.fillStyle = '#ff7a2a'; g.font = '130px "Bebas Neue",Impact,sans-serif'; g.fillText('CANTINA', w / 2, 122); });
      const nm = new THREE.MeshBasicMaterial({ map: neon, transparent: true, alphaTest: 0.3, toneMapped: false, side: DS }); nm.color.setScalar(2.4);
      plane(1.9, 0.6, 5.95, 3.0, 17.78, Math.PI, nm, W.front); box(2.1, 0.74, 0.04, 5.95, 3.0, 17.84, steel, { parent: W.front });

      // placa en el frente de la barra
      const plaque = ctx.ctex(512, 80, (g, w, h) => { g.fillStyle = '#12151b'; g.fillRect(0, 0, w, h); g.fillStyle = '#f26a1b'; g.fillRect(0, h - 5, w, 5); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '56px "Bebas Neue",Impact,sans-serif'; g.fillText('MUZZAGA · CANTINA', w / 2, 58); });
      plane(2.4, 0.375, 3, 0.62, 14.79, Math.PI, new THREE.MeshBasicMaterial({ map: plaque, toneMapped: false }));
    }

    /* ---- lámparas colgantes sobre un tirante de acero apoyado en dos columnas ---- */
    function pendants() {
      box(8.8, 0.12, 0.12, 3, 4.5, 14.4, steel);
      [-1.3, 7.3].forEach((x) => {
        box(0.14, 4.5, 0.14, x, 2.25, 14.4, steel, { solid: true });
      });
      const shade = cyl(0.1, 0.26, 0.28, 24),
        bulb = new THREE.SphereGeometry(0.075, 12, 10),
        cable = cyl(0.008, 0.008, 1.0, 6);
      [-0.2, 1.6, 3.4, 5.2, 7.0].forEach((x) => {
        mesh(cable, steel, x, 3.95, 14.4);
        const s = mesh(
          shade,
          std(0x14161b, { metalness: 0.7, roughness: 0.35, side: DS }),
          x,
          3.28,
          14.4,
        );
        mesh(bulb, ledWarm, x, 3.2, 14.4);
        s.userData.noCast = true;
      });
      [1.6, 5.2].forEach((x) => {
        const l = new THREE.PointLight(0xffb468, 1.5, 9, 2);
        l.position.set(x, 2.9, 14.9);
        scene.add(l);
      });
    }

    /* ---- mobiliario de diseño: mesas redondas con sillas en la franja libre + lámpara de pie ---- */
    function seating() {
      const woodTop = std(0x5b3d28, { roughness: 0.4 }),
        seatCols = [0x2d3340, 0xf26a1b, 0x2d3340];
      function chair(x, z, ry, col) {
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        g.rotation.y = ry;
        scene.add(g);
        mesh(
          cyl(0.21, 0.19, 0.05, 20),
          std(col, { roughness: 0.55 }),
          0,
          0.45,
          0,
          g,
        );
        const back = new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.21,
            0.21,
            0.3,
            20,
            1,
            true,
            Math.PI - 1.0,
            2.0,
          ),
          std(col, { roughness: 0.55, side: DS }),
        );
        back.position.set(0, 0.7, 0);
        g.add(back);
        [
          [-0.13, -0.13],
          [0.13, -0.13],
          [-0.13, 0.13],
          [0.13, 0.13],
        ].forEach(([dx, dz]) =>
          mesh(cyl(0.012, 0.012, 0.45, 6), steel, dx, 0.225, dz, g),
        );
      }
      function tableSet(x, z, n) {
        mesh(cyl(0.5, 0.5, 0.04, 28), woodTop, x, 0.74, z);
        mesh(cyl(0.045, 0.06, 0.72, 10), steel, x, 0.37, z);
        mesh(cyl(0.3, 0.3, 0.03, 20), steel, x, 0.015, z);
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * 2 * i) / n + 0.5;
          chair(
            x + Math.sin(a) * 0.82,
            z + Math.cos(a) * 0.82,
            a + Math.PI,
            seatCols[i % 3],
          );
        }
        for (let i = 0; i < n; i++) { const a = (Math.PI * 2 * i) / n + 0.5; chairSpots.push({ x: x + Math.sin(a) * 0.82, z: z + Math.cos(a) * 0.82, ry: a + Math.PI }); }
        solid(x - 1.05, x + 1.05, z - 1.05, z + 1.05);
        blob(x, z, 2.8, 2.8);
      }
      tableSet(-9.5, 9.2, 3);
      tableSet(-5.4, 9.8, 3);
      tableSet(-1.4, 9.2, 4);
      // lámpara de pie junto al living
      mesh(cyl(0.02, 0.02, 1.5, 8), steel, -12.9, 0.75, 17.0);
      mesh(cyl(0.18, 0.18, 0.03, 16), steel, -12.9, 0.015, 17.0);
      mesh(cyl(0.12, 0.2, 0.28, 20), ledWarm, -12.9, 1.55, 17.0);
      solid(-13.1, -12.7, 16.8, 17.2);
    }

    /* ---- gente: barista, clientes en las mesas y la barra, jugadores descansando en los bancos ---- */
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
      mk(0.4, 0, 16.25, Math.PI, 'coffee');
      chairSpots.forEach((c, i) => { if (i % 3 === 2) return; mk(c.x, -0.34, c.z, c.ry, i % 2 ? 'talk' : 'drink', true); });
      mk(2.0, 0, 13.45, 0, 'talk'); mk(4.7, 0, 13.4, 0, 'drink');
      [-2.85, -1.95, 1.95, 2.85].forEach((x, i) => mk(x, -0.32, 5.55, Math.PI, i % 2 ? 'talk' : 'drink', true));
    }

    /* ---- plantas, cuadros con fotos reales y umbrales ---- */
    function decor() {
      const leaf = std(0x2f7a3a, { roughness: 0.7 }),
        pot = std(0x3a3d44, { roughness: 0.8 });
      [
        [-13.2, 6.6],
        [-13.2, 11.2],
        [8.3, 17.2],
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
