"use client";

import { useEffect, useState } from "react";
import { COURTS, nowInClubTimezone, nextDays } from "./booking";

// Turnos libres para el hero y la tarjeta "Turnos libres": los de hoy y los
// del próximo día con lugar (o los de la semana, si hoy está completo). Lo
// usan dos componentes a la vez, así que el pedido se comparte (uno solo por
// vez) y se repite cada minuto para que un turno que se libera aparezca sin
// recargar.

const REFRESH_MS = 60_000;
const WEEK_DAYS = 7;
const UPCOMING_MAX = 8;
const NEXT_DAY_MAX = 4;

let cache = null; // { at, data }
let inflight = null;
const listeners = new Set();

async function fetchDay(iso) {
  const res = await fetch(`/api/availability?date=${iso}`);
  if (!res.ok) throw new Error("Error fetching slots");
  const data = await res.json();
  // La API los manda agrupados por cancha: se ordenan por horario, que es
  // como se busca un turno.
  const slots = (data.slots || [])
    .filter((s) => s.available && !s.past)
    .sort((a, b) => a.start.localeCompare(b.start) || a.courtId.localeCompare(b.courtId));
  return { courts: data.courts?.length ? data.courts : null, slots };
}

async function load() {
  const now = nowInClubTimezone();
  const days = nextDays(WEEK_DAYS + 1, now.isoDate);
  // Después de las 22:30 el día ya no da para jugar: se arranca por mañana.
  const start = now.hhmm >= "22:30" && days[1] ? 1 : 0;
  const first = days[start];
  const label = start === 0 ? "Hoy" : `Mañana (${first.dayName})`;

  const todayRes = await fetchDay(first.iso);
  let courts = todayRes.courts || COURTS;

  // Después de los de hoy se recomiendan los del próximo día con turnos
  // libres (mañana o, si mañana no hay, el que sigue). Si hoy está completo,
  // se sigue buscando en la semana hasta juntar UPCOMING_MAX.
  // Con turnos hoy, del día siguiente alcanza con los primeros
  // NEXT_DAY_MAX: es una sugerencia, la grilla tiene el resto.
  const max = todayRes.slots.length > 0 ? NEXT_DAY_MAX : UPCOMING_MAX;
  const upcoming = [];
  for (const day of days.slice(start + 1)) {
    if (day.closed) continue;
    const res = await fetchDay(day.iso);
    if (res.courts) courts = res.courts;
    const dayLabel = day.iso === days[1].iso ? "Mañana" : `${day.dayName} ${day.dayNumber}`;
    for (const slot of res.slots) {
      upcoming.push({ ...slot, date: day.iso, dayName: day.dayName, dayNumber: day.dayNumber, dayLabel });
      if (upcoming.length >= max) break;
    }
    if (upcoming.length >= max) break;
    if (todayRes.slots.length > 0 && res.slots.length > 0) break;
  }

  return { date: first.iso, label, today: todayRes.slots, upcoming, courts };
}

function refresh() {
  if (!inflight) {
    inflight = load()
      .then((data) => {
        cache = { at: Date.now(), data, error: false };
      })
      .catch((err) => {
        console.error("Error loading free slots", err);
        cache = { at: Date.now(), data: cache?.data || null, error: true };
      })
      .finally(() => {
        inflight = null;
        listeners.forEach((fn) => fn(cache));
      });
  }
  return inflight;
}

/**
 * @returns {{ status: "loading" | "ready" | "error", date: string, label: string,
 *   today: object[], upcoming: object[], courts: object[] }}
 */
export function useFreeSlots() {
  const [state, setState] = useState(cache);

  useEffect(() => {
    listeners.add(setState);
    // Con dos componentes hay dos intervalos: el que llega con el dato fresco
    // no vuelve a pedir.
    const stale = () => !cache || Date.now() - cache.at > REFRESH_MS - 5_000;
    if (stale()) refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && stale()) refresh();
    }, REFRESH_MS);
    return () => {
      listeners.delete(setState);
      clearInterval(id);
    };
  }, []);

  const data = state?.data;
  if (!data) {
    return {
      status: state?.error ? "error" : "loading",
      date: "",
      label: "Hoy",
      today: [],
      upcoming: [],
      courts: COURTS,
    };
  }
  return { status: "ready", ...data };
}
