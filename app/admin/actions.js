"use server";

import { getDb, isFirebaseConfigured } from "../../lib/firebase";
import {
  addMinutes,
  isoAddDays,
  isoWeekday,
  nowInClubTimezone,
  slotKey,
  todayInClub,
} from "../../lib/booking";
import {
  findCourtIn,
  isValidSlotFor,
  priceFor,
  slotTimesFor,
  validateConfig,
} from "../../lib/clubConfig";
import { getClubConfig, setCachedClubConfig } from "../../lib/clubConfigServer";
import {
  bookingTotal,
  buildDailySummaries,
  computeDailyCash,
  dayOccupancy,
  isCountableBooking,
  isTestRecord,
  onAccountTotal,
  paidAmount,
  pendingAmount,
  periodOccupancy,
  sumSummaries,
  summarizeRecords,
} from "../../lib/metrics";
import { clientKey } from "../../lib/clientsExport";
import {
  datesBetween,
  occupancyHeatmap,
  paymentMix,
  previousPeriod,
  topClients,
  topProducts,
} from "../../lib/reports";
import {
  createAdminSession,
  destroyAdminSession,
  isAdminAuthenticated,
  passwordMatches,
  requireAdmin,
} from "../../lib/adminSession";
import {
  checkLoginAllowed,
  clearLoginAttempts,
  registerFailedLogin,
} from "../../lib/adminRateLimit";
import { OPEN_ORDER_STATUSES } from "../../lib/cantinaOrder";
import {
  STAFF_PIN,
  STAFF_ROLES,
  isPinTaken,
  hashPinFields,
  makeStaffRecord,
  publicStaff,
  verifyStaffPin,
} from "../../lib/staff";

// Ids de push de RTDB. Validarlos evita que un id como "/" o "a/b" apunte a
// otra ruta (un remove sobre `cantinaSales/` borraría la colección entera).
const RECORD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const isId = (v) => typeof v === "string" && RECORD_ID.test(v);
const clip = (v, n) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
const INVALID = { ok: false, error: "Registro inválido." };
const SESSION_STAFF = {
  id: "session",
  name: "Sesión admin",
  role: "Administrador",
};

async function loadStaffMembers(db) {
  return snapToList(await db.ref("staffMembers").once("value"));
}

/** Verifica un PIN de staff con límite de intentos. → { staff } | { error } */
async function authorizeStaff(pin) {
  if (!isFirebaseConfigured()) {
    return { error: "Firebase no está configurado." };
  }
  const gate = await checkLoginAllowed("pin");
  if (!gate.allowed) return { error: gate.error };
  const members = await loadStaffMembers(getDb());
  if (!members.some((m) => m.active !== false)) {
    return {
      error:
        "Todavía no hay equipo cargado. Creá los PINs en Configuración → Equipo.",
    };
  }
  const res = verifyStaffPin(pin, members);
  if (!res.valid) {
    return {
      error: await registerFailedLogin(gate.key, "PIN de equipo incorrecto"),
    };
  }
  await clearLoginAttempts(gate.key);
  if (res.legacy) {
    // Primer PIN correcto con el hash viejo: se guarda de nuevo con scrypt.
    await getDb()
      .ref(`staffMembers/${res.staff.id}`)
      .update(hashPinFields(String(pin).trim()))
      .catch(() => {});
  }
  return { staff: res.staff };
}

// "Deshacer" sin PIN solo vale un rato después de crear el registro: pasado
// ese margen, borrar un cobro o anular una venta exige el PIN de quien lo hace.
const UNDO_WINDOW_MS = 60 * 1000;

/**
 * Con PIN lo exige válido. Sin PIN solo se acepta dentro de la ventana de
 * "Deshacer" del registro recién creado (`createdAt`), a nombre de la sesión.
 */
async function undoStaff(pin, createdAt) {
  if (pin) return authorizeStaff(pin);
  if (Number(createdAt) > 0 && Date.now() - Number(createdAt) <= UNDO_WINDOW_MS) {
    return { staff: SESSION_STAFF };
  }
  return { error: "Pasó más de un minuto: ingresá tu PIN para hacerlo." };
}

/** Exige PIN válido de Administrador o Encargado. → { staff } | { error } */
async function authorizeManager(pin) {
  const auth = await authorizeStaff(pin);
  if (auth.error) return auth;
  if (!MANAGER_ROLES.includes(auth.staff.role)) {
    return { error: "Esta acción es solo para Administrador o Encargado." };
  }
  return auth;
}

async function audit(db, staff, action, target, details, extra = {}) {
  await db
    .ref("auditLog")
    .push()
    .set({
      action,
      target: clip(target, 160),
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      details: clip(details, 240),
      timestamp: Date.now(),
      ...extra,
    });
}

/** Libera el lock del horario solo si sigue siendo de este turno. */
async function releaseClaim(db, booking, bookingId) {
  if (!booking?.date || !booking.courtId || !booking.startTime) return;
  await db
    .ref(
      `slotClaims/${booking.date}/${slotKey(booking.courtId, booking.startTime)}`,
    )
    .transaction((current) => (current === bookingId ? null : current));
}

/** Error listo para devolver si la caja de `date` ya tiene Cierre Z. */
async function closedDayError(db, date) {
  if (!date || !(await isCashClosed(db, date))) return null;
  return {
    ok: false,
    error: `La caja del ${date} ya está cerrada. Reabrila desde Caja (con PIN) para modificar ese día.`,
  };
}

async function readRecord(db, path) {
  return (await db.ref(path).once("value")).val();
}

export async function verifyAdminPassword(password) {
  const gate = await checkLoginAllowed();
  if (!gate.allowed) {
    return { ok: false, error: gate.error };
  }

  if (!passwordMatches(password)) {
    return { ok: false, error: await registerFailedLogin(gate.key) };
  }

  await clearLoginAttempts(gate.key);
  await createAdminSession();
  return { ok: true };
}

/** El cliente pregunta al servidor si su cookie sigue siendo válida. */
export async function checkAdminSession() {
  return { ok: await isAdminAuthenticated() };
}

export async function adminLogout() {
  await destroyAdminSession();
  return { ok: true };
}

/** Lista { id, ...val } de un snapshot de Realtime Database. */
function snapToList(snap) {
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
}

/** Registros de `path` con `date` entre dos fechas ISO (inclusive). */
async function loadByDateRange(db, path, fromIso, toIso) {
  const snap = await db
    .ref(path)
    .orderByChild("date")
    .startAt(fromIso)
    .endAt(toIso)
    .once("value");
  return snapToList(snap);
}

const courtLabel = (court) =>
  court.type ? `${court.name} (${court.type})` : court.name;

const withBookingCode = (b) => ({
  ...b,
  bookingCode: `MUZZ-${b.id.slice(-5).toUpperCase()}`,
});

/**
 * Todo lo que pasó en un día: locks, reservas, ventas de cantina, egresos y
 * cierre. Lo comparten Agenda y Caja para que nunca calculen distinto.
 */
async function loadDayRecords(db, date) {
  const [claimsSnap, bookings, sales, expSnap, sessionSnap] = await Promise.all(
    [
      db.ref(`slotClaims/${date}`).get(),
      loadByDateRange(db, "bookings", date, date),
      loadByDateRange(db, "cantinaSales", date, date),
      db.ref(`cashExpenses/${date}`).once("value"),
      db.ref(`dailyCashSessions/${date}`).once("value"),
    ],
  );
  return {
    claims: claimsSnap.exists() ? claimsSnap.val() : {},
    bookings: bookings.map(withBookingCode),
    sales,
    expenses: snapToList(expSnap),
    session: sessionSnap.exists() ? sessionSnap.val() : null,
  };
}

export async function getAdminDayData(isoDate) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const date = isoDate || todayInClub();
  if (!ISO_DATE.test(date)) return { ok: false, error: "Fecha inválida." };
  const config = await getClubConfig();
  const slotTimes = slotTimesFor(config, date);

  let records = { claims: {}, bookings: [], sales: [], expenses: [] };
  let lastWeek = { bookings: [], sales: [] };
  let firebaseOk = false;

  if (isFirebaseConfigured()) {
    try {
      const db = getDb();
      const lastWeekDate = isoAddDays(date, -7);
      const [day, lwBookings, lwSales] = await Promise.all([
        loadDayRecords(db, date),
        loadByDateRange(db, "bookings", lastWeekDate, lastWeekDate),
        loadByDateRange(db, "cantinaSales", lastWeekDate, lastWeekDate),
      ]);
      records = day;
      lastWeek = { bookings: lwBookings, sales: lwSales };
      firebaseOk = true;
    } catch (error) {
      console.warn("Aviso Firebase en Admin:", error.message);
    }
  }

  const slots = config.courts.flatMap((court) =>
    slotTimes.map(({ start, end }) => {
      const key = slotKey(court.id, start);
      const bookingId = records.claims[key] || null;
      const booking = bookingId
        ? records.bookings.find((b) => b.id === bookingId) || null
        : null;
      return {
        courtId: court.id,
        courtName: court.name,
        courtType: court.type,
        start,
        end,
        price: priceFor(config, date, start),
        slotKey: key,
        isTaken: Boolean(bookingId),
        bookingId,
        booking,
      };
    }),
  );

  const totalSlots = slots.length;
  const takenSlots = slots.filter((s) => s.isTaken).length;
  const summary = summarizeRecords(records);
  // Mismo día de la semana anterior, para las comparaciones de los KPIs.
  const lastWeekSummary = summarizeRecords(lastWeek);

  return {
    ok: true,
    firebaseOk,
    date,
    courts: config.courts,
    slots,
    sales: records.sales,
    bookings: records.bookings.sort((a, b) =>
      a.startTime > b.startTime ? 1 : -1,
    ),
    summary,
    lastWeek: {
      ...lastWeekSummary,
      ocupacionPct: dayOccupancy({ ...lastWeekSummary, totalSlots }),
    },
    cash: computeDailyCash(records),
    stats: {
      totalSlots,
      takenSlots,
      libres: totalSlots - takenSlots,
      reservados: summary.turnos,
      disponibles: totalSlots - summary.bloqueados,
      ocupacionPct: dayOccupancy({ ...summary, totalSlots }),
    },
  };
}

