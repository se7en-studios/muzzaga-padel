#!/usr/bin/env node
// Fotos del recorrido 3D para la landing (components/ClubRecorrido.jsx).
//
// La sección "Así es Muzzaga" ya no lleva la maqueta 3D en vivo: muestra una
// secuencia de fotos de ese mismo recorrido que se cambia con el scroll (anda
// liso en cualquier celu). Este script saca esas fotos de la maqueta de verdad
// (public/recorrido/index.html, calidad completa, con la gente) y las guarda
// en WebP en public/recorrido/secuencia/{movil,compu}/ junto a manifest.json.
// La maqueta interactiva sigue en /recorrido ("Recorrer el club").
//
// Cómo se usa (con el sitio en producción local, no `next dev`):
//
//   npx next build && npx next start -p 3200
//   node scripts/render-recorrido.mjs                  # las dos variantes
//   node scripts/render-recorrido.mjs --solo movil     # o compu
//   node scripts/render-recorrido.mjs --codificar      # solo rearmar los WebP desde las fotos crudas
//
// Opciones: --base http://localhost:3200 · --crudo <carpeta para los PNG>
// (por defecto en el temporal del sistema; si ya hay un PNG de un cuadro, no
// se vuelve a sacar: se puede cortar y seguir) · --rehacer (saca todo de nuevo).
//
// Cómo funciona: abre una página del mismo origen con la maqueta en un iframe
// (/recorrido/index.html?embed=1&captura=1) y le habla igual que la landing:
// {muzzaga:"visible", v:true} y {muzzaga:"tour", p}. ?captura=1 congela el
// tiempo (gente y pelotas quietas: fotos seguidas que solo cambian por la
// cámara) y hace que la cámara llegue de una, sin suavizado. Después de cada
// "tour" espera a que la maqueta diga que ya dibujó esa posición
// (window.MZ_CAPTURA.dibujado) y saca la foto. Con WebGL por software (sin placa
// de video) cada foto puede tardar 10 s o más: las dos variantes
// juntas llevan un buen rato (conviene correrlo en segundo plano).
//
// Si cambia la ruta de cámara (KF en index.html) o las paradas
// (STOPS / RUTA_* en ClubRecorrido.jsx), hay que volver a correrlo.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const BASE = opt("base", "http://localhost:3200");
const CRUDO = opt("crudo", path.join(os.tmpdir(), "muzzaga-recorrido-crudo"));
const SOLO = opt("solo", null);
const SOLO_CODIFICAR = flag("codificar");
const REHACER = flag("rehacer");
const PLAYWRIGHT = process.env.PLAYWRIGHT || "/opt/node-tools/node_modules/playwright/index.mjs";
const CHROMIUM = process.env.CHROMIUM || "/opt/pw-browsers/chromium";

// Posiciones de cámara (0..1 sobre la ruta de index.html, 8 cuadros clave → i/7).
// Paso base: 1/112 (16 fotos por tramo entre cuadros clave). Las paradas
// (0, 2/7, 4/7, 5/7, 6/7 y 1) caen justo en una foto.
const PASO = 112;
const rango = (desde, hasta, cada = 1) => {
  const out = [];
  for (let j = desde; j <= hasta; j += cada) out.push(j / PASO);
  return out;
};

const VARIANTES = {
  // Celu: la sección fija mide 100svh × 100vw; en un 390×844 la maqueta se ve
  // en vertical. Se saca a 2× (780×1688) y se guarda a 624 de ancho (1,6×):
  // con el ruido del piso cada foto pesa bastante y el celu tiene que bajar
  // todo en ~2 MB. Ruta del celu (RUTA_CELU): vista general → canchas → barra
  // (cam 0..4/7) con una foto cada 2/112 (el reproductor funde una con la
  // otra); de la barra a mesas y baños (solo con los chips, sin scroll), cada 4/112.
  movil: {
    viewport: { width: 390, height: 844 },
    escala: 2,
    cams: [...rango(0, 64, 2), ...rango(68, 96, 4)],
    ancho: 624,
    calidad: 45,
  },
  // Compu: ruta completa (RUTA_PC, cam 0..1), apaisada 16:9, una foto cada
  // 2/112. Pesa más que la del celu (~5 MB) pero también baja de a poco.
  compu: {
    viewport: { width: 1600, height: 900 },
    escala: 1,
    cams: rango(0, 112, 2),
    calidad: 50,
  },
};

const nombreCrudo = (variante, cam) =>
  path.join(CRUDO, variante, `${Math.round(cam * PASO).toString().padStart(3, "0")}.png`);

