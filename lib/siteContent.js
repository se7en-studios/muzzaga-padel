// Fotos de la web pública como datos: lo que se cambia desde Configuración →
// Sitio web. Puro e isomórfico, igual que clubConfig.js: lo usan el server
// (landing, /torneos, actions) y el admin. Los valores por defecto son las
// fotos que estaban fijas en los componentes, así un `siteContent` vacío en la
// base se ve exactamente igual que antes. La ubicación vive en siteLocation.js.
import { normalizeLocation, presentLocation } from "./siteLocation.js";

/** URLs de las fotos subidas desde el panel (Vercel Blob). */
const STORED_PHOTO = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/sitio\//i;
const DEFAULT_PHOTO = /^\/img\/[\w/.-]+\.(jpe?g|png|webp)$/i;
const PHOTO_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const isStoredPhoto = (src) => STORED_PHOTO.test(String(src || ""));
const isValidSrc = (src) => isStoredPhoto(src) || DEFAULT_PHOTO.test(String(src || ""));

export const CAPTION_MAX = 40;
export const NAME_MAX = 60;
export const MAX_GALLERY_PHOTOS = 80;
const CLUB = "Muzzaga Pádel";

const clip = (v, n) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

/** RTDB guarda listas con claves 0..n como arrays, a veces como objetos. */
const asList = (v) =>
  Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : null;

// Las de Instalaciones son las fotos del club del 12/10/2026 (public/img/club)
// más dos de la sesión anterior. Ojo, el nombre engaña: court_blue_glass.jpg
// es el living con la pantalla y gente mirando. El alt de cada default
// describe la foto real; cuando el club sube otra, se usa `customAlt`, que no
// asume qué muestra.
export const PHOTO_GROUPS = [
  {
    id: "portada",
    title: "Portada",
    hint: "El fondo de la primera pantalla: se ve mientras carga el video y en celulares con ahorro de datos. Conviene horizontal y oscura, porque el texto va encima.",
    aspect: "16 / 9",
    slots: [
      {
        id: "hero",
        label: "Fondo de la portada",
        src: "/img/court_glass_night_match.jpg",
        alt: "",
        customAlt: "",
      },
    ],
  },
  {
    id: "instalaciones",
    title: "Instalaciones",
    hint: "Una foto por cada tarjeta del carrusel de Instalaciones. Se ven verticales: conviene que lo importante quede en el centro.",
    aspect: "4 / 5",
    slots: [
      {
        id: "inst-canchas",
        label: "Canchas de cristal",
        src: "/img/club/canchas-vista.jpg",
        alt: "Las dos canchas de cristal con césped azul vistas desde el pasillo central",
        customAlt: `Canchas de cristal de ${CLUB}`,
      },
      {
        id: "inst-led",
        label: "Iluminación LED",
        src: "/img/club/iluminacion-led.jpg",
        alt: "Jugador en la cancha de cristal de noche, con las luces LED prendidas",
        customAlt: `Iluminación LED en las canchas de ${CLUB}`,
      },
      {
        id: "inst-cantina",
        label: "Cantina propia",
        src: "/img/club/cantina-torta.jpg",
        alt: "Torta casera sobre la mesa de la cantina, con las canchas de fondo",
        customAlt: `La cantina de ${CLUB}`,
      },
      {
        id: "inst-torneos",
        label: "Torneos todo el año",
        src: "/img/torneos/junio/jugadores_12.jpg",
        alt: "Cuatro jugadores posando en la red, Torneo Junio 2026",
        customAlt: `Un torneo en ${CLUB}`,
      },
      {
        id: "inst-living",
        label: "Living y tercer tiempo",
        src: "/img/court_blue_glass.jpg",
        alt: "El living de la cantina lleno, mirando un partido en la pantalla",
        customAlt: `El living y el tercer tiempo en ${CLUB}`,
      },
      {
        id: "inst-vestuarios",
        label: "Vestuarios y duchas",
        src: "/img/club/vestuario-duchas.jpg",
        alt: "Vestuario con dos duchas con cortina y un banco de madera",
        customAlt: `Los vestuarios de ${CLUB}`,
      },
    ],
  },
  {
    id: "cantina",
    title: "Cantina",
    hint: "Las dos fotos grandes de la sección Cantina del inicio.",
    aspect: "4 / 3",
    slots: [
      {
        id: "cantina-tercer-tiempo",
        label: "Tercer tiempo",
        src: "/img/cantina_beer_court.jpg",
        alt: "Cerveza helada y vista a la pista en la cantina de Muzzaga",
        customAlt: `Tercer tiempo en la cantina de ${CLUB}`,
      },
      {
        id: "cantina-cocina",
        label: "Cocina propia",
        src: "/img/bar_coffee_snacks.jpg",
        alt: "Empanadas caseras y el partido de la Selección en la pantalla de la cantina",
        customAlt: `Comida de la cantina de ${CLUB}`,
      },
    ],
  },
  {
    id: "torneos-home",
    title: "Torneos en el inicio",
    hint: "Las 5 fotos destacadas de la sección Torneos del inicio. La primera es la grande. El texto va sobre la foto.",
    aspect: "1 / 1",
    captioned: true,
    slots: [
      {
        id: "torneo-1",
        label: "Foto grande",
        src: "/img/torneos/agosto/ganadores_1er_caballeros.jpg",
        alt: "1er puesto 7ma Caballeros, Torneo Agosto 2026",
        caption: "1er puesto Caballeros",
      },
      {
        id: "torneo-2",
        label: "Foto 2",
        src: "/img/torneos/agosto/ganadores_1er_damas.jpg",
        alt: "1er puesto 7ma Damas, Torneo Agosto 2026",
        caption: "1er puesto Damas",
      },
      {
        id: "torneo-3",
        label: "Foto 3",
        src: "/img/torneos/junio/ganadores_1er_puesto.jpg",
        alt: "1er puesto 6ta Libre (G. Salinas y F. Alcalá)",
        caption: "1er puesto 6ta Libre",
      },
      {
        id: "torneo-4",
        label: "Foto 4",
        src: "/img/torneos/agosto/jugadores_01.jpg",
        alt: "Cuatro jugadores posando en la red, Torneo Agosto 2026",
        caption: "Caballeros de agosto",
      },
      {
        id: "torneo-5",
        label: "Foto 5",
        src: "/img/torneos/agosto/jugadores_06.jpg",
        alt: "Cuatro jugadoras posando en la red, Torneo Agosto 2026",
        caption: "Damas de agosto",
      },
    ],
  },
];

