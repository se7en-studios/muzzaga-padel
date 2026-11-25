// Turnos libres por día a partir de slotClaims. Lo usan la tira de días de
// la reserva (/api/availability/summary) y la Agenda del admin, así los dos
// cuentan igual: días cerrados o bloqueados no tienen cupos, y los turnos que
// ya arrancaron no cuentan como libres (ni como cupo).

import { isoAddDays, slotKey } from "./booking.js";
import { hasSlotStarted, slotTimesFor } from "./clubConfig.js";

/**
 * Cuenta los turnos libres de `count` días desde `from`.
 * @param {object} params
 * @param {object} params.config config del club ya normalizada
 * @param {object} params.claims slotClaims del rango: { fecha: { "cancha_hh:mm": id } }
 * @param {string} params.from fecha ISO del primer día
 * @param {number} params.count cantidad de días
 * @param {{ isoDate: string, hhmm: string }} params.now hora actual en Catriel
 * @returns {Record<string, { free: number, total: number, closed: boolean,
 *   freeStarts: { start: string, free: number }[] }>}
 *   `freeStarts`: los horarios con al menos una cancha libre, en orden de la
 *   grilla (sirve para armar la promo de WhatsApp).
 */
export function countFreeSlots({ config, claims, from, count, now }) {
  const days = {};
  const courts = config?.courts || [];
  for (let i = 0; i < count; i += 1) {
    const date = isoAddDays(from, i);
    const times = slotTimesFor(config, date);
    if (times.length === 0 || courts.length === 0) {
      days[date] = { free: 0, total: 0, closed: true, freeStarts: [] };
      continue;
    }
    const taken = claims?.[date] || {};
    let free = 0;
    let total = 0;
    const freeStarts = [];
    for (const { start } of times) {
      if (hasSlotStarted(config, date, start, now)) continue;
      let freeHere = 0;
      for (const court of courts) {
        total += 1;
        if (!taken[slotKey(court.id, start)]) freeHere += 1;
      }
      free += freeHere;
      if (freeHere > 0) freeStarts.push({ start, free: freeHere });
    }
    days[date] = { free, total, closed: false, freeStarts };
  }
  return days;
}

/**
 * Qué tan lleno está un día, para pintar la barrita.
 * "closed" (no abre), "done" (ya no quedan turnos por jugar), "full" (lleno),
 * "high" (75 % o más), "mid" (40 % o más), "low" (algo reservado), "empty".
 */
export function freeSlotsTone(day) {
  if (!day || day.closed) return "closed";
  if (day.total === 0) return "done";
  if (day.free === 0) return "full";
  const pct = ((day.total - day.free) / day.total) * 100;
  if (pct >= 75) return "high";
  if (pct >= 40) return "mid";
  if (pct > 0) return "low";
  return "empty";
}

/** Porcentaje ocupado (0-100) de lo que queda por jugar; null sin cupos. */
export function freeSlotsPct(day) {
  if (!day || day.closed || day.total === 0) return null;
  return Math.round(((day.total - day.free) / day.total) * 100);
}

/** "8 libres", "1 libre", "Lleno", "Cerrado" o "Terminó". */
export function freeSlotsLabel(day) {
  if (!day || day.closed) return "Cerrado";
  if (day.total === 0) return "Terminó";
  if (day.free === 0) return "Lleno";
  return `${day.free} ${day.free === 1 ? "libre" : "libres"}`;
}

/**
 * Resumen de un tramo de días (por ejemplo, los próximos 7) para el panel de
 * la Agenda: libres en total, el día más lleno y el más vacío (el que
 * conviene promocionar). Solo cuentan los días con turnos por jugar.
 * @param {Record<string, { free: number, total: number, closed: boolean }>} days
 * @param {string[]} dates las fechas del tramo, en orden
 * @param {{ promoMinFree?: number }} [opts] desde cuántos libres un día entra
 *   en la promo (por defecto, 4: una tarde con lugar en más de una cancha)
 */
export function freeSlotsOutlook(days, dates, { promoMinFree = 4 } = {}) {
  let free = 0;
  let total = 0;
  let busiest = null;
  let emptiest = null;
  const open = [];
  for (const date of dates) {
    const d = days?.[date];
    if (!d || d.closed || d.total === 0) continue;
    free += d.free;
    total += d.total;
    const pct = (d.total - d.free) / d.total;
    const entry = { date, free: d.free, total: d.total, pct: Math.round(pct * 100) };
    open.push(entry);
    // Ante empate gana el primero: el más cercano es el que más apura.
    if (!busiest || entry.pct > busiest.pct) busiest = entry;
    if (!emptiest || entry.free > emptiest.free) emptiest = entry;
  }
  // Sin nada libre no hay día "vacío" que mostrar; sin nada reservado, no
  // hay día "lleno". Y si caen el mismo día, no aporta marcar los dos.
  if (emptiest && emptiest.free === 0) emptiest = null;
  if (busiest && busiest.pct === 0) busiest = null;
  if (busiest && emptiest && busiest.date === emptiest.date) busiest = null;
  const promoDates = open
    .filter((d) => d.free >= promoMinFree)
    .map((d) => d.date);
  return {
    free,
    total,
    pct: total > 0 ? Math.round(((total - free) / total) * 100) : null,
    openDays: open.length,
    busiest,
    emptiest,
    promoDates,
  };
}
