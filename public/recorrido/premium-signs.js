/* Muzzaga · sistema de señalética de la maqueta.
   Un solo lenguaje visual: panel carbón, acento naranja, tipografía de marca (Bebas Neue + Poppins),
   borde LED que brilla con el bloom. Reemplaza los carteles planos originales sin tocar la distribución. */
(function () {
  const ORANGE = "#f26a1b",
    INK = "#12151b",
    WHITE = "#ffffff";

  function install(ctx) {
    const { THREE, scene, plane, ctex, W, IMG, DS, std, box } = ctx;
    const steel = std(0x15171c, { metalness: 0.85, roughness: 0.3 });
    const led = new THREE.MeshBasicMaterial({ toneMapped: false });
    led.color.setRGB(1.5, 0.62, 0.2);
    const ledWarm = new THREE.MeshBasicMaterial({ toneMapped: false });
    ledWarm.color.setRGB(2.2, 1.6, 0.8);
    const mesh = (geo, mat, x, y, z, parent) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      (parent || scene).add(m);
      return m;
    };

    const findAt = (parent, x, y, tol) =>
      parent.children.find(
        (o) =>
          o.isMesh &&
          Math.abs(o.position.x - x) < (tol || 0.2) &&
          Math.abs(o.position.y - y) < (tol || 0.2),
      );
    const drop = (o) => {
      if (o && o.parent) o.parent.remove(o);
    };
    const fit = (g, text, maxW, px, font) => {
      do {
        g.font = px + "px " + font;
        px -= 2;
      } while (g.measureText(text).width > maxW && px > 10);
    };
    const BEBAS = '"Bebas Neue",Impact,sans-serif',
      POP = "Poppins,sans-serif";

    /* panel con marco de acero y borde LED, orientado con ry (π mira a -z, ±π/2 a los costados) */
    function panel(o) {
      const px = o.px || 200,
        nx = Math.sin(o.ry),
        nz = Math.cos(o.ry),
        side = Math.abs(Math.sin(o.ry)) > 0.5;
      const tex = ctex(Math.round(o.w * px), Math.round(o.h * px), (g, w, h) =>
        o.draw(g, w, h),
      );
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        toneMapped: false,
        side: DS,
        transparent: !!o.alpha,
        alphaTest: o.alpha ? 0.3 : 0,
      });
      mat.color.setScalar(o.glow || 1.12);
      const m = plane(o.w, o.h, o.x, o.y, o.z, o.ry, mat, o.parent);
      if (o.frame !== false) {
        const bx = o.x - nx * 0.035,
          bz = o.z - nz * 0.035,
          fw = o.w + 0.1,
          fh = o.h + 0.1;
        box(side ? 0.05 : fw, fh, side ? fw : 0.05, bx, o.y, bz, steel, {
          parent: o.parent,
        });
        if (o.led !== false) {
          const e = side
            ? [0.03, 0.025, o.w + 0.06]
            : [o.w + 0.06, 0.025, 0.03];
          box(
            e[0],
            e[1],
            e[2],
            o.x - nx * 0.012,
            o.y - o.h / 2 - 0.045,
            o.z - nz * 0.012,
            led,
            { parent: o.parent },
          );
        }
      }
      return m;
    }
    const base = (g, w, h) => {
      g.fillStyle = INK;
      g.fillRect(0, 0, w, h);
      g.fillStyle = ORANGE;
      g.fillRect(0, 0, w, Math.max(6, h * 0.05));
    };

    /* ---- pared de torneos (lado derecho) ---- */
    const torneos = findAt(W.right, 13.8, 3.05);
    if (torneos) {
      drop(torneos);
      panel({
        w: 6.2,
        h: 0.8,
        x: 13.8,
        y: 3.05,
        z: -6,
        ry: -Math.PI / 2,
        parent: W.right,
        draw: (g, w, h) => {
          base(g, w, h);
          g.fillStyle = ORANGE;
          g.fillRect(0, 0, h * 1.05, h);
          g.fillStyle = WHITE;
          g.beginPath();
          g.moveTo(h * 0.3, h * 0.22);
          g.lineTo(h * 0.75, h * 0.22);
          g.lineTo(h * 0.68, h * 0.5);
          g.quadraticCurveTo(h * 0.52, h * 0.62, h * 0.37, h * 0.5);
          g.closePath();
          g.fill();
          g.fillRect(h * 0.48, h * 0.58, h * 0.06, h * 0.14);
          g.fillRect(h * 0.38, h * 0.72, h * 0.26, h * 0.06);
          g.textBaseline = "alphabetic";
          g.fillStyle = WHITE;
          fit(g, "TORNEOS TODO EL AÑO", w - h * 1.4 - 640, 150, BEBAS);
          g.textAlign = "left";
          g.fillText("TORNEOS TODO EL AÑO", h * 1.35, h * 0.74);
          g.fillStyle = ORANGE;
          g.font = "600 34px " + POP;
          g.textAlign = "right";
          g.fillText("Libre · Caballeros · Damas", w - 40, h * 0.66);
        },
      });
    }

    /* ---- próximamente ---- */
    const prox = findAt(W.right, 13.82, 3.65);
    if (prox) {
      const z = prox.position.z;
      drop(prox);
      panel({
        w: 3.8,
        h: 0.95,
        x: 13.82,
        y: 3.65,
        z,
        ry: -Math.PI / 2,
        parent: W.right,
        draw: (g, w, h) => {
          base(g, w, h);
          g.save();
          g.beginPath();
          g.rect(0, h - 22, w, 22);
          g.clip();
          g.fillStyle = ORANGE;
          for (let x = -40; x < w + 40; x += 46) {
            g.beginPath();
            g.moveTo(x, h);
            g.lineTo(x + 23, h);
            g.lineTo(x + 46, h - 22);
            g.lineTo(x + 23, h - 22);
            g.fill();
          }
          g.restore();
          g.textAlign = "center";
          g.fillStyle = ORANGE;
          g.font = "150px " + BEBAS;
          g.fillText("PRÓXIMAMENTE", w / 2, h * 0.58);
          g.fillStyle = WHITE;
          g.font = "500 40px " + POP;
          g.fillText("Nuevo espacio del club", w / 2, h * 0.84 - 8);
        },
      });
    }

    /* ---- cartel luminoso de las canchas ---- */
    panel({
      w: 3.8,
      h: 0.7,
      x: 13.8,
      y: 3.25,
      z: -14,
      ry: -Math.PI / 2,
      parent: W.right,
      draw: (g, w, h) => {
        g.fillStyle = ORANGE;
        g.fillRect(0, 0, w, h);
        g.fillStyle = "rgba(0,0,0,.12)";
        g.fillRect(0, h - 10, w, 10);
        g.textAlign = "center";
        g.fillStyle = WHITE;
        fit(g, "CANCHAS DE PÁDEL", w - 80, 150, BEBAS);
        g.fillText("CANCHAS DE PÁDEL", w / 2, h * 0.76);
      },
      glow: 1.25,
    });

    /* ---- placas de cada cancha, colgadas de la viga ---- */
    [
      [-6.5, "CANCHA 1", "EL TANO"],
      [6.5, "CANCHA 2", "LA VASCA"],
    ].forEach(([cx, a, b]) => {
      panel({
        w: 2.8,
        h: 0.46,
        x: cx,
        y: 2.52,
        z: 3.9,
        ry: Math.PI,
        draw: (g, w, h) => {
          base(g, w, h);
          g.textAlign = "left";
          g.fillStyle = ORANGE;
          g.font = "600 40px " + POP;
          g.fillText(a, 34, h * 0.64);
          g.textAlign = "right";
          g.fillStyle = WHITE;
          g.font = "78px " + BEBAS;
          g.fillText(b, w - 34, h * 0.78);
        },
      });
      [-1.2, 1.2].forEach((dx) =>
        mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6),
          steel,
          cx + dx,
          2.78,
          3.9,
        ),
      );
    });

    /* ---- logo grande en la pared del frente, sobre las mesas ---- */
    panel({
      w: 4.4,
      h: 1.0,
      x: -8,
      y: 3.45,
      z: 17.78,
      ry: Math.PI,
      parent: W.front,
      draw: (g, w, h) => {
        g.fillStyle = INK;
        g.fillRect(0, 0, w, h);
        g.fillStyle = ORANGE;
        g.fillRect(0, h - 8, w, 8);
        if (IMG.badge && IMG.badge.naturalWidth)
          g.drawImage(IMG.badge, 34, 22, h - 60, h - 60);
        g.textAlign = "left";
        g.fillStyle = WHITE;
        g.font = "170px " + BEBAS;
        g.fillText("MUZZAGA", h + 6, h * 0.6);
        g.fillStyle = ORANGE;
        g.font = "600 40px " + POP;
        g.fillText("PÁDEL · CANTINA · TORNEOS", h + 10, h * 0.86);
      },
      glow: 1.18,
    });
  }

  window.MuzzagaSigns = { install };
})();
