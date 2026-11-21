"use client";

import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import { formatARS } from "../../../../lib/format";

const pctOf = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * El cartel de arriba, sobre la cancha: cuánto entró en grande y, al lado,
 * si fue mejor o peor que el período anterior (con dos barras para verlo
 * sin leer números). Los cálculos vienen hechos de ReportContent.
 */
export default function ReportHero({
  name,
  prevLabel,
  prevName,
  totals: t,
  previousTotals: p,
  inProgress,
  notStarted,
  elapsed,
  totalDays,
  cur,
  prev,
  change,
}) {
  const turnosShare = t.cobrado > 0 ? (t.cobradoTurnos / t.cobrado) * 100 : 0;
  const barMax = Math.max(cur, prev) || 1;
  const showBars = !notStarted && (cur > 0 || prev > 0);
  const suffix = inProgress ? " por día" : "";

  return (
    <section className="rp-hero" aria-label="Cómo fue el período">
      <div className="rp-hero-main">
        <span className="rp-hero-kicker">{name}</span>
        <span className="rp-hero-label">
          {inProgress ? "Cobraste hasta hoy" : "Cobraste"}
        </span>
        <strong className={`rp-hero-amount${t.cobrado > 0 ? "" : " is-zero"}`}>
          {formatARS(t.cobrado)}
        </strong>

        {t.cobrado > 0 && (
          <div
            className="rp-split"
            role="img"
            aria-label={`Turnos ${formatARS(t.cobradoTurnos)}, cantina ${formatARS(t.cantina)}`}
          >
            <span className="is-turnos" style={{ width: `${turnosShare}%` }} />
            <span className="is-cantina" style={{ width: `${100 - turnosShare}%` }} />
          </div>
        )}
        <div className="rp-split-legend">
          <span className="is-turnos">
            Turnos <strong>{formatARS(t.cobradoTurnos)}</strong>
            {t.cobrado > 0 && <em>{pctOf(t.cobradoTurnos, t.cobrado)}%</em>}
          </span>
          <span className="is-cantina">
            Cantina <strong>{formatARS(t.cantina)}</strong>
            {t.cobrado > 0 && <em>{pctOf(t.cantina, t.cobrado)}%</em>}
          </span>
        </div>

        {inProgress && (
          <div className="rp-progress">
            <span className="rp-progress-label">
              Van <strong>{elapsed}</strong> de {totalDays} días
            </span>
            <span
              className="rp-progress-track"
              role="img"
              aria-label={`Van ${elapsed} de ${totalDays} días del período`}
            >
              <span style={{ width: `${(elapsed / totalDays) * 100}%` }}>
                <i aria-hidden />
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="rp-versus">
        <span className="rp-versus-title">¿Mejor o peor que antes?</span>

        {notStarted ? (
          <p className="rp-verdict-text">
            Cuando arranque, acá lo vas a comparar con {prevLabel}.
          </p>
        ) : change == null ? (
          <>
            {p.cobrado > 0 && (
              <span className="rp-verdict is-even">
                <Equal size={20} strokeWidth={2.5} aria-hidden />
                Igual
              </span>
            )}
            <p className="rp-verdict-text">
              {p.cobrado > 0
                ? "Igual que el período anterior."
                : `No hubo cobros ${prevName} para comparar.`}
            </p>
          </>
        ) : (
          <>
            <span className={`rp-verdict ${change > 0 ? "is-up" : "is-down"}`}>
              {change > 0 ? (
                <ArrowUp size={22} strokeWidth={2.75} aria-hidden />
              ) : (
                <ArrowDown size={22} strokeWidth={2.75} aria-hidden />
              )}
              {Math.abs(change).toLocaleString("es-AR")}% {change > 0 ? "más" : "menos"}
            </span>
            <p className="rp-verdict-text">
              {change > 0 ? "Entró más plata" : "Entró menos plata"}
              {inProgress ? " por día " : " "}
              que {prevName}.
            </p>
          </>
        )}

        {showBars && (
          <dl className="rp-versus-bars">
            <div className="is-cur">
              <dt>{name}</dt>
              <dd>
                <span className="rp-versus-track" aria-hidden>
                  <span style={{ width: `${(cur / barMax) * 100}%` }} />
                </span>
                <strong>
                  {formatARS(cur)}
                  {suffix && <small>{suffix}</small>}
                </strong>
              </dd>
            </div>
            <div className="is-prev">
              <dt>{prevLabel}</dt>
              <dd>
                <span className="rp-versus-track" aria-hidden>
                  <span style={{ width: `${(prev / barMax) * 100}%` }} />
                </span>
                <strong>
                  {formatARS(prev)}
                  {suffix && <small>{suffix}</small>}
                </strong>
              </dd>
            </div>
          </dl>
        )}

        {inProgress && change != null && (
          <p className="rp-hero-note">
            Como el período no terminó, se compara lo que entra por día, no el
            total.
          </p>
        )}
      </div>
    </section>
  );
}
