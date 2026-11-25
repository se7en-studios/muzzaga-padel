// Secuencia de fotos del recorrido (ver scripts/render-recorrido.mjs): baja
// las fotos en orden de importancia y tiene a mano, ya decodificadas, solo las
// que están cerca de la posición actual.
//
// - Primero las paradas (`claves`): cada parada se ve nítida enseguida.
// - Después rellena el medio por mitades (la del medio de cada tramo, después
//   las del medio de cada mitad...) en los ratos libres del navegador: con
//   pocas fotos bajadas el recorrido ya se ve entero, solo que a saltos.
// - Decodificar una WebP de 780×1688 cuesta, y guardarlas todas abiertas
//   serían cientos de MB: se guardan comprimidas (~20 KB) y se abren con
//   createImageBitmap (fuera del hilo principal) solo las vecinas.
// - Mientras la foto justa no está, se dibuja la más cercana que haya.

const DECODIFICADAS = 10;

/** Orden de relleno: los puntos medios de cada tramo entre fotos ya pedidas. */
function ordenRelleno(n, pedidas) {
  const ks = [...new Set(pedidas)].sort((a, b) => a - b);
  const out = [];
  if (ks[0] !== 0) out.push(0);
  if (ks[ks.length - 1] !== n - 1) out.push(n - 1);
  const bordes = [...new Set([0, n - 1, ...ks])].sort((a, b) => a - b);
  let tramos = bordes.slice(1).map((b, j) => [bordes[j], b]);
  while (tramos.length) {
    const sig = [];
    for (const [a, b] of tramos) {
      if (b - a < 2) continue;
      const m = (a + b) >> 1;
      out.push(m);
      sig.push([a, m], [m, b]);
    }
    tramos = sig;
  }
  return out;
}

function abrir(blob) {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  // navegadores sin createImageBitmap: una <img> ya decodificada
  return new Promise((ok, mal) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const listo = () => ok(Object.assign(img, { _url: url }));
      if (img.decode) img.decode().then(listo, listo);
      else listo();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      mal(new Error("foto"));
    };
    img.src = url;
  });
}

function cerrar(img) {
  if (img.close) img.close();
  else if (img._url) URL.revokeObjectURL(img._url);
}

/**
 * @param {object} o
 * @param {{cuadros:number, archivos:string[]}} o.manifiesto
 * @param {string} o.carpeta  URL de la carpeta de las fotos
 * @param {number[]} o.claves índices que se bajan primero (las paradas), en orden
 * @param {boolean} o.soloClaves  movimiento reducido: no se bajan las del medio
 * @param {() => void} o.alCambiar  hay una foto nueva lista para dibujar
 */
export function crearSecuencia({ manifiesto, carpeta, claves, soloClaves, alCambiar }) {
  const n = manifiesto.cuadros;
  const blobs = new Array(n).fill(null);
  const pedidas = new Array(n).fill(false);
  const abiertas = new Map(); // índice → imagen decodificada
  const abriendo = new Set();
  const urgentes = [...claves];
  const resto = soloClaves ? [] : ordenRelleno(n, claves);
  let vivo = true;
  let cerca = claves[0] || 0;
  let enVuelo = 0;
  let ocioId = 0;

  const bajar = (i) => {
    pedidas[i] = true;
    enVuelo++;
    fetch(`${carpeta}/${manifiesto.archivos[i]}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((b) => {
        if (!vivo) return;
        blobs[i] = b;
        if (Math.abs(i - cerca) <= 3) abrirFoto(i);
      })
      .catch(() => {
        pedidas[i] = false; // si hace falta se vuelve a pedir (sin conexión no insiste sola)
      })
      .finally(() => {
        enVuelo--;
        seguir();
      });
  };

  // Las del medio, de a una o dos y en los ratos libres: no le quitan red ni
  // hilo a lo que la persona está mirando.
  const ocio = () => {
    ocioId = 0;
    while (vivo && enVuelo < 2 && resto.length) {
      const i = resto.shift();
      if (!pedidas[i]) bajar(i);
    }
  };

  function seguir() {
    if (!vivo) return;
    while (enVuelo < 3 && urgentes.length) {
      const i = urgentes.shift();
      if (!pedidas[i]) bajar(i);
    }
    if (urgentes.length || ocioId || !resto.length || enVuelo >= 2) return;
    ocioId =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(ocio, { timeout: 2000 })
        : window.setTimeout(ocio, 60);
  }

  function podar() {
    if (abiertas.size <= DECODIFICADAS) return;
    const lejos = [...abiertas.keys()].sort((a, b) => Math.abs(b - cerca) - Math.abs(a - cerca));
    for (const k of lejos.slice(0, abiertas.size - DECODIFICADAS)) {
      cerrar(abiertas.get(k));
      abiertas.delete(k);
    }
  }

  function abrirFoto(i) {
    if (i < 0 || i >= n || abiertas.has(i) || abriendo.has(i)) return;
    const b = blobs[i];
    if (!b) {
      if (!pedidas[i] && !urgentes.includes(i)) {
        urgentes.unshift(i);
        seguir();
      }
      return;
    }
    abriendo.add(i);
    abrir(b).then(
      (img) => {
        abriendo.delete(i);
        if (!vivo) return cerrar(img);
        img._i = i;
        abiertas.set(i, img);
        podar();
        alCambiar();
      },
      () => abriendo.delete(i),
    );
  }

  seguir();

  return {
    n,
    /**
     * Qué dibujar para la posición `pos` (índice con decimales): la foto de
     * abajo, la de arriba y cuánto de la de arriba (fundido entre las dos), o
     * la más cercana que ya esté abierta. null si todavía no hay ninguna.
     */
    paraDibujar(pos) {
      cerca = pos;
      const a = Math.max(0, Math.min(n - 1, Math.floor(pos)));
      const b = Math.min(n - 1, a + 1);
      const t = Math.max(0, Math.min(1, pos - a));
      abrirFoto(a);
      abrirFoto(b);
      // las vecinas, para que al seguir scrolleando ya estén abiertas
      abrirFoto(a - 1);
      abrirFoto(b + 1);
      abrirFoto(b + 2);
      const A = abiertas.get(a);
      const B = t > 0.01 && b !== a ? abiertas.get(b) : null;
      if (A && (B || t <= 0.01)) return { A, B, t: B ? t : 0 };
      let mejor = null;
      let d = Infinity;
      for (const [k, img] of abiertas) {
        const dd = Math.abs(k - pos);
        if (dd < d) {
          d = dd;
          mejor = img;
        }
      }
      return mejor ? { A: mejor, B: null, t: 0 } : null;
    },
    destruir() {
      vivo = false;
      if (ocioId) {
        if ("cancelIdleCallback" in window) window.cancelIdleCallback(ocioId);
        window.clearTimeout(ocioId);
      }
      abiertas.forEach(cerrar);
      abiertas.clear();
    },
  };
}

/** Posición de cámara (0..1) → índice de foto con decimales (las fotos van en orden de cámara). */
export function indiceDeCam(cams, cam) {
  const n = cams.length;
  if (cam <= cams[0]) return 0;
  if (cam >= cams[n - 1]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cams[m] <= cam) lo = m;
    else hi = m;
  }
  return lo + (cam - cams[lo]) / (cams[hi] - cams[lo]);
}
