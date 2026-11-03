"use client";

import { useMemo, useState } from "react";
import { Copy, Dices, Shuffle } from "lucide-react";
import {
  buildFixture,
  computeFixture,
  describePlan,
  drawGroups,
  fixtureWhatsappText,
  isByeMatch,
  pairName,
  sortedMatches,
} from "../../../../lib/tournament";
import { adminSaveTournamentFixture } from "../../actions";
import { courtNamer, dayLabel, MatchRow } from "./shared";

export default function DrawTab({
  tournament: t,
  category,
  pairsById,
  courts,
  onRun,
  onReload,
  onSaveMatch,
  onToast,
  onGoTo,
}) {
  const fixture = t.fixtures?.[category.id];
  const pairs = useMemo(
    () => (t.players || []).filter((p) => p.categoryId === category.id),
    [t.players, category.id],
  );
  const [redo, setRedo] = useState(false);
  const [format, setFormat] = useState(
    fixture?.format || (pairs.length <= 4 ? "directo" : "zonas"),
  );
  const [groupSize, setGroupSize] = useState(fixture?.groupSize || 3);
  const [qualify, setQualify] = useState(fixture?.qualify || 2);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const showSetup = !fixture || redo;
  const courtName = courtNamer(courts);

  function sortear() {
    if (format === "directo") {
      setDraft(buildFixture({ format: "directo", pairs }));
    } else {
      setDraft({
        format: "zonas",
        groups: drawGroups(pairs, { size: groupSize }),
      });
    }
  }

  function movePair(pairId, toGroup) {
    setDraft((d) => ({
      ...d,
      groups: d.groups.map((g) => ({
        ...g,
        pairIds:
          g.id === toGroup
            ? [...g.pairIds.filter((id) => id !== pairId), pairId]
            : g.pairIds.filter((id) => id !== pairId),
      })),
    }));
  }

  async function saveDraft() {
    if (fixture) {
      const played = Object.values(fixture.matches).filter(
        (m) => m.winner,
      ).length;
      if (
        played &&
        !confirm(
          `Ya hay ${played} resultados cargados en ${category.name}. Si guardás el nuevo sorteo se pierden. ¿Seguir?`,
        )
      ) {
        return;
      }
    }
    const full =
      draft.format === "directo"
        ? draft
        : buildFixture({
            format: "zonas",
            groups: draft.groups.filter((g) => g.pairIds.length),
            qualify,
            groupSize,
          });
    if (
      full.format === "zonas" &&
      full.groups.some((g) => g.pairIds.length < 2)
    ) {
      onToast?.("Cada zona necesita al menos 2 parejas.", { tone: "error" });
      return;
    }
    setSaving(true);
    const res = await onRun(
      adminSaveTournamentFixture(t.id, category.id, {
        ...full,
        matches: Object.values(full.matches),
      }),
      "No se pudo guardar el sorteo.",
    );
    setSaving(false);
    if (!res) return;
    onToast?.(`Sorteo de ${category.name} guardado`);
    setDraft(null);
    setRedo(false);
    onReload();
  }

  async function copyWhatsapp() {
    const text = fixtureWhatsappText({
      tournamentName: t.name,
      categoryName: category.name,
      fixture,
      pairsById,
      courtName,
      dateLabel: dayLabel,
    });
    try {
      await navigator.clipboard.writeText(text);
      onToast?.("Copiado: pegalo en el grupo de WhatsApp");
    } catch {
      onToast?.("No se pudo copiar.", { tone: "error" });
    }
  }

  if (pairs.length < 2) {
    return (
      <div className="tn-banner">
        <span>
          Para sortear {category.name} hacen falta al menos 2 parejas anotadas.
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onGoTo("parejas")}
        >
          Anotar parejas
        </button>
      </div>
    );
  }

  return (
    <div className="tn-stack">
      {showSetup && (
        <div className="tn-card tn-stack">
          <div>
            <h3 className="tn-card-title">Cómo se juega {category.name}</h3>
            <p className="tn-muted" style={{ margin: 0 }}>
              {pairs.length} parejas anotadas
              {pairs.some((p) => p.seed)
                ? ` · ${pairs.filter((p) => p.seed).length} cabezas de serie (van a zonas distintas)`
                : ""}
            </p>
          </div>
          <div className="tn-options">
            <div className="tn-field">
              <span className="admin-field-label">Formato</span>
              <div className="admin-segmented" role="group">
                <button
                  type="button"
                  aria-pressed={format === "zonas"}
                  onClick={() => {
                    setFormat("zonas");
                    setDraft(null);
                  }}
                >
                  Zonas + cuadro
                </button>
                <button
                  type="button"
                  aria-pressed={format === "directo"}
                  onClick={() => {
                    setFormat("directo");
                    setDraft(null);
                  }}
                >
                  Eliminación directa
                </button>
              </div>
            </div>
            {format === "zonas" && (
              <>
                <div className="tn-field">
                  <span className="admin-field-label">Parejas por zona</span>
                  <div className="admin-segmented" role="group">
                    {[3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={groupSize === n}
                        onClick={() => {
                          setGroupSize(n);
                          setDraft(null);
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="tn-field">
                  <span className="admin-field-label">
                    Pasan al cuadro por zona
                  </span>
                  <div className="admin-segmented" role="group">
                    {[1, 2].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={qualify === n}
                        onClick={() => setQualify(n)}
                      >
                        {n === 1 ? "El 1°" : "1° y 2°"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="tn-banner is-ok">
            <span>
              {describePlan(pairs.length, { format, groupSize, qualify })}
            </span>
          </div>
          <div className="tn-row" style={{ justifyContent: "flex-end" }}>
            {redo && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setRedo(false);
                  setDraft(null);
                }}
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              className="btn btn-linear-primary admin-btn-lg"
              onClick={sortear}
            >
              {draft ? <Shuffle size={17} /> : <Dices size={17} />}{" "}
              {draft ? "Volver a sortear" : "Sortear"}
            </button>
          </div>
        </div>
      )}

      {draft && (
        <div className="tn-card tn-stack">
          <div className="tn-row-between">
            <h3 className="tn-card-title" style={{ margin: 0 }}>
              Así quedó el sorteo
            </h3>
            <span className="tn-muted">
              {draft.format === "zonas"
                ? "Si querés, mové parejas entre zonas antes de guardar."
                : "Los cruces del cuadro:"}
            </span>
          </div>
          {draft.format === "zonas" ? (
            <div className="tn-zones">
              {draft.groups.map((g) => (
                <div key={g.id} className="tn-zone">
                  <div className="tn-zone-head">
                    <strong>Zona {g.id}</strong>
                    <span>{g.pairIds.length} parejas</span>
                  </div>
                  {g.pairIds.map((id) => (
                    <div key={id} className="tn-draft-pair">
                      <span>
                        {pairsById[id]?.seed ? "⭐ " : ""}
                        {pairName(pairsById[id])}
                      </span>
                      <select
                        className="admin-mini-select"
                        aria-label="Mover a otra zona"
                        value={g.id}
                        onChange={(e) => movePair(id, e.target.value)}
                      >
                        {draft.groups.map((x) => (
                          <option key={x.id} value={x.id}>
                            Zona {x.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="tn-day-list">
              {sortedMatches(draft)
                .filter(
                  (m) =>
                    m.size ===
                    Math.max(
                      ...Object.values(draft.matches).map((x) => x.size),
                    ),
                )
                .map((m) => (
                  <div key={m.id} className="tn-match is-compact">
                    <div className="tn-match-sides">
                      <span>
                        {m.a.bye
                          ? "Pasa directo"
                          : pairName(pairsById[m.a.pair])}
                      </span>
                      <span>
                        {m.b.bye
                          ? "Pasa directo"
                          : pairName(pairsById[m.b.pair])}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div className="tn-row" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={sortear}
            >
              <Shuffle size={15} /> Volver a sortear
            </button>
            <button
              type="button"
              className="btn btn-linear-primary admin-btn-lg"
              onClick={saveDraft}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar sorteo y armar partidos"}
            </button>
          </div>
        </div>
      )}

      {fixture && !redo && (
        <FixtureView
          {...{
            t,
            category,
            fixture,
            pairsById,
            courts,
            courtName,
            onSaveMatch,
          }}
          onRedo={() => setRedo(true)}
          onCopy={copyWhatsapp}
          onGoTo={onGoTo}
        />
      )}
    </div>
  );
}

function FixtureView({
  t,
  category,
  fixture,
  pairsById,
  courts,
  courtName,
  onSaveMatch,
  onRedo,
  onCopy,
  onGoTo,
}) {
  const calc = useMemo(() => computeFixture(fixture), [fixture]);
  const matches = sortedMatches(fixture);
  const unscheduled = matches.filter((m) => !isByeMatch(m) && !m.time).length;

  return (
    <div className="tn-stack">
      <div className="tn-row-between">
        <div className="tn-row">
          <button type="button" className="btn btn-secondary" onClick={onCopy}>
            <Copy size={15} /> Copiar para WhatsApp
          </button>
          <button type="button" className="btn btn-secondary" onClick={onRedo}>
            <Shuffle size={15} /> Rehacer sorteo
          </button>
        </div>
        {unscheduled > 0 && (
          <button
            type="button"
            className="btn btn-linear-primary"
            onClick={() => onGoTo("horarios")}
          >
            Poner horarios ({unscheduled} sin horario) →
          </button>
        )}
      </div>

      {fixture.format === "directo" ? (
        <div className="tn-banner">
          <span>
            {category.name} se juega por eliminación directa: los cruces están
            en el cuadro final.
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onGoTo("cuadro")}
          >
            Ver cuadro
          </button>
        </div>
      ) : (
        <div className="tn-zones">
          {fixture.groups.map((g) => (
            <div key={g.id} className="tn-zone">
              <div className="tn-zone-head">
                <strong>Zona {g.id}</strong>
                <span>
                  {calc.groupDone[g.id]
                    ? "Terminada"
                    : `${g.pairIds.length} parejas`}
                </span>
              </div>
              <table className="tn-standings">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Pareja</th>
                    <th title="Partidos jugados">PJ</th>
                    <th title="Partidos ganados">PG</th>
                    <th title="Diferencia de sets">Sets</th>
                    <th title="Diferencia de games">Games</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.standings[g.id].map((r, i) => (
                    <tr
                      key={r.pairId}
                      className={i < fixture.qualify ? "is-qualified" : ""}
                    >
                      <td>{i + 1}</td>
                      <td>
                        {pairName(pairsById[r.pairId]) || "Pareja quitada"}
                      </td>
                      <td>{r.played}</td>
                      <td>{r.won}</td>
                      <td>{signed(r.setsFor - r.setsAgainst)}</td>
                      <td>{signed(r.gamesFor - r.gamesAgainst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="tn-zone-matches">
                {matches
                  .filter((m) => m.stage === "group" && m.group === g.id)
                  .map((m) => (
                    <MatchRow
                      key={m.id}
                      compact
                      match={m}
                      fixture={fixture}
                      calc={calc}
                      pairsById={pairsById}
                      courts={courts}
                      courtName={courtName}
                      defaultDate={t.date}
                      onSave={(payload) =>
                        onSaveMatch(category.id, m.id, payload)
                      }
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {fixture.format === "zonas" && fixture.qualify > 0 && (
        <p className="tn-muted" style={{ margin: 0 }}>
          La raya naranja marca a los que pasan al cuadro. Desempate: partidos
          ganados, resultado entre ellos (si empatan dos), diferencia de sets y
          de games.
        </p>
      )}
    </div>
  );
}

const signed = (n) => (n > 0 ? `+${n}` : String(n));
