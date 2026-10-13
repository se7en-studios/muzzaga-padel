import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GALLERY,
  PHOTO_GROUPS,
  applyGalleryOp,
  findPhotoSlot,
  galleryFromDb,
  galleryToDb,
  isStoredPhoto,
  normalizeSiteContent,
} from "../lib/siteContent.js";

const BLOB = "https://abc123xyz.public.blob.vercel-storage.com/sitio/hero-Xy12.webp";

test("sin nada guardado, la web muestra exactamente las fotos de siempre", () => {
  const { photos, gallery } = normalizeSiteContent(null);
  assert.equal(photos.hero.src, "/img/court_glass_night_match.jpg");
  assert.equal(photos.hero.alt, "");
  assert.equal(photos["inst-led"].src, "/img/club/iluminacion-led.jpg");
  assert.equal(
    photos["inst-led"].alt,
    "Jugador en la cancha de cristal de noche, con las luces LED prendidas",
  );
  assert.equal(photos["torneo-1"].caption, "1er puesto Caballeros");
  assert.equal(Object.values(photos).every((p) => p.custom === false), true);

  assert.deepEqual(gallery.map((t) => t.id), ["agosto-2026", "junio-2026"]);
  assert.equal(gallery[0].title, "Torneo Agosto 2026 · 7ma Damas y Caballeros");
  assert.equal(gallery[0].jugadores.length, 26);
  assert.equal(gallery[1].jugadores.length, 25);
  assert.equal(gallery[0].jugadores[0].src, "/img/torneos/agosto/jugadores_01.jpg");
  assert.equal(gallery[0].jugadores[0].label, "Torneo Agosto 2026");
  assert.equal(gallery[0].ganadores[3].label, "2do puesto Damas");
});

test("una foto subida reemplaza la de por defecto con un alt que no asume qué muestra", () => {
  const { photos } = normalizeSiteContent({
    photos: {
      "inst-canchas": { src: BLOB },
      "torneo-2": { src: BLOB, caption: "  Campeonas   de 6ta " },
    },
  });
  assert.equal(photos["inst-canchas"].src, BLOB);
  assert.equal(photos["inst-canchas"].custom, true);
  assert.equal(photos["inst-canchas"].alt, "Canchas de cristal de Muzzaga Pádel");
  assert.equal(photos["torneo-2"].caption, "Campeonas de 6ta");
  assert.equal(photos["torneo-2"].alt, "Campeonas de 6ta · Torneo en Muzzaga Pádel");
});

test("un texto editado sin cambiar la foto conserva la foto y el alt originales", () => {
  const { photos } = normalizeSiteContent({ photos: { "torneo-3": { caption: "" } } });
  assert.equal(photos["torneo-3"].src, "/img/torneos/junio/ganadores_1er_puesto.jpg");
  assert.equal(photos["torneo-3"].caption, "");
  assert.equal(photos["torneo-3"].alt, "1er puesto 6ta Libre (G. Salinas y F. Alcalá)");
});

test("solo se aceptan URLs del store de fotos del sitio o archivos de /img", () => {
  assert.equal(isStoredPhoto(BLOB), true);
  assert.equal(isStoredPhoto("https://evil.example.com/sitio/x.jpg"), false);
  assert.equal(
    isStoredPhoto("https://abc.public.blob.vercel-storage.com/otra-carpeta/x.jpg"),
    false,
  );
  const { photos } = normalizeSiteContent({
    photos: { hero: { src: "javascript:alert(1)" } },
  });
  assert.equal(photos.hero.src, "/img/court_glass_night_match.jpg");

  const list = galleryFromDb({
    v: 1,
    tournaments: [
      {
        id: "t1",
        name: "X",
        jugadores: [
          { id: "a", src: BLOB },
          { id: "b", src: "https://evil.example.com/x.jpg" },
        ],
      },
    ],
  });
  assert.deepEqual(list[0].jugadores.map((p) => p.id), ["a"]);
});

test("cada lugar de foto tiene id único y se encuentra por id", () => {
  const ids = PHOTO_GROUPS.flatMap((g) => g.slots.map((s) => s.id));
  assert.equal(new Set(ids).size, ids.length);
  // Una por tarjeta del carrusel de components/FeatureCarousel.jsx.
  const carousel = ["canchas", "led", "cantina", "torneos", "living", "vestuarios"];
  assert.deepEqual(
    PHOTO_GROUPS.find((g) => g.id === "instalaciones").slots.map((s) => s.id),
    carousel.map((id) => `inst-${id}`),
  );
  assert.equal(findPhotoSlot("hero").group, "Portada");
  assert.equal(findPhotoSlot("torneo-1").captioned, true);
  assert.equal(findPhotoSlot("inst-led").captioned, false);
  assert.equal(findPhotoSlot("nada"), null);
});