const SLOTS = new Map(
  PHOTO_GROUPS.flatMap((g) =>
    g.slots.map((s) => [
      s.id,
      { ...s, group: g.title, captioned: Boolean(g.captioned) },
    ]),
  ),
);

export function findPhotoSlot(id) {
  return SLOTS.get(id) || null;
}

const jugadores = (folder, count, name) =>
  Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      id: `${folder}-j${n}`,
      src: `/img/torneos/${folder}/jugadores_${n}.jpg`,
      alt: `Jugador del ${name} en la cancha de Muzzaga`,
    };
  });

/** La galería de /torneos tal como estaba antes de poder editarla. */
export const DEFAULT_GALLERY = Object.freeze([
  {
    id: "agosto-2026",
    name: "Torneo Agosto 2026",
    categories: "7ma Damas y Caballeros",
    jugadores: jugadores("agosto", 26, "Torneo Agosto 2026"),
    ganadores: [
      {
        id: "agosto-g1",
        src: "/img/torneos/agosto/ganadores_1er_caballeros.jpg",
        alt: "1er puesto categoría 7ma Caballeros, Torneo Agosto 2026",
        label: "1er puesto Caballeros",
      },
      {
        id: "agosto-g2",
        src: "/img/torneos/agosto/ganadores_2do_caballeros.jpg",
        alt: "2do puesto categoría 7ma Caballeros, Torneo Agosto 2026",
        label: "2do puesto Caballeros",
      },
      {
        id: "agosto-g3",
        src: "/img/torneos/agosto/ganadores_1er_damas.jpg",
        alt: "1er puesto categoría 7ma Damas, Torneo Agosto 2026",
        label: "1er puesto Damas",
      },
      {
        id: "agosto-g4",
        src: "/img/torneos/agosto/ganadores_2do_damas.jpg",
        alt: "2do puesto categoría 7ma Damas, Torneo Agosto 2026",
        label: "2do puesto Damas",
      },
    ],
  },
  {
    id: "junio-2026",
    name: "Primer Torneo Junio 2026",
    categories: "",
    jugadores: jugadores("junio", 25, "Primer Torneo Junio 2026"),
    ganadores: [
      {
        id: "junio-g1",
        src: "/img/torneos/junio/ganadores_1er_puesto.jpg",
        alt: "1er puesto categoría Sexta Libre, Gabriel Salinas y Franco Alcalá, Primer Torneo Junio 2026",
        label: "1er puesto 6ta (G. Salinas - F. Alcalá)",
      },
      {
        id: "junio-g2",
        src: "/img/torneos/junio/ganadores_2do_puesto.jpg",
        alt: "2do puesto categoría Sexta Libre, Sebastián Riquero y Lucas Ponce, Primer Torneo Junio 2026",
        label: "2do puesto 6ta (S. Riquero - L. Ponce)",
      },
    ],
  },
]);