export async function adminCreateManualBooking(input) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const date = input?.date;

  if (!isFirebaseConfigured()) {
    return {
      ok: false,
      error: "Firebase no está configurado en las variables de entorno.",
    };
  }
  if (!ISO_DATE.test(date || ""))
    return { ok: false, error: "Fecha inválida." };

  try {
    const config = await getClubConfig();
    const res = await createBookingAt(getDb(), config, date, input);
    return res.ok ? { ok: true, bookingId: res.bookingId } : res;
  } catch (error) {
    return {
      ok: false,
      error: "No se pudo guardar la reserva en la base de datos.",
    };
  }
}

const CREATABLE_STATUSES = ["confirmado", "señado", "pagado", "bloqueado"];
const MAX_RECURRING_WEEKS = 26;

/** Toma el lock del horario y guarda el turno. Lo comparten el alta simple y el turno fijo. */
async function createBookingAt(db, config, date, input) {
  const {
    courtId,
    startTime,
    playerName,
    playerPhone,
    playersCount,
    fullCourt,
    status,
    notes,
    recurringId,
  } = input;
  const court = findCourtIn(config, courtId);
  if (!court) return { ok: false, error: "Cancha inválida." };
  if (!isValidSlotFor(config, date, courtId, startTime)) {
    return {
      ok: false,
      error:
        "Ese horario no existe en la grilla de ese día (¿día cerrado o bloqueado?).",
    };
  }

  const bookingRef = db.ref("bookings").push();
  const claimRef = db.ref(`slotClaims/${date}/${slotKey(courtId, startTime)}`);
  const claim = await claimRef.transaction((current) =>
    current ? undefined : bookingRef.key,
  );
  if (!claim.committed) {
    return { ok: false, error: "Ese horario ya se encuentra ocupado." };
  }

  const players = Math.min(8, Math.max(1, Number(playersCount) || 4));
  const slotPricing = priceFor(config, date, startTime);
  try {
    await bookingRef.set({
    courtId,
    courtName: courtLabel(court),
    date,
    startTime,
    endTime: addMinutes(startTime, config.slotDurationMin),
    playerName: clip(playerName, 60) || "Reserva Manual",
    playerPhone: clip(playerPhone, 30),
    playersCount: players,
    fullCourt: fullCourt !== false,
    total:
      fullCourt !== false ? slotPricing.total : players * slotPricing.perPlayer,
    priceBand: slotPricing.band,
    status: CREATABLE_STATUSES.includes(status) ? status : "confirmado",
    notes: clip(notes, 300),
    createdFromAdmin: true,
    ...(recurringId ? { recurringId } : {}),
    createdAt: Date.now(),
    });
  } catch (err) {
    // El lock ya era nuestro: se suelta para no dejar el horario bloqueado.
    await claimRef.remove().catch(() => {});
    throw err;
  }
  return { ok: true, bookingId: bookingRef.key };
}

/**
 * Turno fijo: el mismo horario y cancha durante `weeks` semanas desde `date`.
 * Las semanas ocupadas o cerradas se saltean y se informan, no frenan el resto.
 */
export async function adminCreateRecurringBookings(input) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { date, weeks } = input || {};
  const count = Math.round(Number(weeks));
  if (!ISO_DATE.test(date || ""))
    return { ok: false, error: "Fecha inválida." };
  if (!Number.isFinite(count) || count < 2 || count > MAX_RECURRING_WEEKS) {
    return {
      ok: false,
      error: `Elegí entre 2 y ${MAX_RECURRING_WEEKS} semanas.`,
    };
  }
  if (!isFirebaseConfigured()) {
    return { ok: false, error: "Firebase no está configurado." };
  }

  try {
    const db = getDb();
    const config = await getClubConfig();
    const recurringId = db.ref("bookings").push().key;
    const created = [];
    const skipped = [];
    for (let i = 0; i < count; i += 1) {
      const day = isoAddDays(date, i * 7);
      const res = await createBookingAt(db, config, day, {
        ...input,
        recurringId,
      });
      if (res.ok) created.push(day);
      else skipped.push({ date: day, reason: res.error });
    }
    if (created.length === 0) {
      return {
        ok: false,
        error:
          "No se pudo crear ninguna semana: todas estaban ocupadas o cerradas.",
        skipped,
      };
    }
    return { ok: true, recurringId, created, skipped };
  } catch (error) {
    return { ok: false, error: "No se pudo crear el turno fijo." };
  }
}

const BOOKING_STATUSES = [
  "confirmado",
  "señado",
  "pagado",
  "bloqueado",
  "cancelado",
];

export async function adminUpdateStatus(bookingId, newStatus) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isId(bookingId)) return { ok: false, error: "ID de reserva inválido." };
  if (!BOOKING_STATUSES.includes(newStatus)) {
    return { ok: false, error: "Estado inválido." };
  }
  try {
    const db = getDb();
    const booking = await readRecord(db, `bookings/${bookingId}`);
    if (!booking) return { ok: false, error: "El turno no existe." };
    // Cancelar/bloquear saca los cobros del turno de la caja del día.
    const closed = await closedDayError(db, booking.date);
    if (closed) return closed;
    await db.ref(`bookings/${bookingId}`).update({
      status: newStatus,
      updatedAt: Date.now(),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "No se pudo actualizar el estado." };
  }
}

/** Cancela un turno y libera el horario. Pide PIN para dejar registrado quién fue. */
export async function adminCancelBooking({ bookingId, pin, reason } = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isId(bookingId)) return { ok: false, error: "Turno inválido." };

  const auth = await authorizeStaff(pin);
  if (auth.error) return { ok: false, error: auth.error };

  try {
    const db = getDb();
    const booking = await readRecord(db, `bookings/${bookingId}`);
    if (!booking) return { ok: false, error: "El turno no existe." };
    if (booking.status === "cancelado") {
      return { ok: false, error: "Ese turno ya estaba cancelado." };
    }
    const closed = await closedDayError(db, booking.date);
    if (closed) return closed;

    await releaseClaim(db, booking, bookingId);
    await db.ref(`bookings/${bookingId}`).update({
      status: "cancelado",
      cancelledAt: Date.now(),
      cancelledBy: auth.staff.name,
      ...(reason ? { cancelReason: clip(reason, 120) } : {}),
    });
    await audit(
      db,
      auth.staff,
      "CANCELAR_TURNO",
      `${booking.playerName || "Turno"} · ${booking.date} ${booking.startTime}`,
      reason ? `Motivo: ${reason}` : "Turno cancelado y horario liberado",
      { courtName: booking.courtName || null },
    );
    return { ok: true, staff: auth.staff.name };
  } catch (error) {
    console.error("Error al cancelar reserva en admin", error);
    return { ok: false, error: "No se pudo cancelar el turno." };
  }
}

/**
 * Cancela de una sola vez todas las ocurrencias futuras (hoy inclusive) y sin
 * cancelar de un turno fijo. Las de un día con la caja ya cerrada se saltean
 * y se informan en `blocked`, no frenan al resto de la serie.
 */
export async function adminCancelRecurringSeries({
  recurringId,
  pin,
  reason,
} = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isId(recurringId)) return { ok: false, error: "Serie inválida." };

  const auth = await authorizeStaff(pin);
  if (auth.error) return { ok: false, error: auth.error };

  try {
    const db = getDb();
    const today = todayInClub();
    // Solo los turnos de esta serie (índice recurringId en database.rules.json).
    const series = snapToList(
      await db
        .ref("bookings")
        .orderByChild("recurringId")
        .equalTo(recurringId)
        .get(),
    );
    const targets = series.filter(
      (b) =>
        b.recurringId === recurringId &&
        b.status !== "cancelado" &&
        b.date >= today,
    );
    if (targets.length === 0) {
      return {
        ok: false,
        error: "No quedan turnos futuros de esa serie para cancelar.",
      };
    }

    let cancelled = 0;
    const blocked = [];
    for (const booking of targets) {
      if (await closedDayError(db, booking.date)) {
        blocked.push(booking.date);
        continue;
      }
      await releaseClaim(db, booking, booking.id);
      await db.ref(`bookings/${booking.id}`).update({
        status: "cancelado",
        cancelledAt: Date.now(),
        cancelledBy: auth.staff.name,
        ...(reason ? { cancelReason: clip(reason, 120) } : {}),
      });
      cancelled += 1;
    }
    if (cancelled === 0) {
      return {
        ok: false,
        error:
          "Ningún turno se pudo cancelar: todos tienen la caja de ese día cerrada.",
      };
    }
    await audit(
      db,
      auth.staff,
      "CANCELAR_SERIE_FIJA",
      `Turno fijo · ${targets[0].playerName || "Serie"} · ${targets[0].courtName || ""}`,
      reason
        ? `Motivo: ${reason} · ${cancelled} semanas`
        : `${cancelled} semanas canceladas`,
    );
    return { ok: true, staff: auth.staff.name, cancelled, blocked };
  } catch (error) {
    console.error("Error al cancelar serie de turno fijo", error);
    return { ok: false, error: "No se pudo cancelar la serie." };
  }
}

