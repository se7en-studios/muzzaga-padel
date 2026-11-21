"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Coins,
  Download,
  Gauge,
  HandCoins,
  Printer,
} from "lucide-react";
import { adminGetReport } from "../actions";
import { isoAddDays, isoWeekday, todayInClub } from "../../../lib/booking";
import { trendPct } from "../../../lib/metrics";
import { formatARS, formatDate, formatPct, plural } from "../../../lib/format";
import { EmptyState, SkeletonCards, SkeletonRows } from "../ui/states";
import DailyChart from "./reportes/DailyChart";
import Highlights from "./reportes/Highlights";
import OccupancyHeat from "./reportes/OccupancyHeat";
import ReportHero from "./reportes/ReportHero";
import { PaymentMix, TopClients, TopProducts } from "./reportes/Rankings";

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

function SectionHead({ title, hint }) {
  return (
    <header className="rp-section-head">
      <h3 className="admin-section-title">{title}</h3>
      {hint && <p>{hint}</p>}
    </header>
  );
}

/**
 * Cuerpo del reporte. Arriba la respuesta a "¿cómo me fue?" en grande; abajo
 * el detalle (días, horarios, medios de pago, rankings).
 */
export function ReportContent({ report, loading }) {
  const t = report.totals;
  const p = report.previousTotals;
  const heat = report.heatmap;

  // Si el período no terminó, comparar el total contra un período completo
  // engaña (parece que se vendió menos). En ese caso se compara el promedio
  // por día transcurrido, que sí es justo.
  const today = todayInClub();
  const totalDays = report.days.length;
  const elapsed = report.days.filter((d) => d.date <= today).length;
  const inProgress = elapsed > 0 && elapsed < totalDays;
  const notStarted = elapsed === 0;
  const name = periodName(report.from, report.to);
  const prevLabel = periodName(report.previous.from, report.previous.to);
  const prevName = periodPhrase(report.previous.from, report.previous.to);
  const perDay = (total, n) => (n > 0 ? total / n : 0);
  const cur = inProgress ? perDay(t.cobrado, elapsed) : t.cobrado;
  const prev = inProgress ? perDay(p.cobrado, totalDays) : p.cobrado;
  const change = trendPct(cur, prev);
  const hasData =
    t.cobrado > 0 || t.turnos > 0 || t.cantina > 0 || t.porCobrar > 0;

  return (
    <div className={`rp-body${loading ? " admin-content-loading" : ""}`}>
      <ReportHero
        name={name}
        prevLabel={prevLabel}
        prevName={prevName}
        totals={t}
        previousTotals={p}
        inProgress={inProgress}
        notStarted={notStarted}
        elapsed={elapsed}
        totalDays={totalDays}
        cur={cur}
        prev={prev}
        change={change}
      />

      {!hasData ? (
        <section className="rp-empty">
          <EmptyState
            icon={BarChart3}
            mascot={notStarted ? "descanso-mate" : "pelota-padel-life"}
            title={
              notStarted
                ? "Este período todavía no empezó"
                : `Todavía no hay movimientos ${periodPhrase(report.from, report.to)}`
            }
            text={
              notStarted
                ? "Cuando arranque, acá vas a ver cuánta plata entró cada día y qué horarios se llenan."
                : "Cuando se carguen cobros en la Agenda y ventas en la Cantina, acá vas a ver cuánta plata entró cada día, qué horarios se llenan y quiénes juegan más."
            }
          />
        </section>
      ) : (
        <>
          <div className="rp-kpis">
            <article className="rp-kpi is-court">
              <header>
                <span className="rp-kpi-icon" aria-hidden>
                  <CalendarCheck size={18} strokeWidth={2} />
                </span>
                <span className="rp-kpi-title">Turnos jugados</span>
                {inProgress ? (
                  <Delta
                    current={perDay(t.turnos, elapsed)}
                    previous={perDay(p.turnos, totalDays)}
                    title="Promedio por día vs. período anterior"
                  />
                ) : (
                  <Delta current={t.turnos} previous={p.turnos} />
                )}
              </header>
              <strong className="rp-kpi-number">{t.turnos}</strong>
              <span className="rp-kpi-sub">
                {elapsed > 0 &&
                  `${(t.turnos / elapsed).toLocaleString("es-AR", { maximumFractionDigits: 1 })} por día · `}
                facturado {formatARS(t.facturadoTurnos)}
              </span>
            </article>

            <article className="rp-kpi is-court">
              <header>
                <span className="rp-kpi-icon" aria-hidden>
                  <Gauge size={18} strokeWidth={2} />
                </span>
                <span className="rp-kpi-title">Canchas ocupadas</span>
                <Delta current={t.ocupacionPct} previous={p.ocupacionPct} points />
              </header>
              <strong className="rp-kpi-number">{formatPct(t.ocupacionPct)}</strong>
              {t.ocupacionPct != null && (
                <span className="rp-meter" aria-hidden>
                  <span style={{ width: `${Math.min(100, t.ocupacionPct)}%` }}>
                    <i />
                  </span>
                </span>
              )}
              <span className="rp-kpi-sub">
                De los turnos que se podían reservar hasta hoy
              </span>
            </article>

            <article className="rp-kpi is-money">
              <header>
                <span className="rp-kpi-icon" aria-hidden>
                  <Coins size={18} strokeWidth={2} />
                </span>
                <span className="rp-kpi-title">Promedio por día</span>
              </header>
              <strong className="rp-kpi-number">
                {formatARS(Math.round(perDay(t.cobrado, elapsed)))}
              </strong>
              <span className="rp-kpi-sub">
                {elapsed > 0
                  ? `Lo cobrado repartido en ${plural(elapsed, "día", "días")}`
                  : "Todavía no pasó ningún día"}
              </span>
            </article>

            <article className={`rp-kpi ${t.porCobrar > 0 ? "is-owe" : "is-money"}`}>
              <header>
                <span className="rp-kpi-icon" aria-hidden>
                  <HandCoins size={18} strokeWidth={2} />
                </span>
                <span className="rp-kpi-title">Por cobrar</span>
                <Delta current={t.porCobrar} previous={p.porCobrar} goodWhenDown />
              </header>
              <strong className="rp-kpi-number">{formatARS(t.porCobrar)}</strong>
              <span className="rp-kpi-sub">
                {t.pagadosSinCobro > 0
                  ? `Ojo: ${plural(t.pagadosSinCobro, "turno marcado pagado sin cobro cargado", "turnos marcados pagados sin cobro cargado")}`
                  : t.porCobrar > 0
                    ? "Saldos de turnos y cuentas de cantina"
                    : "Todo cobrado"}
              </span>
            </article>
          </div>

          <Highlights days={report.days} heat={heat} today={today} />

          <section className="admin-report-section rp-section">
            <SectionHead
              title="Plata que entró cada día"
              hint="Cada barra es un día: verde oscuro lo de los turnos, verde claro lo de la cantina."
            />
            <div className="rp-card rp-chart-card">
              <DailyChart days={report.days} today={today} />
            </div>
          </section>

          <section className="admin-report-section rp-section">
            <SectionHead
              title="Qué horarios se llenan"
              hint="Cada cuadradito es un día y un horario: cuanto más azul, más canchas ocupadas. Sirve para decidir el precio de horario pico o dónde hacer promos."
            />
            {heat.weekdays.length === 0 ? (
              <div className="rp-card">
                <EmptyState
                  icon={BarChart3}
                  mascot="pelota-padel-life"
                  title="Todavía no hay días transcurridos en el período"
                />
              </div>
            ) : (
              <div className="rp-card rp-heat-card">
                <OccupancyHeat heat={heat} />
              </div>
            )}
          </section>

          <div className="rp-panels">
            <PaymentMix mix={report.paymentMix} />
            <TopProducts rows={report.topProducts} />
            <TopClients rows={report.topClients} />
          </div>
        </>
      )}
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
