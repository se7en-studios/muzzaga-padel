"use client";

import { useEffect, useState } from "react";
import {
  Coins,
  Download,
  Lock,
  LockOpen,
  Receipt,
  Scale,
  Send,
  Trash2,
} from "lucide-react";
import { EmptyState, SkeletonCards, SkeletonRows } from "../ui/states";
import StaffPinModal from "../ui/StaffPinModal";
import KpiCard, { KpiGrid } from "../ui/KpiCard";
import { formatARS, formatDate, formatTime, plural } from "../../../lib/format";
import { cashDiffTone } from "../../../lib/metrics";
import {
  adminAddCashExpense,
  adminCloseDailyCash,
  adminDeleteCashExpense,
  adminGetCashHistory,
  adminGetDailyCashSummary,
  adminReopenDailyCash,
} from "../actions";
import { businessDayInClub, todayInClub, isoAddDays } from "../../../lib/booking";
import { JornadaNote } from "../adminHelpers";
import { CLUB_INFO } from "../../../data/club";

const ICON = { size: 18, strokeWidth: 1.75, "aria-hidden": true };
const BILL_DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 200, 100];
const CATEGORIES = [
  { id: "hielo", label: "Hielo" },
  { id: "limpieza", label: "Limpieza" },
  { id: "mantenimiento", label: "Mantenimiento" },
  { id: "otros", label: "Otros" },
];
const categoryLabel = (id) =>
  CATEGORIES.find((c) => c.id === id)?.label || "Otros";
const DIFF_TEXT = {
  ok: "Cuadra exacto",
  minor: "Diferencia chica",
  major: "Diferencia grande: revisá antes de cerrar",
};
const EMPTY_BILLS = Object.fromEntries(BILL_DENOMINATIONS.map((d) => [d, ""]));

function diffLabel(diff) {
  if (!diff) return "$0";
  return `${formatARS(diff, { signed: true })} ${diff > 0 ? "sobrante" : "faltante"}`;
}