/** Elimina definitivamente una reserva de la base, requiriendo PIN de staff. */
export async function adminDeleteBooking({ bookingId, pin, reason } = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isId(bookingId)) return { ok: false, error: "Turno inválido." };

  const auth = await authorizeStaff(pin);
  if (auth.error) return { ok: false, error: auth.error };

  try {
    const db = getDb();
    const booking = await readRecord(db, `bookings/${bookingId}`);
    if (!booking) return { ok: false, error: "El turno no existe." };
    const closed = await closedDayError(db, booking.date);
    if (closed) return closed;

    await releaseClaim(db, booking, bookingId);
    await db.ref(`bookings/${bookingId}`).remove();
    await audit(
      db,
      auth.staff,
      "ELIMINAR_TURNO",
      `${booking.playerName || "Turno"} · ${booking.date} ${booking.startTime}`,
      reason
        ? `Motivo: ${reason}`
        : "Turno eliminado definitivamente de la base",
      { courtName: booking.courtName || null, amount: bookingTotal(booking) },
    );
    return { ok: true, staff: auth.staff.name };
  } catch (error) {
    return { ok: false, error: "No se pudo eliminar el turno." };
  }
}

const PAYMENT_METHODS = ["efectivo", "transferencia", "mercadopago"];
const MAX_PAYMENT = 10_000_000;

/** Registra un cobro parcial o total sobre una reserva (seña, efectivo, etc). */
export async function adminAddPayment(bookingId, method, amount) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const amt = Math.round(Number(amount));
  if (
    !isId(bookingId) ||
    !Number.isFinite(amt) ||
    amt <= 0 ||
    amt > MAX_PAYMENT
  ) {
    return { ok: false, error: "Ingresá un monto válido." };
  }

  try {
    const db = getDb();
    const booking = await readRecord(db, `bookings/${bookingId}`);
    if (!booking) return { ok: false, error: "El turno no existe." };
    if (!isCountableBooking(booking)) {
      return {
        ok: false,
        error: "No se puede cobrar un turno cancelado o bloqueado.",
      };
    }
    const closed = await closedDayError(db, booking.date);
    if (closed) return closed;
    const paymentRef = db.ref(`bookings/${bookingId}/payments`).push();
    await paymentRef.set({
      method: PAYMENT_METHODS.includes(method) ? method : "efectivo",
      amount: amt,
      createdAt: Date.now(),
    });
    return { ok: true, paymentId: paymentRef.key };
  } catch (error) {
    return { ok: false, error: "No se pudo registrar el cobro." };
  }
}

/** Borra un cobro. Con PIN queda a nombre del integrante; sin PIN solo dentro del minuto de "Deshacer". */
export async function adminRemovePayment(bookingId, paymentId, pin) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isId(bookingId) || !isId(paymentId)) return INVALID;
  try {
    const db = getDb();
    const booking = await readRecord(db, `bookings/${bookingId}`);
    const payment = booking?.payments?.[paymentId];
    if (!payment) return { ok: false, error: "Ese cobro ya no existe." };
    const auth = await undoStaff(pin, payment.createdAt);
    if (auth.error) return { ok: false, error: auth.error };
    const closed = await closedDayError(db, booking.date);
    if (closed) return closed;
    await db.ref(`bookings/${bookingId}/payments/${paymentId}`).remove();
    await audit(
      db,
      auth.staff,
      "ELIMINAR_COBRO",
      `${booking.playerName || "Turno"} · ${booking.date} ${booking.startTime}`,
      `Cobro de $${payment.amount} (${payment.method || "efectivo"}) eliminado`,
      { amount: Number(payment.amount) || 0 },
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "No se pudo eliminar el cobro." };
  }
}

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Resumen de los últimos 7 días (hoy en Catriel incluido) para el gráfico de
 * la semana, más el mismo día de la semana anterior para las tendencias.
 */
export async function adminGetWeekStats() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const today = todayInClub();
  const dates = Array.from({ length: 7 }, (_, i) => isoAddDays(today, i - 6));
  const allDates = [isoAddDays(today, -7), ...dates];
  const shape = (summaries) => ({
    ok: true,
    days: summaries.slice(1).map((d) => ({
      ...d,
      dayLabel: WEEKDAY_LABELS[isoWeekday(d.date)],
      isToday: d.date === today,
    })),
    lastWeekSameDay: summaries[0],
  });

  if (!isFirebaseConfigured()) return shape(buildDailySummaries(allDates));

  try {
    const db = getDb();
    const [bookings, sales] = await Promise.all([
      loadByDateRange(db, "bookings", allDates[0], today),
      loadByDateRange(db, "cantinaSales", allDates[0], today),
    ]);
    return shape(buildDailySummaries(allDates, bookings, sales));
  } catch (error) {
    return { ok: false, error: "No se pudo cargar la tendencia semanal." };
  }
}

const CLIENT_KEY = /^(t\d{1,10}|n-[a-z0-9-]{1,80})$/;

/**
 * Listado de clientes derivado de las reservas (agrupadas por teléfono).
 * No es una colección nueva: `bookings` sigue siendo la fuente de verdad.
 */
export async function adminGetClients() {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isFirebaseConfigured()) return { ok: true, clients: [] };

  try {
    const db = getDb();
    const [snap, deletedSnap] = await Promise.all([
      db.ref("bookings").get(),
      db.ref("deletedClients").get(),
    ]);

    // Borrar un cliente oculta su historial hasta ese momento: si vuelve a
    // reservar después, reaparece con los turnos nuevos.
    const deletedAt = new Map(
      Object.entries(deletedSnap.exists() ? deletedSnap.val() : {}).map(
        ([k, v]) => [k, Number(v?.deletedAt) || Infinity],
      ),
    );
    const byKey = new Map();

    snapToList(snap).forEach((b) => {
      if (!isCountableBooking(b)) return;
      const phone = (b.playerPhone || "").trim();
      const name = (b.playerName || "Sin nombre").trim();
      const key = clientKey(phone, name);
      if (deletedAt.has(key) && (b.createdAt || 0) <= deletedAt.get(key))
        return;

      const date = b.date || "";
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalSpent += bookingTotal(b);
        if (date > existing.lastDate) {
          existing.lastDate = date;
          existing.name = name; // el nombre más reciente
        }
        if (date && (!existing.firstDate || date < existing.firstDate))
          existing.firstDate = date;
      } else {
        byKey.set(key, {
          key,
          name,
          phone,
          count: 1,
          totalSpent: bookingTotal(b),
          lastDate: date,
          firstDate: date,
        });
      }
    });

    const clients = Array.from(byKey.values()).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
    return { ok: true, clients };
  } catch (error) {
    return { ok: false, error: "No se pudo cargar el listado de clientes." };
  }
}

/** Elimina a un cliente del CRM y listados, requiriendo PIN del personal para auditoría. */
export async function adminDeleteClient({ key, name, pin, reason } = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!CLIENT_KEY.test(key || "")) {
    return { ok: false, error: "Cliente inválido." };
  }
  const auth = await authorizeStaff(pin);
  if (auth.error) return { ok: false, error: auth.error };

  try {
    const db = getDb();
    await db.ref(`deletedClients/${key}`).set({
      deletedAt: Date.now(),
      deletedBy: auth.staff.name,
      staffRole: auth.staff.role,
      reason: clip(reason, 120),
    });
    await db.ref(`clientNotes/${key}`).remove();
    await audit(
      db,
      auth.staff,
      "ELIMINAR_CLIENTE",
      name ? `${clip(name, 60)} (${key})` : key,
      reason ? `Motivo: ${reason}` : "Cliente eliminado del listado",
    );
    return { ok: true, staff: auth.staff.name };
  } catch (error) {
    return { ok: false, error: "No se pudo eliminar el cliente." };
  }
}

/** Historial de reservas, consumo en cantina y notas de un cliente. */
export async function adminGetClientDetail(key) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!CLIENT_KEY.test(key || ""))
    return { ok: false, error: "Cliente inválido." };
  if (!isFirebaseConfigured())
    return { ok: true, bookings: [], cantina: [], note: "" };

  try {
    const db = getDb();
    const [bookingsSnap, noteSnap] = await Promise.all([
      db.ref("bookings").get(),
      db.ref(`clientNotes/${key}`).once("value"),
    ]);
    const bookings = snapToList(bookingsSnap)
      .filter((b) => !isTestRecord(b))
      .filter((b) => clientKey(b.playerPhone, b.playerName) === key)
      .map((b) => ({
        id: b.id,
        date: b.date,
        startTime: b.startTime,
        courtName: b.courtName,
        status: b.status,
        total: bookingTotal(b),
        paid: paidAmount(b),
      }))
      .sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? 1 : -1));

    // Consumo en cantina: ventas cargadas a la cuenta de alguno de sus turnos.
    const ids = new Set(bookings.map((b) => b.id));
    const dates = bookings
      .map((b) => b.date)
      .filter(Boolean)
      .sort();
    const cantina = dates.length
      ? (
          await loadByDateRange(
            db,
            "cantinaSales",
            dates[0],
            dates[dates.length - 1],
          )
        )
          .filter(
            (sale) => sale.chargeTo && ids.has(sale.chargeTo) && !sale.voided,
          )
          .map((sale) => ({
            id: sale.id,
            date: sale.date,
            total: Number(sale.total) || 0,
            items: sale.items || [],
            settled: sale.method !== "cuenta",
          }))
      : [];

    return { ok: true, bookings, cantina, note: noteSnap.val()?.text || "" };
  } catch (error) {
    return { ok: false, error: "No se pudo cargar el historial del cliente." };
  }
}

