"use client";

import { RefreshCw } from "lucide-react";
import { formatDate, formatPct } from "../../../../lib/format";

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true };

/** Color de la barrita de ocupación según qué tan lleno está el día. */
function occupancyTone(pct) {
  if (pct == null || pct === 0) return "empty";
  if (pct < 40) return "low";
  if (pct < 75) return "mid";
  return "high";
}

/**
 * Tira de 14 días con mini indicador de ocupación. Los días cerrados o
 * bloqueados quedan en gris y deshabilitados.
 */
export default function DayStrip({
  days,
  rangeStats,
  activeDate,
  todayIso,
  loading,
  onSelect,
  onRefresh,
}) {
  const statsByDate = new Map((rangeStats || []).map((d) => [d.date, d]));
  const isOutOfStrip = !days.some((d) => d.iso === activeDate);

  return (
    <div className="admin-daystrip">
      <div className="admin-daystrip-scroll" role="tablist" aria-label="Día de la agenda">
        {days.map((d) => {
          const stats = statsByDate.get(d.iso);
          const closed = stats ? stats.closed : d.closed;
          const pct = stats?.ocupacionPct ?? null;
          const turnos = stats?.turnos ?? 0;
          const isToday = d.iso === todayIso;
          // El 1° del mes lleva el mes arriba: si no, "1" después de "30"
          // parece un error.
          const isMonthStart = d.dayNumber === 1;
          return (
            <button
              key={d.iso}
              type="button"
              role="tab"
              aria-selected={activeDate === d.iso}
              disabled={closed}
              className={`admin-daychip${isToday ? " is-today" : ""}${d.isWeekend ? " is-weekend" : ""}${isMonthStart ? " is-month-start" : ""}`}
              title={
                closed
                  ? `${d.fullLabel}: cerrado`
                  : `${d.fullLabel}: ${turnos} ${turnos === 1 ? "turno" : "turnos"} · ${formatPct(pct ?? 0)} ocupado`
              }
              onClick={() => onSelect(d.iso)}
            >
              {isMonthStart && (
                <span className="admin-daychip-month" aria-hidden>
                  {d.monthName.slice(0, 3)}
                </span>
              )}
              <span className="admin-daychip-name">{d.dayName}</span>
              <strong>{d.dayNumber}</strong>
              {!closed && turnos > 0 && (
                <span className="admin-daychip-count" aria-hidden>
                  {turnos}
                </span>
              )}
              <span
                className="admin-daychip-bar"
                data-tone={closed ? "closed" : occupancyTone(pct)}
                aria-hidden
              >
                <span style={{ width: `${closed ? 0 : Math.max(pct ?? 0, 0)}%` }} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="admin-daystrip-actions">
        {/* Recordatorio de los atajos: en el mostrador se usa más el teclado. */}
        <span className="admin-daystrip-keys" aria-hidden>
          <kbd>←</kbd>
          <kbd>→</kbd> día · <kbd>T</kbd> hoy
        </span>
        {isOutOfStrip && (
          <span className="admin-daystrip-viewing">Viendo {formatDate(activeDate)}</span>
        )}
        {activeDate !== todayIso && (
          <button type="button" className="btn btn-secondary" onClick={() => onSelect(todayIso)}>
            Hoy
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Actualizar agenda"
          title="Actualizar"
        >
          <RefreshCw {...ICON} />
        </button>
      </div>
    </div>
  );
}
