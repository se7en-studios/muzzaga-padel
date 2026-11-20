// Única fuente de verdad para plata y ocupación del admin. Ninguna vista ni
// server action suma totales por su cuenta: todo pasa por estas funciones
// puras (testeadas en tests/metrics.test.js).
//
// Definiciones:
// - Facturado: lo que vale el turno (booking.total).
// - Cobrado: lo que efectivamente entró (payments del turno + pago online de
//   Mercado Pago + ventas de cantina).
// - Por cobrar: facturado - cobrado de cada turno, nunca negativo.
// - Ocupación: turnos reservados ÷ turnos disponibles (cupos del día menos
//   los bloqueados por mantenimiento), con 1 decimal.
// - Los registros con `isTest: true`, los cancelados y los bloqueos no suman
//   ni plata ni ocupación.

import { priceForSlot } from "../data/pricing.js";

export const PAYMENT_METHOD_KEYS = ["efectivo", "transferencia", "mercadopago"];

const emptyByMethod = () => ({ efectivo: 0, transferencia: 0, mercadopago: 0 });

/** Sin método guardado = efectivo (default de adminAddPayment). */
function methodKey(method) {
  if (!method) return "efectivo";
  return PAYMENT_METHOD_KEYS.includes(method) ? method : "transferencia";
}

export function isTestRecord(record) {
  return record?.isTest === true;
}

/** Venta de cantina anulada: queda en el historial pero no suma. */
export function isVoidedSale(sale) {
  return sale?.voided === true;
}

/** Venta cargada a la cuenta de un turno y todavía no cobrada. */
export function isOnAccountSale(sale) {
  return sale?.method === "cuenta";
}

/** Venta que ya entró a la caja: ni prueba, ni anulada, ni a cuenta. */
function isCollectedSale(sale) {
  return !isTestRecord(sale) && !isVoidedSale(sale) && !isOnAccountSale(sale);
}

/** Consumos de cantina a cuenta de un turno, todavía sin cobrar. */
export function onAccountTotal(sales, bookingId) {
  return sales
    .filter((s) => isOnAccountSale(s) && !isVoidedSale(s) && !isTestRecord(s))
    .filter((s) => bookingId == null || s.chargeTo === bookingId)
    .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
}

/** Turno real que ocupa cancha y genera plata. */
export function isCountableBooking(booking) {
  return Boolean(
    booking &&
    booking.status !== "cancelado" &&
    booking.status !== "bloqueado" &&
    !isTestRecord(booking),
  );
}

function isBlockedBooking(booking) {
  return booking?.status === "bloqueado" && !isTestRecord(booking);
}

/** Lo que vale el turno. 0 si no cuenta (cancelado, bloqueo, prueba). */
export function bookingTotal(booking) {
  if (!isCountableBooking(booking)) return 0;
  if (typeof booking.total === "number") return booking.total;
  const pricing = priceForSlot(booking.date, booking.startTime);
  return booking.fullCourt !== false
    ? pricing.total
    : (booking.playersCount || 4) * pricing.perPlayer;
}

/**
 * Cobros de un turno como lista { method, amount }. Incluye el pago online
 * que el webhook de Mercado Pago guarda aparte (booking.paidAmount), que
 * antes no entraba en ningún total.
 */
export function bookingPayments(booking) {
  const manual = Object.values(booking?.payments || {}).map((p) => ({
    method: methodKey(p.method),
    amount: Number(p.amount) || 0,
  }));
  if (booking?.paymentStatus === "approved" && Number(booking.paidAmount) > 0) {
    manual.push({ method: "mercadopago", amount: Number(booking.paidAmount) });
  }
  return manual;
}

/** Todo lo cobrado sobre un turno (sin importar si cuenta o no). */
export function paidAmount(booking) {
  return bookingPayments(booking).reduce((sum, p) => sum + p.amount, 0);
}

/** Lo que falta cobrar de un turno, nunca negativo. */
export function pendingAmount(booking) {
  return Math.max(0, bookingTotal(booking) - paidAmount(booking));
}

/**
 * Lo que debe un cliente sumando sus turnos: mismo criterio que la ficha
 * (turnos que cuentan con saldo pendiente, incluidos los que todavía no se
 * jugaron). Sirve para mostrar "Debe" en la lista sin abrir cada ficha.
 * @returns {{ owed: number, owedCount: number }}
 */
export function clientDebt(bookings = []) {
  let owed = 0;
  let owedCount = 0;
  bookings.filter(isCountableBooking).forEach((b) => {
    const pending = pendingAmount(b);
    if (pending > 0) {
      owed += pending;
      owedCount += 1;
    }
  });
  return { owed, owedCount };
}

function paymentsByMethod(bookings) {
  const totals = emptyByMethod();
  bookings.filter(isCountableBooking).forEach((b) => {
    bookingPayments(b).forEach((p) => {
      totals[p.method] += p.amount;
    });
  });
  return totals;
}

function salesByMethod(sales) {
  const totals = emptyByMethod();
  sales
    .filter(isCollectedSale)
    .forEach((s) => {
      totals[methodKey(s.method)] += Number(s.total) || 0;
    });
  return totals;
}

const sumValues = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

/**
 * Caja del día. La usan Agenda (línea resumen) y Caja & Cierre Z, así los
 * dos muestran exactamente los mismos números.
 * Esperado en cajón = efectivo turnos + efectivo cantina - egresos.
 */