export async function adminSaveClientNote(key, text) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!CLIENT_KEY.test(key || ""))
    return { ok: false, error: "Cliente inválido." };
  const note = String(text || "")
    .trim()
    .slice(0, 1000);
  try {
    await getDb()
      .ref(`clientNotes/${key}`)
      .set(note ? { text: note, updatedAt: Date.now() } : null);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "No se pudo guardar la nota." };
  }
}

/**
 * Resumen día por día de un rango de fechas (turnos + cantina + ocupación),
 * con los cupos de cada día según Configuración.
 */
async function loadRangeSummaries(dates) {
  const config = await getClubConfig();
  const first = dates[0];
  const last = dates[dates.length - 1];
  let bookings = [];
  let sales = [];
  if (isFirebaseConfigured()) {
    const db = getDb();
    [bookings, sales] = await Promise.all([
      loadByDateRange(db, "bookings", first, last),
      loadByDateRange(db, "cantinaSales", first, last),
    ]);
  }
  return buildDailySummaries(dates, bookings, sales).map((d) => {
    const totalSlots =
      slotTimesFor(config, d.date).length * config.courts.length;
    const closed = totalSlots === 0;
    const closedReason = !closed
      ? null
      : config.blockedDates.includes(d.date)
        ? "Día bloqueado en Configuración"
        : "Cerrado por horario";
    const withSlots = { ...d, totalSlots, closed, closedReason };
    return { ...withSlots, ocupacionPct: dayOccupancy(withSlots) };
  });
}

/**
 * Resumen día por día de un mes calendario. Alimenta Calendario y
 * Reportes, así los dos muestran los mismos números.
 */
export async function adminGetMonthStats(year, month) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const y = Number(year);
  const m = Number(month); // 1-12
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) =>
    isoAddDays(first, i),
  );

  try {
    const days = (await loadRangeSummaries(dates)).map((d, i) => ({
      ...d,
      day: i + 1,
    }));
    return {
      ok: true,
      days,
      totals: sumSummaries(days),
      ocupacionPct: periodOccupancy(days, todayInClub()),
    };
  } catch (error) {
    return { ok: false, error: "No se pudo cargar el reporte del mes." };
  }
}

/** Ocupación de `count` días desde `fromIso`, para la tira de días de Agenda. */
export async function adminGetRangeStats(fromIso, count = 14) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const n = Math.min(62, Math.max(1, Number(count) || 14));
  const dates = Array.from({ length: n }, (_, i) =>
    isoAddDays(fromIso || todayInClub(), i),
  );
  try {
    return { ok: true, days: await loadRangeSummaries(dates) };
  } catch (error) {
    return {
      ok: false,
      error: "No se pudo cargar la ocupación de los próximos días.",
    };
  }
}

const MAX_REPORT_DAYS = 366;

/**
 * Reporte de un período arbitrario: totales vs. el período anterior del
 * mismo largo, serie diaria, heatmap día × hora, mix de pagos, top productos
 * y top clientes. Una sola lectura por colección.
 */
export async function adminGetReport(from, to) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!ISO_DATE.test(from || "") || !ISO_DATE.test(to || "") || from > to) {
    return { ok: false, error: "Elegí un período válido." };
  }
  const dates = datesBetween(from, to);
  if (dates.length > MAX_REPORT_DAYS) {
    return { ok: false, error: "El período puede tener hasta un año." };
  }
  const prev = previousPeriod(from, to);
  const prevDates = datesBetween(prev.from, prev.to);

  try {
    const config = await getClubConfig();
    let bookings = [];
    let sales = [];
    if (isFirebaseConfigured()) {
      const db = getDb();
      [bookings, sales] = await Promise.all([
        loadByDateRange(db, "bookings", prev.from, to),
        loadByDateRange(db, "cantinaSales", prev.from, to),
      ]);
    }
    const inRange = (list, a, b) =>
      list.filter((r) => r.date >= a && r.date <= b);
    const cur = {
      bookings: inRange(bookings, from, to),
      sales: inRange(sales, from, to),
    };
    const old = {
      bookings: inRange(bookings, prev.from, prev.to),
      sales: inRange(sales, prev.from, prev.to),
    };

    const withSlots = (list) =>
      list.map((d) => {
        const totalSlots =
          slotTimesFor(config, d.date).length * config.courts.length;
        const day = { ...d, totalSlots };
        return { ...day, ocupacionPct: dayOccupancy(day) };
      });
    const days = withSlots(buildDailySummaries(dates, cur.bookings, cur.sales));
    const prevDays = withSlots(
      buildDailySummaries(prevDates, old.bookings, old.sales),
    );
    const today = todayInClub();

    return {
      ok: true,
      from,
      to,
      previous: prev,
      days,
      totals: {
        ...sumSummaries(days),
        ocupacionPct: periodOccupancy(days, today),
      },
      previousTotals: {
        ...sumSummaries(prevDays),
        ocupacionPct: periodOccupancy(prevDays, today),
      },
      heatmap: occupancyHeatmap(
        config,
        dates.filter((d) => d <= today),
        cur.bookings,
      ),
      paymentMix: paymentMix(cur.bookings, cur.sales),
      topProducts: topProducts(cur.sales),
      topClients: topClients(cur.bookings),
    };
  } catch (error) {
    return { ok: false, error: "No se pudo armar el reporte." };
  }
}

const CANTINA_PAYMENT_METHODS = ["efectivo", "transferencia", "mercadopago"];
const TOP_PRODUCTS_DAYS = 30;

/**
 * Registra una venta de cantina. `method: "cuenta"` + `chargeTo` la carga a
 * la cuenta de un turno: no entra a la caja hasta que se cobra. Con
 * `orderId` cobra un pedido de la carta: lo pasa a cocina en la misma
 * operación, y si ya lo cobró otra pantalla no registra la venta.
 */
export async function adminAddCantinaSale({
  date,
  items,
  method,
  notes,
  chargeTo,
  orderId,
}) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!Array.isArray(items) || items.length === 0 || items.length > 60) {
    return { ok: false, error: "Agregá al menos un producto a la venta." };
  }
  const saleDate = date || todayInClub();
  if (!ISO_DATE.test(saleDate)) return { ok: false, error: "Fecha inválida." };
  if (!isFirebaseConfigured()) {
    return { ok: false, error: "Firebase no está configurado." };
  }

  const cleanItems = items
    .map((it) => ({
      name: String(it.name || "").slice(0, 80),
      price: Math.min(MAX_PAYMENT, Math.max(0, Number(it.price) || 0)),
      qty: Math.min(99, Math.max(1, Math.round(Number(it.qty) || 1))),
    }))
    .filter((it) => it.name && it.price > 0);
  const total = cleanItems.reduce((sum, it) => sum + it.price * it.qty, 0);
  if (total <= 0) {
    return { ok: false, error: "El total de la venta debe ser mayor a cero." };
  }

  try {
    const db = getDb();
    const isOnAccount = method === "cuenta";
    // A cuenta no entra a la caja del día, así que no depende del cierre.
    if (!isOnAccount) {
      const closed = await closedDayError(db, saleDate);
      if (closed) return closed;
    }
    if (isOnAccount) {
      const booking = isId(chargeTo)
        ? await readRecord(db, `bookings/${chargeTo}`)
        : null;
      if (!booking || booking.status === "cancelado") {
        return {
          ok: false,
          error: "Elegí un turno activo para cargar la cuenta.",
        };
      }
    }
    const ref = db.ref("cantinaSales").push();
    const forOrder = orderId !== undefined && orderId !== null;
    if (forOrder) {
      if (!isId(orderId)) return { ok: false, error: "Pedido inválido." };
      // Primero se reserva el pedido (solo si sigue esperando el pago) y
      // después se guarda la venta: dos pantallas no lo cobran dos veces.
      const paid = await db
        .ref(`cantinaOrders/${orderId}`)
        .transaction((order) => {
          if (order === null) return null; // ver adminVoidCantinaSale
          if (order.status !== "nuevo") return; // ya cobrado o cancelado: aborta
          const now = Date.now();
          return {
            ...order,
            status: "preparando",
            saleId: ref.key,
            paidAt: now,
            updatedAt: now,
          };
        });
      if (!paid.committed || !paid.snapshot.exists()) {
        return {
          ok: false,
          error: "Ese pedido ya se cobró o se canceló en otra pantalla.",
          orderChanged: true,
        };
      }
    }
    try {
      await ref.set({
        date: saleDate,
        items: cleanItems,
        total,
        method: isOnAccount
          ? "cuenta"
          : CANTINA_PAYMENT_METHODS.includes(method)
            ? method
            : "efectivo",
        ...(isOnAccount ? { chargeTo } : {}),
        ...(forOrder ? { orderId } : {}),
        notes: clip(notes, 200),
        createdAt: Date.now(),
      });
    } catch (error) {
      // La venta no se guardó: el pedido vuelve a esperar el pago.
      if (forOrder) {
        await db
          .ref(`cantinaOrders/${orderId}`)
          .transaction((order) =>
            order && order.saleId === ref.key
              ? { ...order, status: "nuevo", saleId: null, paidAt: null }
              : order,
          )
          .catch(() => {});
      }
      throw error;
    }
    return { ok: true, saleId: ref.key, total };
  } catch (error) {
    return { ok: false, error: "No se pudo registrar la venta." };
  }
}

