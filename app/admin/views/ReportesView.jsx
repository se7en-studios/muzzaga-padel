"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
} from "lucide-react";
import { adminGetReport } from "../actions";
import { isoAddDays, isoWeekday, todayInClub } from "../../../lib/booking";
import { trendPct } from "../../../lib/metrics";
import { formatARS, formatDate, formatPct, plural } from "../../../lib/format";
import { EmptyState, SkeletonCards, SkeletonRows } from "../ui/states";
import { PAYMENT_METHODS } from "../adminHelpers";
import DailyChart from "./reportes/DailyChart";

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true };
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
const WEEKDAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MODES = [
  { id: "mes", label: "Mes" },
  { id: "semana", label: "Semana" },
  { id: "rango", label: "Rango" },
];

function monthRange(year, month) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: isoAddDays(from, days - 1) };
}

/** Semana lunes–domingo que contiene `iso`. */
function weekRange(iso) {
  const from = isoAddDays(iso, -((isoWeekday(iso) + 6) % 7));
  return { from, to: isoAddDays(from, 6) };
}

function Delta({
  current,
  previous,
  goodWhenDown = false,
  points = false,
  title = "vs. período anterior",
}) {
  if (previous == null || current == null) return null;
  const value = points
    ? Math.round((current - previous) * 10) / 10
    : trendPct(current, previous);
  if (!value) return null;
  const up = value > 0;
  const good = goodWhenDown ? !up : up;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={`admin-kpi-trend ${good ? "up" : "down"}`}
      title={title}
    >
      <Icon size={12} strokeWidth={2} aria-hidden />
      {up ? "+" : "-"}
      {Math.abs(value).toLocaleString("es-AR")}
      {points ? " pts" : "%"}
    </span>
  );
}

function csvDownload(filename, rows) {
  const csv = rows
    .map((r) =>
      r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportesView({ onExpiredSession }) {
  const today = todayInClub();
  const [mode, setMode] = useState("mes");
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [custom, setCustom] = useState({
    from: isoAddDays(today, -29),
    to: today,
  });
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const period = useMemo(() => {
    if (mode === "semana") return weekRange(weekAnchor);
    if (mode === "rango") return custom;
    return monthRange(year, month);
  }, [mode, year, month, weekAnchor, custom]);

  useEffect(() => {
    if (!period.from || !period.to || period.from > period.to) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    adminGetReport(period.from, period.to).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) setReport(res);
      else if (!onExpiredSession?.(res))
        setError(res.error || "No se pudo armar el reporte.");
    });
    return () => {
      cancelled = true;
    };
  }, [period.from, period.to]);

  function exportCsv() {
    csvDownload(`muzzaga-reporte-${period.from}_${period.to}.csv`, [
      [
        "Fecha",
        "Turnos",
        "Cobrado turnos",
        "Cantina",
        "Cobrado total",
        "Facturado turnos",
        "Por cobrar",
        "Cupos",
        "Ocupación %",
      ],
      ...report.days.map((d) => [
        d.date,
        d.turnos,
        d.cobradoTurnos,
        d.cantina,
        d.cobrado,
        d.facturadoTurnos,
        d.porCobrar,
        d.totalSlots,
        d.ocupacionPct ?? "",
      ]),
    ]);
  }


  return (
    <div className="admin-report">
      <div className="admin-view-toolbar admin-no-print">
        <div className="admin-period">
          <div
            className="admin-segmented"
            role="group"
            aria-label="Tipo de período"
          >
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "mes" && (
            <div className="admin-period-controls">
              <select
                aria-label="Mes"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Año"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {[year - 2, year - 1, year, year + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === "semana" && (
            <div className="admin-period-controls">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setWeekAnchor(isoAddDays(weekAnchor, -7))}
                aria-label="Semana anterior"
              >
                <ChevronLeft {...ICON} />
              </button>
              <strong>
                {formatDate(period.from)} al {formatDate(period.to)}
              </strong>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setWeekAnchor(isoAddDays(weekAnchor, 7))}
                aria-label="Semana siguiente"
              >
                <ChevronRight {...ICON} />
              </button>
            </div>
          )}

          {mode === "rango" && (
            <div className="admin-period-controls">
              <input
                type="date"
                aria-label="Desde"
                value={custom.from}
                max={custom.to}
                onChange={(e) =>
                  e.target.value &&
                  setCustom((c) => ({ ...c, from: e.target.value }))
                }
              />
              <span aria-hidden>a</span>
              <input
                type="date"
                aria-label="Hasta"
                value={custom.to}
                min={custom.from}
                onChange={(e) =>
                  e.target.value &&
                  setCustom((c) => ({ ...c, to: e.target.value }))
                }
              />
            </div>
          )}
        </div>

        <div className="admin-view-toolbar-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportCsv}
            disabled={!report}
          >
            <Download {...ICON} /> CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
            disabled={!report}
          >
            <Printer {...ICON} /> PDF
          </button>
        </div>
      </div>

      {/* Encabezado ejecutivo para impresión PDF */}
      <div
        className="admin-print-only"
        style={{
          borderBottom: "2px solid #ea580c",
          paddingBottom: 14,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: 20, margin: 0, fontWeight: 800, color: "#141412", letterSpacing: "0.02em" }}>
              MUZZAGA PÁDEL CLUB · REPORTE EJECUTIVO
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#4a473f" }}>
              Período auditado: {formatDate(period.from, "long")} al {formatDate(period.to, "long")}
            </p>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "#4a473f" }}>
            <div>Emisión: {formatDate(today, "long")}</div>
            <div style={{ color: "#ea580c", fontWeight: 600 }}>Sistema Muzzaga Admin</div>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="admin-settings-card"
          style={{ color: "#b91c1c" }}
        >
          {error}
        </div>
      )}

      {!report && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SkeletonCards count={4} />
          <SkeletonRows count={1} height={240} />
        </div>
      )}

      {report && <ReportContent report={report} loading={loading} />}
    </div>
  );
}

