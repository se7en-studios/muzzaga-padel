import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingTotal,
  clientDebt,
  computeDailyCash,
  hasPenalty,
  isBillableBooking,
  isCountableBooking,
  pendingAmount,
  slotValue,
  summarizeRecords,
} from "../lib/metrics.js";
import { normalizeConfig, penaltyFor, validateConfig } from "../lib/clubConfig.js";

// Multa por cancelar sobre la hora (por ejemplo, un turno fijo que cede el
// horario tarde): el turno se cancela y libera la cancha, pero la multa se
// factura y se cobra.

const booking = (over = {}) => ({
  date: "2026-11-24",
  startTime: "20:00",
  status: "confirmado",
  total: 60000,
  ...over,
});

const cancelledWithPenalty = (over = {}) =>
  booking({ status: "cancelado", penalty: { amount: 30000, pct: 50 }, ...over });

test("la multa sugerida es el % de Ajustes sobre el valor del turno, redondeada a $100", () => {
  assert.equal(penaltyFor({ penaltyPct: 50 }, 60000), 30000);
  assert.equal(penaltyFor({ penaltyPct: 30 }, 55000), 16500);
  assert.equal(penaltyFor({ penaltyPct: 50 }, 55550), 27800);
  // Sin % guardado: la mitad.
  assert.equal(penaltyFor({}, 60000), 30000);
  assert.equal(penaltyFor({ penaltyPct: 0 }, 60000), 0);
});

test("el % de multa se guarda entre 0 y 100 y por defecto es 50", () => {
  assert.equal(normalizeConfig({}).penaltyPct, 50);
  assert.equal(normalizeConfig({ penaltyPct: 40 }).penaltyPct, 40);
  assert.equal(normalizeConfig({ penaltyPct: 140 }).penaltyPct, 100);
  const bad = validateConfig({ ...normalizeConfig({}), penaltyPct: 150 });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.penaltyPct);
});

test("un cancelado con multa factura la multa pero no ocupa cancha", () => {
  const b = cancelledWithPenalty();
  assert.equal(hasPenalty(b), true);
  assert.equal(isCountableBooking(b), false);
  assert.equal(isBillableBooking(b), true);
  assert.equal(bookingTotal(b), 30000);
  assert.equal(pendingAmount(b), 30000);
  // El valor del horario sigue disponible para calcular la multa.
  assert.equal(slotValue(b), 60000);
});

test("un cancelado sin multa sigue sin sumar nada", () => {
  const b = booking({ status: "cancelado", payments: { a: { method: "efectivo", amount: 15000 } } });
  assert.equal(hasPenalty(b), false);
  assert.equal(bookingTotal(b), 0);
  assert.equal(computeDailyCash({ bookings: [b] }).cobrado, 0);
});

test("los cobros de la multa entran en la caja del día, y la seña cuenta como parte", () => {
  const conSena = cancelledWithPenalty({
    payments: { s: { method: "transferencia", amount: 15000 } },
  });
  assert.equal(pendingAmount(conSena), 15000);
  const cash = computeDailyCash({ bookings: [conSena] });
  assert.equal(cash.turnos.transferencia, 15000);
  assert.equal(cash.cobradoTurnos, 15000);

  const pagada = cancelledWithPenalty({
    payments: {
      s: { method: "transferencia", amount: 15000 },
      m: { method: "efectivo", amount: 15000 },
    },
  });
  assert.equal(pendingAmount(pagada), 0);
  assert.equal(computeDailyCash({ bookings: [pagada] }).expectedCash, 15000);
});

test("el resumen del día cuenta la multa como facturado y por cobrar, no como turno", () => {
  const s = summarizeRecords({
    bookings: [booking(), cancelledWithPenalty()],
  });
  assert.equal(s.turnos, 1);
  assert.equal(s.multas, 1);
  assert.equal(s.facturadoMultas, 30000);
  assert.equal(s.facturadoTurnos, 90000);
  assert.equal(s.porCobrar, 90000);
});

test("la multa sin pagar queda como deuda del cliente", () => {
  const { owed, owedCount } = clientDebt([cancelledWithPenalty(), booking({ status: "cancelado" })]);
  assert.equal(owed, 30000);
  assert.equal(owedCount, 1);
});

test("una multa en un turno de prueba no suma", () => {
  const b = cancelledWithPenalty({ isTest: true });
  assert.equal(hasPenalty(b), false);
  assert.equal(bookingTotal(b), 0);
});
