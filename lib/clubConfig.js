// Configuración del club (canchas, horarios, precios, seña) como datos.
// Puro e isomórfico: lo usan el server (disponibilidad, reservas, admin) y
// el cliente (admin, turnero) con el config que vino del server. Los valores
// por defecto son exactamente los que estaban hardcodeados antes, así un
// clubConfig vacío en la base se comporta igual que siempre.

import { addMinutes, isValidIsoDate, isoWeekday } from "./booking.js";

export const MAX_COURTS = 6;
const PLAYERS_PER_COURT = 4;
const DAY_MIN = 24 * 60;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const OPEN_DAY = { open: true, start: "14:00", end: "00:30" };

export const DEFAULT_CONFIG = Object.freeze({
  courts: [
    { id: "cancha-1", name: "Cancha 1", type: "Cristal" },
    { id: "cancha-2", name: "Cancha 2", type: "Cristal" },
  ],
  slotDurationMin: 90,
  // 0 = domingo … 6 = sábado
  schedule: [
    { open: false, start: "14:00", end: "00:30" },
    OPEN_DAY,
    OPEN_DAY,
    OPEN_DAY,
    OPEN_DAY,
    OPEN_DAY,
    OPEN_DAY,
  ],
  pricing: {
    valle: { court: 60000, perPlayer: null }, // null = cancha ÷ 4
    pico: { court: 60000, perPlayer: null },
    picoEnabled: false,
    picoDesde: "18:30",
  },
  depositPct: 25,
  paymentAlias: "muzzaga.padel.mp",
  paymentCbu: "",
  paymentTitular: "Muzzaga Pádel",
  clubPhone: "5492995974176",
  blockedDates: [],
});

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const positiveInt = (v, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** RTDB guarda listas con claves 0..n como arrays, a veces como objetos. */
const asList = (v) =>
  Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : null;

/**
 * Mezcla lo guardado con los defaults. Tolera el formato viejo
 * (fullCourtPrice / perPlayerPrice planos) y datos incompletos.
 */
export function normalizeConfig(raw = {}) {
  const d = DEFAULT_CONFIG;
  const courts = (asList(raw.courts) || d.courts)
    .filter((c) => c && c.id)
    .slice(0, MAX_COURTS)
    .map((c) => ({
      id: String(c.id),
      name: String(c.name || c.id),
      type: String(c.type || ""),
    }));

  // Se accede por índice de día: sirve igual si RTDB lo devuelve como array u objeto.
  const savedSchedule = raw.schedule && typeof raw.schedule === "object" ? raw.schedule : null;
  const schedule = d.schedule.map((def, i) => {
    const s = savedSchedule?.[i];
    if (!s) return { ...def };
    return {
      open: Boolean(s.open),
      start: HHMM.test(s.start) ? s.start : def.start,
      end: HHMM.test(s.end) ? s.end : def.end,
    };
  });

  const legacyCourt = positiveInt(raw.fullCourtPrice, d.pricing.valle.court);
  const band = (saved, fallbackCourt) => ({
    court: positiveInt(saved?.court, fallbackCourt),
    perPlayer: saved?.perPlayer ? positiveInt(saved.perPlayer, null) : null,
  });
  const p = raw.pricing || {};

  return {
    courts: courts.length ? courts : d.courts.map((c) => ({ ...c })),
    slotDurationMin: positiveInt(raw.slotDurationMin, d.slotDurationMin),
    schedule,
    pricing: {
      valle: band(p.valle, legacyCourt),
      pico: band(p.pico, positiveInt(p.valle?.court, legacyCourt)),
      picoEnabled: Boolean(p.picoEnabled),
      picoDesde: HHMM.test(p.picoDesde) ? p.picoDesde : d.pricing.picoDesde,
    },
    depositPct: Number.isFinite(Number(raw.depositPct))
      ? Math.min(100, Math.max(0, Number(raw.depositPct)))
      : d.depositPct,
    paymentAlias: String(raw.paymentAlias ?? d.paymentAlias),
    paymentCbu: String(raw.paymentCbu ?? d.paymentCbu),
    paymentTitular: String(raw.paymentTitular ?? d.paymentTitular),
    clubPhone: String(raw.clubPhone ?? d.clubPhone),
    blockedDates: (asList(raw.blockedDates) || [])
      .filter((x) => ISO_DATE.test(x))
      .sort(),
  };
}

/** Ventana del día en minutos desde su 00:00; el cierre "00:30" pasa a 1470. */
function dayWindow(day) {
  const start = toMinutes(day.start);
  let end = toMinutes(day.end);
  if (end <= start) end += DAY_MIN;
  return { start, end };
}

/** Inicios de turno de un día de la semana según horario y duración. */
function startsForDay(day, durationMin) {
  if (!day?.open) return [];
  const { start, end } = dayWindow(day);
  const starts = [];
  for (let t = start; t + durationMin <= end; t += durationMin) {
    const m = t % DAY_MIN;
    starts.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
    );
  }
  return starts;
}

/** @returns {{start: string, end: string}[]} vacío si el día está cerrado o bloqueado */
export function slotTimesFor(config, isoDate) {
  if (!isValidIsoDate(isoDate)) return [];
  if (config.blockedDates.includes(isoDate)) return [];
  const day = config.schedule[isoWeekday(isoDate)];
  return startsForDay(day, config.slotDurationMin).map((start) => ({
    start,
    end: addMinutes(start, config.slotDurationMin),
  }));
}

export function isValidSlotFor(config, isoDate, courtId, startTime) {
  if (!config.courts.some((c) => c.id === courtId)) return false;
  return slotTimesFor(config, isoDate).some((s) => s.start === startTime);
}