export function computeDailyCash({ bookings = [], sales = [], expenses = [] }) {
  const turnos = paymentsByMethod(bookings);
  const cantina = salesByMethod(sales);
  const totalExpenses = expenses.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0,
  );
  const byMethod = emptyByMethod();
  PAYMENT_METHOD_KEYS.forEach((k) => {
    byMethod[k] = turnos[k] + cantina[k];
  });
  const cobradoTurnos = sumValues(turnos);
  const cobradoCantina = sumValues(cantina);
  return {
    turnos,
    cantina,
    byMethod,
    totalExpenses,
    expectedCash: turnos.efectivo + cantina.efectivo - totalExpenses,
    cobradoTurnos,
    cobradoCantina,
    cobrado: cobradoTurnos + cobradoCantina,
  };
}

/** Resumen de plata y turnos de un conjunto de registros (un día o un período). */
export function summarizeRecords({ bookings = [], sales = [] }) {
  const countable = bookings.filter(isCountableBooking);
  const cash = computeDailyCash({ bookings, sales });
  return {
    turnos: countable.length,
    bloqueados: bookings.filter(isBlockedBooking).length,
    facturadoTurnos: countable.reduce((s, b) => s + bookingTotal(b), 0),
    cobradoTurnos: cash.cobradoTurnos,
    cantina: cash.cobradoCantina,
    cobrado: cash.cobrado,
    // Lo pendiente de los turnos más los consumos de cantina a cuenta.
    porCobrar:
      countable.reduce((s, b) => s + pendingAmount(b), 0) + onAccountTotal(sales),
    // Marcados "pagado" pero sin ningún cobro cargado: la plata no aparece
    // en caja. Se muestran como alerta para que el personal los cargue.
    pagadosSinCobro: countable.filter(
      (b) => b.status === "pagado" && paidAmount(b) === 0,
    ).length,
  };
}

/**
 * Agrupa por fecha y resume cada día.
 * @param {string[]} dates fechas ISO del período, en orden
 */
export function buildDailySummaries(dates, bookings = [], sales = []) {
  const group = (list) => {
    const map = new Map(dates.map((d) => [d, []]));
    list.forEach((r) => map.get(r.date)?.push(r));
    return map;
  };
  const bookingsByDate = group(bookings);
  const salesByDate = group(sales);
  return dates.map((date) => ({
    date,
    ...summarizeRecords({
      bookings: bookingsByDate.get(date),
      sales: salesByDate.get(date),
    }),
  }));
}

/** Suma campo a campo una lista de resúmenes diarios. */
export function sumSummaries(days) {
  const keys = [
    "turnos",
    "bloqueados",
    "facturadoTurnos",
    "cobradoTurnos",
    "cantina",
    "cobrado",
    "porCobrar",
    "pagadosSinCobro",
  ];
  return Object.fromEntries(
    keys.map((k) => [k, days.reduce((s, d) => s + (d[k] || 0), 0)]),
  );
}

const round1 = (n) => Math.round(n * 10) / 10;

/** Cupos disponibles de un día: los del horario menos los bloqueados. */
function availableSlots(day) {
  return Math.max(0, (day.totalSlots || 0) - (day.bloqueados || 0));
}

/** % de ocupación de un día con 1 decimal, o null si el club no abre. */
export function dayOccupancy(day) {
  const available = availableSlots(day);
  if (available === 0) return null;
  return round1((day.turnos / available) * 100);
}

/**
 * Ocupación promedio del período: turnos reservados ÷ cupos disponibles,
 * contando solo días abiertos que ya llegaron (<= hoy). Así un mes en curso
 * no se diluye con los días que todavía no pasaron.
 * @returns {number|null} null si no hay ningún día abierto transcurrido
 */
export function periodOccupancy(days, todayIso) {
  const elapsed = days.filter(
    (d) => d.date <= todayIso && availableSlots(d) > 0,
  );
  const available = elapsed.reduce((s, d) => s + availableSlots(d), 0);
  if (available === 0) return null;
  const taken = elapsed.reduce((s, d) => s + d.turnos, 0);
  return round1((taken / available) * 100);
}

/** Variación % entre dos valores, redondeada. null si no hay base. */
export function trendPct(current, previous) {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct === 0 ? null : pct;
}

/**
 * Estado de cobro de un turno para pintarlo en la grilla:
 * "bloqueado" | "prueba" | "pagado" (cobrado completo) | "senado" (cobró
 * algo) | "pendiente" (nada cobrado todavía).
 */
export function paymentState(booking) {
  if (booking?.status === "bloqueado") return "bloqueado";
  if (isTestRecord(booking)) return "prueba";
  const total = bookingTotal(booking);
  const paid = paidAmount(booking);
  if (total > 0 && paid >= total) return "pagado";
  if (paid > 0) return "senado";
  return "pendiente";
}

/** Diferencia de arqueo tolerable (vuelto, redondeos) antes de marcarla en rojo. */
export const MINOR_CASH_DIFF = 2000;

/** "ok" si cuadra exacto, "minor" si es chica, "major" si pasa el margen. */
export function cashDiffTone(difference) {
  const abs = Math.abs(Number(difference) || 0);
  if (abs === 0) return "ok";
  return abs <= MINOR_CASH_DIFF ? "minor" : "major";
}