export async function adminGetCantinaSales(date) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isFirebaseConfigured()) return { ok: true, sales: [] };
  if (date && !ISO_DATE.test(date))
    return { ok: false, error: "Fecha inválida." };

  try {
    const db = getDb();
    const sales = date
      ? await loadByDateRange(db, "cantinaSales", date, date)
      : snapToList(await db.ref("cantinaSales").once("value"));
    sales.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { ok: true, sales };
  } catch (error) {
    return {
      ok: false,
      error: "No se pudieron cargar las ventas de cantina.",
    };
  }
}

/**
 * Anula una venta con motivo: queda en el historial pero deja de sumar.
 * Con PIN queda a nombre del integrante; sin PIN (Deshacer inmediato) a nombre de la sesión.
 */
export async function adminVoidCantinaSale({ saleId, reason, pin } = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const why = clip(reason, 120);
  if (!isId(saleId)) return { ok: false, error: "Venta inválida." };
  if (!why) return { ok: false, error: "Indicá el motivo de la anulación." };
  try {
    const db = getDb();
    const current = await readRecord(db, `cantinaSales/${saleId}`);
    if (!current) return { ok: false, error: "Esa venta no existe." };
    const auth = await undoStaff(pin, current.createdAt);
    if (auth.error) return { ok: false, error: auth.error };
    const closed = await closedDayError(db, current.date);
    if (closed) return closed;
    // RTDB llama primero con el valor en caché (null si no hay): devolver
    // null hace que reintente con el valor real del server en vez de abortar.
    const result = await db
      .ref(`cantinaSales/${saleId}`)
      .transaction((sale) => {
        if (sale === null) return null;
        if (sale.voided) return; // ya anulada: aborta
        return {
          ...sale,
          voided: true,
          voidReason: why,
          voidedBy: auth.staff.name,
          voidedAt: Date.now(),
        };
      });
    if (!result.committed)
      return { ok: false, error: "Esa venta ya estaba anulada." };
    if (!result.snapshot.exists())
      return { ok: false, error: "Esa venta no existe." };
    await audit(
      db,
      auth.staff,
      "ANULAR_VENTA_CANTINA",
      `Venta #${saleId.slice(-6)} ($${current.total})`,
      `Motivo: ${why}`,
      { amount: Number(current.total) || 0 },
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "No se pudo anular la venta." };
  }
}

/** Elimina definitivamente una venta de cantina, requiriendo PIN de staff. */
export async function adminDeleteCantinaSale({ saleId, pin, reason } = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isId(saleId)) return { ok: false, error: "Venta inválida." };

  const auth = await authorizeStaff(pin);
  if (auth.error) return { ok: false, error: auth.error };

  try {
    const db = getDb();
    const sale = await readRecord(db, `cantinaSales/${saleId}`);
    if (!sale) return { ok: false, error: "La venta no existe." };
    const closed = await closedDayError(db, sale.date);
    if (closed) return closed;

    await db.ref(`cantinaSales/${saleId}`).remove();
    await audit(
      db,
      auth.staff,
      "ELIMINAR_PEDIDO_CANTINA",
      `Pedido #${saleId.slice(-6)} ($${sale.total})`,
      reason ? `Motivo: ${reason}` : "Pedido eliminado definitivamente",
      { amount: Number(sale.total) || 0 },
    );
    return { ok: true, staff: auth.staff.name };
  } catch (error) {
    return { ok: false, error: "No se pudo eliminar la venta." };
  }
}

/** Cobra un consumo que estaba a cuenta de un turno. */
export async function adminSettleCantinaSale(saleId, method) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isId(saleId) || !CANTINA_PAYMENT_METHODS.includes(method)) {
    return { ok: false, error: "Elegí cómo se cobró." };
  }
  try {
    const db = getDb();
    const current = await readRecord(db, `cantinaSales/${saleId}`);
    if (!current) return { ok: false, error: "Esa venta no existe." };
    const closed = await closedDayError(db, current.date);
    if (closed) return closed;
    const result = await db
      .ref(`cantinaSales/${saleId}`)
      .transaction((sale) => {
        if (sale === null) return null; // ver adminVoidCantinaSale
        if (sale.voided || sale.method !== "cuenta") return;
        return { ...sale, method, settledAt: Date.now() };
      });
    if (!result.committed || !result.snapshot.exists()) {
      return { ok: false, error: "Ese consumo ya no está a cuenta." };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "No se pudo cobrar el consumo." };
  }
}

/**
 * Pedidos que entraron por la carta (/menu → POST /api/cantina-orders) en un
 * día: los abiertos primero, del más viejo al más nuevo (así se preparan en
 * orden), y después los entregados y cancelados, del más nuevo al más viejo.
 */
export async function adminGetCantinaOrders(date) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isFirebaseConfigured()) return { ok: true, orders: [] };
  const day = date || todayInClub();
  if (!ISO_DATE.test(day)) return { ok: false, error: "Fecha inválida." };

  try {
    // El tercer tiempo cruza la medianoche: la vista de un día también trae
    // los pedidos abiertos de la víspera y del día siguiente.
    const isOpen = (o) => OPEN_ORDER_STATUSES.includes(o.status);
    const orders = (
      await loadByDateRange(
        getDb(),
        "cantinaOrders",
        isoAddDays(day, -1),
        isoAddDays(day, 1),
      )
    ).filter((o) => o.date === day || isOpen(o));
    orders.sort((a, b) =>
      isOpen(a) !== isOpen(b)
        ? isOpen(a)
          ? -1
          : 1
        : isOpen(a)
          ? (a.createdAt || 0) - (b.createdAt || 0)
          : (b.createdAt || 0) - (a.createdAt || 0),
    );
    return { ok: true, orders };
  } catch (error) {
    return { ok: false, error: "No se pudieron cargar los pedidos de la web." };
  }
}

// Qué cambios de estado valen, y desde dónde. El cobro (nuevo → preparando)
// lo hace adminAddCantinaSale junto con la venta.
const ORDER_TRANSITIONS = {
  entregado: ["preparando"], // se entrega ya pago
  preparando: ["entregado"], // "Deshacer" de Entregado
  nuevo: ["preparando"], // "Deshacer" del cobro: con el mismo saleId
  cancelado: ["nuevo", "preparando"],
};

/**
 * Cambia el estado de un pedido de la web. Si otra pantalla ya lo cambió y
 * el paso no vale (por ejemplo entregar uno cancelado), no toca nada.
 * Volver a "nuevo" (deshacer el cobro) exige el `saleId` de ese cobro.
 */
export async function adminSetCantinaOrderStatus(orderId, status, saleId) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isId(orderId) || !ORDER_TRANSITIONS[status]) {
    return { ok: false, error: "Pedido inválido." };
  }
  if (status === "nuevo" && !isId(saleId)) {
    return { ok: false, error: "Pedido inválido." };
  }
  if (!isFirebaseConfigured()) {
    return { ok: false, error: "Firebase no está configurado." };
  }
  try {
    const db = getDb();
    const result = await db
      .ref(`cantinaOrders/${orderId}`)
      .transaction((order) => {
        if (order === null) return null; // ver adminVoidCantinaSale
        if (!ORDER_TRANSITIONS[status].includes(order.status)) return; // aborta
        if (status === "nuevo" && order.saleId !== saleId) return;
        const now = Date.now();
        return {
          ...order,
          status,
          updatedAt: now,
          // Deshecho el cobro, vuelve a esperar el pago.
          ...(status === "nuevo" ? { saleId: null, paidAt: null } : {}),
        };
      });
    if (!result.snapshot.exists()) {
      return { ok: false, error: "Ese pedido ya no existe." };
    }
    if (!result.committed) {
      return {
        ok: false,
        error: "Ese pedido ya cambió en otra pantalla: actualicé la lista.",
        orderChanged: true,
      };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "No se pudo actualizar el pedido." };
  }
}

/** Productos más vendidos de los últimos días, para la fila de accesos rápidos. */
export async function adminGetTopProducts(limit = 8) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isFirebaseConfigured()) return { ok: true, products: [] };
  try {
    const to = todayInClub();
    const from = isoAddDays(to, -TOP_PRODUCTS_DAYS);
    const sales = await loadByDateRange(getDb(), "cantinaSales", from, to);
    const qtyByName = new Map();
    sales
      .filter((sale) => !sale.voided && !sale.isTest)
      .forEach((sale) =>
        (sale.items || []).forEach((it) =>
          qtyByName.set(
            it.name,
            (qtyByName.get(it.name) || 0) + (Number(it.qty) || 1),
          ),
        ),
      );
    const products = [...qtyByName.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.min(20, Number(limit) || 8))
      .map(([name, qty]) => ({ name, qty }));
    return { ok: true, products };
  } catch (error) {
    return { ok: false, error: "No se pudieron calcular los más vendidos." };
  }
}

