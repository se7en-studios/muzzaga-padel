import { NextResponse } from "next/server";
import { getDb, isFirebaseConfigured } from "../../../../lib/firebase";
import { nowInClubTimezone, slotKey } from "../../../../lib/booking";
import { hasSlotStarted, slotTimesFor } from "../../../../lib/clubConfig";
import { getClubConfig } from "../../../../lib/clubConfigServer";

const MAX_DAYS = 14;

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

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
  const to = addDays(from, count - 1);

  const config = await getClubConfig();
  const { courts } = config;

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

  const days = {};
  for (let i = 0; i < count; i += 1) {
    const date = addDays(from, i);
    const times = slotTimesFor(config, date);
    if (times.length === 0) {
      days[date] = { free: 0, total: 0, closed: true };
      continue;
    }
    const taken = claims[date] || {};
    let free = 0;
    let total = 0;
    for (const court of courts) {
      for (const { start } of times) {
        if (hasSlotStarted(config, date, start, now)) continue;
        total += 1;
        if (!taken[slotKey(court.id, start)]) free += 1;
      }
    }
    days[date] = { free, total, closed: false };
  }

  return NextResponse.json({ from, days });
}
