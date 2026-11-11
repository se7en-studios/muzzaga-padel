"use client";

import { Plus } from "lucide-react";
import { paymentState, pendingAmount } from "../../../../lib/metrics";
import { hasSlotStarted, minutesIntoNight } from "../../../../lib/clubConfig";
import { isoWeekday } from "../../../../lib/booking";
import { formatARS } from "../../../../lib/format";
import { toWhatsappNumber } from "../../../../lib/phone";
import { WhatsAppMiniIcon } from "../../adminHelpers";

const ICON = { size: 15, strokeWidth: 1.75, "aria-hidden": true };
const DAY_MIN = 24 * 60;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function paymentBadge(b) {
  const state = paymentState(b);
  if (state === "bloqueado") return { state, label: "Bloqueado" };
  if (state === "prueba") return { state, label: "Prueba" };
  if (state === "pagado") return { state, label: "Pagado" };
  if (state === "senado") return { state, label: `Pagó seña · debe ${formatARS(pendingAmount(b))}` };
  return { state, label: `Debe ${formatARS(pendingAmount(b))}` };
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
        {nowTopPct != null && (
          <div className="admin-timeline-now" style={{ top: `${nowTopPct}%` }} aria-hidden>
            <span>{now.hhmm}</span>
          </div>
        )}

        {rows.map((row) => {
          const isPast = hasSlotStarted(clubConfig, activeDate, row.end, now);
          return (
            <div
              key={row.start}
              role="row"
              className={`admin-timeline-row${isPast ? " is-past" : ""}`}
            >
              <div className="admin-timeline-time" role="rowheader">
                <strong>{row.start}</strong>
                <span>{row.end}</span>
              </div>

              {courts.map((court) => {
                const slot = cellFor(court.id, row.start);
                const b = slot?.booking;
                if (!slot) return <div key={court.id} role="gridcell" />;

                if (!slot.isTaken) {
                  return (
                    <div key={court.id} role="gridcell" className="admin-slot is-free">
                      <button
                        type="button"
                        className="admin-slot-assign"
                        onClick={() => onAssign(court.id, row.start)}
                        aria-label={`Reservar ${court.name} a las ${row.start}`}
                      >
                        <span className="admin-slot-court">{court.name}</span>
                        <span className="admin-slot-free-label">
                          <Plus {...ICON} /> Libre · Reservar
                        </span>
                      </button>
                    </div>
                  );
                }

                // Lock sin reserva asociada (dato inconsistente): se muestra ocupado.
                if (!b) {
                  return (
                    <div key={court.id} role="gridcell" className="admin-slot is-taken" data-state="bloqueado">
                      <span className="admin-slot-court">{court.name}</span>
                      <span className="admin-slot-name">Ocupado</span>
                    </div>
                  );
                }

                const badge = paymentBadge(b);
                return (
                  <div
                    key={court.id}
                    role="gridcell"
                    className="admin-slot is-taken"
                    data-state={badge.state}
                  >
                    <button
                      type="button"
                      className="admin-slot-main"
                      onClick={() => onOpenDetail(b)}
                      aria-label={`${b.playerName}, ${row.start} en ${court.name}. ${badge.label}. Ver detalle`}
                    >
                      <span className="admin-slot-court">{court.name}</span>
                      <span className="admin-slot-name">{b.playerName}</span>
                      <span className="admin-slot-badge">{badge.label}</span>
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
