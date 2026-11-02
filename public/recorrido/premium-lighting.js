/* Muzzaga · iluminación local de la maqueta (modo atardecer).
   Luces cálidas puntuales (living, entrada, barra), derrame de luz blanca sobre las canchas y
   sombras de contacto al pie de las paredes. Las luces nuevas se encienden de a poco (addFade).
   En pantallas chicas se omiten las luces puntuales para no pasarse del límite de uniformes. */
(function () {
  function install(ctx) {
    const { THREE, scene, ctex, addFade } = ctx;
    const mobile = innerWidth < 860;

    /* ---- luces cálidas locales ---- */
    if (!mobile) {
      [
        [0xffb468, 1.3, 6, -12.9, 1.7, 17.0],
        [0xffa050, 1.2, 7, -15.3, 2.9, 6.8],
        [0xff8a30, 0.9, 5, 3, 0.5, 14.6],
      ].forEach(([c, k, d, x, y, z]) => {
        const l = new THREE.PointLight(c, k, d, 2);
        l.position.set(x, y, z);
        scene.add(l);
        addFade(l, k);
      });
    }

    /* ---- derrame de luz blanca de los focos sobre el borde interior de las canchas ---- */
    const spill = ctex(64, 4, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, "rgba(255,255,255,0)");
      gr.addColorStop(1, "rgba(235,242,255,1)");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    const spillMat = new THREE.MeshBasicMaterial({
      map: spill,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    [-6.5, 6.5].forEach((cx) =>
      [-1, 1].forEach((sd) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 15), spillMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(cx + sd * 3.7, 0.055, -6);
        m.scale.x = sd;
        m.userData.noCast = true;
        scene.add(m);
      }),
    );
    addFade(spillMat, 0.22);

    /* ---- sombra de contacto al pie de las paredes interiores ---- */
    const ao = ctex(4, 64, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "rgba(0,0,0,.5)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    const aoMat = new THREE.MeshBasicMaterial({
      map: ao,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const along = (len, x, z, rot) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.0), aoMat);
      m.rotation.set(-Math.PI / 2, 0, rot);
      m.position.set(x, 0.03, z);
      m.userData.noCast = true;
      scene.add(m);
    };
    along(35.6, -13.35, 0, Math.PI / 2); // pared izquierda
    along(35.6, 13.35, 0, -Math.PI / 2); // pared derecha
    along(27.6, 0, -17.3, 0); // pared del fondo
    along(27.6, 0, 17.3, Math.PI); // pared del frente
  }

  window.MuzzagaLighting = { install };
})();
