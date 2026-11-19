// Links de las cámaras de Beelup. Los de stream tienen la forma
//   https://beelup.com/ver.stream.m3u8.php?p1=<cámara>&p2=<vence>
// con p1 y p2 en base64: p1 es la cámara ("muzzagapadel101") y p2 la fecha
// hasta la que sirve el link ("2026-11-20 20:32:06", hora de Argentina; los
// que da Beelup duran 24 h). Puro e isomórfico: lo usan Configuración, la
// landing y los tests.

export const URL_MAX = 600;

/** "" si no es un link https usable; si no, el link limpio. */
export function cleanHttpsUrl(value) {
  const url = String(value ?? "").trim();
  if (!url || url.length > URL_MAX) return "";
  try {
    return new URL(url).protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function fromBase64(value) {
  try {
    const text =
      typeof atob === "function"
        ? atob(value)
        : Buffer.from(value, "base64").toString("utf8");
    return /^[\x20-\x7e]+$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

const P2_DATE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;

/**
 * @returns {{ camera: string | null, expiresAt: number | null, expired: boolean }}
 *   expiresAt en ms; null si el link no dice cuándo vence.
 */
export function beelupStreamInfo(url, now = Date.now()) {
  const clean = cleanHttpsUrl(url);
  if (!clean) return { camera: null, expiresAt: null, expired: false };
  const params = new URL(clean).searchParams;
  const camera = params.get("p1") ? fromBase64(params.get("p1")) : null;
  const rawDate = params.get("p2") ? fromBase64(params.get("p2")) : null;
  const m = rawDate && P2_DATE.exec(rawDate);
  // Argentina no tiene horario de verano: siempre UTC-3.
  const expiresAt = m ? Date.parse(`${m[1]}T${m[2]}-03:00`) : null;
  return {
    camera,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
    expired: Number.isFinite(expiresAt) ? expiresAt <= now : false,
  };
}

// Prueba: los links que pasó el club el 19/11 (cámara 101 = cancha 1, 202 =
// cancha 2). Solo se usan en una cancha sin link guardado en Configuración y
// dejan de mostrarse solos cuando vencen (20/11 20:32). Borrar cuando los
// links se carguen desde el panel.
export const PRUEBA_STREAMS = [
  "https://beelup.com/ver.stream.m3u8.php?p1=bXV6emFnYXBhZGVsMTAx&p2=MjAyNi0xMS0yMCAyMDozMjowNg==",
  "https://beelup.com/ver.stream.m3u8.php?p1=bXV6emFnYXBhZGVsMjAy&p2=MjAyNi0xMS0yMCAyMDozMjowNg==",
];
