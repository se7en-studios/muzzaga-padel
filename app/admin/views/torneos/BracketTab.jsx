"use client";

import { useMemo, useState } from "react";
import { Clock, Pencil, Trophy } from "lucide-react";
import {
  computeFixture,
  isByeMatch,
  pairName,
  roundName,
  shortPairName,
} from "../../../../lib/tournament";
import {
  BracketTree,
  courtNamer,
  dayLabel,
  MatchEditor,
  SetScores,
  sideInfo,
} from "./shared";

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

      <div className="tn-bracket-scroll">
        <BracketTree
          className="bk-screen"
          rounds={rounds}
          renderMatch={(m) => (
            <BracketMatch
              match={m}
              fixture={fixture}
              calc={calc}
              pairsById={pairsById}
              courts={courts}
              courtName={courtName}
              defaultDate={t.dateEnd || t.date}
              onSave={(payload) => onSaveMatch(category.id, m.id, payload)}
            />
          )}
          champion={
            <div className={`bk-champ${champion ? " is-set" : ""}`}>
              <Trophy size={22} aria-hidden />
              <span>
                {champion ? shortPairName(pairsById[champion]) : "A definir"}
              </span>
            </div>
          }
        />
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
  const a = sideInfo(calc, fixture, pairsById, m.a, { short: true });
  const b = sideInfo(calc, fixture, pairsById, m.b, { short: true });
  const ready = !a.tbd && !b.tbd;

  if (isByeMatch(m)) {
    const real = m.a?.bye ? b : a;
    return (
      <div className="bk-match is-bye">
        <div className={`bk-side${real.tbd ? " is-tbd" : ""}`}>
          <span className="bk-name">{real.name}</span>
        </div>
        <div className="bk-side is-tbd">
          <span className="bk-name">Pasa directo</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bk-match${m.winner ? " is-played" : ""}${editing ? " is-editing" : ""}`}
    >
      <div className="bk-head">
        <span>
          {m.time
            ? `${dayLabel(m.date)} · ${m.time} · ${courtName(m.court)}`
            : "Sin horario"}
        </span>
        <span className="bk-tools">
          <button
            type="button"
            onClick={() =>
              setEditing(editing === "schedule" ? null : "schedule")
            }
            aria-label="Cambiar día, hora o cancha"
            title="Cambiar día, hora o cancha"
          >
            <Clock size={13} />
          </button>
        </span>
      </div>
      {[
        ["a", a],
        ["b", b],
      ].map(([k, side]) => (
        <div
          key={k}
          className={`bk-side${m.winner === k ? " is-winner" : ""}${m.winner && m.winner !== k ? " is-loser" : ""}${side.tbd ? " is-tbd" : ""}`}
        >
          <span className="bk-name">{side.name}</span>
          <SetScores score={m.score} side={k} />
        </div>
      ))}
      {editing ? (
        <div className="bk-edit">
          <MatchEditor
            match={m}
            sides={{ a, b }}
            courts={courts}
            defaultDate={defaultDate}
            mode={editing}
            onSave={onSave}
            onClose={() => setEditing(null)}
          />
        </div>
      ) : (
        <button
          type="button"
          className="bk-result-btn"
          disabled={!ready}
          onClick={() => setEditing("result")}
          title={
            ready
              ? "Cargar resultado"
              : "Se define cuando terminen los partidos anteriores"
          }
        >
          <Pencil size={12} aria-hidden />{" "}
          {!ready
            ? "Esperando rivales"
            : m.winner
              ? "Editar resultado"
              : "Cargar resultado"}
        </button>
      )}
    </div>
  );
}
