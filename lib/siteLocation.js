// Ubicación del club como datos: dirección, link de Google Maps y el punto del
// mapa, editables desde Configuración → Sitio web por si el club se muda.
// Puro e isomórfico, igual que siteContent.js. Los defaults son los que
// estaban fijos en la landing, el footer y el JSON-LD, así un `location` vacío
// en la base se ve exactamente igual que antes.

export const STREET_MAX = 80;
export const LOCALITY_MAX = 60;

export const DEFAULT_LOCATION = Object.freeze({
  street: "Av. Cacique Catriel y Córdoba",
  locality: "Catriel, Río Negro",
  mapsUrl: "https://maps.app.goo.gl/kR1h9mhdLqGLKatV7",
  lat: -37.8832905,
  lng: -67.8005469,
});

const clip = (v, n) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

const round = (n) => Math.round(n * 1e7) / 1e7;

const validCoords = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0);

// Lo que se copia de Google Maps: "-37.88329, -67.80054" (mantener apretado o
// clic derecho en el mapa), o un link largo con el punto adentro. El orden
// importa: !3d!4d es el pin del lugar y @ es solo el centro de la vista.
const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const COORD_PATTERNS = [
  new RegExp(String.raw`!3d${NUM}!4d${NUM}`),
  new RegExp(String.raw`[?&](?:q|query|ll|destination)=${NUM}(?:,|%2C)\s*${NUM}`, "i"),
  new RegExp(String.raw`/maps/(?:search|place|dir)/${NUM},(?:\+|%20|\s)*${NUM}`, "i"),
  new RegExp(String.raw`@${NUM},${NUM}`),
  new RegExp(String.raw`^\s*\(?${NUM}\s*[,;\s]\s*${NUM}\)?\s*$`),
];

/** Texto pegado → { lat, lng }, o null si no se entiende. */
export function parseCoords(text) {
  const s = String(text ?? "");
  for (const re of COORD_PATTERNS) {
    const m = s.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (validCoords(lat, lng)) return { lat: round(lat), lng: round(lng) };
  }
  return null;
}

/**
 * Solo links de Google Maps: el botón "Cómo llegar" no puede terminar
 * mandando a la gente a cualquier sitio.
 */
export function isMapsUrl(url) {
  let u;
  try {
    u = new URL(String(url ?? "").trim());
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return u.pathname.startsWith("/maps");
  if (/^maps\.google\.com(\.ar)?$/.test(host)) return true;
  if (/^google\.com(\.ar)?$/.test(host)) return u.pathname.startsWith("/maps");
  return false;
}

/** Links cortos de "Compartir": no traen el punto, hay que seguir la redirección. */
export function isShortMapsUrl(url) {
  if (!isMapsUrl(url)) return false;
  const host = new URL(String(url).trim()).hostname.toLowerCase();
  return host === "maps.app.goo.gl" || host === "goo.gl";
}

/**
 * Ubicación guardada → la que se usa. `null` (nunca se tocó) son los
 * defaults; un campo inválido vuelve a su default en vez de romper la web.
 */
export function normalizeLocation(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LOCATION, custom: false };
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const hasCoords = validCoords(lat, lng);
  const mapsUrl = String(raw.mapsUrl ?? "").trim();
  return {
    street: clip(raw.street, STREET_MAX) || DEFAULT_LOCATION.street,
    locality: clip(raw.locality, LOCALITY_MAX) || DEFAULT_LOCATION.locality,
    // Vacío a propósito: el botón abre el punto del mapa.
    mapsUrl: mapsUrl && isMapsUrl(mapsUrl) ? mapsUrl : "",
    lat: hasCoords ? round(lat) : DEFAULT_LOCATION.lat,
    lng: hasCoords ? round(lng) : DEFAULT_LOCATION.lng,
    custom: true,
  };
}

/**
 * Lo que se cargó en el panel → lo que se guarda.
 * @returns {{ location: object } | { error: string }}
 */
export function locationFromInput(input) {
  const street = clip(input?.street, STREET_MAX);
  const locality = clip(input?.locality, LOCALITY_MAX);
  const mapsUrl = String(input?.mapsUrl ?? "").trim();
  if (!street) return { error: "Poné la dirección (calle y número o esquina)." };
  if (!locality) return { error: "Poné la localidad, por ej. Catriel, Río Negro." };
  if (mapsUrl && !isMapsUrl(mapsUrl)) {
    return { error: "El link tiene que ser de Google Maps (por ej. https://maps.app.goo.gl/…)." };
  }
  // Si dejaron las coordenadas vacías pero el link largo las trae, sirven.
  const coords = parseCoords(input?.coords) || (input?.coords ? null : parseCoords(mapsUrl));
  if (!coords) {
    return {
      error:
        "No se entienden las coordenadas. Copialas de Google Maps, por ej. -37.88329, -67.80054.",
    };
  }
  return { location: { street, locality, mapsUrl, ...coords } };
}

/** Links y textos que salen de la ubicación, listos para la web. */
export function presentLocation(loc) {
  const ll = `${loc.lat},${loc.lng}`;
  const [city, ...rest] = loc.locality.split(",");
  return {
    ...loc,
    coordsText: `${loc.lat}, ${loc.lng}`,
    mapsHref: loc.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${ll}`,
    embedUrl: `https://maps.google.com/maps?q=${ll}&hl=es&z=16&output=embed`,
    hasMap: `https://maps.google.com/maps?q=${ll}`,
    wazeUrl: `https://waze.com/ul?ll=${ll}&navigate=yes`,
    city: city.trim(),
    region: rest.join(",").trim(),
  };
}