/**
 * Torneos: el admin ya inscribe parejas a mano por WhatsApp (ver
 * TorneosGallery en la landing), esto le da un lugar donde llevar esa lista
 * con quién pagó en vez de un cuaderno o un chat.
 */
export async function adminCreateTournament({
  name,
  date,
  category,
  price,
} = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!clip(name, 80)) {
    return { ok: false, error: "Ingresá un nombre para el torneo." };
  }
  if (date && !ISO_DATE.test(date))
    return { ok: false, error: "Fecha inválida." };
  if (!isFirebaseConfigured()) {
    return { ok: false, error: "Firebase no está configurado." };
  }

  try {
    const db = getDb();
    const ref = db.ref("tournaments").push();
    await ref.set({
      name: clip(name, 80),
      date: date || "",
      category: clip(category, 40),
      price: Math.min(MAX_PAYMENT, Math.max(0, Math.round(Number(price) || 0))),
      status: "abierto",
      createdAt: Date.now(),
    });
    return { ok: true, tournamentId: ref.key };
  } catch (error) {
    return { ok: false, error: "No se pudo crear el torneo." };
  }
}

export async function adminGetTournaments() {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isFirebaseConfigured()) return { ok: true, tournaments: [] };

  try {
    const db = getDb();
    const snap = await db.ref("tournaments").get();
    const tournaments = [];
    if (snap.exists()) {
      Object.entries(snap.val()).forEach(([id, t]) => {
        const players = t.players
          ? Object.entries(t.players).map(([pid, p]) => ({ id: pid, ...p }))
          : [];
        const { players: _omit, ...rest } = t;
        tournaments.push({ id, ...rest, players });
      });
    }
    tournaments.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { ok: true, tournaments };
  } catch (error) {
    return { ok: false, error: "No se pudieron cargar los torneos." };
  }
}

const TOURNAMENT_STATUSES = ["abierto", "cerrado", "finalizado"];

export async function adminUpdateTournamentStatus(tournamentId, status) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isId(tournamentId) || !TOURNAMENT_STATUSES.includes(status)) {
    return INVALID;
  }
  try {
    await getDb().ref(`tournaments/${tournamentId}`).update({ status });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "No se pudo actualizar el torneo." };
  }
}

/** Borra el torneo con todas sus parejas: pide PIN y queda en auditoría. */
export async function adminDeleteTournament({
  tournamentId,
  pin,
  reason,
} = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isId(tournamentId)) return { ok: false, error: "Torneo inválido." };

  const auth = await authorizeStaff(pin);
  if (auth.error) return { ok: false, error: auth.error };
  try {
    const db = getDb();
    const t = await readRecord(db, `tournaments/${tournamentId}`);
    if (!t) return { ok: false, error: "El torneo no existe." };
    await db.ref(`tournaments/${tournamentId}`).remove();
    await audit(
      db,
      auth.staff,
      "ELIMINAR_TORNEO",
      `${t.name} (${Object.keys(t.players || {}).length} inscriptos)`,
      reason ? `Motivo: ${reason}` : "Torneo eliminado con sus inscriptos",
    );
    return { ok: true, staff: auth.staff.name };
  } catch (error) {
    return { ok: false, error: "No se pudo eliminar el torneo." };
  }
}

export async function adminAddTournamentPlayer(tournamentId, input) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { name, phone, partner } = input || {};
  if (!isId(tournamentId) || !clip(name, 60)) {
    return { ok: false, error: "Ingresá el nombre del jugador." };
  }
  try {
    const ref = getDb().ref(`tournaments/${tournamentId}/players`).push();
    await ref.set({
      name: clip(name, 60),
      phone: clip(phone, 30),
      partner: clip(partner, 60),
      paid: false,
      createdAt: Date.now(),
    });
    return { ok: true, playerId: ref.key };
  } catch (error) {
    return { ok: false, error: "No se pudo agregar el jugador." };
  }
}

/** Marca la inscripción como paga (con método y fecha) o la vuelve a pendiente. */
export async function adminTogglePlayerPaid(
  tournamentId,
  playerId,
  paid,
  method,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isId(tournamentId) || !isId(playerId)) return INVALID;
  try {
    await getDb()
      .ref(`tournaments/${tournamentId}/players/${playerId}`)
      .update(
        paid
          ? {
              paid: true,
              paidMethod: PAYMENT_METHODS.includes(method)
                ? method
                : "efectivo",
              paidAt: Date.now(),
            }
          : { paid: false, paidMethod: null, paidAt: null },
      );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "No se pudo actualizar el pago." };
  }
}

export async function adminRemoveTournamentPlayer(tournamentId, playerId) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isId(tournamentId) || !isId(playerId)) return INVALID;
  try {
    await getDb()
      .ref(`tournaments/${tournamentId}/players/${playerId}`)
      .remove();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "No se pudo quitar el jugador." };
  }
}

/* ==========================================================================
   CONFIGURACIÓN DINÁMICA DEL CLUB (FASE 1)
   ========================================================================== */

export async function adminGetClubConfig() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return { ok: true, config: await getClubConfig({ fresh: true }) };
}

export async function adminSaveClubConfig(input, pin) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isFirebaseConfigured()) {
    return { ok: false, error: "Firebase no está configurado." };
  }
  // Precios, % de seña y alias de pago mueven plata: solo con PIN de gestión.
  const auth = await authorizeManager(pin);
  if (auth.error) return { ok: false, error: auth.error };

  const result = validateConfig(input || {});
  if (!result.ok) {
    return {
      ok: false,
      error: "Revisá los campos marcados.",
      fieldErrors: result.errors,
    };
  }

  try {
    const config = {
      ...result.config,
      paymentAlias: result.config.paymentAlias.trim(),
      paymentTitular: result.config.paymentTitular.trim(),
      clubPhone: result.config.clubPhone.trim(),
    };
    const db = getDb();
    await db.ref("clubConfig").set({ ...config, updatedAt: Date.now() });
    setCachedClubConfig(config);
    await audit(
      db,
      auth.staff,
      "CONFIG_GUARDAR",
      "Configuración del club",
      "Se guardó la configuración (precios, horarios, seña, pagos)",
    ).catch(() => {});
    return { ok: true, config };
  } catch (err) {
    return { ok: false, error: "No se pudo guardar la configuración." };
  }
}

/* ==========================================================================
   CAJA DIARIA, EGRESOS Y ARQUEO / CIERRE Z (FASE 2)
   ========================================================================== */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EXPENSE_CATEGORIES = ["hielo", "limpieza", "mantenimiento", "otros"];

async function isCashClosed(db, date) {
  const snap = await db.ref(`dailyCashSessions/${date}/closed`).once("value");
  return snap.val() === true;
}

export async function adminAddCashExpense({
  date,
  concept,
  amount,
  notes,
  category,
}) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!ISO_DATE.test(date || ""))
    return { ok: false, error: "Fecha inválida." };
  const numericAmount = Number(amount);
  if (!concept?.trim() || !numericAmount || numericAmount <= 0) {
    return { ok: false, error: "Ingresá un concepto y un monto válido." };
  }

  if (!isFirebaseConfigured()) {
    return { ok: false, error: "Firebase no está configurado." };
  }

  try {
    const db = getDb();
    if (await isCashClosed(db, date)) {
      return { ok: false, error: "La caja de ese día ya está cerrada." };
    }
    const ref = db.ref(`cashExpenses/${date}`).push();
    await ref.set({
      concept: concept.trim(),
      category: EXPENSE_CATEGORIES.includes(category) ? category : "otros",
      amount: numericAmount,
      notes: (notes || "").trim(),
      createdAt: Date.now(),
    });
    return { ok: true, expenseId: ref.key };
  } catch (err) {
    return { ok: false, error: "No se pudo registrar el egreso." };
  }
}

/** Elimina un egreso de caja cargado por error, requiriendo PIN de staff. */
export async function adminDeleteCashExpense({
  date,
  expenseId,
  pin,
  reason,
} = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!ISO_DATE.test(date || "") || !isId(expenseId)) {
    return { ok: false, error: "Egreso inválido." };
  }

  const auth = await authorizeStaff(pin);
  if (auth.error) return { ok: false, error: auth.error };

  try {
    const db = getDb();
    const closed = await closedDayError(db, date);
    if (closed) return closed;
    const expense = await readRecord(db, `cashExpenses/${date}/${expenseId}`);
    if (!expense) return { ok: false, error: "Ese egreso ya no existe." };

    await db.ref(`cashExpenses/${date}/${expenseId}`).remove();
    await audit(
      db,
      auth.staff,
      "ELIMINAR_EGRESO_CAJA",
      `${expense.concept} ($${expense.amount}) · ${date}`,
      reason ? `Motivo: ${reason}` : "Egreso eliminado",
      { amount: Number(expense.amount) || 0 },
    );
    return { ok: true, staff: auth.staff.name };
  } catch (error) {
    return { ok: false, error: "No se pudo eliminar el egreso." };
  }
}

