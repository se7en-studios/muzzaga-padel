"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Flame,
  Lock,
  Percent,
  Wallet,
} from "lucide-react";
import { adminGetMonthStats } from "../actions";
import { todayInClub } from "../../../lib/booking";
import { formatARS, formatDate, formatPct, plural } from "../../../lib/format";
import { Skeleton } from "../ui/states";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
// Semana de lunes a domingo, como la piensa el club.
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Nivel de intensidad del heatmap (0 = sin turnos … 4 = casi lleno). */
function heatLevel(pct) {
  if (!pct) return 0;
  if (pct < 25) return 1;
  if (pct < 50) return 2;
  if (pct < 75) return 3;
  return 4;
}

const WEEKDAYS_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];

/**
 * Puntitos de cobro de un día (solo presentación): verde si entró plata,
 * naranja si queda algo por cobrar, rojo si hay turnos marcados "pagado"
 * sin el cobro cargado. Lo pendiente de días que todavía no llegaron no se
 * marca: esos turnos se pagan cuando se juegan.
 */
function payDots(d, todayIso) {
  if (d.closed) return [];
  const dots = [];
  if (d.cobrado > 0) dots.push("ok");
  if (d.porCobrar > 0 && d.date <= todayIso) dots.push("owe");
  if (d.pagadosSinCobro > 0) dots.push("alert");
  return dots;
}

const DOT_TEXT = {
  ok: "hubo cobros",
  owe: "falta cobrar",
  alert: "pagados sin cobro cargado",
};
const dotsText = (dots) => (dots.length ? ` · ${dots.map((k) => DOT_TEXT[k]).join(", ")}` : "");

const shortK = (n) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : formatARS(n));

