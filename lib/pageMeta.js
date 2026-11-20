// Metadatos de cada página pública: título, descripción, canónico y la
// tarjeta para compartir con los mismos textos. Next mezcla `openGraph` de
// forma superficial: si la página no lo define, hereda el de la home y el
// link de una herramienta se comparte hablando de las canchas.
import { SITE_URL } from "./site.js";
import { CLUB_INFO } from "../data/club.js";
import { formatARS } from "./format.js";

export const OG_BASE = { type: "website", siteName: "Muzzaga Pádel", locale: "es_AR" };

// La tarjeta de app/opengraph-image.js: al definir openGraph, la página deja
// de heredarla, así que va explícita.
const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Muzzaga Pádel · Canchas de pádel en Catriel, Río Negro",
};

/**
 * @param {{ title: string, description: string, path: string }} page
 */
export function pageMetadata({ title, description, path }) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OG_BASE, title, description, url: path, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}

// ── Datos estructurados (JSON-LD) ─────────────────────────────────────────
// Lo que Google lee para la ficha del club: dirección, horarios, teléfono,
// precio del turno y los torneos abiertos. Todo sale del panel (config,
// ubicación, torneos); lo fijo es solo lo institucional de data/club.js.

const CLUB_ID = `${SITE_URL}/#club`;
const SITE_ID = `${SITE_URL}/#web`;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Días abiertos agrupados por horario. Si cierra pasada la medianoche,
 * `closes` queda antes que `opens` (así lo pide Google). */
function openingHours(schedule = []) {
  const groups = new Map();
  schedule.forEach((d, i) => {
    if (!d?.open) return;
    const key = `${d.start}-${d.end}`;
    if (!groups.has(key)) groups.set(key, { opens: d.start, closes: d.end, days: [] });
    groups.get(key).days.push(DAYS[i]);
  });
  // Domingo al final: lunes a sábado se lee de corrido.
  const order = (day) => (DAYS.indexOf(day) + 6) % 7;
  return [...groups.values()].map(({ opens, closes, days }) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: days.sort((a, b) => order(a) - order(b)),
    opens,
    closes,
  }));
}

function courtPrices(pricing) {
  const valle = pricing?.valle?.court;
  const pico = pricing?.picoEnabled ? pricing?.pico?.court : null;
  return [valle, pico].filter((n) => Number.isFinite(n) && n > 0);
}

/** Un torneo abierto (lib/tournament.js → toPublicTournament) como Event. */
function tournamentEvent(t, place) {
  const categories = (t.categories || []).map((c) => c.name).filter(Boolean);
  return {
    "@type": "SportsEvent",
    name: `${t.name} · Muzzaga Pádel`,
    sport: "Pádel",
    startDate: t.date,
    endDate: t.dateEnd || t.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    description: categories.length
      ? `Torneo de pádel en Catriel. Categorías: ${categories.join(", ")}.`
      : "Torneo de pádel en Catriel.",
    url: `${SITE_URL}/torneos`,
    image: [`${SITE_URL}/opengraph-image`],
    location: place,
    organizer: { "@id": CLUB_ID, name: CLUB_INFO.name, url: SITE_URL },
    ...(t.price > 0 && {
      offers: {
        "@type": "Offer",
        name: "Inscripción por pareja",
        price: t.price,
        priceCurrency: "ARS",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/torneos#inscripcion`,
      },
    }),
  };
}

/**
 * Club + sitio (+ torneos con fecha) en un solo @graph.
 * @param {{ location: object, config: object, tournaments?: object[] }} data
 *   location: presentLocation(...) de lib/siteLocation.js
 *   config: normalizeConfig(...) de lib/clubConfig.js
 */
export function clubJsonLd({ location, config, tournaments = [] }) {
  const courts = config.courts?.length || CLUB_INFO.courtsCount;
  const slot = config.slotDurationMin;
  const prices = courtPrices(config.pricing);
  const priceText = prices.length
    ? `${[...new Set([Math.min(...prices), Math.max(...prices)])].map((n) => formatARS(n)).join(" a ")} el turno de ${slot} min`
    : undefined;

  const address = {
    "@type": "PostalAddress",
    streetAddress: location.street,
    addressLocality: location.city,
    addressRegion: location.region || undefined,
    // El código postal es el de Catriel: si se mudan de ciudad, se omite.
    postalCode: location.city === "Catriel" ? "R8307" : undefined,
    addressCountry: "AR",
  };

  const club = {
    "@type": "SportsActivityLocation",
    "@id": CLUB_ID,
    name: CLUB_INFO.name,
    alternateName: ["Muzzaga Padel", "Muzzaga"],
    slogan: CLUB_INFO.tagline,
    description: `Club de pádel en Catriel, Río Negro: ${courts} canchas de cristal templado con iluminación LED, turnos de ${slot} min con reserva online, torneos todo el año y cantina propia.`,
    url: SITE_URL,
    telephone: CLUB_INFO.phoneFormatted,
    logo: `${SITE_URL}/img/logo_full.png`,
    image: [
      `${SITE_URL}/img/court_glass_night_match.jpg`,
      `${SITE_URL}/img/panoramic_courts.jpg`,
      `${SITE_URL}/opengraph-image`,
    ],
    address,
    geo: { "@type": "GeoCoordinates", latitude: location.lat, longitude: location.lng },
    hasMap: location.mapsHref,
    areaServed: { "@type": "City", name: location.city },
    openingHoursSpecification: openingHours(config.schedule),
    priceRange: priceText,
    currenciesAccepted: "ARS",
    paymentAccepted: "Efectivo, Transferencia",
    amenityFeature: [
      `${courts} canchas de cristal templado`,
      "Iluminación LED",
      "Cantina",
      "Torneos",
    ].map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
    ...(prices.length && {
      makesOffer: {
        "@type": "Offer",
        name: `Turno de pádel de ${slot} min (cancha completa)`,
        price: Math.min(...prices),
        priceCurrency: "ARS",
        url: `${SITE_URL}/#turnos`,
      },
    }),
    sameAs: [CLUB_INFO.instagram],
  };

  const place = { "@type": "Place", name: CLUB_INFO.name, address, geo: club.geo };
  const events = tournaments.filter((t) => t?.date).map((t) => tournamentEvent(t, place));
  if (events.length) club.event = events;

  const site = {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: CLUB_INFO.name,
    alternateName: "Muzzaga Pádel Catriel",
    url: SITE_URL,
    inLanguage: "es-AR",
    publisher: { "@id": CLUB_ID },
  };

  return { "@context": "https://schema.org", "@graph": [club, site] };
}