export const GALLERY_KINDS = ["jugadores", "ganadores"];

function normalizePhoto(raw, kind) {
  if (!raw || !PHOTO_ID.test(String(raw.id || "")) || !isValidSrc(raw.src)) {
    return null;
  }
  const photo = { id: String(raw.id), src: String(raw.src) };
  if (raw.alt) photo.alt = clip(raw.alt, 200);
  if (kind === "ganadores") photo.label = clip(raw.label, CAPTION_MAX);
  return photo;
}

function normalizeTournament(raw) {
  if (!raw || !PHOTO_ID.test(String(raw.id || ""))) return null;
  const t = {
    id: String(raw.id),
    name: clip(raw.name, NAME_MAX) || "Torneo",
    categories: clip(raw.categories, NAME_MAX),
  };
  for (const kind of GALLERY_KINDS) {
    t[kind] = (asList(raw[kind]) || [])
      .map((p) => normalizePhoto(p, kind))
      .filter(Boolean);
  }
  return t;
}

/**
 * Galería guardada → lista de torneos. `null` (nunca se tocó) es la galería
 * por defecto; una vez guardada, el nodo tiene `v` aunque quede sin torneos,
 * así borrar todos no la hace volver a los defaults.
 */
export function galleryFromDb(raw) {
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_GALLERY);
  }
  return (asList(raw.tournaments) || [])
    .map(normalizeTournament)
    .filter(Boolean);
}

export function galleryToDb(list) {
  return { v: 1, tournaments: list, updatedAt: Date.now() };
}

/** Texto alternativo y leyenda finales de las fotos de un torneo. */
function presentTournament(t) {
  const title = t.categories ? `${t.name} · ${t.categories}` : t.name;
  return {
    ...t,
    title,
    jugadores: t.jugadores.map((p) => ({
      ...p,
      alt: p.alt || `Jugadores del ${t.name} en ${CLUB}`,
      label: t.name,
      caption: `${t.name} · ${CLUB}`,
    })),
    ganadores: t.ganadores.map((p) => ({
      ...p,
      alt: p.alt || (p.label ? `${p.label}, ${t.name}` : `Ganadores del ${t.name}`),
    })),
  };
}

/**
 * Mezcla lo guardado en `siteContent` con los defaults.
 * @returns {{ photos: Record<string, {src:string, alt:string, caption?:string, custom:boolean}>, gallery: object[], location: object }}
 */
export function normalizeSiteContent(raw) {
  const saved = raw && typeof raw === "object" ? raw : {};
  const savedPhotos = saved.photos && typeof saved.photos === "object" ? saved.photos : {};
  const photos = {};
  for (const slot of SLOTS.values()) {
    const s = savedPhotos[slot.id] || {};
    const custom = isStoredPhoto(s.src);
    const photo = {
      src: custom ? s.src : slot.src,
      alt: custom ? slot.customAlt ?? "" : slot.alt,
      custom,
    };
    if (slot.captioned) {
      photo.caption =
        typeof s.caption === "string" ? clip(s.caption, CAPTION_MAX) : slot.caption;
      if (custom) {
        photo.alt = photo.caption
          ? `${photo.caption} · Torneo en ${CLUB}`
          : `Torneo en ${CLUB}`;
      }
    }
    photos[slot.id] = photo;
  }
  return {
    photos,
    gallery: galleryFromDb(saved.gallery).map(presentTournament),
    location: presentLocation(normalizeLocation(saved.location)),
  };
}

