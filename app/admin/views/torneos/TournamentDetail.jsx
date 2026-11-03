"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, FileDown, Pencil, Plus, Trash2 } from "lucide-react";
import { formatARS } from "../../../../lib/format";
import {
  computeFixture,
  isByeMatch,
  pairName,
} from "../../../../lib/tournament";
import {
  adminDeleteTournament,
  adminSaveTournamentCategory,
  adminUpdateTournament,
  adminUpdateTournamentStatus,
} from "../../actions";
import { usePinGate } from "../../ui/usePinGate";
import { STATUS_LABELS, tournamentDates } from "./shared";
import PairsTab from "./PairsTab";
import DrawTab from "./DrawTab";
import ScheduleTab from "./ScheduleTab";
import BracketTab from "./BracketTab";
import PrintSheet from "./PrintSheet";

const STEPS = [
  { id: "parejas", label: "Parejas" },
  { id: "zonas", label: "Zonas" },
  { id: "horarios", label: "Horarios y resultados" },
  { id: "cuadro", label: "Cuadro final" },
];

export default function TournamentDetail({
  tournament: t,
  courts,
  onBack,
  onReload,
  onRun,
  onSaveMatch,
  onPatch,
  onDeleted,
  onToast,
}) {
  const [step, setStep] = useState(() =>
    Object.keys(t.fixtures || {}).length ? "horarios" : "parejas",
  );
  const [categoryId, setCategoryId] = useState(t.categories[0]?.id);
  const [editing, setEditing] = useState(false);
  const [info, setInfo] = useState({
    name: t.name,
    date: t.date || "",
    dateEnd: t.dateEnd || "",
    price: t.price || "",
  });
  const [newCat, setNewCat] = useState(null);
  const [printing, setPrinting] = useState(false);
  const { ask, pinModal } = usePinGate();

  const category =
    t.categories.find((c) => c.id === categoryId) || t.categories[0];
  const pairsById = useMemo(
    () => Object.fromEntries((t.players || []).map((p) => [p.id, p])),
    [t.players],
  );
  const countByCat = useMemo(() => {
    const out = {};
    for (const p of t.players || [])
      out[p.categoryId] = (out[p.categoryId] || 0) + 1;
    return out;
  }, [t.players]);

  const stepInfo = useMemo(() => {
    const fixtures = Object.values(t.fixtures || {});
    const drawn = t.categories.filter((c) => t.fixtures?.[c.id]).length;
    let total = 0;
    let scheduled = 0;
    let played = 0;
    for (const fx of fixtures) {
      for (const m of Object.values(fx.matches)) {
        if (isByeMatch(m)) continue;
        total += 1;
        if (m.time) scheduled += 1;
        if (m.winner) played += 1;
      }
    }
    const champions = t.categories
      .map((c) => {
        const fx = t.fixtures?.[c.id];
        const final =
          fx &&
          Object.values(fx.matches).find(
            (m) => m.stage === "bracket" && m.size === 2,
          );
        const w = final && computeFixture(fx).winnerOf(final);
        return w ? `${c.name}: ${pairName(pairsById[w])}` : null;
      })
      .filter(Boolean);
    return {
      parejas: {
        sub: `${t.players.length} anotadas`,
        done: t.players.length >= 2,
      },
      zonas: {
        sub: drawn
          ? `${drawn} de ${t.categories.length} sorteadas`
          : "Falta sortear",
        done: drawn > 0 && drawn === t.categories.length,
      },
      horarios: {
        sub: total ? `${played}/${total} jugados` : "Primero sorteá",
        done: total > 0 && scheduled === total,
      },
      cuadro: {
        sub: champions.length
          ? `🏆 ${champions.length} campeón${champions.length > 1 ? "es" : ""}`
          : "Cuartos, semis y final",
        done: champions.length > 0 && champions.length === t.categories.length,
      },
    };
  }, [t, pairsById]);

  async function saveInfo(e) {
    e.preventDefault();
    const res = await onRun(
      adminUpdateTournament(t.id, info),
      "No se pudo guardar el torneo.",
    );
    if (!res) return;
    setEditing(false);
    onToast?.("Torneo actualizado");
    onReload();
  }

  async function changeStatus(status) {
    const res = await onRun(
      adminUpdateTournamentStatus(t.id, status),
      "No se pudo cambiar el estado.",
    );
    if (res) onPatch((x) => ({ ...x, status }));
  }

  async function addCategory(e) {
    e.preventDefault();
    const res = await onRun(
      adminSaveTournamentCategory(t.id, { name: newCat }),
      "No se pudo agregar la categoría.",
    );
    if (!res) return;
    setNewCat(null);
    await onReload();
    setCategoryId(res.categoryId);
    setStep("parejas");
  }

  async function handleDelete() {
    const res = await ask(
      {
        title: "Borrar torneo",
        description: `Se borra "${t.name}" con sus ${t.players.length} parejas, zonas y resultados. No se puede deshacer.`,
        confirmButtonText: "Borrar torneo",
        confirmButtonTone: "danger",
        requireReason: false,
      },
      ({ pin, reason }) =>
        adminDeleteTournament({ tournamentId: t.id, pin, reason }),
    );
    if (res?.ok) {
      onToast?.(`Torneo borrado · lo autorizó ${res.staff}`);
      onDeleted();
    }
  }

  const hasFixtures = Object.keys(t.fixtures || {}).length > 0;

  return (
    <div className="tn-stack">
      {pinModal}
      {printing && (
        <PrintSheet
          tournament={t}
          courts={courts}
          pairsById={pairsById}
          onClose={() => setPrinting(false)}
        />
      )}

      <div className="tn-row-between">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Todos los torneos
        </button>
        <div className="tn-row">
          <button
            type="button"
            className="btn btn-linear-primary"
            onClick={() => setPrinting(true)}
            title="Hoja con zonas, horarios y cuadro con la marca Muzzaga"
          >
            <FileDown size={16} /> PDF con horarios
          </button>
        </div>
      </div>

      <div className="tn-card">
        {editing ? (
          <form className="tn-grid-form" onSubmit={saveInfo}>
            <label className="tn-field" style={{ gridColumn: "1 / -1" }}>
              <span className="admin-field-label">Nombre</span>
              <input
                type="text"
                required
                maxLength={80}
                value={info.name}
                onChange={(e) => setInfo({ ...info, name: e.target.value })}
              />
            </label>
            <label className="tn-field">
              <span className="admin-field-label">Empieza</span>
              <input
                type="date"
                value={info.date}
                onChange={(e) => setInfo({ ...info, date: e.target.value })}
              />
            </label>
            <label className="tn-field">
              <span className="admin-field-label">Termina</span>
              <input
                type="date"
                value={info.dateEnd}
                min={info.date || undefined}
                onChange={(e) => setInfo({ ...info, dateEnd: e.target.value })}
              />
            </label>
            <label className="tn-field">
              <span className="admin-field-label">Inscripción por pareja</span>
              <input
                type="number"
                min="0"
                value={info.price}
                onChange={(e) => setInfo({ ...info, price: e.target.value })}
              />
            </label>
            <div className="tn-row">
              <button type="submit" className="btn btn-linear-primary">
                Guardar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="tn-row-between" style={{ alignItems: "flex-start" }}>
            <div>
              <h2 className="tn-card-title" style={{ fontSize: 28 }}>
                {t.name}
              </h2>
              <div className="tn-list-meta">
                <span>📅 {tournamentDates(t)}</span>
                {t.price > 0 && <span>💰 {formatARS(t.price)} por pareja</span>}
                <span>
                  👥 {t.players.filter((p) => p.paid).length} de{" "}
                  {t.players.length} pagaron
                </span>
              </div>
            </div>
            <div className="tn-row">
              <select
                className="admin-mini-select"
                aria-label="Estado del torneo"
                value={t.status}
                onChange={(e) => changeStatus(e.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([val, s]) => (
                  <option key={val} value={val}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="tn-icon-btn"
                onClick={() => setEditing(true)}
                aria-label="Editar datos del torneo"
                title="Editar nombre, fechas y precio"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                className="tn-icon-btn is-danger"
                onClick={handleDelete}
                aria-label="Borrar torneo"
                title="Borrar torneo (pide PIN)"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <nav className="tn-steps" aria-label="Pasos del torneo">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`tn-step${stepInfo[s.id].done ? " is-done" : ""}`}
            aria-pressed={step === s.id}
            onClick={() => setStep(s.id)}
          >
            <span className="tn-step-num">
              {stepInfo[s.id].done ? "✓" : i + 1}
            </span>
            <span>
              {s.label}
              <span className="tn-step-sub">{stepInfo[s.id].sub}</span>
            </span>
          </button>
        ))}
      </nav>

      {step !== "horarios" && (
        <div className="tn-cats" role="group" aria-label="Categoría">
          {t.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="tn-cat-chip"
              aria-pressed={c.id === category.id}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name} <small>{countByCat[c.id] || 0}</small>
            </button>
          ))}
          {newCat === null ? (
            <button
              type="button"
              className="tn-cat-chip is-add"
              onClick={() => setNewCat("")}
            >
              <Plus size={14} aria-hidden /> Categoría
            </button>
          ) : (
            <form className="tn-row" onSubmit={addCategory}>
              <input
                type="text"
                autoFocus
                maxLength={40}
                placeholder="Ej. 7ma Damas"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                style={{ width: 160 }}
              />
              <button
                type="submit"
                className="btn btn-linear-primary"
                disabled={!newCat.trim()}
              >
                Agregar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setNewCat(null)}
              >
                Cancelar
              </button>
            </form>
          )}
        </div>
      )}

      {step === "parejas" && (
        <PairsTab
          key={category.id}
          tournament={t}
          category={category}
          onRun={onRun}
          onReload={onReload}
          onPatch={onPatch}
          onToast={onToast}
          onGoToDraw={() => setStep("zonas")}
          onCategoryRemoved={() =>
            setCategoryId(t.categories.find((c) => c.id !== category.id)?.id)
          }
        />
      )}
      {step === "zonas" && (
        <DrawTab
          key={category.id}
          tournament={t}
          category={category}
          pairsById={pairsById}
          courts={courts}
          onRun={onRun}
          onReload={onReload}
          onSaveMatch={onSaveMatch}
          onToast={onToast}
          onGoTo={setStep}
        />
      )}
      {step === "horarios" && (
        <ScheduleTab
          tournament={t}
          courts={courts}
          pairsById={pairsById}
          onRun={onRun}
          onReload={onReload}
          onSaveMatch={onSaveMatch}
          onToast={onToast}
          onGoTo={setStep}
          hasFixtures={hasFixtures}
        />
      )}
      {step === "cuadro" && (
        <BracketTab
          key={category.id}
          tournament={t}
          category={category}
          pairsById={pairsById}
          courts={courts}
          onSaveMatch={onSaveMatch}
          onGoTo={setStep}
        />
      )}
    </div>
  );
}
