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

// Prueba: el canal de YouTube del club en la cancha 2 (el stream directo de
// Beelup no se puede reproducir dentro de otra página). Solo se usa si la
// cancha no tiene link guardado en Configuración. Borrar cuando los links se
// carguen desde el panel.
export const PRUEBA_STREAMS = [
  "",
  "https://www.youtube.com/channel/UC4R8DWoMoI7CAwX8_LjQHig",
];

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_CHANNEL = /^UC[A-Za-z0-9_-]{22}$/;

/**
 * Link de YouTube → dirección para mostrarlo dentro de la página (silenciado
 * y arrancando solo), o null si no es de YouTube. Sirve para lo que ofrece
 * Beelup: transmitir las cámaras en vivo a YouTube. Acepta el link de un
 * video o transmisión (watch?v=, youtu.be/, /live/…) y el del canal
 * (/channel/UC…): con el canal se ve siempre la transmisión del momento y el
 * link no cambia.
 */
export function youtubeEmbedUrl(value) {
  const clean = cleanHttpsUrl(value);
  if (!clean) return null;
  const u = new URL(clean);
  const host = u.hostname.replace(/^(www|m)\./, "");
  const opts = "autoplay=1&mute=1&playsinline=1&rel=0";
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (["live", "embed", "shorts"].includes(parts[0]) && parts[1] !== "live_stream") id = parts[1];
    const channel =
      parts[0] === "channel" ? parts[1] : u.searchParams.get("channel");
    if (!id && YT_CHANNEL.test(channel || "")) {
      return `https://www.youtube.com/embed/live_stream?channel=${channel}&${opts}`;
    }
  } else return null;
  return YT_ID.test(id || "") ? `https://www.youtube-nocookie.com/embed/${id}?${opts}` : null;
}
