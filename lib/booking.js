// Reglas de negocio del turnero. Compartido por el route handler de
// disponibilidad y por el server action de reserva para que nunca se
// desincronicen los horarios que se muestran de los que se pueden reservar.

export const COURTS = [
  { id: "cancha-1", name: "Cancha 1", type: "Cristal" },
  { id: "cancha-2", name: "Cancha 2", type: "Cristal" },
];

import {
  PRECIO_TURNO,
  PRECIO_POR_JUGADOR,
  DURACION_MIN,
  priceForSlot,
} from "../data/pricing.js";

export const PRICE_PER_PLAYER = PRECIO_POR_JUGADOR;
export const PRICE_FULL = PRECIO_TURNO;
export const SLOT_DURATION_MIN = DURACION_MIN;
export { priceForSlot };

// Lunes a Sábado, 14:00 a ~00:30. Domingo el club está cerrado.
const DAILY_START_TIMES = [
  "14:00",
  "15:30",
  "17:00",
  "18:30",
  "20:00",
  "21:30",
  "23:00",
];

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/** @param {string} time "HH:MM" @param {number} minutes @returns {string} "HH:MM" */
export function addMinutes(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

/** @param {Date} date @returns {string} "YYYY-MM-DD" in local time */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const CLUB_TIMEZONE = "America/Argentina/Buenos_Aires";

/**
 * Fecha y hora actuales en el huso horario del club, sin importar en qué
 * huso corre el servidor (Vercel corre en UTC: `new Date()` + toISODate
 * podía marcar "mañana" desde las 21hs de Argentina en adelante, y eso es
 * justo la ventana en la que se decide qué turnos ya pasaron). Usa
 * formatToParts en vez de parsear el string localizado, así no depende del
 * formato que devuelva el locale.
 * @returns {{ isoDate: string, hhmm: string }}
 */
export function nowInClubTimezone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLUB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    isoDate: `${get("year")}-${get("month")}-${get("day")}`,
    hhmm: `${get("hour")}:${get("minute")}`,
  };
}

/** "Hoy" en Catriel, no en el huso del server ni del navegador. */
export function todayInClub() {
  return nowInClubTimezone().isoDate;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * true solo para una fecha real "YYYY-MM-DD" (rechaza "2026-10-14-x" y
 * "2026-02-31"). Todo lo que viene del navegador pasa por acá antes de
 * usarse como clave en la base.
 */
export function isValidIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
}

// Aritmética sobre "YYYY-MM-DD" en UTC puro: el resultado no depende del
// huso horario de quien lo ejecute (Vercel en UTC, navegador en ART).
function isoToUTC(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** @param {string} isoDate @param {number} days @returns {string} */
export function isoAddDays(isoDate, days) {
  const d = isoToUTC(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado */
export function isoWeekday(isoDate) {
  return isoToUTC(isoDate).getUTCDay();
}

export function isClosedDay(isoDate) {
  return isoWeekday(isoDate) === 0; // domingo
}

/** @returns {{start: string, end: string}[]} horarios del día, vacío si el club está cerrado */
export function getSlotTimesForDate(isoDate) {
  if (isClosedDay(isoDate)) return [];
  return DAILY_START_TIMES.map((start) => ({
    start,
    end: addMinutes(start, SLOT_DURATION_MIN),
  }));
}

/** Próximos `count` días (incluye hoy en Catriel) para el selector de fechas. */
export function nextDays(count = 7, fromIso = todayInClub()) {
  const days = [];
  for (let i = 0; i < count; i += 1) {
    const iso = isoAddDays(fromIso, i);
    const weekday = isoWeekday(iso);
    const dayNumber = Number(iso.slice(8, 10));
    const monthName = MONTH_NAMES[Number(iso.slice(5, 7)) - 1];
    days.push({
      iso,
      dayName: i === 0 ? "Hoy" : DAY_NAMES[weekday],
      dayNumber,
      monthName,
      fullLabel: `${DAY_NAMES[weekday]} ${dayNumber} de ${monthName}`,
      closed: isClosedDay(iso),
      isWeekend: weekday === 0 || weekday === 6,
    });
  }
  return days;
}

/** Clave determinística usada como lock de unicidad en Realtime Database. */
export function slotKey(courtId, startTime) {
  return `${courtId}_${startTime.replace(":", "")}`;
}

export function findCourt(courtId) {
  return COURTS.find((c) => c.id === courtId) || null;
}

export function isValidSlot(isoDate, courtId, startTime) {
  if (!findCourt(courtId)) return false;
  return getSlotTimesForDate(isoDate).some((slot) => slot.start === startTime);
}
