import { NextResponse } from "next/server";
import { getDb, isFirebaseConfigured } from "../../../../lib/firebase";
import { isoAddDays, nowInClubTimezone } from "../../../../lib/booking";
import { getClubConfig } from "../../../../lib/clubConfigServer";
import { countFreeSlots } from "../../../../lib/freeSlots";

const MAX_DAYS = 14;

/**
 * GET /api/availability/summary?from=YYYY-MM-DD&days=N
 * Cuántos turnos libres tiene cada día (para la tira de días de la reserva).
 * Una sola lectura de slotClaims para todo el rango, no una por día.
 * Responde { days: { "YYYY-MM-DD": { free, total, closed } } }.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const now = nowInClubTimezone();
  const from = searchParams.get("from") || now.isoDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const count = Math.min(MAX_DAYS, Math.max(1, Number(searchParams.get("days")) || 7));
  const to = isoAddDays(from, count - 1);

  const config = await getClubConfig();

  let claims = {};
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDb()
        .ref("slotClaims")
        .orderByKey()
        .startAt(from)
        .endAt(to)
        .get();
      if (snap.exists()) claims = snap.val() || {};
    } catch (error) {
      console.warn("Aviso: no se pudo leer la disponibilidad del rango:", error.message);
    }
  }

  // El conteo es el mismo que usa la Agenda del admin (lib/freeSlots.js).
  // Al público le alcanza con los números, sin los horarios.
  const counted = countFreeSlots({ config, claims, from, count, now });
  const days = {};
  for (const [date, { free, total, closed }] of Object.entries(counted)) {
    days[date] = { free, total, closed };
  }

  return NextResponse.json({ from, days });
}