function downloadCsv(filename, rows) {
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

export default function CajaView({ initialDate, onExpiredSession, onToast }) {
  const [date, setDate] = useState(() => initialDate || businessDayInClub());
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [expense, setExpense] = useState({
    category: "hielo",
    concept: "",
    amount: "",
    notes: "",
  });
  const [addingExpense, setAddingExpense] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState(null);

  const [counted, setCounted] = useState("");
  const [showBillCalc, setShowBillCalc] = useState(false);
  const [billCounts, setBillCounts] = useState(EMPTY_BILLS);
  const [closingNotes, setClosingNotes] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  function handleBillChange(denom, val) {
    const nextCounts = { ...billCounts, [denom]: val };
    setBillCounts(nextCounts);
    const total = BILL_DENOMINATIONS.reduce((sum, d) => {
      const qty = parseInt(nextCounts[d], 10) || 0;
      return sum + d * qty;
    }, 0);
    setCounted(total > 0 ? String(total) : "");
  }

  // Al cambiar de día, el conteo y las notas del día anterior no aplican.
  useEffect(() => {
    setBillCounts(EMPTY_BILLS);
    setShowBillCalc(false);
    setClosingNotes("");
    loadSummary();
  }, [date]);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadSummary() {
    setLoading(true);
    setLoadError("");
    const res = await adminGetDailyCashSummary(date);
    setLoading(false);
    if (res.ok) {
      setSummary(res.summary);
      setCounted(
        res.summary.actualCash != null ? String(res.summary.actualCash) : "",
      );
    } else if (!onExpiredSession?.(res)) {
      setSummary(null);
      setLoadError(res.error || "No se pudo calcular la caja del día.");
    }
  }

  async function loadHistory() {
    const res = await adminGetCashHistory(30);
    if (res.ok) setHistory(res.sessions);
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    setAddingExpense(true);
    const concept = expense.concept.trim() || categoryLabel(expense.category);
    const res = await adminAddCashExpense({ date, ...expense, concept });
    setAddingExpense(false);
    if (res.ok) {
      onToast?.(
        `Egreso cargado · ${concept} · ${formatARS(-Number(expense.amount))}`,
      );
      setExpense((x) => ({ ...x, concept: "", amount: "", notes: "" }));
      loadSummary();
    } else if (!onExpiredSession?.(res)) {
      onToast?.(res.error || "No se pudo registrar el egreso.", {
        tone: "error",
      });
    }
  }

  async function handleClose({ pin, notes }) {
    const res = await adminCloseDailyCash({
      date,
      actualCash: counted,
      notes,
      pin,
    });
    if (!res.ok) {
      if (onExpiredSession?.(res)) return;
      throw new Error(res.error || "No se pudo cerrar la caja.");
    }
    setIsClosing(false);
    onToast?.(`Caja cerrada por ${res.staff} · ${diffLabel(res.difference)}`);
    loadSummary();
    loadHistory();
  }

  async function handleReopen({ pin, reason }) {
    const res = await adminReopenDailyCash({ date, pin, reason });
    if (!res.ok) {
      if (onExpiredSession?.(res)) return;
      throw new Error(res.error || "No se pudo reabrir la caja.");
    }
    setIsReopening(false);
    onToast?.(`Caja reabierta por ${res.staff}`);
    loadSummary();
    loadHistory();
  }

  function shareWhatsApp() {
    if (!summary) return;
    const lines = [
      `📊 *CIERRE DE CAJA MUZZAGA PÁDEL*`,
      `📅 ${formatDate(date, "long")}`,
      "",
      `💰 *EFECTIVO*`,
      `• Turnos: ${formatARS(summary.cashTurnos)}`,
      `• Cantina: ${formatARS(summary.cashCantina)}`,
      `• Egresos: ${formatARS(-summary.totalExpenses)}`,
      `👉 *Esperado en cajón: ${formatARS(summary.expectedCash)}*`,
      `👉 *Contado: ${formatARS(summary.actualCash || 0)}*`,
      `⚖️ *Diferencia:* ${diffLabel(summary.difference ?? 0)}`,
      "",
      `🏦 Transferencias: ${formatARS(summary.transferTurnos + summary.transferCantina)}`,
      `💳 Mercado Pago: ${formatARS(summary.mpTurnos + summary.mpCantina)}`,
      summary.notes ? `\n📝 ${summary.notes}` : "",
      summary.closedBy
        ? `\nCerró: ${summary.closedBy} a las ${formatTime(summary.closedAt)}`
        : "",
    ];
    window.open(
      `https://wa.me/${CLUB_INFO.phoneRaw}?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
      "noopener",
    );
  }

  function exportHistory() {
    downloadCsv(`muzzaga-cierres-${todayInClub()}.csv`, [
      ["Fecha", "Esperado", "Contado", "Diferencia", "Cerró", "Hora", "Notas"],
      ...(history || []).map((h) => [
        h.date,
        h.expectedCash,
        h.actualCash,
        h.difference,
        h.closedBy || "",
        h.closedAt ? formatTime(h.closedAt) : "",
        h.notes || "",
      ]),
    ]);
  }

  const header = (
    <div className="admin-view-toolbar">
      <h2 className="admin-section-title admin-m0">
        Arqueo del {formatDate(date, "long")}
      </h2>
      <div className="admin-view-toolbar-actions">
        <button
          type="button"
          className="btn btn-secondary admin-btn-sm"
          onClick={() => setDate(isoAddDays(businessDayInClub(), -1))}
        >
          Ayer
        </button>
        <button
          type="button"
          className={`btn admin-btn-sm ${date === businessDayInClub() ? "btn-linear-primary" : "btn-secondary"}`}
          onClick={() => setDate(businessDayInClub())}
        >
          Hoy
        </button>
        <input
          type="date"
          aria-label="Fecha de la caja"
          value={date}
          max={todayInClub()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="admin-date-sm"
        />
      </div>
      <JornadaNote date={date} />
    </div>
  );

  if (!summary) {
    return (
      <div>
        {header}
        {loadError ? (
          <div role="alert" className="admin-settings-card admin-error-card">
            <span>{loadError}</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadSummary}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <SkeletonCards count={4} />
        )}
      </div>
    );
  }

  const isClosed = summary.closed;
  const liveDiff =
    counted === "" ? null : Number(counted) - summary.expectedCash;
  const tone = liveDiff == null ? null : cashDiffTone(liveDiff);

  return (
    <div className={loading ? "admin-content-loading" : ""}>
      {header}

      {isClosed && (
        <div className="admin-closed-banner" role="status">
          <Lock {...ICON} />
          <div>
            <strong>
              Cerrado{summary.closedBy ? ` por ${summary.closedBy}` : ""} a las{" "}
              {formatTime(summary.closedAt)}
            </strong>
            <span>
              Contado {formatARS(summary.actualCash || 0)} ·{" "}
              {diffLabel(summary.difference ?? 0)}. El día queda bloqueado: no
              se pueden cargar ni borrar cobros, ventas ni egresos. Para
              corregir algo, reabrí la caja con PIN de encargado.
            </span>
          </div>
          <div className="admin-closed-banner-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={shareWhatsApp}
            >
              <Send {...ICON} /> WhatsApp
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsReopening(true)}
            >
              <LockOpen {...ICON} /> Reabrir caja
            </button>
          </div>
        </div>
      )}

      {!isClosed && summary.reopenedBy && (
        <div className="admin-reopen-banner" role="status">
          <LockOpen {...ICON} />
          <span>
            Caja reabierta por <strong>{summary.reopenedBy}</strong>
            {summary.reopenedAt ? ` a las ${formatTime(summary.reopenedAt)}` : ""}
            {summary.reopenReason ? ` · ${summary.reopenReason}` : ""}. Volvé a
            cerrarla cuando termines la corrección.
          </span>
        </div>
      )}

      <KpiGrid>
        <KpiCard
          title="Efectivo turnos"
          icon={Coins}
          tone="success"
          value={formatARS(summary.cashTurnos)}
          sub="Cobrado en mano por turnos"
        />
        <KpiCard
          title="Efectivo cantina"
          icon={Receipt}
          tone="brand"
          value={formatARS(summary.cashCantina)}
          sub="Ventas del tercer tiempo"
        />
        <KpiCard
          title="Egresos"
          icon={Receipt}
          tone={summary.totalExpenses > 0 ? "danger" : "default"}
          value={formatARS(-summary.totalExpenses)}
          sub="Hielo, limpieza y mantenimiento"
        />
        <KpiCard
          title="Esperado en cajón"
          icon={Scale}
          tone="dark"
          value={formatARS(summary.expectedCash)}
          sub="Efectivo físico a controlar"
        />
      </KpiGrid>
      <p className="admin-field-hint admin-cash-outside">
        Fuera del cajón: Transferencias{" "}
        {formatARS(summary.transferTurnos + summary.transferCantina)} · Mercado
        Pago {formatARS(summary.mpTurnos + summary.mpCantina)}
      </p>

      <div className="admin-cash-grid">
        {/* EGRESOS */}
        <section className="admin-settings-card">
          <h3 className="admin-section-title">
            <Receipt {...ICON} /> Egresos del día
          </h3>

          {!isClosed && (
            <form onSubmit={handleAddExpense} className="admin-expense-form">
              <div
                className="admin-segmented"
                role="group"
                aria-label="Categoría del egreso"
              >
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={expense.category === c.id}
                    onClick={() =>
                      setExpense((x) => ({ ...x, category: c.id }))
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="admin-field-row">
                <div className="admin-field">
                  <label className="admin-field-label" htmlFor="exp-concept">
                    Detalle
                  </label>
                  <input
                    id="exp-concept"
                    type="text"
                    placeholder={`ej. ${categoryLabel(expense.category)} para la cantina`}
                    value={expense.concept}
                    onChange={(e) =>
                      setExpense((x) => ({ ...x, concept: e.target.value }))
                    }
                  />
                </div>
                <div className="admin-field">
                  <label className="admin-field-label" htmlFor="exp-amount">
                    Monto ($)
                  </label>
                  <input
                    id="exp-amount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    required
                    value={expense.amount}
                    onChange={(e) =>
                      setExpense((x) => ({ ...x, amount: e.target.value }))
                    }
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={addingExpense || !expense.amount}
              >
                {addingExpense ? "Cargando…" : "Cargar egreso"}
              </button>
            </form>
          )}

          {summary.expensesList.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Sin egresos este día"
              text={
                isClosed
                  ? "No se registraron salidas de dinero."
                  : "Cargá lo que sale del cajón (hielo, limpieza, cambio) para que el arqueo cuadre."
              }
            />
          ) : (
            <ul className="admin-expense-list">
              {summary.expensesList.map((x) => (
                <li key={x.id} className="admin-expense-row">
                  <div className="admin-expense-main">
                    <span className="admin-tag">{categoryLabel(x.category)}</span>
                    <span className="admin-expense-concept">
                      {x.concept}
                      {x.notes && <small> · {x.notes}</small>}
                    </span>
                  </div>
                  <div className="admin-expense-side">
                    <strong className="is-negative">
                      {formatARS(-x.amount)}
                    </strong>
                    {!isClosed && (
                      <button
                        type="button"
                        className="admin-icon-btn-ghost"
                        title="Eliminar egreso (requiere PIN)"
                        aria-label={`Eliminar egreso ${x.concept}`}
                        onClick={() => setDeletingExpense(x)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ARQUEO */}
        <section className="admin-settings-card">
          <h3 className="admin-section-title">
            <Scale {...ICON} /> Arqueo y cierre
          </h3>
          <div className="admin-field">
            <label className="admin-field-label" htmlFor="cash-counted">
              Efectivo contado en el cajón ($)
            </label>
            <input
              id="cash-counted"
              type="number"
              inputMode="numeric"
              min={0}
              className="admin-input-lg"
              placeholder="Contá los billetes y poné el total"
              value={counted}
              readOnly={isClosed}
              onChange={(e) => setCounted(e.target.value)}
            />
            {!isClosed && (
              <div className="admin-bill-calc-wrap">
                <button
                  type="button"
                  className="btn btn-secondary admin-btn-xs"
                  aria-expanded={showBillCalc}
                  onClick={() => setShowBillCalc((v) => !v)}
                >
                  <Coins size={14} aria-hidden />
                  <span>
                    {showBillCalc
                      ? "Ocultar desglose"
                      : "Contar por billetes ($20k, $10k, $2k…)"}
                  </span>
                </button>

                {showBillCalc && (
                  <div className="admin-bill-calc">
                    {BILL_DENOMINATIONS.map((denom) => (
                      <label key={denom} className="admin-bill-field">
                        <span>{formatARS(denom)}</span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          placeholder="Cant."
                          value={billCounts[denom]}
                          onChange={(e) =>
                            handleBillChange(denom, e.target.value)
                          }
                        />
                      </label>
                    ))}
                    <div className="admin-bill-calc-foot">
                      <button
                        type="button"
                        className="admin-link-danger"
                        onClick={() => {
                          setBillCounts(EMPTY_BILLS);
                          setCounted("");
                        }}
                      >
                        Limpiar contador
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {liveDiff != null && (
            <div
              className="admin-cash-diff"
              data-tone={tone}
              role="status"
              aria-live="polite"
            >
              <span>{DIFF_TEXT[tone]}</span>
              <strong>{diffLabel(liveDiff)}</strong>
            </div>
          )}

          {!isClosed && (
            <>
              <div className="admin-field">
                <label className="admin-field-label" htmlFor="cash-notes">
                  Observaciones
                </label>
                <textarea
                  id="cash-notes"
                  rows={2}
                  placeholder="ej. Quedaron $10.000 de cambio para mañana"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-linear-primary admin-btn-block"
                disabled={counted === ""}
                onClick={() => setIsClosing(true)}
              >
                <Lock {...ICON} /> Cerrar caja del día
              </button>
            </>
          )}
        </section>
      </div>

      {/* HISTORIAL */}
      <section className="admin-cash-history">
        <div className="admin-view-toolbar">
          <h2 className="admin-section-title admin-m0">
            Cierres anteriores
          </h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportHistory}
            disabled={!history?.length}
          >
            <Download {...ICON} /> Exportar CSV
          </button>
        </div>
        {!history ? (
          <SkeletonRows count={4} />
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Esperado</th>
                  <th>Contado</th>
                  <th>Diferencia</th>
                  <th>Cerró</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <EmptyState
                        icon={Lock}
                        title="Todavía no hay cierres"
                        text="Cada vez que cierres la caja del día queda registrada acá."
                      />
                    </td>
                  </tr>
                ) : (
                  history.map((h) => {
                    const t = cashDiffTone(h.difference);
                    return (
                      <tr key={h.date}>
                        <td data-label="Fecha">
                          <button
                            type="button"
                            className="admin-link-btn"
                            onClick={() => setDate(h.date)}
                          >
                            {formatDate(h.date, "long")}
                          </button>
                        </td>
                        <td data-label="Esperado">
                          {formatARS(h.expectedCash)}
                        </td>
                        <td data-label="Contado">{formatARS(h.actualCash)}</td>
                        <td data-label="Diferencia">
                          <span className="admin-diff-pill" data-tone={t}>
                            {diffLabel(h.difference)}
                          </span>
                        </td>
                        <td data-label="Cerró">
                          {h.closedBy || "—"}
                          {h.closedAt && (
                            <span className="admin-cell-sub">
                              {" "}
                              {formatTime(h.closedAt)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isClosing && (
        <StaffPinModal
          isOpen={isClosing}
          onClose={() => setIsClosing(false)}
          title={`Cerrar caja del ${formatDate(date, "long")}`}
          confirmButtonText="Confirmar cierre Z"
          confirmButtonTone="primary"
          reasonLabel="Observaciones del cierre (opcional)"
          reasonPlaceholder={closingNotes || "ej. Quedaron $10.000 de cambio"}
          description={
            <dl className="admin-summary-list">
              <div>
                <dt>Esperado en cajón</dt>
                <dd>{formatARS(summary.expectedCash)}</dd>
              </div>
              <div>
                <dt>Contado</dt>
                <dd>{formatARS(Number(counted))}</dd>
              </div>
              <div>
                <dt>Diferencia</dt>
                <dd>
                  <span className="admin-diff-pill" data-tone={tone}>
                    {diffLabel(liveDiff)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Egresos</dt>
                <dd>
                  {plural(summary.expensesList.length, "egreso", "egresos")} ·{" "}
                  {formatARS(-summary.totalExpenses)}
                </dd>
              </div>
            </dl>
          }
          onConfirm={({ pin, reason }) =>
            handleClose({
              pin,
              notes: [closingNotes.trim(), reason].filter(Boolean).join(" · "),
            })
          }
        />
      )}

      {isReopening && (
        <StaffPinModal
          isOpen={isReopening}
          onClose={() => setIsReopening(false)}
          title={`Reabrir caja del ${formatDate(date, "long")}`}
          description="Solo un Administrador o Encargado puede reabrirla. El cierre anterior queda guardado en el registro de actividad."
          confirmButtonText="Reabrir caja"
          confirmButtonTone="danger"
          requireReason
          reasonPlaceholder="ej. Faltó cargar un cobro por transferencia"
          onConfirm={handleReopen}
        />
      )}

      {deletingExpense && (
        <StaffPinModal
          isOpen={Boolean(deletingExpense)}
          onClose={() => setDeletingExpense(null)}
          title="Eliminar egreso de caja"
          description={`¿Seguro que querés eliminar el egreso "${deletingExpense.concept}" por ${formatARS(-deletingExpense.amount)}?`}
          targetName={deletingExpense.concept}
          confirmButtonText="Eliminar egreso"
          confirmButtonTone="danger"
          onConfirm={async ({ pin, reason }) => {
            const res = await adminDeleteCashExpense({
              date,
              expenseId: deletingExpense.id,
              pin,
              reason,
            });
            if (!res.ok) {
              if (onExpiredSession?.(res)) return;
              throw new Error(res.error || "No se pudo eliminar el egreso.");
            }
            onToast?.(`Egreso eliminado por ${res.staff}`);
            setDeletingExpense(null);
            loadSummary();
          }}
        />
      )}
    </div>
  );
}
