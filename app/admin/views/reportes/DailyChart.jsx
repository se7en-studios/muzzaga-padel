"use client";

import { formatARS, formatDate } from "../../../../lib/format";

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function niceMax(value) {
  if (value <= 0) return 10000;
  const pow = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].map((s) => s * pow).find((v) => v >= value);
}

const shortK = (n) =>
  n >= 1000000
    ? `$${(n / 1000000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`
    : n >= 1000
      ? `$${Math.round(n / 1000)}k`
      : `$${n}`;

const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/**
 * Lo cobrado cada día en barras apiladas (turnos abajo, cantina arriba): la
 * altura total es lo que entró ese día. Barras y no líneas porque cada día es
 * un número suelto, no una tendencia. Los días que todavía no pasaron quedan
 * vacíos (antes se dibujaban en $0 y parecía que la caja se había caído).
 * Es HTML y no SVG para que los textos no se achiquen en el celu.
 */
export default function DailyChart({ days, today }) {
  const isPast = (d) => !today || d.date <= today;
  const past = days.filter(isPast);
  const total = (d) => d.cobradoTurnos + d.cantina;
  const max = niceMax(Math.max(0, ...past.map(total)));
  const pct = (v) => `${Math.max(0, (v / max) * 100)}%`;
  const sum = (key) => past.reduce((s, d) => s + d[key], 0);
  const turnos = sum("cobradoTurnos");
  const cantina = sum("cantina");
  const avg = past.length ? (turnos + cantina) / past.length : 0;
  const best = past.reduce(
    (b, d) => (!b || total(d) > total(b) ? d : b),
    null,
  );
  const n = days.length;
  const sameMonth = days[0]?.date.slice(0, 7) === days[n - 1]?.date.slice(0, 7);
  // Con muchos días no entran todas las etiquetas: se marca una cada tanto.
  const every = n <= 31 ? 5 : Math.ceil(n / 12);
  const label = (d) => {
    if (n <= 7) return `${WEEKDAYS[weekday(d.date)]} ${Number(d.date.slice(8))}`;
    return sameMonth && n <= 31 ? String(Number(d.date.slice(8))) : formatDate(d.date);
  };

  return (
    <figure className="rp-chart">
      <div className="rp-chart-head">
        <div className="rp-chart-legend">
          <span className="is-turnos">
            Turnos <strong>{formatARS(turnos)}</strong>
          </span>
          <span className="is-cantina">
            Cantina <strong>{formatARS(cantina)}</strong>
          </span>
          <span className="is-weekend">Sábado y domingo</span>
          <span className="is-avg">
            Promedio <strong>{formatARS(avg)}</strong> por día
          </span>
        </div>
      </div>
      <div
        className="rp-chart-plot"
        role="img"
        aria-label={`Cobrado por día. Turnos ${formatARS(turnos)}, cantina ${formatARS(cantina)}, promedio ${formatARS(avg)} por día.`}
      >
        <div className="rp-chart-y" aria-hidden>
          {[max, max / 2, 0].map((v) => (
            <span key={v}>{shortK(v)}</span>
          ))}
        </div>
        <div className="rp-chart-area">
          <span className="rp-chart-grid" style={{ bottom: "50%" }} />
          <span className="rp-chart-grid" style={{ bottom: "100%" }} />
          {avg > 0 && (
            <span className="rp-chart-avg" style={{ bottom: pct(avg) }}>
              <em>Promedio</em>
            </span>
          )}
          <div
            className="rp-chart-bars"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
          >
            {days.map((d, i) => {
              const wd = weekday(d.date);
              const future = !isPast(d);
              const isBest = best && d.date === best.date && total(best) > 0;
              // El cartelito del mouse se abre hacia adentro en las puntas.
              const edge = i < n * 0.35 ? " tip-start" : i >= n * 0.65 ? " tip-end" : "";
              return (
                <div
                  key={d.date}
                  style={{ "--i": i }}
                  className={`rp-bar${future ? " is-future" : ""}${wd === 0 || wd === 6 ? " is-weekend" : ""}${d.date === today ? " is-today" : ""}${isBest ? " is-best" : ""}${edge}`}
                  data-tip={
                    future
                      ? `${formatDate(d.date, "long")}: todavía no pasó`
                      : `${formatDate(d.date, "long")}: ${formatARS(total(d))}`
                  }
                  title={
                    future
                      ? undefined
                      : `Turnos ${formatARS(d.cobradoTurnos)} · cantina ${formatARS(d.cantina)}`
                  }
                >
                  {isBest && (
                    <span
                      className="rp-bar-best"
                      style={{ bottom: pct(total(d)) }}
                      aria-hidden
                    >
                      <i />
                      {shortK(total(d))}
                    </span>
                  )}
                  {!future && (
                    <span className="rp-bar-stack" style={{ height: pct(total(d)) }}>
                      <span
                        className="is-cantina"
                        style={{ flexGrow: d.cantina }}
                      />
                      <span
                        className="is-turnos"
                        style={{ flexGrow: d.cobradoTurnos }}
                      />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div
        className="rp-chart-x"
        aria-hidden
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {days.map((d, i) => {
          const wd = weekday(d.date);
          return (
            <span
              key={d.date}
              className={`${i % every === 0 || d.date === today ? "is-major" : ""}${wd === 0 || wd === 6 ? " is-weekend" : ""}${d.date === today ? " is-today" : ""}`}
              title={d.date === today ? "Hoy" : undefined}
            >
              {n <= 31 || i % every === 0 ? label(d) : ""}
            </span>
          );
        })}
      </div>
      <figcaption className="rp-chart-caption">
        La pelotita marca hoy y el mejor día. Los días que todavía no
        pasaron quedan rayados.
        <span className="rp-hover-hint">
          {" "}
          Pasá el mouse por una barra para ver el detalle.
        </span>
      </figcaption>
    </figure>
  );
}