export async function adminGetDailyCashSummary(isoDate) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const date = isoDate || todayInClub();
  if (!ISO_DATE.test(date)) return { ok: false, error: "Fecha inválida." };
  let records = { bookings: [], sales: [], expenses: [], session: null };

  if (isFirebaseConfigured()) {
    try {
      records = await loadDayRecords(getDb(), date);
    } catch (err) {
      return { ok: false, error: "No se pudo calcular la caja del día." };
    }
  }

  const cash = computeDailyCash(records);
  const { session } = records;
  return {
    ok: true,
    summary: {
      date,
      cashTurnos: cash.turnos.efectivo,
      cashCantina: cash.cantina.efectivo,
      transferTurnos: cash.turnos.transferencia,
      transferCantina: cash.cantina.transferencia,
      mpTurnos: cash.turnos.mercadopago,
      mpCantina: cash.cantina.mercadopago,
      totalExpenses: cash.totalExpenses,
      expectedCash: cash.expectedCash,
      expensesList: records.expenses,
      closed: Boolean(session?.closed),
      closedAt: session?.closedAt ?? null,
      // `??` y no `||`: un cierre exacto ($0 de diferencia) es un dato válido.
      actualCash: session?.actualCash ?? null,
      difference: session?.difference ?? null,
      notes: session?.notes || null,
      closedBy: session?.closedBy || null,
      reopenedBy: session?.reopenedBy || null,
      reopenedAt: session?.reopenedAt ?? null,
      reopenReason: session?.reopenReason || null,
    },
  };
}

const TEST_FLAG_COLLECTIONS = ["bookings", "cantinaSales"];

/**
 * Marca o desmarca un registro como dato de prueba: sigue existiendo pero
 * no suma en ningún total. Desmarcar borra el campo en vez de guardar false.
 */
export async function adminSetTestFlag(collection, id, isTest, pin) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!TEST_FLAG_COLLECTIONS.includes(collection) || !isId(id)) return INVALID;
  // Marcar algo como "prueba" lo saca de los totales: queda a nombre de quien lo hace.
  const auth = await authorizeManager(pin);
  if (auth.error) return { ok: false, error: auth.error };
  try {
    const db = getDb();
    const record = await readRecord(db, `${collection}/${id}`);
    if (!record) return { ok: false, error: "El registro no existe." };
    const closed = await closedDayError(db, record.date);
    if (closed) return closed;
    await db.ref(`${collection}/${id}/isTest`).set(isTest ? true : null);
    await audit(
      db,
      auth.staff,
      isTest ? "MARCAR_PRUEBA" : "DESMARCAR_PRUEBA",
      `${collection}/${id.slice(-6)}`,
      isTest
        ? "Marcado como dato de prueba"
        : "Vuelve a contar como dato real",
      { amount: Number(record.total) || 0 },
    ).catch(() => {});
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "No se pudo actualizar el registro." };
  }
}

/** Cierre Z: el PIN identifica a quien contó el cajón. */
export async function adminCloseDailyCash({
  date,
  actualCash,
  notes,
  pin,
} = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!ISO_DATE.test(date || ""))
    return { ok: false, error: "Fecha inválida." };
  const actual = Number(actualCash);
  if (!Number.isFinite(actual) || actual < 0 || actual > MAX_PAYMENT * 10) {
    return { ok: false, error: "Ingresá el efectivo contado." };
  }
  if (!isFirebaseConfigured()) {
    return { ok: false, error: "Firebase no está configurado." };
  }
  const auth = await authorizeStaff(pin);
  if (auth.error) return { ok: false, error: auth.error };

  try {
    const summaryRes = await adminGetDailyCashSummary(date);
    if (!summaryRes.ok) return summaryRes;

    const expectedCash = summaryRes.summary.expectedCash;
    const difference = actual - expectedCash;
    const session = {
      closed: true,
      closedAt: Date.now(),
      closedBy: auth.staff.name,
      closedById: auth.staff.id,
      expectedCash,
      actualCash: actual,
      difference,
      notes: clip(notes, 300),
    };

    // Transacción: dos personas cerrando a la vez no pisan un cierre ya hecho.
    const db = getDb();
    const result = await db
      .ref(`dailyCashSessions/${date}`)
      .transaction((current) => (current?.closed ? undefined : session));
    if (!result.committed) {
      return {
        ok: false,
        error: "Esa caja ya se cerró. Recargá para ver el cierre.",
      };
    }
    await audit(
      db,
      auth.staff,
      "CIERRE_CAJA",
      `Caja ${date}`,
      `Contado $${actual} · esperado $${expectedCash} · diferencia $${difference}`,
      { amount: actual },
    );
    return { ok: true, difference, staff: auth.staff.name };
  } catch (err) {
    return { ok: false, error: "No se pudo cerrar la caja." };
  }
}

/** Reabre un Cierre Z para corregir un error. Motivo obligatorio y queda auditado. */
export async function adminReopenDailyCash({ date, pin, reason } = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!ISO_DATE.test(date || ""))
    return { ok: false, error: "Fecha inválida." };
  const why = clip(reason, 160);
  if (!why) return { ok: false, error: "Indicá por qué se reabre la caja." };
  const auth = await authorizeStaff(pin);
  if (auth.error) return { ok: false, error: auth.error };
  if (!MANAGER_ROLES.includes(auth.staff.role)) {
    return {
      ok: false,
      error:
        "Solo un Administrador o Encargado puede reabrir una caja cerrada.",
    };
  }

  try {
    const db = getDb();
    const ref = db.ref(`dailyCashSessions/${date}`);
    const previous = (await ref.once("value")).val();
    if (!previous?.closed) {
      return { ok: false, error: "Esa caja no está cerrada." };
    }
    await ref.set({
      closed: false,
      reopenedAt: Date.now(),
      reopenedBy: auth.staff.name,
      reopenReason: why,
      previousClose: previous,
    });
    await audit(
      db,
      auth.staff,
      "REABRIR_CAJA",
      `Caja ${date}`,
      `Motivo: ${why} · cierre anterior de ${previous.closedBy || "—"} (dif. $${previous.difference ?? 0})`,
    );
    return { ok: true, staff: auth.staff.name };
  } catch (err) {
    return { ok: false, error: "No se pudo reabrir la caja." };
  }
}

/** Últimos cierres de caja, del más nuevo al más viejo. */
export async function adminGetCashHistory(limit = 30) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isFirebaseConfigured()) return { ok: true, sessions: [] };
  try {
    const snap = await getDb()
      .ref("dailyCashSessions")
      .orderByKey()
      .limitToLast(Math.min(120, Math.max(1, Number(limit) || 30)))
      .once("value");
    const sessions = snapToList(snap)
      .filter((x) => x.closed)
      .map(({ id, ...x }) => ({ date: id, ...x }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return { ok: true, sessions };
  } catch (err) {
    return { ok: false, error: "No se pudo cargar el historial de cierres." };
  }
}

/* ==========================================================================
   REPROGRAMACIÓN Y CAMBIO RÁPIDO DE CANCHA (FASE 3)
   ========================================================================== */

/**
 * Mueve un turno a otro día/horario/cancha. El origen se lee de la base (no
 * del cliente) para no liberar por error el horario de otra reserva.
 */
export async function adminMoveBooking({
  bookingId,
  newDate,
  newCourtId,
  newStartTime,
} = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (
    !isId(bookingId) ||
    !ISO_DATE.test(newDate || "") ||
    !newCourtId ||
    !newStartTime
  ) {
    return { ok: false, error: "Faltan datos del nuevo turno." };
  }
  if (!isFirebaseConfigured()) {
    return { ok: false, error: "Firebase no está configurado." };
  }

  const config = await getClubConfig();
  const court = findCourtIn(config, newCourtId);
  if (!court) return { ok: false, error: "Cancha destino inválida." };
  if (!isValidSlotFor(config, newDate, newCourtId, newStartTime)) {
    return {
      ok: false,
      error: "Ese horario no existe en la grilla del día destino.",
    };
  }

  const db = getDb();
  const newClaimRef = db.ref(
    `slotClaims/${newDate}/${slotKey(newCourtId, newStartTime)}`,
  );
  try {
    const booking = await readRecord(db, `bookings/${bookingId}`);
    if (!booking || booking.status === "cancelado") {
      return { ok: false, error: "Ese turno no existe o está cancelado." };
    }
    const closedOrigin = await closedDayError(db, booking.date);
    if (closedOrigin) return closedOrigin;
    if (newDate !== booking.date) {
      const closedTarget = await closedDayError(db, newDate);
      if (closedTarget) return closedTarget;
    }

    const claimResult = await newClaimRef.transaction((current) =>
      current ? undefined : bookingId,
    );
    if (!claimResult.committed) {
      return {
        ok: false,
        error: "El horario y cancha de destino ya están ocupados.",
      };
    }

    try {
      await db.ref(`bookings/${bookingId}`).update({
        courtId: newCourtId,
        courtName: courtLabel(court),
        date: newDate,
        startTime: newStartTime,
        endTime: addMinutes(newStartTime, config.slotDurationMin),
        reprogrammedAt: Date.now(),
        previousSlot: `${booking.date} ${booking.startTime} · ${booking.courtName || booking.courtId}`,
      });
    } catch (err) {
      // Si no se pudo mover, el horario nuevo no puede quedar tomado.
      await newClaimRef.transaction((current) =>
        current === bookingId ? null : current,
      );
      throw err;
    }
    await releaseClaim(db, booking, bookingId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "No se pudo mover la reserva." };
  }
}

/* ==========================================================================
   EQUIPO (PINs), AUDITORÍA Y ALERTAS
   ========================================================================== */

const MANAGER_ROLES = ["Administrador", "Encargado"];

/** Valida un PIN de staff y devuelve quién es (sin datos del PIN). */
export async function adminVerifyStaffPinAction(pin) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const auth = await authorizeStaff(pin);
  if (auth.error) return { ok: false, error: auth.error };
  return { ok: true, staff: auth.staff };
}

