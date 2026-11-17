import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  slotTimesFor,
  priceFor,
  bookingPriceFor,
  depositFor,
  validateConfig,
  maskCbu,
  isValidSlotFor,
} from "../lib/clubConfig.js";

const defaults = normalizeConfig({});

test("config vacío = los mismos turnos que estaban hardcodeados", () => {
  const starts = slotTimesFor(defaults, "2026-09-22").map((s) => s.start);
  assert.deepEqual(starts, [
    "14:00",
    "15:30",
    "17:00",
    "18:30",
    "20:00",
    "21:30",
    "23:00",
  ]);
  assert.equal(slotTimesFor(defaults, "2026-09-27").length, 0); // domingo cerrado
  assert.equal(priceFor(defaults, "2026-09-22", "20:00").total, 60000);
  assert.equal(priceFor(defaults, "2026-09-22", "20:00").perPlayer, 15000);
});

test("formato viejo (fullCourtPrice plano) se respeta", () => {
  const c = normalizeConfig({
    fullCourtPrice: 70000,
    blockedDates: ["2026-09-25"],
  });
  assert.equal(priceFor(c, "2026-09-22", "14:00").total, 70000);
  assert.equal(slotTimesFor(c, "2026-09-25").length, 0);
});

test("RTDB puede devolver schedule/courts como objeto en vez de array", () => {
  const c = normalizeConfig({
    courts: { 0: { id: "cancha-1", name: "Central", type: "Cristal" } },
    schedule: { 2: { open: false, start: "14:00", end: "00:30" } },
  });
  assert.equal(c.courts.length, 1);
  assert.equal(slotTimesFor(c, "2026-09-22").length, 0); // martes cerrado
  assert.equal(slotTimesFor(c, "2026-09-23").length, 7); // miércoles default
});

test("horario pico / valle, con inicios después de medianoche como pico", () => {
  const c = normalizeConfig({
    pricing: {
      valle: { court: 50000 },
      pico: { court: 70000, perPlayer: 20000 },
      picoEnabled: true,
      picoDesde: "18:30",
    },
    schedule: [null, { open: true, start: "14:00", end: "02:00" }],
  });
  const monday = "2026-09-21";
  assert.equal(priceFor(c, monday, "17:00").total, 50000);
  assert.equal(priceFor(c, monday, "17:00").perPlayer, 12500);
  assert.equal(priceFor(c, monday, "18:30").band, "pico");
  assert.equal(priceFor(c, monday, "18:30").perPlayer, 20000); // override
  assert.ok(slotTimesFor(c, monday).some((s) => s.start === "00:30"));
  assert.equal(priceFor(c, monday, "00:30").band, "pico");
});

test("cantidad y nombres de canchas vienen del config", () => {
  const c = normalizeConfig({
    courts: [
      { id: "cancha-1", name: "A" },
      { id: "cancha-2", name: "B" },
      { id: "cancha-3", name: "C" },
    ],
  });
  assert.equal(isValidSlotFor(c, "2026-09-22", "cancha-3", "20:00"), true);
  assert.equal(
    isValidSlotFor(defaults, "2026-09-22", "cancha-3", "20:00"),
    false,
  );
});

test("seña = % del total, redondeada a $100", () => {
  assert.equal(depositFor(defaults, 60000), 15000);
  assert.equal(depositFor(normalizeConfig({ depositPct: 33 }), 60000), 19800);
});

test("validación: CBU de 22 dígitos, precios y horarios", () => {
  const base = { ...DEFAULT_CONFIG, pricing: DEFAULT_CONFIG.pricing };
  assert.equal(validateConfig(base).ok, true);
  assert.equal(
    validateConfig({ ...base, paymentCbu: "123" }).errors.paymentCbu !==
      undefined,
    true,
  );
  assert.equal(
    validateConfig({ ...base, paymentCbu: "0000 0031 0001 0002 0003 04" }).ok,
    true,
  );
  assert.ok(validateConfig({ ...base, courts: [] }).errors.courts);
  assert.ok(
    validateConfig({ ...base, slotDurationMin: 95 }).errors.slotDurationMin,
  );
  const badDay = [...base.schedule];
  badDay[1] = { open: true, start: "14:00", end: "14:30" };
  assert.ok(validateConfig({ ...base, schedule: badDay }).errors["schedule.1"]);
  assert.ok(
    validateConfig({
      ...base,
      pricing: { ...base.pricing, valle: { court: 0 } },
    }).errors["pricing.valle"],
  );
});

test("CBU enmascarado", () => {
  assert.equal(maskCbu("0000003100010002000304"), "0000 ···· ···· 0304");
});

test("turnos después de medianoche no cuentan como pasados a la tarde", async () => {
  const { hasSlotStarted } = await import("../lib/clubConfig.js");
  const c = normalizeConfig({ schedule: [null, { open: true, start: "14:00", end: "02:00" }] });
  const now = { isoDate: "2026-09-21", hhmm: "15:00" };
  assert.equal(hasSlotStarted(c, "2026-09-21", "14:00", now), true);
  assert.equal(hasSlotStarted(c, "2026-09-21", "00:30", now), false);
  assert.equal(hasSlotStarted(c, "2026-09-20", "20:00", now), true);
  assert.equal(hasSlotStarted(c, "2026-09-22", "14:00", now), false);
});

test("turno fijo con valle a $40.000: el precio sale de la franja, no del precio viejo", () => {
  const c = normalizeConfig({
    pricing: {
      valle: { court: 40000 },
      pico: { court: 60000 },
      picoEnabled: true,
      picoDesde: "18:30",
    },
  });
  const monday = "2026-09-21";
  // Un fijo cargado cuando todo valía $60.000.
  const fijo = { date: monday, startTime: "17:00", total: 60000, fullCourt: true };
  assert.deepEqual(bookingPriceFor(c, fijo), { band: "valle", total: 40000 });
  assert.deepEqual(bookingPriceFor(c, { ...fijo, startTime: "18:30" }), {
    band: "pico",
    total: 60000,
  });
  // Por jugador: 3 × ($40.000 ÷ 4).
  assert.equal(
    bookingPriceFor(c, { ...fijo, fullCourt: false, playersCount: 3 }).total,
    30000,
  );
});