async function sacarFotos(variante, cfg) {
  const { chromium } = await import(PLAYWRIGHT);
  fs.mkdirSync(path.join(CRUDO, variante), { recursive: true });
  const faltan = cfg.cams.filter((c) => REHACER || !fs.existsSync(nombreCrudo(variante, c)));
  if (!faltan.length) {
    console.log(`[${variante}] ya están las ${cfg.cams.length} fotos crudas`);
    return;
  }
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: ["--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  try {
    const ctx = await browser.newContext({
      viewport: cfg.viewport,
      deviceScaleFactor: cfg.escala,
      reducedMotion: "no-preference",
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.warn(`[${variante}] error en la página:`, e.message));
    page.on("console", (m) => {
      if (m.type() === "error") console.warn(`[${variante}] consola:`, m.text());
    });
    // Página anfitriona del mismo origen (la maqueta solo escucha mensajes de su origen).
    const anfitriona = `${BASE}/__captura-recorrido`;
    await page.route(anfitriona, (route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden;background:#141826}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
<iframe id="m" src="/recorrido/index.html?embed=1&captura=1&v=${Date.now()}"></iframe>
<script>window.__listo=false;addEventListener('message',e=>{if(e.data&&e.data.muzzaga==='ready')window.__listo=true});</script>`,
      }),
    );
    await page.goto(anfitriona, { waitUntil: "load" });
    await page.waitForFunction(() => window.__listo, null, { timeout: 300_000, polling: 500 });
    const frame = page.frame({ url: /recorrido\/index\.html/ });
    const post = (msg) =>
      page.evaluate((m) => document.getElementById("m").contentWindow.postMessage(m, location.origin), msg);
    await post({ muzzaga: "visible", v: true });
    // personajes 3D cargados, tipografías listas y luces ya prendidas (fundido de 2,8 s)
    await frame.waitForFunction(() => window.MZ_CAPTURA && window.MZ_CAPTURA.gente, null, {
      timeout: 300_000,
      polling: 500,
    });
    await frame.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(4000);
    let n = 0;
    const t0 = Date.now();
    for (const cam of faltan) {
      await post({ muzzaga: "tour", p: cam });
      await frame.waitForFunction((p) => window.MZ_CAPTURA.dibujado === p, cam, {
        timeout: 120_000,
        polling: 50,
      });
      await page.screenshot({ path: nombreCrudo(variante, cam), type: "png", timeout: 120_000 });
      n++;
      const seg = (Date.now() - t0) / 1000;
      console.log(`[${variante}] ${n}/${faltan.length} cam=${cam.toFixed(4)} (${(seg / n).toFixed(1)} s por foto)`);
    }
  } finally {
    await browser.close();
  }
}

async function codificar(variante, cfg) {
  const sharp = (await import("sharp")).default;
  const dest = path.join(raiz, "public", "recorrido", "secuencia", variante);
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(dest)) if (f.endsWith(".webp")) fs.rmSync(path.join(dest, f));
  const archivos = [];
  let bytes = 0;
  let ancho = 0;
  let alto = 0;
  for (const [i, cam] of cfg.cams.entries()) {
    let img = sharp(nombreCrudo(variante, cam));
    if (cfg.ancho) img = img.resize({ width: cfg.ancho });
    const buf = await img
      .webp({ quality: cfg.calidad, effort: 6, smartSubsample: true })
      .toBuffer();
    const meta = await sharp(buf).metadata();
    ancho = meta.width;
    alto = meta.height;
    // nombre con el hash del contenido: se puede cachear para siempre
    const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10);
    const nombre = `${i.toString().padStart(3, "0")}-${hash}.webp`;
    fs.writeFileSync(path.join(dest, nombre), buf);
    archivos.push(nombre);
    bytes += buf.length;
  }
  const manifest = {
    // generado por scripts/render-recorrido.mjs: no editar a mano
    ancho,
    alto,
    cuadros: cfg.cams.length,
    // posición de cámara (0..1 de la ruta de index.html) de cada foto, en orden
    cams: cfg.cams.map((c) => +c.toFixed(6)),
    archivos,
    bytes,
  };
  fs.writeFileSync(path.join(dest, "manifest.json"), JSON.stringify(manifest) + "\n");
  console.log(`[${variante}] ${archivos.length} cuadros ${ancho}×${alto}, ${(bytes / 1024).toFixed(0)} KB en total`);
}

for (const [variante, cfg] of Object.entries(VARIANTES)) {
  if (SOLO && SOLO !== variante) continue;
  if (!SOLO_CODIFICAR) await sacarFotos(variante, cfg);
  await codificar(variante, cfg);
}
