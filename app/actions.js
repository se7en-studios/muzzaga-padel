"use server";

import { getDb, isFirebaseConfigured } from "../lib/firebase";
import {
  addMinutes,
  isValidIsoDate,
  isoAddDays,
  nowInClubTimezone,
  slotKey,
} from "../lib/booking";
import {
  findCourtIn,
  hasSlotStarted,
  isValidSlotFor,
  priceFor,
} from "../lib/clubConfig";
import { getClubConfig } from "../lib/clubConfigServer";
import { checkPublicRateLimit } from "../lib/adminRateLimit";
import { RATE_LIMIT_ERROR } from "../lib/rateLimit";

// Cuánto a futuro se puede reservar desde la web pública, y largos máximos
// de los datos de contacto (sin tope se podía ensuciar la base).
const MAX_BOOKING_DAYS_AHEAD = 60;
const MAX_NAME_LENGTH = 60;
const MAX_PHONE_LENGTH = 25;

/**
 * @param {{date: string, courtId: string, startTime: string, endTime: string, playerName: string, playerPhone: string, playersCount: number, fullCourt: boolean}} input
 * @returns {Promise<{ok: true, bookingCode: string, booking: object} | {ok: false, error: string}>}
 */
export async function createBooking(input) {
  const {
    date,
    courtId,
    startTime,
    playerName,
    playerPhone,
    playersCount,
    fullCourt,
  } = input;

  // La fecha es parte de la clave del candado en la base: tiene que ser una
  // fecha real, si no "2026-10-14-x" esquivaba la unicidad del turno.
  if (!isValidIsoDate(date)) return { ok: false, error: "Fecha inválida." };
  if (typeof courtId !== "string" || typeof startTime !== "string") {
    return { ok: false, error: "Datos inválidos." };
  }

  // Canchas, horarios y precios salen de Configuración del admin.
  const config = await getClubConfig();
  const court = findCourtIn(config, courtId);
  if (!court) return { ok: false, error: "Cancha inválida." };
  if (!isValidSlotFor(config, date, courtId, startTime)) {
    return {
      ok: false,
      error: "Ese horario no existe o el club está cerrado ese día.",
    };
  }
  // Chequeo del lado del servidor, no solo confiar en que la UI ya haya
  // ocultado el slot: usa el horario del club (America/Argentina/Buenos_Aires),
  // no la medianoche del servidor (Vercel corre en UTC).
  const now = nowInClubTimezone();
  if (hasSlotStarted(config, date, startTime, now)) {
    return {
      ok: false,
      error: "Ese horario ya pasó. Elegí un turno futuro.",
    };
  }
  if (date > isoAddDays(now.isoDate, MAX_BOOKING_DAYS_AHEAD)) {
    return {
      ok: false,
      error: `Solo se puede reservar hasta ${MAX_BOOKING_DAYS_AHEAD} días adelante.`,
    };
  }
  const name = String(playerName || "").trim();
  const phone = String(playerPhone || "").trim();
  if (name.length < 2 || name.length > MAX_NAME_LENGTH)
    return { ok: false, error: "Ingresá tu nombre (hasta 60 letras)." };
  if (phone.length < 6 || phone.length > MAX_PHONE_LENGTH)
    return { ok: false, error: "Ingresá un teléfono de contacto válido." };
  const players = Number(playersCount) || 1;
  if (players < 1 || players > 4)
    return { ok: false, error: "La cancha admite entre 1 y 4 jugadores." };

  const courtName = court.type ? `${court.name} (${court.type})` : court.name;
  // El fin y el precio los decide el server, no lo que mande el navegador.
  const endTime = addMinutes(startTime, config.slotDurationMin);
  const slotPricing = priceFor(config, date, startTime);
  const total = fullCourt
    ? slotPricing.total
    : slotPricing.perPlayer * players;

  // Sin esto, un corte de Firebase (env vars mal puestas, cuota, red) generaba
  // un código de reserva falso: el cliente veía "¡Turno reservado!" pero nunca
  // se guardaba nada, así que el horario seguía apareciendo libre para el
  // próximo visitante y el club no tenía registro de la seña. Si no podemos
  // confirmar el lock en la base, avisamos en vez de fingir éxito: el turno
  // sigue pudiéndose coordinar a mano por WhatsApp, pero el usuario y el club
  // saben que hace falta ese paso manual.
  if (!isFirebaseConfigured()) {
    console.error(
      "createBooking: Firebase no está configurado (faltan FIREBASE_* en el entorno). No se puede garantizar que el horario siga libre.",
    );
    return {
      ok: false,
      error:
        "No pudimos confirmar la disponibilidad en este momento. Escribinos por WhatsApp para coordinar el turno a mano.",
    };
  }

  // Después de validar: un formulario mal cargado no gasta cupo.
  const gate = await checkPublicRateLimit("createBooking");
  if (!gate.allowed) return { ok: false, error: RATE_LIMIT_ERROR };
  // Topes diarios por IP y por teléfono: evitan bloquear la grilla de a poco.
  const daily = await checkPublicRateLimit("createBookingDaily");
  if (!daily.allowed) return { ok: false, error: RATE_LIMIT_ERROR };
  const byPhone = await checkPublicRateLimit(
    "createBookingPhone",
    phone.replace(/\D/g, "") || phone,
  );
  if (!byPhone.allowed) return { ok: false, error: RATE_LIMIT_ERROR };

  let bookingKey;
  let claimRef;
  let claimed = false;
  try {
    const db = getDb();
    claimRef = db.ref(`slotClaims/${date}/${slotKey(courtId, startTime)}`);
    const bookingRef = db.ref("bookings").push();

    const claim = await claimRef.transaction((current) => {
      if (current) return; // ya reservado: aborta la transacción
      return bookingRef.key;
    });

    if (!claim.committed) {
      return {
        ok: false,
        error: "Ese horario se acaba de ocupar. Elegí otro.",
      };
    }

    claimed = true;
    const code = `MUZZ-${bookingRef.key.slice(-5).toUpperCase()}`;

    const bookingData = {
      bookingCode: code,
      courtId,
      courtName,
      date,
      startTime,
      endTime,
      playerName: name,
      playerPhone: phone,
      playersCount: players,
      fullCourt: Boolean(fullCourt),
      total,
      priceBand: slotPricing.band,
      status: "confirmado",
      paymentStatus: "pending",
      createdAt: Date.now(),
    };

    await bookingRef.set(bookingData);
    bookingKey = bookingRef.key;
  } catch (error) {
    console.error(
      "createBooking: fallo al guardar la reserva en Firebase:",
      error.message,
    );
    // Si el lock ya era nuestro y la reserva no se guardó, lo soltamos para
    // que el horario no quede bloqueado sin dueño.
    if (claimed && claimRef) {
      await claimRef.remove().catch(() => {});
    }
    return {
      ok: false,
      error:
        "No pudimos guardar tu turno en el sistema. Escribinos por WhatsApp para coordinarlo a mano antes de que se lo lleve otro grupo.",
    };
  }

  const bookingCode = `MUZZ-${bookingKey.slice(-5).toUpperCase()}`;

  // The WhatsApp message is built client-side in BookingCalendar, not here:
  // this action only returns plain data.
  return {
    ok: true,
    bookingCode,
    booking: {
      courtName,
      date,
      startTime,
      endTime,
      players,
      fullCourt: Boolean(fullCourt),
      total,
      name,
      phone,
    },
  };
}
