import test from "node:test";
import assert from "node:assert/strict";
import { normalizeConfig } from "../lib/clubConfig.js";
import {
  countFreeSlots,
  freeSlotsLabel,
  freeSlotsOutlook,
  freeSlotsPct,
  freeSlotsTone,
} from "../lib/freeSlots.js";
import { buildFreeSlotsPromoMessage } from "../lib/adminMessages.js";

// Config por defecto: 2 canchas, 7 turnos (14:00 a 23:00), domingo cerrado.
const config = normalizeConfig({});
const courts = config.courts.map((c) => c.id);
// Lunes 21/9/2026 a las 10:00: el día todavía no arrancó.
const morning = { isoDate: "2026-09-21", hhmm: "10:00" };

test("día sin reservas: todos los cupos libres", () => {
  const days = countFreeSlots({ config, claims: {}, from: "2026-09-21", count: 1, now: morning });
  const total = 7 * courts.length;
  assert.deepEqual(
    { free: days["2026-09-21"].free, total: days["2026-09-21"].total, closed: false },
    { free: total, total, closed: false },
  );
  assert.equal(days["2026-09-21"].freeStarts.length, 7);
  assert.equal(days["2026-09-21"].freeStarts[0].free, courts.length);
});

test("los locks de slotClaims restan y un horario lleno sale de freeStarts", () => {
  const claims = {
    "2026-09-21": Object.fromEntries(courts.map((c) => [`${c}_2000`, "b1"])),
    "2026-09-22": { [`${courts[0]}_1400`]: "b2" },
  };
  const days = countFreeSlots({ config, claims, from: "2026-09-21", count: 2, now: morning });
  const lunes = days["2026-09-21"];
  assert.equal(lunes.free, lunes.total - courts.length);
  assert.ok(!lunes.freeStarts.some((s) => s.start === "20:00"));
  const martes = days["2026-09-22"];
  assert.equal(martes.free, martes.total - 1);
  assert.equal(martes.freeStarts[0].free, courts.length - 1);
});

test("domingo y días bloqueados quedan cerrados, sin cupos", () => {
  const blocked = normalizeConfig({ blockedDates: ["2026-09-23"] });
  const days = countFreeSlots({
    config: blocked,
    claims: {},
    from: "2026-09-21",
    count: 7,
    now: morning,
  });
  assert.deepEqual(days["2026-09-23"], { free: 0, total: 0, closed: true, freeStarts: [] });
  assert.equal(days["2026-09-27"].closed, true); // domingo
  assert.equal(Object.keys(days).length, 7);
});

test("los turnos que ya arrancaron no cuentan, ni como libres ni como cupo", () => {
  const tarde = { isoDate: "2026-09-21", hhmm: "18:00" };
  const days = countFreeSlots({ config, claims: {}, from: "2026-09-21", count: 2, now: tarde });
  // Quedan 18:30, 20:00, 21:30 y 23:00.
  assert.equal(days["2026-09-21"].total, 4 * courts.length);
  assert.equal(days["2026-09-21"].freeStarts[0].start, "18:30");
  // Mañana no se toca.
  assert.equal(days["2026-09-22"].total, 7 * courts.length);

  // A la 01:00 del martes la jornada del lunes ya terminó.
  const madrugada = { isoDate: "2026-09-22", hhmm: "01:00" };
  const late = countFreeSlots({ config, claims: {}, from: "2026-09-21", count: 1, now: madrugada });
  assert.deepEqual(late["2026-09-21"], { free: 0, total: 0, closed: false, freeStarts: [] });
  assert.equal(freeSlotsLabel(late["2026-09-21"]), "Terminó");
});

