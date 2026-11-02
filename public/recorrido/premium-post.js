/* Muzzaga · posproceso de la maqueta: render en HDR con antialiasing, bloom selectivo por brillo,
   tonemapping ACES, viñeta y contraste de cine. Si el navegador no soporta render HDR devuelve null
   y la maqueta sigue con el render directo de siempre. */
(function () {
  const FINAL = {
    uniforms: {
      tDiffuse: { value: null },
      exposure: { value: 0.9 },
      vignette: { value: 0.34 },
      contrast: { value: 0.3 },
    },
    vertexShader:
      "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: [
      "uniform sampler2D tDiffuse; uniform float exposure; uniform float vignette; uniform float contrast; varying vec2 vUv;",
      "vec3 rrt(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }",
      "vec3 aces(vec3 c){",
      "  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));",
      "  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));",
      "  c *= exposure / 0.6; return clamp(outM * rrt(inM * c), 0.0, 1.0);",
      "}",
      "void main(){",
      "  vec3 col = aces(texture2D(tDiffuse, vUv).rgb);",
      "  col = mix(col, col * col * (3.0 - 2.0 * col), contrast);",
      "  vec2 d = vUv - 0.5; col *= 1.0 - vignette * dot(d, d) * 2.4;",
      "  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);",
      "}",
    ].join("\n"),
  };

  function create(ctx) {
    const { THREE, renderer, scene, camera } = ctx;
    const gl2 = renderer.capabilities.isWebGL2;
    const hdr =
      renderer.extensions.has("EXT_color_buffer_float") ||
      renderer.extensions.has("EXT_color_buffer_half_float");
    if (!gl2 || !hdr || !THREE.EffectComposer || !THREE.UnrealBloomPass)
      return null;

    const size = renderer.getSize(new THREE.Vector2()),
      pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLMultisampleRenderTarget(
      size.x * pr,
      size.y * pr,
      { type: THREE.HalfFloatType, format: THREE.RGBAFormat },
    );
    rt.samples = ctx.samples || 4;
    const composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const bloom = new THREE.UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      ctx.bloom || 0.55,
      0.65,
      ctx.threshold || 0.95,
    );
    composer.addPass(bloom);
    const fin = new THREE.ShaderPass(FINAL);
    composer.addPass(fin);

    // el tonemapping lo hace el pase final (en HDR); el del renderer se apaga para no aplicarlo dos veces
    renderer.toneMapping = THREE.NoToneMapping;

    return {
      bloom,
      render() {
        fin.uniforms.exposure.value = ctx.exposure();
        composer.render();
      },
      setSize(w, h) {
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(w, h);
      },
    };
  }

  window.MuzzagaPost = { create };
})();