const photoSrcs = (t) => GALLERY_KINDS.flatMap((k) => t[k].map((p) => p.src));

/**
 * Cambios sobre la galería, puros para poder correrlos dentro de una
 * transacción de RTDB (que puede reintentarlos con otro valor de base).
 * @returns {{ list: object[], removed: string[] } | { error: string }}
 */
export function applyGalleryOp(list, op) {
  const find = () => list.find((t) => t.id === op.id);
  const notFound = { error: "Ese torneo ya no existe. Recargá la página." };
  const kindOk = GALLERY_KINDS.includes(op.kind);

  switch (op.type) {
    case "addTournament": {
      const name = clip(op.name, NAME_MAX);
      if (!name) return { error: "Poné el nombre del torneo." };
      if (!PHOTO_ID.test(String(op.id || ""))) return { error: "Torneo inválido." };
      const t = {
        id: op.id,
        name,
        categories: clip(op.categories, NAME_MAX),
        jugadores: [],
        ganadores: [],
      };
      // El más nuevo arriba: es el que la gente quiere ver.
      return { list: [t, ...list], removed: [], target: name };
    }
    case "renameTournament": {
      const name = clip(op.name, NAME_MAX);
      if (!name) return { error: "Poné el nombre del torneo." };
      if (!find()) return notFound;
      return {
        list: list.map((t) =>
          t.id === op.id
            ? { ...t, name, categories: clip(op.categories, NAME_MAX) }
            : t,
        ),
        removed: [],
        target: name,
      };
    }
    case "deleteTournament": {
      const t = find();
      if (!t) return notFound;
      return {
        list: list.filter((x) => x !== t),
        removed: photoSrcs(t),
        target: t.name,
      };
    }
    case "moveTournament": {
      const i = list.findIndex((t) => t.id === op.id);
      if (i < 0) return notFound;
      const j = i + (op.direction === "up" ? -1 : 1);
      if (j < 0 || j >= list.length) return { list, removed: [] };
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return { list: next, removed: [] };
    }
    case "addPhoto": {
      const t = find();
      if (!t) return notFound;
      if (!kindOk) return { error: "Tipo de foto inválido." };
      const photo = normalizePhoto(op.photo, op.kind);
      if (!photo) return { error: "Foto inválida." };
      if (t[op.kind].length >= MAX_GALLERY_PHOTOS) {
        return { error: `Cada sección admite hasta ${MAX_GALLERY_PHOTOS} fotos.` };
      }
      return {
        list: list.map((x) =>
          x === t ? { ...t, [op.kind]: [...t[op.kind], photo] } : x,
        ),
        removed: [],
        target: t.name,
      };
    }
    case "removePhoto": {
      const t = find();
      if (!t) return notFound;
      if (!kindOk) return { error: "Tipo de foto inválido." };
      const photo = t[op.kind].find((p) => p.id === op.photoId);
      if (!photo) return { list, removed: [] };
      return {
        list: list.map((x) =>
          x === t
            ? { ...t, [op.kind]: t[op.kind].filter((p) => p !== photo) }
            : x,
        ),
        removed: [photo.src],
        target: t.name,
      };
    }
    case "labelPhoto": {
      const t = find();
      if (!t) return notFound;
      if (!t.ganadores.some((p) => p.id === op.photoId)) {
        return { error: "Esa foto ya no existe. Recargá la página." };
      }
      const label = clip(op.label, CAPTION_MAX);
      return {
        list: list.map((x) =>
          x === t
            ? {
                ...t,
                // El alt viejo describía el texto anterior: se regenera.
                ganadores: t.ganadores.map((p) =>
                  p.id === op.photoId ? { id: p.id, src: p.src, label } : p,
                ),
              }
            : x,
        ),
        removed: [],
      };
    }
    default:
      return { error: "Operación inválida." };
  }
}