export async function adminGetStaff() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseConfigured()) return { ok: true, staff: [], needsSetup: true };
  try {
    const members = await loadStaffMembers(getDb());
    const staff = publicStaff(members).sort(
      (a, b) =>
        Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
    );
    return { ok: true, staff, needsSetup: !staff.some((m) => m.active) };
  } catch (err) {
    return { ok: false, error: "No se pudo cargar el equipo." };
  }
}

/** true si después del cambio sigue habiendo alguien que pueda administrar el equipo. */
function keepsAManager(members, changedId, next) {
  const after = changedId
    ? members.map((m) => (m.id === changedId ? { ...m, ...next } : m))
    : [...members, next];
  return after.some(
    (m) => m.active !== false && MANAGER_ROLES.includes(m.role),
  );
}

/**
 * Alta o edición de un integrante. Con el equipo vacío, la sesión de admin
 * alcanza para crear el primero (tiene que ser Administrador); después,
 * cualquier cambio lo autoriza el PIN de un Administrador o Encargado.
 */
export async function adminSaveStaffMember({
  id,
  name,
  role,
  pin,
  authPin,
} = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseConfigured()) {
    return { ok: false, error: "Firebase no está configurado." };
  }

  const cleanName = clip(name, 40);
  const cleanPin = String(pin || "").trim();
  if (!cleanName) return { ok: false, error: "Ingresá el nombre." };
  if (id && !isId(id)) return INVALID;
  if (!STAFF_ROLES.includes(role)) return { ok: false, error: "Elegí un rol." };
  if ((!id || cleanPin) && !STAFF_PIN.test(cleanPin)) {
    return { ok: false, error: "El PIN tiene que tener de 4 a 6 números." };
  }

  try {
    const db = getDb();
    const members = await loadStaffMembers(db);
    const hasTeam = members.some((m) => m.active !== false);
    let actor = SESSION_STAFF;
    if (hasTeam) {
      const auth = await authorizeStaff(authPin);
      if (auth.error) return { ok: false, error: auth.error };
      if (!MANAGER_ROLES.includes(auth.staff.role)) {
        return {
          ok: false,
          error: "Solo un Administrador o Encargado puede modificar el equipo.",
        };
      }
      actor = auth.staff;
    } else if (role !== "Administrador") {
      return {
        ok: false,
        error: "El primer integrante tiene que ser Administrador.",
      };
    }

    const existing = id ? members.find((m) => m.id === id) : null;
    if (id && !existing)
      return { ok: false, error: "Ese integrante no existe." };
    if (cleanPin && isPinTaken(cleanPin, members, id || null)) {
      return {
        ok: false,
        error: "Ese PIN ya lo usa otra persona. Elegí otro.",
      };
    }

    const record = cleanPin
      ? makeStaffRecord({ name: cleanName, role, pin: cleanPin })
      : { name: cleanName, role };
    if (!keepsAManager(members, id || null, { ...record, active: true })) {
      return {
        ok: false,
        error: "Tiene que quedar al menos un Administrador o Encargado activo.",
      };
    }

    let memberId = id;
    if (existing) {
      await db
        .ref(`staffMembers/${id}`)
        .update({ ...record, updatedAt: Date.now() });
    } else {
      const ref = db.ref("staffMembers").push();
      memberId = ref.key;
      await ref.set({ ...record, active: true, createdAt: Date.now() });
    }
    await audit(
      db,
      actor,
      existing ? "EQUIPO_EDITAR" : "EQUIPO_ALTA",
      `${record.name} (${record.role})`,
      existing
        ? cleanPin
          ? "Datos y PIN actualizados"
          : "Datos actualizados"
        : "Nuevo integrante con PIN",
    );
    return { ok: true, id: memberId };
  } catch (err) {
    return { ok: false, error: "No se pudo guardar el integrante." };
  }
}

/** Da de baja (o reactiva) a un integrante: su PIN deja de valer pero el historial queda. */
export async function adminSetStaffActive({ id, active, authPin } = {}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isId(id)) return INVALID;

  const auth = await authorizeStaff(authPin);
  if (auth.error) return { ok: false, error: auth.error };
  if (!MANAGER_ROLES.includes(auth.staff.role)) {
    return {
      ok: false,
      error: "Solo un Administrador o Encargado puede modificar el equipo.",
    };
  }
  try {
    const db = getDb();
    const members = await loadStaffMembers(db);
    const member = members.find((m) => m.id === id);
    if (!member) return { ok: false, error: "Ese integrante no existe." };
    if (!active && !keepsAManager(members, id, { active: false })) {
      return {
        ok: false,
        error: "Tiene que quedar al menos un Administrador o Encargado activo.",
      };
    }
    await db.ref(`staffMembers/${id}/active`).set(Boolean(active));
    await audit(
      db,
      auth.staff,
      active ? "EQUIPO_REACTIVAR" : "EQUIPO_BAJA",
      `${member.name} (${member.role})`,
      active ? "PIN reactivado" : "PIN dado de baja",
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "No se pudo actualizar el integrante." };
  }
}

/** Registro de acciones del equipo, del más nuevo al más viejo. */
export async function adminGetAuditLog(limit = 100) {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isFirebaseConfigured()) return { ok: true, logs: [] };

  try {
    const snap = await getDb()
      .ref("auditLog")
      .orderByChild("timestamp")
      .limitToLast(Math.min(500, Math.max(1, Number(limit) || 100)))
      .once("value");
    const logs = snapToList(snap).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
    );
    return { ok: true, logs };
  } catch (error) {
    return { ok: false, error: "No se pudo cargar el registro de auditoría." };
  }
}

const OPEN_ACCOUNT_DAYS = 14;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const ars = (n) => `$${Math.round(n).toLocaleString("es-AR")}`;

/**
 * Alertas operativas reales para la campana del header: lo que el personal
 * tiene que resolver hoy. Cada una dice a qué vista llevar.
 * @returns {Promise<{ ok: true, alerts: Array<{id:string,tone:"danger"|"warning"|"info",title:string,detail:string,view:string}> }>}
 */
export async function adminGetAlerts() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseConfigured()) return { ok: true, alerts: [] };

  try {
    const db = getDb();
    const { isoDate: today, hhmm } = nowInClubTimezone();
    const yesterday = isoAddDays(today, -1);
    const [day, prev, recentSales, members, webOrders] = await Promise.all([
      loadDayRecords(db, today),
      loadDayRecords(db, yesterday),
      loadByDateRange(
        db,
        "cantinaSales",
        isoAddDays(today, -OPEN_ACCOUNT_DAYS),
        today,
      ),
      loadStaffMembers(db),
      loadByDateRange(db, "cantinaOrders", yesterday, today),
    ]);
    const alerts = [];

    const newOrders = webOrders.filter((o) => o.status === "nuevo");
    if (newOrders.length) {
      alerts.push({
        id: "web-orders",
        count: newOrders.length,
        tone: "warning",
        title: `${plural(newOrders.length, "pedido")} de la carta esperando pago`,
        detail: `Se cobran antes de pasar a la cocina: ${ars(newOrders.reduce((s, o) => s + (o.total || 0), 0))} en total.`,
        view: "cantina",
      });
    }

    if (!members.some((m) => m.active !== false)) {
      alerts.push({
        id: "staff-setup",
        tone: "danger",
        title: "Falta configurar el equipo",
        detail: "Sin PINs no se puede cancelar, borrar ni cerrar caja.",
        view: "configuracion",
      });
    }

    const prevCash = computeDailyCash(prev);
    if (
      (prevCash.cobrado > 0 || prevCash.totalExpenses > 0) &&
      !prev.session?.closed
    ) {
      alerts.push({
        id: "yesterday-open",
        tone: "danger",
        title: "La caja de ayer no se cerró",
        detail: `Hubo movimientos el ${yesterday} y falta el Cierre Z.`,
        view: "caja",
      });
    }

    const overdue = day.bookings.filter(
      (b) =>
        isCountableBooking(b) && b.startTime <= hhmm && pendingAmount(b) > 0,
    );
    if (overdue.length) {
      alerts.push({
        id: "overdue",
        tone: "warning",
        title: `${plural(overdue.length, "turno")} en juego o terminado con saldo`,
        detail: `Falta cobrar ${ars(overdue.reduce((s, b) => s + pendingAmount(b), 0))}`,
        view: "agenda",
      });
    }

    const { pagadosSinCobro } = summarizeRecords(day);
    if (pagadosSinCobro) {
      alerts.push({
        id: "paid-no-payment",
        tone: "warning",
        title: `${plural(pagadosSinCobro, "turno")} "pagado" sin cobro cargado`,
        detail: "No aparecen en caja hasta que se registre el cobro.",
        view: "agenda",
      });
    }

    const open = onAccountTotal(recentSales);
    if (open > 0) {
      alerts.push({
        id: "on-account",
        tone: "info",
        title: "Consumos de cantina a cuenta",
        detail: `${ars(open)} sin cobrar en los últimos ${OPEN_ACCOUNT_DAYS} días`,
        view: "cantina",
      });
    }

    return { ok: true, alerts };
  } catch (error) {
    return { ok: false, error: "No se pudieron calcular las alertas." };
  }
}
