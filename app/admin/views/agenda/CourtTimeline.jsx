"use client";

import { useEffect, useRef } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  FlaskConical,
  Lock,
  Plus,
} from "lucide-react";
import { paymentState, pendingAmount } from "../../../../lib/metrics";
import { hasSlotStarted, minutesIntoNight } from "../../../../lib/clubConfig";
import { isoWeekday } from "../../../../lib/booking";
import { formatARS } from "../../../../lib/format";
import { toWhatsappNumber } from "../../../../lib/phone";
import { WhatsAppMiniIcon } from "../../adminHelpers";

const ICON = { size: 15, strokeWidth: 1.75, "aria-hidden": true };
// Un ícono por estado de cobro: se distingue sin depender solo del color.
const STATE_ICON = {
  pagado: CircleCheck,
  senado: CircleDollarSign,
  pendiente: CircleAlert,
  bloqueado: Lock,
  prueba: FlaskConical,
};
// Tope del escalonado al entrar: con muchas franjas el último turno no
// puede tardar más de medio segundo en aparecer.
const STAGGER_MAX = 18;
const DAY_MIN = 24 * 60;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// `short`: la misma etiqueta para la celda angosta del celu (dos canchas
// lado a lado); el texto completo sigue en el aria-label del turno.
function paymentBadge(b) {
  const state = paymentState(b);
  if (state === "bloqueado") return { state, label: "Bloqueado", short: "Bloqueado" };
  if (state === "prueba") return { state, label: "Prueba", short: "Prueba" };
  if (state === "pagado") return { state, label: "Pagado", short: "Pagado" };
  const debe = formatARS(pendingAmount(b));
  if (state === "senado") return { state, label: `Pagó seña · debe ${debe}`, short: `Seña · debe ${debe}` };
  return { state, label: `Debe ${debe}`, short: `Debe ${debe}` };
}

/**
 * Grilla tipo timeline: columnas = canchas, filas = franjas. Con 7 franjas
 * el día entero entra en pantalla en desktop. En mobile cada franja es un
 * bloque con el horario arriba y una tarjeta por cancha.
 *
 * Cada turno es un solo botón que abre el detalle (cobrar, mover, cancelar).
 * Cancelar no está acá a propósito: un toque de más no puede liberar una
 * cancha; el detalle pide confirmación con PIN.
 */