test("tono, porcentaje y etiqueta según qué tan lleno está", () => {
  assert.equal(freeSlotsTone({ free: 0, total: 0, closed: true }), "closed");
  assert.equal(freeSlotsTone({ free: 0, total: 0, closed: false }), "done");
  assert.equal(freeSlotsTone({ free: 0, total: 14, closed: false }), "full");
  assert.equal(freeSlotsTone({ free: 2, total: 14, closed: false }), "high");
  assert.equal(freeSlotsTone({ free: 7, total: 14, closed: false }), "mid");
  assert.equal(freeSlotsTone({ free: 12, total: 14, closed: false }), "low");
  assert.equal(freeSlotsTone({ free: 14, total: 14, closed: false }), "empty");
  assert.equal(freeSlotsPct({ free: 7, total: 14, closed: false }), 50);
  assert.equal(freeSlotsPct({ free: 0, total: 0, closed: true }), null);
  assert.equal(freeSlotsLabel({ free: 1, total: 14, closed: false }), "1 libre");
  assert.equal(freeSlotsLabel({ free: 8, total: 14, closed: false }), "8 libres");
  assert.equal(freeSlotsLabel({ free: 0, total: 14, closed: false }), "Lleno");
  assert.equal(freeSlotsLabel({ free: 0, total: 0, closed: true }), "Cerrado");
});

test("resumen de la semana: total, día más lleno, más vacío y días para promo", () => {
  const days = {
    a: { free: 2, total: 14, closed: false },
    b: { free: 10, total: 14, closed: false },
    c: { free: 0, total: 0, closed: true },
    d: { free: 10, total: 14, closed: false },
    e: { free: 3, total: 14, closed: false },
  };
  const out = freeSlotsOutlook(days, ["a", "b", "c", "d", "e"]);
  assert.equal(out.free, 25);
  assert.equal(out.total, 56);
  assert.equal(out.openDays, 4);
  assert.equal(out.busiest.date, "a");
  // Empate en libres: gana el más cercano.
  assert.equal(out.emptiest.date, "b");
  assert.deepEqual(out.promoDates, ["b", "d"]);
  assert.equal(out.pct, Math.round((31 / 56) * 100));
});

test("resumen sin días abiertos o todo lleno no inventa destacados", () => {
  const none = freeSlotsOutlook({ a: { free: 0, total: 0, closed: true } }, ["a", "x"]);
  assert.equal(none.openDays, 0);
  assert.equal(none.pct, null);
  assert.equal(none.busiest, null);
  assert.equal(none.emptiest, null);

  const full = freeSlotsOutlook(
    { a: { free: 0, total: 14, closed: false }, b: { free: 0, total: 14, closed: false } },
    ["a", "b"],
  );
  assert.equal(full.emptiest, null);
  assert.equal(full.busiest.date, "a");
  assert.deepEqual(full.promoDates, []);

  const vacio = freeSlotsOutlook(
    { a: { free: 14, total: 14, closed: false }, b: { free: 14, total: 14, closed: false } },
    ["a", "b"],
  );
  assert.equal(vacio.busiest, null);
  assert.equal(vacio.emptiest.date, "a");
});

test("promo de WhatsApp con los días y horarios libres", () => {
  const msg = buildFreeSlotsPromoMessage(
    [
      { date: "2026-09-21", starts: ["20:00", "21:30"] },
      { date: "2026-09-22", starts: ["14:00"] },
      { date: "2026-09-24", starts: ["14:00", "15:30", "17:00", "18:30", "20:00", "21:30", "23:00"] },
      { date: "2026-09-25", starts: [] },
    ],
    { todayIso: "2026-09-21", link: "https://club.test", maxStarts: 6 },
  );
  assert.match(msg, /Hay canchas libres en Muzzaga Pádel/);
  assert.match(msg, /\*Hoy lunes 21:\* 20:00 · 21:30 hs/);
  assert.match(msg, /\*Mañana martes 22:\* 14:00 hs/);
  assert.match(msg, /\*Jueves 24:\* 14:00 · 15:30 · 17:00 · 18:30 · 20:00 · 21:30 hs \(y 1 horario más\)/);
  assert.ok(!msg.includes("Viernes 25"));
  assert.match(msg, /https:\/\/club\.test/);
  assert.equal(buildFreeSlotsPromoMessage([]), "");
});
