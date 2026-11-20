import test from "node:test";
import assert from "node:assert/strict";
import { clientDebt } from "../lib/metrics.js";

const booking = (patch = {}) => ({
  date: "2026-11-10",
  startTime: "20:00",
  status: "confirmado",
  total: 40000,
  ...patch,
});

test("clientDebt suma el saldo de cada turno que cuenta", () => {
  const res = clientDebt([
    booking({ payments: { a: { amount: 10000, method: "efectivo" } } }), // debe 30.000
    booking({ total: 36000 }), // debe todo
    booking({ payments: { a: { amount: 40000 } } }), // pagado
  ]);
  assert.deepEqual(res, { owed: 66000, owedCount: 2 });
});

test("clientDebt no cuenta cancelados, bloqueos ni turnos de prueba", () => {
  const res = clientDebt([
    booking({ status: "cancelado" }),
    booking({ status: "bloqueado" }),
    booking({ isTest: true }),
  ]);
  assert.deepEqual(res, { owed: 0, owedCount: 0 });
});

test("clientDebt toma el pago de Mercado Pago y nunca da negativo", () => {
  const res = clientDebt([
    booking({ paymentStatus: "approved", paidAmount: 15000 }), // debe 25.000
    booking({ payments: { a: { amount: 50000 } } }), // pagó de más: 0
  ]);
  assert.deepEqual(res, { owed: 25000, owedCount: 1 });
});

test("clientDebt sin turnos devuelve cero", () => {
  assert.deepEqual(clientDebt(), { owed: 0, owedCount: 0 });
  assert.deepEqual(clientDebt([]), { owed: 0, owedCount: 0 });
});
