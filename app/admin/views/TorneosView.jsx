"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, Plus, Trophy, Users, X } from "lucide-react";
import { EmptyState } from "../ui/states";
import CountUp from "../ui/CountUp";
import { Bone, TorneosSkeleton } from "./Esqueletos";
import { formatARS } from "../../../lib/format";
import { todayInClub } from "../../../lib/booking";
import { CATEGORY_PRESETS, isByeMatch } from "../../../lib/tournament";
import {
  adminCreateTournament,
  adminGetTournaments,
  adminSaveTournamentMatch,
} from "../actions";
import TournamentDetail from "./torneos/TournamentDetail";
import { Marcador, STATUS_LABELS, tournamentDates } from "./torneos/shared";

const EMPTY_FORM = {
  name: "",
  date: "",
  dateEnd: "",
  price: "",
  categories: [],
};

/** Próximo sábado (o hoy si es sábado): el caso típico, "torneo este finde". */
function nextSaturday() {
  const today = todayInClub();
  const d = new Date(`${today}T12:00:00Z`);
  const add = (6 - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

function plusDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Cuántos partidos se jugaron sobre el total (sin contar los bye). */
function tournamentProgress(t) {
  let total = 0;
  let played = 0;
  for (const fx of Object.values(t.fixtures || {})) {
    for (const m of Object.values(fx.matches || {})) {
      if (isByeMatch(m)) continue;
      total += 1;
      if (m.winner) played += 1;
    }
  }
  return { total, played };
}

export default function TorneosView({ clubConfig, onExpiredSession, onToast }) {
  const [tournaments, setTournaments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [customCat, setCustomCat] = useState("");
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("activos");

  const courts = clubConfig?.courts?.length
    ? clubConfig.courts
    : [
        { id: "cancha-1", name: "Cancha 1" },
        { id: "cancha-2", name: "Cancha 2" },
      ];

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload() {
    setLoading(true);
    const res = await adminGetTournaments();
    setLoading(false);
    if (res?.ok) {
      setTournaments(res.tournaments || []);
      return true;
    }
    if (!onExpiredSession?.(res)) {
      onToast?.(res?.error || "No se pudieron cargar los torneos.", {
        tone: "error",
      });
      setTournaments((prev) => prev || []);
    }
    return false;
  }

  /** Corre una acción del server; si falla muestra el error. → true/false */
  async function run(promise, fallback) {
    const res = await promise;
    if (res?.ok) return res;
    if (!onExpiredSession?.(res))
      onToast?.(res?.error || fallback, { tone: "error" });
    return null;
  }

  function patchTournament(id, updater) {
    setTournaments((list) =>
      (list || []).map((t) => (t.id === id ? updater(t) : t)),
    );
  }

  async function saveMatch(tournamentId, categoryId, matchId, payload) {
    const res = await run(
      adminSaveTournamentMatch(tournamentId, categoryId, matchId, payload),
      "No se pudo guardar el partido.",
    );
    if (!res) return false;
    patchTournament(tournamentId, (t) => {
      const fx = t.fixtures?.[categoryId];
      if (!fx?.matches?.[matchId]) return t;
      const merged = { ...fx.matches[matchId], ...res.match };
      for (const k of Object.keys(merged))
        if (merged[k] == null) delete merged[k];
      return {
        ...t,
        fixtures: {
          ...t.fixtures,
          [categoryId]: {
            ...fx,
            matches: { ...fx.matches, [matchId]: merged },
          },
        },
      };
    });
    return true;
  }

  function toggleCategory(name) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(name)
        ? f.categories.filter((c) => c !== name)
        : [...f.categories, name],
    }));
  }

  function addCustomCategory() {
    const name = customCat.trim();
    if (!name) return;
    if (!form.categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setForm((f) => ({ ...f, categories: [...f.categories, name] }));
    }
    setCustomCat("");
  }

  function openCreate() {
    const sat = nextSaturday();
    setForm({ ...EMPTY_FORM, date: sat, dateEnd: plusDays(sat, 1) });
    setShowCreate(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const categories = [...form.categories];
    if (customCat.trim()) categories.push(customCat.trim());
    setCreating(true);
    const res = await run(
      adminCreateTournament({ ...form, categories }),
      "No se pudo crear el torneo.",
    );
    setCreating(false);
    if (!res) return;
    onToast?.(`Torneo creado · ${form.name.trim()}`);
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setCustomCat("");
    await reload();
    setSelectedId(res.tournamentId);
  }

  const metrics = useMemo(() => {
    const list = tournaments || [];
    const active = list.filter((t) => t.status !== "finalizado");
    let pairs = 0;
    let paid = 0;
    let collected = 0;
    let pending = 0;
    for (const t of active) {
      const price = Number(t.price) || 0;
      for (const p of t.players || []) {
        pairs += 1;
        if (p.paid) {
          paid += 1;
          collected += price;
        } else pending += price;
      }
    }
    return { active: active.length, pairs, paid, collected, pending };
  }, [tournaments]);

  const visible = useMemo(() => {
    const list = tournaments || [];
    if (statusFilter === "activos")
      return list.filter((t) => t.status !== "finalizado");
    if (statusFilter === "finalizado")
      return list.filter((t) => t.status === "finalizado");
    return list;
  }, [tournaments, statusFilter]);

  const selected = tournaments?.find((t) => t.id === selectedId);

  if (selected) {
    return (
      <TournamentDetail
        key={selected.id}
        tournament={selected}
        courts={courts}
        onBack={() => setSelectedId(null)}
        onReload={reload}
        onRun={run}
        onSaveMatch={(catId, matchId, payload) =>
          saveMatch(selected.id, catId, matchId, payload)
        }
        onPatch={(updater) => patchTournament(selected.id, updater)}
        onDeleted={() => {
          setSelectedId(null);
          reload();
        }}
        onToast={onToast}
      />
    );
  }

  return (
    <div className="tn-stack">
      <div className="admin-kpis-3">
        <Kpi
          icon={Trophy}
          color="#ea580c"
          title="Torneos activos"
          value={<CountUp value={metrics.active} />}
          sub={
            tournaments ? (
              `${tournaments.length} en total`
            ) : (
              <Bone w={84} h={11} className="is-light" />
            )
          }
        />
        <Kpi
          icon={Users}
          color="#15803d"
          title="Parejas anotadas"
          value={<CountUp value={metrics.pairs} />}
          sub={`${metrics.paid} pagaron · ${metrics.pairs - metrics.paid} deben`}
        />
        <Kpi
          icon={DollarSign}
          color="#15803d"
          numberColor="#15803d"
          title="Inscripciones cobradas"
          value={<CountUp value={metrics.collected} format={formatARS} />}
          sub={
            metrics.pending > 0
              ? `${formatARS(metrics.pending)} por cobrar`
              : "Todo cobrado"
          }
        />
      </div>

      <div className="tn-row-between">
        <div
          className="admin-segmented"
          role="group"
          aria-label="Filtro de torneos"
        >
          {[
            ["activos", "Activos"],
            ["finalizado", "Terminados"],
            ["all", "Todos"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={statusFilter === id}
              onClick={() => setStatusFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-linear-primary"
          onClick={() => (showCreate ? setShowCreate(false) : openCreate())}
        >
          <Plus size={16} /> Nuevo torneo
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="tn-card tn-create">
          {/* El afiche se va armando mientras escribís. */}
          <div className="tn-create-poster">
            <Marcador date={form.date} dateEnd={form.dateEnd} />
            <div className="tn-create-poster-text">
              <span className="tn-hero-kicker">Nuevo torneo</span>
              <h2
                className={`tn-card-title tn-create-title${form.name.trim() ? "" : " is-placeholder"}`}
              >
                {form.name.trim() || "Nombre del torneo"}
              </h2>
              <span className="tn-create-poster-sub">
                {tournamentDates(form)}
                {Number(form.price) > 0 &&
                  ` · ${formatARS(form.price)} por pareja`}
              </span>
              {form.categories.length > 0 && (
                <span className="tn-hero-chips">
                  {form.categories.map((c) => (
                    <span key={c} className="tn-hero-chip">
                      {c}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
          <div className="tn-create-body tn-stack">
          <p className="tn-muted" style={{ margin: 0 }}>
            Poné el nombre, cuándo se juega y las categorías. Después anotás
            las parejas.
          </p>
          <div className="tn-grid-form">
            <label className="tn-field" style={{ gridColumn: "1 / -1" }}>
              <span className="admin-field-label">Nombre del torneo *</span>
              <input
                type="text"
                required
                autoFocus
                maxLength={80}
                placeholder="Ej. Torneo de Primavera"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="tn-field">
              <span className="admin-field-label">Empieza</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label className="tn-field">
              <span className="admin-field-label">Termina</span>
              <input
                type="date"
                value={form.dateEnd}
                min={form.date || undefined}
                onChange={(e) => setForm({ ...form, dateEnd: e.target.value })}
              />
            </label>
            <label className="tn-field">
              <span className="admin-field-label">Inscripción por pareja</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="$ 0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
          </div>

          <div className="tn-field">
            <span className="admin-field-label">
              Categorías * (tocá todas las que juegan)
            </span>
            <div className="tn-cats">
              {CATEGORY_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="tn-cat-chip"
                  aria-pressed={form.categories.includes(c)}
                  onClick={() => toggleCategory(c)}
                >
                  {c}
                </button>
              ))}
              {form.categories
                .filter((c) => !CATEGORY_PRESETS.includes(c))
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="tn-cat-chip"
                    aria-pressed="true"
                    onClick={() => toggleCategory(c)}
                  >
                    {c} <X size={13} aria-hidden />
                  </button>
                ))}
            </div>
            <div className="tn-row" style={{ marginTop: 6 }}>
              <input
                type="text"
                maxLength={40}
                placeholder="Otra: Suma 13, 7ma Damas..."
                value={customCat}
                onChange={(e) => setCustomCat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomCategory();
                  }
                }}
                style={{ maxWidth: 280 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addCustomCategory}
                disabled={!customCat.trim()}
              >
                Agregar
              </button>
            </div>
          </div>

          <div className="tn-row" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowCreate(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-linear-primary"
              disabled={
                creating ||
                !form.name.trim() ||
                (!form.categories.length && !customCat.trim())
              }
            >
              {creating ? "Creando..." : "Crear y anotar parejas →"}
            </button>
          </div>
          </div>
        </form>
      )}

      {!tournaments ? (
        <TorneosSkeleton />
      ) : tournaments.length === 0 ? (
        showCreate ? null : (
          <div className="tn-empty-poster">
            <img
              className="tn-empty-mascot"
              src="/img/mascotas/muzzaguito-trofeo-paleta.webp"
              alt=""
              width={150}
              height={150}
              loading="lazy"
              decoding="async"
            />
            <div className="tn-empty-text">
              <span className="tn-hero-kicker">Torneos del club</span>
              <h2 className="tn-empty-title">Todavía no hay torneos</h2>
              <p>
                Creá el torneo del finde y llevalo de punta a punta desde acá.
              </p>
              <ol className="tn-empty-steps">
                <li>
                  <strong>Anotás</strong> las parejas y quién pagó
                </li>
                <li>
                  <strong>Sorteás</strong> las zonas y armás los horarios
                </li>
                <li>
                  <strong>Sacás</strong> el PDF y cargás el cuadro
                </li>
              </ol>
              <button
                type="button"
                className="tn-cta"
                onClick={openCreate}
              >
                <Plus size={18} aria-hidden /> Crear el primer torneo
              </button>
            </div>
          </div>
        )
      ) : visible.length === 0 ? (
        <div className="tn-card">
          <EmptyState
            icon={Trophy}
            mascot="trofeo-paleta"
            title={
              statusFilter === "finalizado"
                ? "Todavía no terminó ningún torneo"
                : "No hay torneos activos"
            }
            text="Cambiá el filtro para ver los demás."
          />
        </div>
      ) : (
        <div className={`tn-list${loading ? " admin-content-loading" : ""}`}>
          {visible.map((t) => (
            <TournamentCard
              key={t.id}
              t={t}
              onOpen={() => setSelectedId(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Tarjeta de un torneo en la lista, como el afiche de /torneos: arriba la
 * cancha azul con la fecha en el tablero LED y el nombre grande (se reconoce
 * de lejos), abajo categorías con sus parejas, cobro y cuánto falta jugar.
 */
export function TournamentCard({ t, onOpen }) {
  const status = STATUS_LABELS[t.status] || STATUS_LABELS.abierto;
  const { total, played } = tournamentProgress(t);
  const players = t.players || [];
  const paid = players.filter((p) => p.paid).length;
  const owe = players.length - paid;
  const pct = total ? Math.round((played / total) * 100) : 0;
  const paidPct = players.length ? Math.round((paid / players.length) * 100) : 0;
  const countByCat = {};
  for (const p of players)
    countByCat[p.categoryId] = (countByCat[p.categoryId] || 0) + 1;
  return (
    <button
      type="button"
      className="tn-list-item tn-tcard"
      data-status={t.status}
      onClick={onOpen}
    >
      <span className="tn-tcard-court">
        <Marcador date={t.date} dateEnd={t.dateEnd} />
        <span className="tn-tcard-head">
          <span className="tn-tcard-status" data-status={t.status}>
            {status.label}
          </span>
          <span className="tn-list-name">{t.name}</span>
          <span className="tn-tcard-date">{tournamentDates(t)}</span>
        </span>
        {Number(t.price) > 0 && (
          <span className="tn-tcard-price">
            {formatARS(t.price)} <small>x pareja</small>
          </span>
        )}
      </span>
      <span className="tn-tcard-body">
        <span className="tn-tcard-cats">
          {t.categories.map((c) => (
            <span key={c.id} className="tn-tcard-cat">
              {c.name}
              <small>{countByCat[c.id] || 0}</small>
            </span>
          ))}
        </span>
        <span className="tn-tcard-meters">
          <span className="tn-tcard-meter">
            <span className="tn-tcard-meter-label">
              <span>Inscripción</span>
              <span>
                <strong>{players.length}</strong>{" "}
                {players.length === 1 ? "pareja" : "parejas"} ·{" "}
                <strong className="is-paid">{paid}</strong> pagaron
                {owe > 0 && (
                  <>
                    {" "}
                    · <strong className="is-owe">{owe}</strong>{" "}
                    {owe === 1 ? "debe" : "deben"}
                  </>
                )}
              </span>
            </span>
            <span
              className={`tn-paybar${players.length ? "" : " is-empty"}`}
              aria-hidden
            >
              <span style={{ width: `${paidPct}%` }} />
            </span>
          </span>
          <span className="tn-tcard-meter">
            <span className="tn-tcard-meter-label">
              <span>Partidos</span>
              <span>
                {total > 0 ? (
                  <>
                    <strong>{played}</strong> de {total} jugados
                  </>
                ) : (
                  "Sin sorteo todavía"
                )}
              </span>
            </span>
            <span
              className={`tn-progress${total ? "" : " is-empty"}`}
              aria-hidden
            >
              {total > 0 && <span style={{ width: `${pct}%` }} />}
            </span>
          </span>
        </span>
        <span className="tn-tcard-go">
          Abrir torneo <span aria-hidden>→</span>
        </span>
      </span>
    </button>
  );
}

function Kpi({ icon: Icon, color, numberColor, title, value, sub }) {
  return (
    <div className="admin-kravio-kpi-card">
      <div className="admin-kravio-kpi-header">
        <span className="admin-kravio-kpi-title">{title}</span>
        <Icon size={17} style={{ color }} />
      </div>
      <div className="admin-kravio-kpi-content">
        <div className="admin-kravio-kpi-left">
          <div className="admin-kravio-kpi-number" style={{ color: numberColor }}>
            {value}
          </div>
          <span className="admin-cell-sub">{sub}</span>
        </div>
      </div>
    </div>
  );
}