test("una galería guardada vacía no vuelve a los torneos por defecto", () => {
  assert.equal(galleryFromDb(null).length, DEFAULT_GALLERY.length);
  // RTDB borra el array vacío: queda solo { v: 1 }.
  assert.deepEqual(galleryFromDb({ v: 1 }), []);
  const roundTrip = galleryFromDb(galleryToDb(galleryFromDb(null)));
  assert.deepEqual(roundTrip, galleryFromDb(null));
});

test("los defaults no se modifican al editar la galería", () => {
  const list = galleryFromDb(null);
  list[0].jugadores.pop();
  assert.equal(DEFAULT_GALLERY[0].jugadores.length, 26);
});

test("agregar un torneo lo pone primero y valida el nombre", () => {
  const list = galleryFromDb(null);
  assert.ok(applyGalleryOp(list, { type: "addTournament", id: "n1", name: "  " }).error);
  const res = applyGalleryOp(list, {
    type: "addTournament",
    id: "n1",
    name: "Torneo Noviembre 2026",
    categories: "6ta",
  });
  assert.equal(res.list[0].id, "n1");
  assert.equal(res.list.length, 3);
  assert.equal(res.target, "Torneo Noviembre 2026");
  assert.deepEqual(res.removed, []);
});

test("eliminar un torneo devuelve sus fotos para borrarlas del store", () => {
  let list = galleryFromDb(null);
  list = applyGalleryOp(list, { type: "addTournament", id: "n1", name: "Nuevo" }).list;
  list = applyGalleryOp(list, {
    type: "addPhoto",
    id: "n1",
    kind: "jugadores",
    photo: { id: "p1", src: BLOB },
  }).list;
  const res = applyGalleryOp(list, { type: "deleteTournament", id: "n1" });
  assert.deepEqual(res.removed, [BLOB]);
  assert.equal(res.list.some((t) => t.id === "n1"), false);
  assert.ok(applyGalleryOp(res.list, { type: "deleteTournament", id: "n1" }).error);
});

test("agregar, rotular y quitar fotos de ganadores", () => {
  let list = galleryFromDb(null);
  const add = applyGalleryOp(list, {
    type: "addPhoto",
    id: "agosto-2026",
    kind: "ganadores",
    photo: { id: "g9", src: BLOB },
  });
  list = add.list;
  const t = () => list.find((x) => x.id === "agosto-2026");
  assert.equal(t().ganadores.at(-1).label, "");

  list = applyGalleryOp(list, {
    type: "labelPhoto",
    id: "agosto-2026",
    photoId: "agosto-g1",
    label: "Campeones 7ma",
  }).list;
  const g1 = t().ganadores[0];
  assert.equal(g1.label, "Campeones 7ma");
  // El alt describía el texto viejo: se regenera a partir del nuevo.
  assert.equal(g1.alt, undefined);
  const shown = normalizeSiteContent({ gallery: galleryToDb(list) }).gallery[0];
  assert.equal(shown.ganadores[0].alt, "Campeones 7ma, Torneo Agosto 2026");

  const rm = applyGalleryOp(list, {
    type: "removePhoto",
    id: "agosto-2026",
    kind: "ganadores",
    photoId: "agosto-g2",
  });
  assert.deepEqual(rm.removed, ["/img/torneos/agosto/ganadores_2do_caballeros.jpg"]);
  assert.equal(rm.list[0].ganadores.length, 4);
});

test("tipos de foto y operaciones inválidas no rompen la galería", () => {
  const list = galleryFromDb(null);
  assert.ok(
    applyGalleryOp(list, {
      type: "addPhoto",
      id: "agosto-2026",
      kind: "otra",
      photo: { id: "p", src: BLOB },
    }).error,
  );
  assert.ok(
    applyGalleryOp(list, {
      type: "addPhoto",
      id: "agosto-2026",
      kind: "jugadores",
      photo: { id: "p", src: "https://evil.example.com/x.jpg" },
    }).error,
  );
  assert.ok(applyGalleryOp(list, { type: "borrarTodo" }).error);
});

test("mover torneos cambia el orden y no se pasa de los bordes", () => {
  const list = galleryFromDb(null);
  const down = applyGalleryOp(list, { type: "moveTournament", id: "agosto-2026", direction: "down" });
  assert.deepEqual(down.list.map((t) => t.id), ["junio-2026", "agosto-2026"]);
  const edge = applyGalleryOp(list, { type: "moveTournament", id: "agosto-2026", direction: "up" });
  assert.deepEqual(edge.list.map((t) => t.id), ["agosto-2026", "junio-2026"]);
});
