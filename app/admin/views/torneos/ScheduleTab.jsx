"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2, Wand2 } from "lucide-react";
import {
  addDays,
  computeFixture,
  isByeMatch,
  scheduleItems,
  scheduleMatches,
} from "../../../../lib/tournament";
import { todayInClub } from "../../../../lib/booking";
import { adminSaveTournamentSchedule } from "../../actions";
import { courtNamer, longDayLabel, MatchRow } from "./shared";

const DURATIONS = [45, 60, 75, 90];

/** Días del torneo con un horario razonable: viernes a la tarde, finde todo el día. */
function defaultDays(t) {
  const start = t.date || todayInClub();
  const end = t.dateEnd && t.dateEnd >= start ? t.dateEnd : start;
  const days = [];
  for (let d = start; d <= end && days.length < 7; d = addDays(d, 1)) {
    const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    days.push({
      date: d,
      from: weekend ? "09:00" : "18:00",
      to: weekend ? "21:00" : "22:00",
    });
  }
  return days;
}

export default function ScheduleTab({
  tournament: t,
  courts,
  pairsById,
  onRun,
  onReload,
  onToast,
  onSaveMatch,
  onGoTo,
  hasFixtures,
}) {
  const courtName = courtNamer(courts);
  const withFixture = t.categories.filter((c) => t.fixtures?.[c.id]);
  const [filter, setFilter] = useState("all");
  const [onlyPending, setOnlyPending] = useState(false);
  const allMatches = useMemo(() => {
    const out = [];
    for (const c of withFixture) {
      const fx = t.fixtures[c.id];
      const calc = computeFixture(fx);
      for (const m of Object.values(fx.matches)) {
        if (!isByeMatch(m)) out.push({ m, c, fx, calc });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.fixtures, t.categories]);
  const anyScheduled = allMatches.some((x) => x.m.time);
  const [showPlanner, setShowPlanner] = useState(!anyScheduled);
  const [days, setDays] = useState(() => defaultDays(t));
  const [duration, setDuration] = useState(60);
  const [courtIds, setCourtIds] = useState(() => courts.map((c) => c.id));
  const [catIds, setCatIds] = useState(() => withFixture.map((c) => c.id));
  const [saving, setSaving] = useState(false);

  // Choques: misma cancha a la misma hora o una pareja en dos partidos a la vez.
  const conflicts = useMemo(() => {
    const out = {};
    const bySlot = {};
    for (const x of allMatches) {
      if (!x.m.date || !x.m.time) continue;
      (bySlot[`${x.m.date} ${x.m.time}`] ||= []).push(x);
    }
    for (const list of Object.values(bySlot)) {
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i];
          const b = list[j];
          if (a.m.court && a.m.court === b.m.court) {
            out[`${a.c.id}/${a.m.id}`] = out[`${b.c.id}/${b.m.id}`] =
              "Dos partidos en la misma cancha a la misma hora";
          }
          const pa = [a.calc.resolve(a.m.a), a.calc.resolve(a.m.b)].filter(
            Boolean,
          );
          const pb = [b.calc.resolve(b.m.a), b.calc.resolve(b.m.b)].filter(
            Boolean,
          );
          if (pa.some((p) => pb.includes(p))) {
            out[`${a.c.id}/${a.m.id}`] = out[`${b.c.id}/${b.m.id}`] =
              "Una pareja juega dos partidos a la misma hora";
          }
        }
      }
    }
    return out;
  }, [allMatches]);

  const visible = allMatches.filter(
    (x) =>
      (filter === "all" || x.c.id === filter) && (!onlyPending || !x.m.winner),
  );
  const byDay = useMemo(() => {
    const idx = Object.fromEntries(courts.map((c, i) => [c.id, i]));
    const groups = {};
    for (const x of visible)
      (groups[x.m.date && x.m.time ? x.m.date : ""] ||= []).push(x);
    return Object.entries(groups)
      .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
      .map(([day, list]) => ({
        day,
        list: list.sort(
          (x, y) =>
            (x.m.time || "").localeCompare(y.m.time || "") ||
            (idx[x.m.court] ?? 99) - (idx[y.m.court] ?? 99),
        ),
      }));
  }, [visible, courts]);

  async function autoSchedule() {
    if (!catIds.length || !courtIds.length || !days.length) return;
    const chosen = withFixture.filter((c) => catIds.includes(c.id));
    const items = scheduleItems(
      chosen.map((c) => ({ categoryId: c.id, fixture: t.fixtures[c.id] })),
    );
    // Lo ya jugado y las categorías que no se reprograman quedan donde están.
    const done = [];
    const occupied = [];
    for (const x of allMatches) {
      const key = `${x.c.id}/${x.m.id}`;
      const keep = x.m.winner || !catIds.includes(x.c.id);
      if (x.m.winner) done.push(key);
      if (keep && x.m.date && x.m.time) {
        occupied.push({
          date: x.m.date,
          time: x.m.time,
          court: x.m.court,
          pairs: [x.calc.resolve(x.m.a), x.calc.resolve(x.m.b)]
            .filter(Boolean)
            .map((p) => `${x.c.id}:${p}`),
        });
      }
    }
    const pendingCount = items.filter((it) => !done.includes(it.key)).length;
    const alreadyScheduled = allMatches.filter(
      (x) => catIds.includes(x.c.id) && !x.m.winner && x.m.time,
    ).length;
    if (
      alreadyScheduled &&
      !confirm(
        `Se van a reacomodar ${alreadyScheduled} partidos que ya tenían horario. ¿Seguir?`,
      )
    )
      return;

    const { assigned, unscheduled } = scheduleMatches(items, {
      days,
      duration,
      courts: courtIds,
      occupied,
      done,
    });
    const assignments = items
      .filter((it) => !done.includes(it.key))
      .map((it) => {
        const a = assigned[it.key];
        return {
          categoryId: it.categoryId,
          matchId: it.matchId,
          date: a?.date || "",
          time: a?.time || "",
          court: a?.court || "",
        };
      });
    setSaving(true);
    const res = await onRun(
      adminSaveTournamentSchedule(t.id, assignments),
      "No se pudieron guardar los horarios.",
    );
    setSaving(false);
    if (!res) return;
    await onReload();
    setShowPlanner(false);
    if (unscheduled.length) {
      onToast?.(
        `Entraron ${pendingCount - unscheduled.length} de ${pendingCount} partidos. Para los otros ${unscheduled.length}, sumá un día, más horas o más canchas.`,
        { tone: "error" },
      );
    } else {
      onToast?.(`Listo: ${pendingCount} partidos con día, hora y cancha`);
    }
  }

  if (!hasFixtures) {
    return (
      <div className="tn-banner">
        <span>
          Primero sorteá las zonas de al menos una categoría: ahí se arman los
          partidos.
        </span>
        <button
          type="button"
          className="btn btn-linear-primary"
          onClick={() => onGoTo("zonas")}
        >
          Ir al sorteo
        </button>
      </div>
    );
  }

  const unscheduledCount = allMatches.filter((x) => !x.m.time).length;
  const conflictCount = Object.keys(conflicts).length;

  return (
    <div className="tn-stack">
      {!showPlanner ? (
        <div className="tn-row-between">
          <div className="tn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowPlanner(true)}
            >
              <Wand2 size={15} /> Armar horarios automáticamente
            </button>
            {unscheduledCount > 0 && (
              <span className="tn-muted">
                {unscheduledCount} partidos sin horario
              </span>
            )}
            {conflictCount > 0 && (
              <span style={{ color: "var(--danger)", fontWeight: 600 }}>
                ⚠ {conflictCount} con choque de horario
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="tn-card tn-stack">
          <div>
            <h3 className="tn-card-title">
              <CalendarClock size={20} style={{ verticalAlign: "-3px" }} />{" "}
              Armar horarios
            </h3>
            <p className="tn-muted" style={{ margin: 0 }}>
              Decí qué días y de qué hora a qué hora se juega. Se reparten los
              partidos en las canchas sin que una pareja juegue dos seguidos si
              se puede, y el cuadro va después de las zonas. Después podés mover
              cualquiera a mano.
            </p>
          </div>

          <div className="tn-field">
            <span className="admin-field-label">
              Días y horarios (hora del último partido)
            </span>
            <div className="tn-days">
              {days.map((d, i) => (
                <div key={i} className="tn-day-row">
                  <label className="tn-field">
                    <span className="tn-muted">
                      {longDayLabel(d.date) || "Día"}
                    </span>
                    <input
                      type="date"
                      value={d.date}
                      onChange={(e) =>
                        setDays(
                          days.map((x, j) =>
                            j === i ? { ...x, date: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="tn-field">
                    <span className="tn-muted">Desde</span>
                    <input
                      type="time"
                      step={900}
                      value={d.from}
                      onChange={(e) =>
                        setDays(
                          days.map((x, j) =>
                            j === i ? { ...x, from: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="tn-field">
                    <span className="tn-muted">Último partido</span>
                    <input
                      type="time"
                      step={900}
                      value={d.to}
                      onChange={(e) =>
                        setDays(
                          days.map((x, j) =>
                            j === i ? { ...x, to: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="tn-icon-btn is-danger"
                    onClick={() => setDays(days.filter((_, j) => j !== i))}
                    disabled={days.length === 1}
                    aria-label="Quitar día"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ alignSelf: "flex-start" }}
                onClick={() => {
                  const last = days[days.length - 1];
                  setDays([
                    ...days,
                    {
                      date: last ? addDays(last.date, 1) : todayInClub(),
                      from: "09:00",
                      to: "21:00",
                    },
                  ]);
                }}
              >
                <Plus size={15} /> Agregar día
              </button>
            </div>
          </div>

          <div className="tn-options">
            <div className="tn-field">
              <span className="admin-field-label">Cada partido dura</span>
              <div className="admin-segmented" role="group">
                {DURATIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={duration === n}
                    onClick={() => setDuration(n)}
                  >
                    {n} min
                  </button>
                ))}
              </div>
            </div>
            <div className="tn-field">
              <span className="admin-field-label">Canchas</span>
              <div className="tn-row">
                {courts.map((c) => (
                  <label key={c.id} className="tn-check">
                    <input
                      type="checkbox"
                      checked={courtIds.includes(c.id)}
                      onChange={(e) =>
                        setCourtIds(
                          e.target.checked
                            ? [...courtIds, c.id]
                            : courtIds.filter((x) => x !== c.id),
                        )
                      }
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            {withFixture.length > 1 && (
              <div className="tn-field">
                <span className="admin-field-label">Categorías</span>
                <div className="tn-row">
                  {withFixture.map((c) => (
                    <label key={c.id} className="tn-check">
                      <input
                        type="checkbox"
                        checked={catIds.includes(c.id)}
                        onChange={(e) =>
                          setCatIds(
                            e.target.checked
                              ? [...catIds, c.id]
                              : catIds.filter((x) => x !== c.id),
                          )
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="tn-row" style={{ justifyContent: "flex-end" }}>
            {anyScheduled && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPlanner(false)}
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              className="btn btn-linear-primary admin-btn-lg"
              onClick={autoSchedule}
              disabled={
                saving || !catIds.length || !courtIds.length || !days.length
              }
            >
              <Wand2 size={17} /> {saving ? "Armando..." : "Armar horarios"}
            </button>
          </div>
        </div>
      )}

      <div className="tn-row-between">
        <div className="tn-cats" role="group" aria-label="Filtrar categoría">
          {withFixture.length > 1 && (
            <button
              type="button"
              className="tn-cat-chip"
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              Todas
            </button>
          )}
          {withFixture.length > 1 &&
            withFixture.map((c) => (
              <button
                key={c.id}
                type="button"
                className="tn-cat-chip"
                aria-pressed={filter === c.id}
                onClick={() => setFilter(c.id)}
              >
                {c.name}
              </button>
            ))}
        </div>
        <label className="tn-check">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
          />
          Solo los que faltan jugar
        </label>
      </div>

      {byDay.map(({ day, list }) => (
        <section key={day || "sin"}>
          <h3 className="tn-day-title">
            {day ? longDayLabel(day) : "Sin horario"}
          </h3>
          <div className="tn-day-list">
            {list.map(({ m, c, fx, calc }) => (
              <MatchRow
                key={`${c.id}/${m.id}`}
                match={m}
                fixture={fx}
                calc={calc}
                pairsById={pairsById}
                courts={courts}
                courtName={courtName}
                categoryName={withFixture.length > 1 ? c.name : ""}
                defaultDate={days[0]?.date || t.date}
                conflict={conflicts[`${c.id}/${m.id}`]}
                onSave={(payload) => onSaveMatch(c.id, m.id, payload)}
              />
            ))}
          </div>
        </section>
      ))}
      {byDay.length === 0 && (
        <p className="tn-muted">No hay partidos con ese filtro.</p>
      )}
    </div>
  );
}
