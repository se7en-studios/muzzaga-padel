import test from "node:test";
import assert from "node:assert/strict";
import { isValidIsoDate } from "../lib/booking.js";
import { isValidSlotFor, normalizeConfig } from "../lib/clubConfig.js";
import {
  ATTEMPT_LIMITS,
  nextAttemptRecord,
  PUBLIC_LIMITS,
} from "../lib/rateLimit.js";
import {
  hashPinFields,
  isPinTaken,
  makeStaffRecord,
  verifyStaffPin,
} from "../lib/staff.js";
import { createHash } from "node:crypto";

test("isValidIsoDate acepta solo fechas reales YYYY-MM-DD", () => {
  assert.equal(isValidIsoDate("2026-10-14"), true);
  assert.equal(isValidIsoDate("2026-10-14-x"), false);
  assert.equal(isValidIsoDate("2026-10-14/y"), false);
  assert.equal(isValidIsoDate("2026-02-31"), false);
  assert.equal(isValidIsoDate("2026-1-4"), false);
  assert.equal(isValidIsoDate(20261014), false);
  assert.equal(isValidIsoDate(undefined), false);
});

test("isValidSlotFor rechaza fechas con sufijo (no esquiva el candado del turno)", () => {
  const config = normalizeConfig({});
  const court = config.courts[0].id;
  const start = "20:00";
  // Un día real y abierto cualquiera: la versión con sufijo nunca es válida.
  const day = ["2026-10-13", "2026-10-14", "2026-10-15"].find((d) =>
    isValidSlotFor(config, d, court, start),
  );
  assert.ok(day, "debería haber un día válido de prueba");
  assert.equal(isValidSlotFor(config, `${day}-a`, court, start), false);
});

test("ráfaga de 20 intentos en paralelo: solo pasan los 5 permitidos", () => {
  const now = 1_000_000;
  let record;
  let allowed = 0;
  for (let i = 0; i < 20; i += 1) {
    const next = nextAttemptRecord(record, now, ATTEMPT_LIMITS.login);
    if (next) {
      record = next;
      allowed += 1;
    }
  }
  assert.equal(allowed, ATTEMPT_LIMITS.login.max);
  assert.ok(record.lockedUntil > now);
});

test("el bloqueo de login vence y la cuenta arranca de cero", () => {
  const limits = ATTEMPT_LIMITS.login;
  let record;
  for (let i = 0; i < limits.max; i += 1) {
    record = nextAttemptRecord(record, 0, limits);
  }
  assert.equal(nextAttemptRecord(record, 1000, limits), undefined);
  const later = nextAttemptRecord(record, limits.lockMs + 1, limits);
  assert.equal(later.count, 1);
  assert.equal(later.lockedUntil, null);
});

test("hay topes diarios para reservas públicas", () => {
  assert.ok(PUBLIC_LIMITS.createBookingDaily.max >= PUBLIC_LIMITS.createBooking.max);
  assert.ok(PUBLIC_LIMITS.createBookingPhone.max > 0);
  assert.ok(PUBLIC_LIMITS.mpPreference.max > 0);
});

test("los PINs nuevos se guardan con scrypt y verifican", () => {
  const record = { id: "a", ...makeStaffRecord({ name: "A", role: "Encargado", pin: "4821" }) };
  assert.equal(record.pinAlgo, "scrypt");
  assert.notEqual(record.pinHash.length, 0);
  const res = verifyStaffPin("4821", [record]);
  assert.equal(res.valid, true);
  assert.equal(res.legacy, false);
  assert.equal(verifyStaffPin("4822", [record]).valid, false);
  assert.equal(isPinTaken("4821", [record]), true);
});

test("los PINs viejos (sha256) siguen funcionando y se marcan para migrar", () => {
  const salt = "abcd1234abcd1234";
  const legacy = {
    id: "old",
    name: "Viejo",
    role: "Recepción",
    salt,
    pinHash: createHash("sha256").update(`${salt}:7070`).digest("hex"),
  };
  const res = verifyStaffPin("7070", [legacy]);
  assert.equal(res.valid, true);
  assert.equal(res.legacy, true);
  const upgraded = { ...legacy, ...hashPinFields("7070") };
  assert.equal(verifyStaffPin("7070", [upgraded]).legacy, false);
});
