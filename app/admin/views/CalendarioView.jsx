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
        <header className="cc-cal-head">
          <div className="cc-cal-nav">
            <button
              type="button"
              className="cc-cal-arrow"
              onClick={() => changeMonth(-1)}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={20} strokeWidth={2} aria-hidden />
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
              <ChevronRight size={20} strokeWidth={2} aria-hidden />
            </button>
            {!isCurrentMonth && (
              <button
                type="button"
                className="cc-cal-today"
                onClick={() => {
                  setYear(Number(todayIso.slice(0, 4)));
                  setMonth(Number(todayIso.slice(5, 7)));
                }}
              >
                Volver a hoy
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

        <div className={loading && monthStats ? "admin-content-loading" : ""}>
          {/* Compu / tablet: el mes como mapa de ocupación */}
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
                <Skeleton key={`sk-${i}`} height={96} radius={12} />
              ))}
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                role="gridcell"
                className={`admin-heat-cell cc-heat-cell${d.date === todayIso ? " is-today" : ""}${d.date < todayIso ? " is-past" : ""}`}
                data-heat={d.closed ? "closed" : heatLevel(d.ocupacionPct)}
                disabled={d.closed}
                title={describe(d)}
                aria-label={`${formatDate(d.date, "long")}: ${describe(d)}`}
                onClick={() => onSelectDate(d.date)}
              >
                <span className="cc-heat-top">
                  <span className="admin-heat-day">{d.day}</span>
                  {d.date === todayIso && <span className="cc-heat-today">Hoy</span>}
                </span>
                {d.closed ? (
                  <span className="admin-heat-closed">
                    <Lock size={13} strokeWidth={2} aria-hidden /> Cerrado
                  </span>
                ) : (
                  <>
                    <span className="admin-heat-pct">
                      {d.turnos > 0 ? formatPct(d.ocupacionPct) : "—"}
                    </span>
                    {(d.turnos > 0 || d.cobrado > 0) && (
                      <span className="admin-heat-meta">
                        {plural(d.turnos, "turno", "turnos")} · {shortK(d.cobrado)}
                      </span>
                    )}
                    {d.turnos > 0 && (
                      <span className="cc-heat-bar" aria-hidden>
                        <span style={{ width: pctWidth(d) }} />
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Celu: ritmo de la semana arriba y la lista de días */}
          {hasAvg && (
            <div className="cc-week-rhythm" aria-label="Ocupación promedio por día de la semana">
              {WEEKDAYS.map((w, i) => (
                <span key={w} className="cc-week-col" data-best={i === bestWeekday || undefined}>
                  <span className="cc-week-bar" aria-hidden>
                    <span style={{ height: `${Math.max(4, Math.min(100, weekdayAvg[i] || 0))}%` }} />
                  </span>
                  <small>{w.slice(0, 2)}</small>
                </span>
              ))}
            </div>
          )}
          <ul className="admin-calendar-list cc-day-list">
            {days.map((d) => (
              <li key={d.date}>
                <button
                  type="button"
                  className={`cc-day${d.date === todayIso ? " is-today" : ""}${d.date < todayIso ? " is-past" : ""}`}
                  data-heat={d.closed ? "closed" : heatLevel(d.ocupacionPct)}
                  data-weekend={weekdayOf(d) >= 5 || undefined}
                  disabled={d.closed}
                  aria-label={`${formatDate(d.date, "long")}: ${describe(d)}`}
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

          <div className="admin-heat-legend cc-legend" aria-hidden>
            <span>Menos ocupado</span>
            <span className="cc-legend-scale">
              {[0, 1, 2, 3, 4].map((l) => (
                <span key={l} className="admin-heat-swatch cc-legend-swatch" data-heat={l} />
              ))}
            </span>
            <span>Casi lleno</span>
            <span className="cc-legend-sep" />
            <span className="admin-heat-swatch cc-legend-swatch" data-heat="closed" />
            <span>Cerrado</span>
            <span className="cc-legend-sep" />
            <span className="cc-ball" />
            <span>Hoy</span>
          </div>
        </div>
      </section>
    </div>
  );
}