export default function CalendarioView({ onSelectDate, onExpiredSession }) {
  const todayIso = todayInClub();
  const [year, setYear] = useState(Number(todayIso.slice(0, 4)));
  const [month, setMonth] = useState(Number(todayIso.slice(5, 7))); // 1-12
  const [monthStats, setMonthStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminGetMonthStats(year, month).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) setMonthStats(res);
      else onExpiredSession?.(res);
    });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  function changeMonth(delta) {
    const index = year * 12 + (month - 1) + delta;
    setYear(Math.floor(index / 12));
    setMonth((index % 12) + 1);
  }

  const isCurrentMonth =
    year === Number(todayIso.slice(0, 4)) &&
    month === Number(todayIso.slice(5, 7));
  // Lunes = 0 … domingo = 6
  const firstWeekday =
    (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const days = monthStats?.days || [];

  const describe = (d) =>
    d.closed
      ? d.closedReason
      : `${plural(d.turnos, "turno", "turnos")} · ${formatPct(d.ocupacionPct ?? 0)} ocupado · ${formatARS(d.cobrado)} cobrado`;

  // Lectura rápida (solo presentación): promedio de ocupación por día de la
  // semana con los días ya jugados, el día más lleno y los cerrados.
  const weekdayOf = (d) => (firstWeekday + d.day - 1) % 7;
  const played = days.filter((d) => !d.closed && d.date <= todayIso);
  const weekdayAvg = WEEKDAYS.map((_, i) => {
    const sample = played.filter((d) => weekdayOf(d) === i);
    if (sample.length === 0) return null;
    return sample.reduce((s, d) => s + (d.ocupacionPct || 0), 0) / sample.length;
  });
  const hasAvg = weekdayAvg.some((v) => v != null);
  const bestDay = days
    .filter((d) => !d.closed && d.turnos > 0)
    .reduce((best, d) => (!best || d.ocupacionPct > best.ocupacionPct ? d : best), null);
  const bestWeekday = hasAvg
    ? weekdayAvg.reduce((bi, v, i) => (v != null && (bi < 0 || v > weekdayAvg[bi]) ? i : bi), -1)
    : -1;
  const closedCount = days.filter((d) => d.closed).length;
  const pctWidth = (d) => `${Math.min(100, Math.max(0, d.ocupacionPct || 0))}%`;

  return (
    <div className="cc-cal" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 3 KPI CARDS KRAVIO MENSUAL */}
      {monthStats && (
        <div className="admin-kpis-3">
          <div className="admin-kravio-kpi-card">
            <div className="admin-kravio-kpi-header">
              <span className="admin-kravio-kpi-title">Ocupación Mensual</span>
              <Percent size={17} strokeWidth={1.75} className="admin-kravio-kpi-icon" aria-hidden />
            </div>
            <div className="admin-kravio-kpi-content">
              <div className="admin-kravio-kpi-left">
                <div className="admin-kravio-kpi-number">
                  {formatPct(monthStats.ocupacionPct)}
                </div>
                <span className="admin-cell-sub">
                  Promedio en {MONTH_NAMES[month - 1]} {year}
                </span>
              </div>
            </div>
          </div>

          <div className="admin-kravio-kpi-card">
            <div className="admin-kravio-kpi-header">
              <span className="admin-kravio-kpi-title">Turnos en el Mes</span>
              <CalendarCheck size={17} strokeWidth={1.75} className="admin-kravio-kpi-icon" aria-hidden />
            </div>
            <div className="admin-kravio-kpi-content">
              <div className="admin-kravio-kpi-left">
                <div className="admin-kravio-kpi-number">
                  {monthStats.totals.turnos} {monthStats.totals.turnos === 1 ? "Turno" : "Turnos"}
                </div>
                <span className="admin-cell-sub">
                  Jugados y reservados
                </span>
              </div>
            </div>
          </div>

          <div className="admin-kravio-kpi-card">
            <div className="admin-kravio-kpi-header">
              <span className="admin-kravio-kpi-title">Recaudación Cobrada</span>
              <Wallet size={17} strokeWidth={1.75} style={{ color: "#15803d" }} aria-hidden />
            </div>
            <div className="admin-kravio-kpi-content">
              <div className="admin-kravio-kpi-left">
                <div className="admin-kravio-kpi-number" style={{ color: "#15803d" }}>
                  {formatARS(monthStats.totals.cobrado)}
                </div>
                <span className="admin-cell-sub">
                  Ingresos de turnos y cantina
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="cc-cal-card" aria-label="Ocupación del mes">
        {/* Cartel en cancha: el mes grande, flechas y lo que hay que saber. */}
        <header className="cc-cal-head">
          <div className="cc-cal-nav">
            <button
              type="button"
              className="cc-cal-arrow"
              onClick={() => changeMonth(-1)}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={22} strokeWidth={2.25} aria-hidden />
            </button>
            <h2 className="cc-cal-month" aria-live="polite">
              {MONTH_NAMES[month - 1]} <span>{year}</span>
            </h2>
            <button
              type="button"
              className="cc-cal-arrow"
              onClick={() => changeMonth(1)}
              aria-label="Mes siguiente"
            >
              <ChevronRight size={22} strokeWidth={2.25} aria-hidden />
            </button>
            {!isCurrentMonth && (
              <button
                type="button"
                className="cc-cal-today"
                aria-label="Volver al mes de hoy"
                onClick={() => {
                  setYear(Number(todayIso.slice(0, 4)));
                  setMonth(Number(todayIso.slice(5, 7)));
                }}
              >
                <span className="cc-ball" aria-hidden />
                Hoy
              </button>
            )}
          </div>

          {monthStats && (
            <ul className="cc-cal-facts" aria-label="Resumen del mes">
              {bestDay && (
                <li data-kind="best">
                  <Flame size={15} strokeWidth={2} aria-hidden />
                  <span>
                    Día más lleno: <strong>{formatDate(bestDay.date, "long")}</strong>{" "}
                    · {formatPct(bestDay.ocupacionPct)}
                  </span>
                </li>
              )}
              {bestWeekday >= 0 && weekdayAvg[bestWeekday] > 0 && (
                <li data-kind="weekday">
                  <span className="cc-ball" aria-hidden />
                  <span>
                    Los <strong>{WEEKDAYS_LONG[bestWeekday]}</strong> son los más
                    movidos
                  </span>
                </li>
              )}
              {closedCount > 0 && (
                <li data-kind="closed">
                  <Lock size={14} strokeWidth={2} aria-hidden />
                  <span>
                    {plural(closedCount, "día cerrado", "días cerrados")}
                  </span>
                </li>
              )}
              <li data-kind="hint" className="cc-cal-hint">
                Tocá un día para abrir su agenda
              </li>
            </ul>
          )}
        </header>

        <div className={`cc-cal-body${loading && monthStats ? " admin-content-loading" : ""}`}>
          {/* El mes como mapa de ocupación: cada día es una entrada de cancha.
              En el celu es la misma grilla, compacta. */}
          <div
            className="admin-heatmap cc-heatmap"
            role="grid"
            aria-label={`Ocupación de ${MONTH_NAMES[month - 1]}`}
          >
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className="admin-heatmap-weekday cc-weekday"
                role="columnheader"
                data-weekend={i >= 5 || undefined}
                data-best={(hasAvg && i === bestWeekday && weekdayAvg[i] > 0) || undefined}
              >
                <span className="cc-weekday-name">{w}</span>
                {hasAvg && weekdayAvg[i] != null && (
                  <span
                    className="cc-weekday-avg"
                    title={`Promedio de los ${WEEKDAYS_LONG[i]}: ${formatPct(Math.round(weekdayAvg[i]))}`}
                  >
                    <span className="cc-weekday-track" aria-hidden>
                      <span style={{ width: `${Math.min(100, weekdayAvg[i])}%` }} />
                    </span>
                    <small>{Math.round(weekdayAvg[i])}%</small>
                  </span>
                )}
              </div>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`blank-${i}`} className="cc-heat-blank" aria-hidden />
            ))}
            {!monthStats &&
              Array.from({ length: 30 }, (_, i) => (
                <Skeleton key={`sk-${i}`} height={112} radius={14} />
              ))}
            {days.map((d) => {
              const dots = payDots(d, todayIso);
              const isToday = d.date === todayIso;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="gridcell"
                  className={`admin-heat-cell cc-heat-cell${isToday ? " is-today" : ""}${d.date < todayIso ? " is-past" : ""}`}
                  data-heat={d.closed ? "closed" : heatLevel(d.ocupacionPct)}
                  data-weekend={weekdayOf(d) >= 5 || undefined}
                  disabled={d.closed}
                  title={describe(d) + dotsText(dots)}
                  aria-label={`${formatDate(d.date, "long")}: ${describe(d)}${dotsText(dots)}`}
                  onClick={() => onSelectDate(d.date)}
                >
                  <span className="cc-heat-top">
                    <span className="admin-heat-day">{d.day}</span>
                    {isToday && <span className="cc-heat-today">Hoy</span>}
                    {dots.length > 0 && (
                      <span className="cc-tk-dots" aria-hidden>
                        {dots.map((k) => (
                          <i key={k} data-pay={k} />
                        ))}
                      </span>
                    )}
                  </span>
                  {d.closed ? (
                    <span className="admin-heat-closed">
                      <Lock size={13} strokeWidth={2} aria-hidden />
                      <span>Cerrado</span>
                    </span>
                  ) : (
                    <>
                      {d.turnos > 0 && (
                        <>
                          <span className="admin-heat-pct">{formatPct(d.ocupacionPct)}</span>
                          <span className="cc-heat-bar" aria-hidden>
                            <span style={{ width: pctWidth(d) }} />
                          </span>
                        </>
                      )}
                      <span className="cc-tk-stub" data-empty={d.turnos > 0 ? undefined : true} aria-hidden>
                        {d.turnos > 0 ? (
                          <span>
                            <strong>{d.turnos}</strong> {d.turnos === 1 ? "turno" : "turnos"}
                          </span>
                        ) : (
                          <span>{d.date < todayIso ? "Sin turnos" : "Libre"}</span>
                        )}
                        {d.cobrado > 0 && <span className="cc-tk-money">{shortK(d.cobrado)}</span>}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="admin-heat-legend cc-legend" aria-hidden>
            <span className="cc-legend-item">
              Libre
              <span className="cc-legend-scale">
                {[0, 1, 2, 3, 4].map((l) => (
                  <span key={l} className="admin-heat-swatch cc-legend-swatch" data-heat={l} />
                ))}
              </span>
              Cancha llena
            </span>
            <span className="cc-legend-item">
              <span className="admin-heat-swatch cc-legend-swatch" data-heat="closed" />
              Cerrado
            </span>
            <span className="cc-legend-item">
              <span className="cc-ball" />
              Hoy
            </span>
            <span className="cc-legend-item">
              <i className="cc-legend-dot" data-pay="ok" /> Cobrado
            </span>
            <span className="cc-legend-item">
              <i className="cc-legend-dot" data-pay="owe" /> Falta cobrar
            </span>
            <span className="cc-legend-item">
              <i className="cc-legend-dot" data-pay="alert" /> Pagado sin cobro cargado
            </span>
          </div>

          {/* Celu: el detalle día por día, a mano pero plegado. */}
          {monthStats && (
            <details className="cc-day-details">
              <summary>
                <span>Ver día por día</span>
                <ChevronRight className="cc-day-details-icon" size={18} strokeWidth={2} aria-hidden />
              </summary>
              <ul className="admin-calendar-list cc-day-list">
                {days.map((d) => (
                  <li key={d.date}>
                    <button
                      type="button"
                      className={`cc-day${d.date === todayIso ? " is-today" : ""}${d.date < todayIso ? " is-past" : ""}`}
                      data-heat={d.closed ? "closed" : heatLevel(d.ocupacionPct)}
                      data-weekend={weekdayOf(d) >= 5 || undefined}
                      disabled={d.closed}
                      aria-label={`${formatDate(d.date, "long")}: ${describe(d)}${dotsText(payDots(d, todayIso))}`}
                      onClick={() => onSelectDate(d.date)}
                    >
                      <span className="cc-day-tile" aria-hidden>
                        <small>{WEEKDAYS[weekdayOf(d)]}</small>
                        <strong>{d.day}</strong>
                      </span>
                      <span className="cc-day-body" aria-hidden>
                        <span className="cc-day-top">
                          <strong>
                            {d.closed
                              ? "Cerrado"
                              : d.turnos > 0
                                ? formatPct(d.ocupacionPct)
                                : "Sin turnos"}
                          </strong>
                          {d.date === todayIso && <span className="cc-heat-today">Hoy</span>}
                          <span className="cc-day-meta">
                            {d.closed
                              ? d.closedReason
                              : d.turnos > 0
                                ? `${plural(d.turnos, "turno", "turnos")} · ${shortK(d.cobrado)}`
                                : ""}
                          </span>
                        </span>
                        {!d.closed && (
                          <span className="cc-day-bar">
                            <span style={{ width: pctWidth(d) }} />
                          </span>
                        )}
                      </span>
                      {!d.closed && (
                        <ChevronRight className="cc-day-go" size={18} strokeWidth={2} aria-hidden />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>
    </div>
  );
}
