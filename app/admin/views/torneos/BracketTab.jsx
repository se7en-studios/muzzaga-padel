"use client";

import { useMemo, useState } from "react";
import { Pencil, Trophy } from "lucide-react";
import {
  computeFixture,
  isByeMatch,
  pairName,
  parseScore,
  roundName,
} from "../../../../lib/tournament";
import { courtNamer, dayLabel, MatchEditor, sideInfo } from "./shared";

/** Columnas del cuadro: [{ size, matches }] de la primera ronda a la final. */
export function bracketRounds(fixture) {
  const bySize = {};
  for (const m of Object.values(fixture?.matches || {})) {
    if (m.stage === "bracket") (bySize[m.size] ||= []).push(m);
  }
  return Object.keys(bySize)
    .map(Number)
    .sort((a, b) => b - a)
    .map((size) => ({
      size,
      matches: bySize[size].sort((x, y) => x.index - y.index),
    }));
}

export default function BracketTab({
  tournament: t,
  category,
  pairsById,
  courts,
  onSaveMatch,
  onGoTo,
}) {
  const fixture = t.fixtures?.[category.id];
  const calc = useMemo(() => fixture && computeFixture(fixture), [fixture]);
  const rounds = useMemo(() => bracketRounds(fixture), [fixture]);
  const courtName = courtNamer(courts);

  if (!fixture) {
    return (
      <div className="tn-banner">
        <span>
          Todavía no sorteaste {category.name}. El cuadro se arma solo con el
          sorteo.
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
  if (!rounds.length) {
    return (
      <div className="tn-banner">
        <span>
          {category.name} se juega solo con zonas (todos contra todos), sin
          cuadro final. Para tener cuartos/semis/final, rehacé el sorteo
          eligiendo que pasen 1° y 2°.
        </span>
      </div>
    );
  }

  const final = rounds[rounds.length - 1].matches[0];
  const champion = calc.winnerOf(final);
  const runnerUp =
    champion && final.winner
      ? calc.resolve(final.winner === "a" ? final.b : final.a)
      : null;
  const firstRound = rounds[0];
  const waitingGroups = fixture.groups
    .filter((g) => !calc.groupDone[g.id])
    .map((g) => g.id);

  return (
    <div className="tn-stack">
      {champion && (
        <div className="tn-champion">
          <Trophy size={40} color="#e8722a" aria-hidden />
          <div>
            <span
              style={{
                fontSize: 13,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#e8722a",
              }}
            >
              Campeones {category.name}
            </span>
            <strong>{pairName(pairsById[champion])}</strong>
            {runnerUp && (
              <span style={{ opacity: 0.8 }}>
                Subcampeones: {pairName(pairsById[runnerUp])}
              </span>
            )}
          </div>
        </div>
      )}

      {waitingGroups.length > 0 && fixture.format === "zonas" && (
        <p className="tn-muted" style={{ margin: 0 }}>
          {roundName(firstRound.size)}: los nombres aparecen solos cuando
          termina cada zona (faltan{" "}
          {waitingGroups.map((g) => `Zona ${g}`).join(", ")}).
        </p>
      )}

      <div
        className="tn-bracket"
        role="list"
        aria-label={`Cuadro de ${category.name}`}
      >
        {rounds.map((r) => (
          <div key={r.size} className="tn-bracket-col" role="listitem">
            <div className="tn-bracket-round">{roundName(r.size)}</div>
            <div className="tn-bracket-matches">
              {r.matches.map((m) => (
                <BracketMatch
                  key={m.id}
                  match={m}
                  fixture={fixture}
                  calc={calc}
                  pairsById={pairsById}
                  courts={courts}
                  courtName={courtName}
                  defaultDate={t.dateEnd || t.date}
                  onSave={(payload) => onSaveMatch(category.id, m.id, payload)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatch({
  match: m,
  fixture,
  calc,
  pairsById,
  courts,
  courtName,
  defaultDate,
  onSave,
}) {
  const [editing, setEditing] = useState(null);
  const bye = isByeMatch(m);
  const a = sideInfo(calc, fixture, pairsById, m.a, { short: true });
  const b = sideInfo(calc, fixture, pairsById, m.b, { short: true });
  const ready = !a.tbd && !b.tbd;
  const { sets } = parseScore(m.score);
  const scoreFor = (side) => sets.map((s) => s[side === "a" ? 0 : 1]).join(" ");

  if (bye) {
    const real = m.a?.bye ? b : a;
    return (
      <div className="tn-bm is-bye">
        <div className="tn-bm-side">
          <span>{real.name}</span>
        </div>
        <div className="tn-bm-side is-tbd">
          <span>Pasa directo</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tn-bm">
      <div className="tn-bm-head">
        <span>
          {m.time
            ? `${dayLabel(m.date)} · ${m.time} · ${courtName(m.court)}`
            : "Sin horario"}
        </span>
        <span>{m.winner ? "Jugado" : ""}</span>
      </div>
      {[
        ["a", a],
        ["b", b],
      ].map(([k, s]) => (
        <div
          key={k}
          className={`tn-bm-side${m.winner === k ? " is-winner" : ""}${s.tbd ? " is-tbd" : ""}`}
        >
          <span>
            {m.winner === k && "🏆 "}
            {s.name}
          </span>
          <span className="tn-score">{scoreFor(k)}</span>
        </div>
      ))}
      <div className="tn-bm-foot">
        {editing ? (
          <MatchEditor
            match={m}
            sides={{ a, b }}
            courts={courts}
            defaultDate={defaultDate}
            mode={editing}
            onSave={onSave}
            onClose={() => setEditing(null)}
          />
        ) : (
          <div className="tn-row" style={{ gap: 6 }}>
            <button
              type="button"
              className="tn-icon-btn"
              disabled={!ready}
              onClick={() => setEditing("result")}
              title={
                ready
                  ? "Cargar resultado"
                  : "Se define cuando terminen los partidos anteriores"
              }
            >
              <Pencil size={13} /> {m.winner ? "Editar resultado" : "Resultado"}
            </button>
            <button
              type="button"
              className="tn-icon-btn"
              onClick={() => setEditing("schedule")}
            >
              Horario
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