export default function CourtTimeline({
  courts,
  slots,
  activeDate,
  clubConfig,
  now,
  onAssign,
  onOpenDetail,
}) {
  const rows = [];
  for (const s of slots) {
    if (!rows.some((r) => r.start === s.start)) rows.push({ start: s.start, end: s.end });
  }
  const cellFor = (courtId, start) =>
    slots.find((s) => s.courtId === courtId && s.start === start);

  // Estado de cobro de cada turno en el render anterior: si cambió (cobró la
  // seña, saldó la deuda) la etiqueta da vuelta como un cartel de marcador.
  const prevStates = useRef(null);
  const nextStates = new Map();
  for (const s of slots) {
    if (s.booking) nextStates.set(s.booking.id, paymentState(s.booking));
  }
  useEffect(() => {
    prevStates.current = nextStates;
  });
  // Se recuerda un rato cuándo cambió: el panel vuelve a pintar enseguida
  // (ocupación de la tira, reloj) y sin esto la vuelta se cortaba a la mitad.
  const changedAt = useRef(new Map());
  const stateChanged = (b, state) => {
    const prev = prevStates.current;
    if (prev?.has(b.id) && prev.get(b.id) !== state) {
      changedAt.current.set(b.id, Date.now());
    }
    const t = changedAt.current.get(b.id);
    return t != null && Date.now() - t < 1200;
  };

  // Línea de "ahora": solo mirando hoy y dentro del horario del club.
  let nowTopPct = null;
  const current = minutesIntoNight(activeDate, now);
  if (current !== null && rows.length) {
    const day = clubConfig.schedule[isoWeekday(activeDate)];
    const open = day?.open ? toMinutes(day.start) : 0;
    const rel = (hhmm) => {
      const m = toMinutes(hhmm);
      return m < open ? m + DAY_MIN : m;
    };
    const first = rel(rows[0].start);
    const last = rel(rows[rows.length - 1].end) || first;
    const end = last <= first ? last + DAY_MIN : last;
    if (current >= first && current <= end) {
      nowTopPct = ((current - first) / (end - first)) * 100;
    }
  }

  // Cuánto va de la franja en juego (0 a 1): la barrita de la hora avanza
  // como el reloj de una transmisión y, en la compu, la línea de "ahora" se
  // ubica dentro de esa franja (las ya jugadas son más bajitas, así que un %
  // del día entero caía corrido).
  const rowProgress = (row) => {
    if (current === null) return null;
    const day = clubConfig.schedule[isoWeekday(activeDate)];
    const open = day?.open ? toMinutes(day.start) : 0;
    const rel = (hhmm) => {
      const m = toMinutes(hhmm);
      return m < open ? m + DAY_MIN : m;
    };
    const a = rel(row.start);
    let z = rel(row.end);
    if (z <= a) z += DAY_MIN;
    return Math.min(1, Math.max(0, (current - a) / (z - a)));
  };

  const rowState = rows.map((row) => {
    const isPast = hasSlotStarted(clubConfig, activeDate, row.end, now);
    // El turno que se está jugando ahora: empezó y todavía no terminó.
    const isCurrent =
      !isPast && hasSlotStarted(clubConfig, activeDate, row.start, now);
    return { isPast, isCurrent };
  });
  const hasCurrentRow = rowState.some((r) => r.isCurrent);

  return (
    <div className="admin-timeline" style={{ "--courts": courts.length }}>
      <div className="admin-timeline-head" aria-hidden>
        <span />
        {courts.map((c) => (
          <strong key={c.id}>
            {c.name}
            {c.type && <small> · {c.type}</small>}
          </strong>
        ))}
      </div>

      <div className="admin-timeline-body" role="grid" aria-label="Turnos del día por cancha">
        {nowTopPct != null && !hasCurrentRow && (
          <div className="admin-timeline-now" style={{ top: `${nowTopPct}%` }} aria-hidden>
            <span>Ahora · {now.hhmm}</span>
          </div>
        )}

        {rows.map((row, rowIndex) => {
          const isPast = rowState[rowIndex].isPast;
          const isCurrent = rowState[rowIndex].isCurrent;
          const progress = isCurrent ? rowProgress(row) : null;
          return (
            <div
              key={row.start}
              role="row"
              className={`admin-timeline-row${isPast ? " is-past" : ""}${isCurrent ? " is-current" : ""}`}
            >
              <div className="admin-timeline-time" role="rowheader">
                <strong>{row.start}</strong>
                <span>{row.end}</span>
                {isCurrent && <em className="admin-timeline-live">En juego</em>}
                {progress != null && (
                  <i
                    className="admin-timeline-clock"
                    style={{ "--p": progress.toFixed(3) }}
                    aria-hidden
                  >
                    <i />
                  </i>
                )}
                {/* Va adentro de la celda de la hora (y no como hijo de la
                    fila) para no contar como una cancha más en el celu. Se
                    ubica contra la fila, que es la que tiene position. Son
                    <i> y no <span>: los span de esta celda llevan "a las". */}
                {progress != null && (
                  <i
                    className="admin-timeline-now is-in-row"
                    style={{ top: `${(progress * 100).toFixed(2)}%` }}
                    aria-hidden
                  />
                )}
              </div>

              {courts.map((court, courtIndex) => {
                const slot = cellFor(court.id, row.start);
                const b = slot?.booking;
                if (!slot) return <div key={court.id} role="gridcell" />;
                const enter = {
                  "--i": Math.min(rowIndex * courts.length + courtIndex, STAGGER_MAX),
                };

                if (!slot.isTaken) {
                  return (
                    <div key={court.id} role="gridcell" className="admin-slot is-free" style={enter}>
                      <button
                        type="button"
                        className="admin-slot-assign"
                        onClick={() => onAssign(court.id, row.start)}
                        aria-label={`Reservar ${court.name} a las ${row.start}`}
                      >
                        <span className="admin-slot-court">{court.name}</span>
                        <span className="admin-slot-free-label">
                          <Plus {...ICON} /> Libre
                          <span className="admin-slot-free-cta"> · Reservar</span>
                        </span>
                      </button>
                    </div>
                  );
                }

                // Lock sin reserva asociada (dato inconsistente): se muestra ocupado.
                if (!b) {
                  return (
                    <div key={court.id} role="gridcell" className="admin-slot is-taken" data-state="bloqueado" style={enter}>
                      <span className="admin-slot-court">{court.name}</span>
                      <span className="admin-slot-name">Ocupado</span>
                    </div>
                  );
                }

                const badge = paymentBadge(b);
                const StateIcon = STATE_ICON[badge.state] || CircleAlert;
                return (
                  <div
                    key={court.id}
                    role="gridcell"
                    className={`admin-slot is-taken${stateChanged(b, badge.state) ? " is-state-changed" : ""}`}
                    data-state={badge.state}
                    style={enter}
                  >
                    <button
                      type="button"
                      className="admin-slot-main"
                      onClick={() => onOpenDetail(b)}
                      aria-label={`${b.playerName}, ${row.start} en ${court.name}. ${badge.label}. Ver detalle`}
                    >
                      <span className="admin-slot-court">{court.name}</span>
                      <span className="admin-slot-name">{b.playerName}</span>
                      <span className="admin-slot-badge" data-short={badge.short}>
                        <StateIcon
                          className="admin-slot-badge-icon"
                          size={13}
                          strokeWidth={2.4}
                          aria-hidden
                        />
                        <span className="admin-slot-badge-long">{badge.label}</span>
                      </span>
                    </button>
                    {b.playerPhone && (
                      <a
                        className="admin-slot-whatsapp"
                        href={`https://wa.me/${toWhatsappNumber(b.playerPhone)}`}
                        target="_blank"
                        rel="noopener"
                        aria-label={`Mandar WhatsApp a ${b.playerName}`}
                        title="Mandar WhatsApp"
                      >
                        <WhatsAppMiniIcon size={18} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