export function findCourtIn(config, courtId) {
  return config.courts.find((c) => c.id === courtId) || null;
}

/** Franja (pico/valle) de un turno. Los inicios después de medianoche son de la noche anterior. */
export function bandFor(config, isoDate, startTime) {
  if (!config.pricing.picoEnabled) return "valle";
  const day = config.schedule[isoWeekday(isoDate)];
  const open = day?.open ? toMinutes(day.start) : 0;
  const rel = (hhmm) => {
    const m = toMinutes(hhmm);
    return m < open ? m + DAY_MIN : m;
  };
  return rel(startTime) >= rel(config.pricing.picoDesde) ? "pico" : "valle";
}

/** Precio de un turno. perPlayer = cancha ÷ 4 salvo override. */
export function priceFor(config, isoDate, startTime) {
  const band = bandFor(config, isoDate, startTime);
  const { court, perPlayer } = config.pricing[band];
  return {
    band,
    total: court,
    perPlayer: perPlayer || Math.round(court / PLAYERS_PER_COURT),
    durationMin: config.slotDurationMin,
  };
}

/** Seña sugerida para un total, redondeada a $100. */
export function depositFor(config, total) {
  return Math.round((total * config.depositPct) / 100 / 100) * 100;
}

/**
 * Valida lo que manda el formulario de Configuración.
 * @returns {{ ok: true, config: object } | { ok: false, errors: Record<string, string> }}
 */
export function validateConfig(input) {
  const errors = {};
  const config = normalizeConfig(input);

  const courts = asList(input.courts) || [];
  if (courts.length < 1 || courts.length > MAX_COURTS) {
    errors.courts = `Tiene que haber entre 1 y ${MAX_COURTS} canchas.`;
  } else if (courts.some((c) => !String(c?.name || "").trim())) {
    errors.courts = "Cada cancha necesita un nombre.";
  }

  const duration = Number(input.slotDurationMin);
  if (
    !Number.isInteger(duration) ||
    duration < 30 ||
    duration > 180 ||
    duration % 15
  ) {
    errors.slotDurationMin =
      "La duración va de 30 a 180 minutos, en pasos de 15.";
  }

  const schedule = asList(input.schedule) || [];
  schedule.forEach((day, i) => {
    if (!day?.open) return;
    if (!HHMM.test(day.start) || !HHMM.test(day.end)) {
      errors[`schedule.${i}`] = "Horario inválido (usá HH:MM).";
    } else if (
      Number.isInteger(duration) &&
      startsForDay(day, duration).length === 0
    ) {
      errors[`schedule.${i}`] =
        "Entre la apertura y el cierre no entra ni un turno.";
    }
  });

  const p = input.pricing || {};
  for (const band of ["valle", "pico"]) {
    const court = Number(p[band]?.court);
    if (!Number.isFinite(court) || court <= 0 || court > 10_000_000) {
      errors[`pricing.${band}`] = "Ingresá un precio mayor a $0.";
    }
    const pp = p[band]?.perPlayer;
    if (pp !== null && pp !== undefined && pp !== "" && !(Number(pp) > 0)) {
      errors[`pricing.${band}.perPlayer`] =
        "El precio por jugador tiene que ser mayor a $0.";
    }
  }
  if (p.picoEnabled && !HHMM.test(p.picoDesde)) {
    errors["pricing.picoDesde"] =
      "Indicá desde qué hora es horario pico (HH:MM).";
  }

  const pct = Number(input.depositPct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    errors.depositPct = "La seña es un porcentaje entre 0 y 100.";
  }

  const cbu = String(input.paymentCbu || "").replace(/\s/g, "");
  if (cbu && !/^\d{22}$/.test(cbu)) {
    errors.paymentCbu = "El CBU/CVU tiene que tener exactamente 22 dígitos.";
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, config: { ...config, paymentCbu: cbu } };
}

/** "0000 0031 0001 ··· 0304" — nunca se muestra el CBU completo en pantalla. */
export function maskCbu(cbu) {
  const digits = String(cbu || "").replace(/\D/g, "");
  if (digits.length < 8) return digits;
  return `${digits.slice(0, 4)} ···· ···· ${digits.slice(-4)}`;
}

/**
 * ¿Ya arrancó el turno `startTime` del día `isoDate`? Los inicios después de
 * medianoche (ej. 00:30 con cierre a las 02:00) son de esa misma noche, así
 * que a las 15:00 todavía no pasaron.
 * @param {{ isoDate: string, hhmm: string }} now hora actual en Catriel
 */
export function hasSlotStarted(config, isoDate, startTime, now) {
  if (isoDate !== now.isoDate) return isoDate < now.isoDate;
  const day = config.schedule[isoWeekday(isoDate)];
  const open = day?.open ? toMinutes(day.start) : 0;
  const start = toMinutes(startTime);
  const startRel = start < open ? start + DAY_MIN : start;
  return startRel <= toMinutes(now.hhmm);
}

/**
 * Datos de pago para mostrar en el pase de reserva. El alias por defecto es un
 * valor de ejemplo, no una cuenta confirmada: mientras el admin no cargue uno
 * propio (Ajustes → Cobros) se devuelve null y el pase manda a confirmar por
 * WhatsApp, en vez de mostrar un dato que podría no existir.
 * @returns {{ alias: string|null, cbu: string|null, titular: string }}
 */
export function publicPayment(config) {
  const alias = String(config?.paymentAlias || "").trim();
  const cbu = String(config?.paymentCbu || "").replace(/\s/g, "");
  return {
    alias: alias && alias !== DEFAULT_CONFIG.paymentAlias ? alias : null,
    cbu: cbu || null,
    titular: String(config?.paymentTitular || "").trim() || DEFAULT_CONFIG.paymentTitular,
  };
}