/** "Noviembre 2026" si el período es un mes entero; si no, "16/11 al 22/11". */
function periodName(from, to) {
  const [y, m] = from.split("-").map(Number);
  const full = monthRange(y, m);
  if (from === full.from && to === full.to) return `${MONTH_NAMES[m - 1]} ${y}`;
  return `${formatDate(from)} al ${formatDate(to)}`;
}

/** Para armar la frase: "en octubre 2026" o "del 02/10 al 31/10". */
function periodPhrase(from, to) {
  const name = periodName(from, to);
  return /^\d/.test(name) ? `del ${name}` : `en ${name.toLowerCase()}`;
}

/**
 * Cuerpo del reporte. Arriba la respuesta a "¿cómo me fue?" en grande; abajo
 * el detalle (días, horarios, medios de pago, rankings).
 */
export function ReportContent({ report, loading }) {
  const t = report.totals;
  const p = report.previousTotals;
  const heat = report.heatmap;
  const mixTotal = report.paymentMix.reduce((s, m) => s + m.amount, 0) || 0;
  const methodLabel = (m) =>
    PAYMENT_METHODS.find((x) => x.value === m)?.label || m;

  // Si el período no terminó, comparar el total contra un período completo
  // engaña (parece que se vendió menos). En ese caso se compara el promedio
  // por día transcurrido, que sí es justo.
  const today = todayInClub();
  const totalDays = report.days.length;
  const elapsed = report.days.filter((d) => d.date <= today).length;
  const inProgress = elapsed > 0 && elapsed < totalDays;
  const notStarted = elapsed === 0;
  const prevName = periodPhrase(report.previous.from, report.previous.to);
  const perDay = (total, n) => (n > 0 ? total / n : 0);
  const cur = inProgress ? perDay(t.cobrado, elapsed) : t.cobrado;
  const prev = inProgress ? perDay(p.cobrado, totalDays) : p.cobrado;
  const change = trendPct(cur, prev);
  const turnosShare = t.cobrado > 0 ? (t.cobradoTurnos / t.cobrado) * 100 : 0;

  return (
        <div className={loading ? "admin-content-loading" : ""}>
          <section className="rp-hero" aria-label="Cómo fue el período">
            <div className="rp-hero-main">
              <span className="rp-hero-kicker">
                {periodName(report.from, report.to)}
                {inProgress && ` · van ${elapsed} de ${totalDays} días`}
              </span>
              <span className="rp-hero-label">Cobraste</span>
              <strong className="rp-hero-amount">{formatARS(t.cobrado)}</strong>
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
                </span>
                <span className="is-cantina">
                  Cantina <strong>{formatARS(t.cantina)}</strong>
                </span>
              </div>
            </div>

            <div className="rp-hero-side">
              {notStarted ? (
                <p className="rp-verdict-text">
                  Este período todavía no empezó.
                </p>
              ) : change == null ? (
                <p className="rp-verdict-text">
                  {p.cobrado > 0
                    ? "Igual que el período anterior."
                    : `Sin cobros ${prevName} para comparar.`}
                </p>
              ) : (
                <>
                  <span
                    className={`rp-verdict ${change > 0 ? "is-up" : "is-down"}`}
                  >
                    {change > 0 ? (
                      <ArrowUp size={18} strokeWidth={2.5} aria-hidden />
                    ) : (
                      <ArrowDown size={18} strokeWidth={2.5} aria-hidden />
                    )}
                    {Math.abs(change).toLocaleString("es-AR")}%{" "}
                    {change > 0 ? "más" : "menos"}
                  </span>
                  <p className="rp-verdict-text">
                    {inProgress ? (
                      <>
                        Por día: <strong>{formatARS(cur)}</strong> contra{" "}
                        {formatARS(prev)} {prevName}.
                      </>
                    ) : (
                      <>
                        Contra <strong>{formatARS(prev)}</strong>{" "}
                        {prevName}.
                      </>
                    )}
                  </p>
                </>
              )}
              {inProgress && (
                <p className="rp-hero-note">
                  El período no terminó: se compara el promedio por día, no el
                  total.
                </p>
              )}
            </div>
          </section>

          <div className="admin-kpis-3 rp-kpis">
            <div className="admin-kravio-kpi-card">
              <div className="admin-kravio-kpi-header">
                <span className="admin-kravio-kpi-title">Turnos jugados</span>
                {inProgress ? (
                  <Delta
                    current={perDay(t.turnos, elapsed)}
                    previous={perDay(p.turnos, totalDays)}
                    title="Promedio por día vs. período anterior"
                  />
                ) : (
                  <Delta current={t.turnos} previous={p.turnos} />
                )}
              </div>
              <div className="admin-kravio-kpi-content">
                <div className="admin-kravio-kpi-left">
                  <div className="admin-kravio-kpi-number">{t.turnos}</div>
                  <span className="admin-cell-sub">
                    {elapsed > 0 &&
                      `${(t.turnos / elapsed).toLocaleString("es-AR", { maximumFractionDigits: 1 })} por día · `}
                    facturado {formatARS(t.facturadoTurnos)}
                  </span>
                </div>
              </div>
            </div>

            <div className="admin-kravio-kpi-card">
              <div className="admin-kravio-kpi-header">
                <span className="admin-kravio-kpi-title">Ocupación de canchas</span>
                <Delta current={t.ocupacionPct} previous={p.ocupacionPct} points />
              </div>
              <div className="admin-kravio-kpi-content">
                <div className="admin-kravio-kpi-left">
                  <div className="admin-kravio-kpi-number">
                    {formatPct(t.ocupacionPct)}
                  </div>
                  {t.ocupacionPct != null && (
                    <span className="rp-meter" aria-hidden>
                      <span style={{ width: `${Math.min(100, t.ocupacionPct)}%` }} />
                    </span>
                  )}
                  <span className="admin-cell-sub">
                    De los cupos de los días abiertos hasta hoy
                  </span>
                </div>
              </div>
            </div>

            <div className="admin-kravio-kpi-card">
              <div className="admin-kravio-kpi-header">
                <span className="admin-kravio-kpi-title">Por cobrar</span>
                <Delta current={t.porCobrar} previous={p.porCobrar} goodWhenDown />
              </div>
              <div className="admin-kravio-kpi-content">
                <div className="admin-kravio-kpi-left">
                  <div
                    className="admin-kravio-kpi-number"
                    style={{ color: t.porCobrar > 0 ? "#c2410c" : undefined }}
                  >
                    {formatARS(t.porCobrar)}
                  </div>
                  <span className="admin-cell-sub">
                    {t.pagadosSinCobro > 0
                      ? `Ojo: ${plural(t.pagadosSinCobro, "turno marcado pagado sin cobro cargado", "turnos marcados pagados sin cobro cargado")}`
                      : t.porCobrar > 0
                        ? "Saldos de turnos y cuentas de cantina"
                        : "Todo cobrado"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <section className="admin-report-section">
            <h3 className="admin-section-title">Plata que entró cada día</h3>
            <div className="admin-kravio-table-card rp-chart-card">
              <DailyChart days={report.days} today={today} />
            </div>
          </section>

          <section className="admin-report-section">
            <h3 className="admin-section-title">Ocupación por día y horario</h3>
            <p className="admin-field-hint" style={{ marginTop: -6 }}>
              Qué franjas se llenan y cuáles quedan vacías: la base para definir
              precios de horario pico.
            </p>
            {heat.weekdays.length > 0 && (
              <div className="rp-heat-legend" aria-hidden>
                <span>Vacío</span>
                {[0, 1, 2, 3, 4].map((l) => (
                  <i key={l} data-heat={l} />
                ))}
                <span>Lleno</span>
              </div>
            )}
            {heat.weekdays.length === 0 ? (
              <div className="admin-settings-card">
                <EmptyState
                  icon={BarChart3}
                  mascot="pelota-padel-life"
                  title="Todavía no hay días transcurridos en el período"
                />
              </div>
            ) : (
              <div className="admin-kravio-table-card admin-heat-table-wrap" style={{ padding: 16 }}>
                <table className="admin-heat-table">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">Día</span>
                      </th>
                      {heat.starts.map((s) => (
                        <th key={s} scope="col">
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heat.weekdays.map((wd) => (
                      <tr key={wd}>
                        <th scope="row">{WEEKDAY_NAMES[wd]}</th>
                        {heat.starts.map((s) => {
                          const c = heat.cells[`${wd}|${s}`];
                          if (!c?.available)
                            return <td key={s} data-heat="closed" />;
                          const pct = Math.round(
                            (c.booked / c.available) * 100,
                          );
                          const level =
                            pct === 0
                              ? 0
                              : pct < 25
                                ? 1
                                : pct < 50
                                  ? 2
                                  : pct < 75
                                    ? 3
                                    : 4;
                          return (
                            <td
                              key={s}
                              data-heat={level}
                              title={`${WEEKDAY_NAMES[wd]} ${s}: ${c.booked} de ${c.available} cupos (${pct}%)`}
                            >
                              {pct}%
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="admin-report-grid">
            <section className="admin-report-section">
              <h3 className="admin-section-title">Métodos de pago</h3>
              <div className="admin-kravio-table-card" style={{ padding: 20 }}>
                {mixTotal === 0 ? (
                  <p className="admin-field-hint">Sin cobros en el período.</p>
                ) : (
                  <>
                    <div
                      className="admin-mix-bar"
                      role="img"
                      aria-label="Distribución de cobros por método"
                    >
                      {report.paymentMix.map((m) => (
                        <span
                          key={m.method}
                          data-method={m.method}
                          style={{ width: `${m.pct}%` }}
                        />
                      ))}
                    </div>
                    <ul className="admin-mix-list">
                      {report.paymentMix.map((m) => (
                        <li key={m.method} data-method={m.method}>
                          <span>{methodLabel(m.method)}</span>
                          <strong>{formatARS(m.amount)}</strong>
                          <span className="admin-cell-sub">
                            {formatPct(m.pct)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>

            <section className="admin-report-section">
              <h3 className="admin-section-title">Top productos de cantina</h3>
              <div className="admin-kravio-table-card" style={{ overflow: "hidden" }}>
                <table className="admin-kravio-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Unidades</th>
                      <th style={{ textAlign: "right" }}>Vendido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topProducts.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="admin-field-hint" style={{ textAlign: "center", padding: 20 }}>
                          Sin ventas en el período.
                        </td>
                      </tr>
                    ) : (
                      report.topProducts.map((row) => (
                        <tr key={row.name}>
                          <td data-label="Producto">
                            <strong>{row.name}</strong>
                            <span className="rp-rank-bar is-money" aria-hidden>
                              <span style={{ width: `${(row.revenue / (report.topProducts[0]?.revenue || 1)) * 100}%` }} />
                            </span>
                          </td>
                          <td data-label="Unidades">{row.qty} un.</td>
                          <td data-label="Vendido" style={{ textAlign: "right", fontWeight: 700, color: "#15803d" }}>
                            {formatARS(row.revenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-report-section">
              <h3 className="admin-section-title">Top clientes</h3>
              <div className="admin-kravio-table-card" style={{ overflow: "hidden" }}>
                <table className="admin-kravio-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Turnos</th>
                      <th style={{ textAlign: "right" }}>Facturado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topClients.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="admin-field-hint" style={{ textAlign: "center", padding: 20 }}>
                          Sin turnos en el período.
                        </td>
                      </tr>
                    ) : (
                      report.topClients.map((row) => (
                        <tr key={row.key}>
                          <td data-label="Cliente">
                            <strong>{row.name}</strong>
                            <span className="rp-rank-bar" aria-hidden>
                              <span style={{ width: `${(row.turnos / (Math.max(...report.topClients.map((c) => c.turnos)) || 1)) * 100}%` }} />
                            </span>
                          </td>
                          <td data-label="Turnos">{row.turnos} turnos</td>
                          <td data-label="Facturado" style={{ textAlign: "right", fontWeight: 700, color: "var(--color-ink)" }}>
                            {formatARS(row.facturado)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Firmas de auditoría e impresión PDF */}
          <div
            className="admin-print-only"
            style={{
              marginTop: 40,
              paddingTop: 24,
              borderTop: "1px dashed #8a857a",
              pageBreakInside: "avoid",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 40,
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ height: 40 }} />
                <div style={{ borderTop: "1px solid #141412", paddingTop: 6, fontSize: 13, fontWeight: 700 }}>
                  Administración del Club
                </div>
                <span style={{ fontSize: 12, color: "#4a473f" }}>Firma y Sello</span>
              </div>
              <div>
                <div style={{ height: 40 }} />
                <div style={{ borderTop: "1px solid #141412", paddingTop: 6, fontSize: 13, fontWeight: 700 }}>
                  Responsable de Turnos &amp; Caja
                </div>
                <span style={{ fontSize: 12, color: "#4a473f" }}>Firma y Aclaración</span>
              </div>
              <div>
                <div style={{ height: 40 }} />
                <div style={{ borderTop: "1px solid #141412", paddingTop: 6, fontSize: 13, fontWeight: 700 }}>
                  Auditoría General
                </div>
                <span style={{ fontSize: 12, color: "#4a473f" }}>Conformidad</span>
              </div>
            </div>
          </div>
        </div>
  );
}
