"use server";

import { getDb, isFirebaseConfigured } from "../lib/firebase";
import { addMinutes, nowInClubTimezone, slotKey } from "../lib/booking";
import {
  findCourtIn,
  hasSlotStarted,
  isValidSlotFor,
  priceFor,
} from "../lib/clubConfig";
import { getClubConfig } from "../lib/clubConfigServer";
import { checkPublicRateLimit } from "../lib/adminRateLimit";
import { RATE_LIMIT_ERROR } from "../lib/rateLimit";

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
  const name = (playerName || "").trim();
  const phone = (playerPhone || "").trim();
  if (name.length < 2) return { ok: false, error: "Ingresá tu nombre." };
  if (phone.length < 6)
    return { ok: false, error: "Ingresá un teléfono de contacto." };
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

  let bookingKey;
  try {
    const db = getDb();
    const claimRef = db.ref(
      `slotClaims/${date}/${slotKey(courtId, startTime)}`,
    );
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
