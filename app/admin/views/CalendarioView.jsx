"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Percent, Wallet } from "lucide-react";
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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

      {/* HEATMAP CARD WRAPPER */}
      <div className="admin-kravio-table-card" style={{ padding: 20 }}>
        <div className="admin-view-toolbar" style={{ marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
          <div className="admin-calendar-nav">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => changeMonth(-1)}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
            </button>
            <strong aria-live="polite" style={{ fontSize: 16 }}>
              {MONTH_NAMES[month - 1]} {year}
            </strong>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => changeMonth(1)}
              aria-label="Mes siguiente"
            >
              <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
            </button>
            {!isCurrentMonth && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setYear(Number(todayIso.slice(0, 4)));
                  setMonth(Number(todayIso.slice(5, 7)));
                }}
              >
                Hoy
              </button>
            )}
          </div>
          {monthStats && (
            <span className="admin-field-hint">
              Hacé click en cualquier día para abrir directamente la agenda de esa fecha.
            </span>
          )}
        </div>

        <div className={loading && monthStats ? "admin-content-loading" : ""}>
          {/* Desktop / tablet: heatmap mensual */}
          <div
            className="admin-heatmap"
            role="grid"
            aria-label={`Ocupación de ${MONTH_NAMES[month - 1]}`}
          >
            {WEEKDAYS.map((w) => (
              <div key={w} className="admin-heatmap-weekday" role="columnheader">
                {w}
              </div>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`blank-${i}`} aria-hidden />
            ))}
            {!monthStats &&
              Array.from({ length: 30 }, (_, i) => (
                <Skeleton key={`sk-${i}`} height={76} radius={8} />
              ))}
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                role="gridcell"
                className={`admin-heat-cell${d.date === todayIso ? " is-today" : ""}`}
                data-heat={d.closed ? "closed" : heatLevel(d.ocupacionPct)}
                disabled={d.closed}
                title={describe(d)}
                aria-label={`${formatDate(d.date, "long")}: ${describe(d)}`}
                onClick={() => onSelectDate(d.date)}
              >
                <span className="admin-heat-day">{d.day}</span>
                {d.closed ? (
                  <span className="admin-heat-closed">Cerrado</span>
                ) : (
                  <>
                    <span className="admin-heat-pct">
                      {d.turnos > 0 ? formatPct(d.ocupacionPct) : "—"}
                    </span>
                    {(d.turnos > 0 || d.cobrado > 0) && (
                      <span className="admin-heat-meta">
                        {d.turnos}t · {shortK(d.cobrado)}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Mobile: lista de días */}
          <ul className="admin-calendar-list">
            {days.map((d) => (
              <li key={d.date}>
                <button
                  type="button"
                  className={d.date === todayIso ? "is-today" : undefined}
                  data-heat={d.closed ? "closed" : heatLevel(d.ocupacionPct)}
                  disabled={d.closed}
                  onClick={() => onSelectDate(d.date)}
                >
                  <span className="admin-heat-swatch" aria-hidden />
                  <strong>{formatDate(d.date, "long")}</strong>
                  <span className="admin-cell-sub">{describe(d)}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="admin-heat-legend" aria-hidden style={{ marginTop: 16 }}>
            <span>Menos ocupado</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className="admin-heat-swatch" data-heat={l} />
            ))}
            <span>Casi lleno</span>
            <span className="admin-heat-swatch" data-heat="closed" style={{ marginLeft: 12 }} />{" "}
            <span>Cerrado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
