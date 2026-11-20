"use client";

import { formatARS, formatDate } from "../../../../lib/format";

const CHART_HEIGHT = 140;

/** Redondea el máximo a un número "lindo" para el eje (ej. 83.000 → 100.000). */
function niceMax(value) {
  if (value <= 0) return 10000;
  const pow = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  return steps.map((s) => s * pow).find((v) => v >= value);
}

const shortK = (n) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);

/**
 * Cobrado de los últimos 7 días, apilado turnos / cantina, con eje Y y el
 * día de hoy en naranja. Abajo de cada día, cuántos turnos se jugaron.
 */
export default function WeekChart({ days }) {
  const max = niceMax(Math.max(...days.map((d) => d.cobrado)));
  const ticks = [max, max / 2, 0];

  return (
    <figure className="admin-weekchart">
      <div className="admin-weekchart-plot" style={{ height: CHART_HEIGHT }}>
        <div className="admin-weekchart-axis" aria-hidden>
          {ticks.map((t) => (
            <span key={t}>{shortK(t)}</span>
          ))}
        </div>
        <div className="admin-weekchart-bars">
          {ticks.map((t) => (
            <span
              key={`grid-${t}`}
              className="admin-weekchart-grid"
              style={{ bottom: `${(t / max) * 100}%` }}
              aria-hidden
            />
          ))}
          {days.map((d) => {
            const turnosH = (d.cobradoTurnos / max) * 100;
            const cantinaH = (d.cantina / max) * 100;
            const label = `${d.dayLabel} ${formatDate(d.date)}: ${d.turnos} ${d.turnos === 1 ? "turno" : "turnos"}, cobrado ${formatARS(d.cobrado)} (turnos ${formatARS(d.cobradoTurnos)}, cantina ${formatARS(d.cantina)})`;
            return (
              <div
                key={d.date}
                className={`admin-weekchart-col${d.isToday ? " is-today" : ""}`}
                title={label}
                aria-label={label}
                role="img"
                tabIndex={0}
              >
                <span className="admin-weekchart-value">
                  {d.cobrado > 0 ? shortK(d.cobrado) : ""}
                </span>
                <span className="admin-weekchart-stack">
                  <span className="is-cantina" style={{ height: `${cantinaH}%` }} />
                  <span className="is-turnos" style={{ height: `${turnosH}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="admin-weekchart-labels" aria-hidden>
        <span />
        {days.map((d) => (
          <span key={d.date} className={d.isToday ? "is-today" : undefined}>
            {d.isToday ? "Hoy" : d.dayLabel}
          </span>
        ))}
      </div>
      {/* Cantidad de turnos por día: es lo primero que pregunta el dueño. */}
      <div className="admin-weekchart-labels admin-weekchart-turnos" aria-hidden>
        <span>Turnos</span>
        {days.map((d) => (
          <strong key={d.date} className={d.isToday ? "is-today" : undefined}>
            {d.turnos}
          </strong>
        ))}
      </div>
      <figcaption className="admin-weekchart-legend">
        <span className="is-turnos">Cobrado en turnos</span>
        <span className="is-cantina">Cantina</span>
      </figcaption>
    </figure>
  );
}
