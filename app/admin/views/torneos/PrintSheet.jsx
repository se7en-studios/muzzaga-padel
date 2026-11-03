"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CLUB_INFO } from "../../../../data/club";
import {
  computeFixture,
  isByeMatch,
  matchLabel,
  shortPairName,
  sortedMatches,
  sourceLabel,
} from "../../../../lib/tournament";
import { bracketRounds } from "./BracketTab";
import {
  BracketTree,
  courtNamer,
  dayLabel,
  longDayLabel,
  SetScores,
  tournamentDates,
} from "./shared";

/**
 * Hoja del torneo con la marca Muzzaga: una página por categoría (zonas con
 * sus partidos y horarios + cuadro final) y la grilla de horarios por
 * cancha para pegar en la cartelera. Se imprime o se guarda como PDF desde
 * el diálogo del navegador.
 */
export default function PrintSheet({
  tournament: t,
  courts,
  pairsById,
  onClose,
}) {
  const withFixture = t.categories.filter((c) => t.fixtures?.[c.id]);
  const [cats, setCats] = useState(() => withFixture.map((c) => c.id));
  const [includeGrid, setIncludeGrid] = useState(true);
  const [includePairs, setIncludePairs] = useState(
    withFixture.length < t.categories.length,
  );
  const courtName = courtNamer(courts);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    document.body.classList.add("tp-printing");
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    const prevTitle = document.title;
    document.title = `${t.name} · Muzzaga Pádel`;
    return () => {
      document.body.classList.remove("tp-printing");
      window.removeEventListener("keydown", onKey);
      document.title = prevTitle;
    };
  }, [t.name]);

  const calcs = useMemo(() => {
    const out = {};
    for (const c of withFixture) out[c.id] = computeFixture(t.fixtures[c.id]);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.fixtures]);

  const name = (catId, src) => {
    const id = calcs[catId].resolve(src);
    return id && pairsById[id]
      ? { text: shortPairName(pairsById[id]), tbd: false }
      : { text: sourceLabel(src, t.fixtures[catId].matches), tbd: true };
  };
  const when = (m) => (m.time ? `${dayLabel(m.date)} ${m.time}` : "A conf.");

  const gridDays = useMemo(() => {
    const days = {};
    for (const c of withFixture) {
      if (!cats.includes(c.id)) continue;
      for (const m of Object.values(t.fixtures[c.id].matches)) {
        if (isByeMatch(m) || !m.date || !m.time) continue;
        const d = (days[m.date] ||= {});
        ((d[m.time] ||= {})[m.court] ||= []).push({ m, c });
      }
    }
    return Object.entries(days).sort(([a], [b]) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.fixtures, cats]);

  const header = (badge, kicker = "Torneo de pádel") => (
    <header className="tp-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/logo_full.png" alt="Muzzaga · más que pádel" />
      <div className="tp-header-text">
        <div className="tp-kicker">{kicker}</div>
        <div className="tp-title">{t.name}</div>
        <div className="tp-sub">
          {tournamentDates(t)} · {CLUB_INFO.city}, {CLUB_INFO.province}
        </div>
      </div>
      {badge && <div className="tp-cat-badge">{badge}</div>}
    </header>
  );
  const footer = (
    <footer className="tp-footer">
      <span>
        <strong>muzzaga</strong> · más que pádel
      </span>
      <span>
        Consultas e inscripción: WhatsApp {CLUB_INFO.phoneFormatted} ·{" "}
        {CLUB_INFO.instagramHandle}
      </span>
    </footer>
  );

  const pages = [];

  // Inscriptos de las categorías que todavía no se sortearon.
  if (includePairs) {
    const pending = t.categories.filter((c) => !t.fixtures?.[c.id]);
    if (pending.length) {
      pages.push(
        <section key="inscriptos" className="tp-page">
          {header("Inscriptos", "Parejas anotadas")}
          <div className="tp-body">
            {pending.map((c) => {
              const list = t.players.filter((p) => p.categoryId === c.id);
              return (
                <div key={c.id}>
                  <h2 className="tp-h2">
                    {c.name} · {list.length} parejas
                  </h2>
                  <table className="tp-table">
                    <tbody>
                      {list.map((p, i) => (
                        <tr key={p.id}>
                          <td style={{ width: "8mm" }}>{i + 1}</td>
                          <td>
                            <strong>{p.name}</strong>
                            {p.partner ? ` / ${p.partner}` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          {footer}
        </section>,
      );
    }
  }

  for (const c of withFixture) {
    if (!cats.includes(c.id)) continue;
    const fx = t.fixtures[c.id];
    const calc = calcs[c.id];
    const matches = sortedMatches(fx);
    const rounds = bracketRounds(fx);
    const anyPlayed = Object.values(fx.matches).some(
      (m) => m.stage === "group" && m.winner,
    );
    if (fx.format === "zonas") {
      pages.push(
        <section key={`${c.id}-zonas`} className="tp-page">
          {header(c.name, "Fase de zonas")}
          <div className="tp-body">
            <div className="tp-zones">
              {fx.groups.map((g) => {
                const rows = calc.standings[g.id];
                return (
                  <div key={g.id} className="tp-zone">
                    <div className="tp-zone-head">
                      Zona {g.id}
                      {fx.qualify > 0 && (
                        <span>
                          {fx.qualify === 1
                            ? "Pasa el 1°"
                            : `Pasan ${fx.qualify}`}
                        </span>
                      )}
                    </div>
                    <table className="tp-standings">
                      {anyPlayed && (
                        <thead>
                          <tr>
                            <th colSpan={2}>Pareja</th>
                            <th>PJ</th>
                            <th>PG</th>
                            <th>Games</th>
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {(anyPlayed
                          ? rows
                          : g.pairIds.map((id) => ({ pairId: id }))
                        ).map((r, i) => (
                          <tr
                            key={r.pairId}
                            className={
                              anyPlayed && i < fx.qualify ? "is-q" : ""
                            }
                          >
                            <td className="tp-pos">{i + 1}</td>
                            <td className="tp-pname">
                              {shortPairName(pairsById[r.pairId]) || "—"}
                            </td>
                            {anyPlayed && (
                              <>
                                <td>{r.played}</td>
                                <td>
                                  <strong>{r.won}</strong>
                                </td>
                                <td>{signed(r.gamesFor - r.gamesAgainst)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <table className="tp-table">
                      <tbody>
                        {matches
                          .filter(
                            (m) => m.stage === "group" && m.group === g.id,
                          )
                          .map((m) => (
                            <tr key={m.id}>
                              <td className="tp-when">
                                <strong>{m.time || "A conf."}</strong>
                                <span className="tp-court">
                                  {m.date ? dayLabel(m.date) : ""}
                                  {m.court
                                    ? ` · ${courtName(m.court).replace("Cancha ", "C")}`
                                    : ""}
                                </span>
                              </td>
                              <td className="tp-vs">
                                <span
                                  className={m.winner === "a" ? "is-w" : ""}
                                >
                                  {name(c.id, m.a).text}
                                </span>
                                <span
                                  className={m.winner === "b" ? "is-w" : ""}
                                >
                                  {name(c.id, m.b).text}
                                </span>
                              </td>
                              <td className="tp-result-cell">
                                <div className="tp-result">{m.score || ""}</div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
            {fx.qualify > 0 && (
              <p className="tp-note">
                Clasifican{" "}
                {fx.qualify === 1
                  ? "el 1° de cada zona"
                  : `los ${fx.qualify} primeros de cada zona`}
                . Desempate: partidos ganados, resultado entre ellos, diferencia
                de sets y de games.
              </p>
            )}
          </div>
          {footer}
        </section>,
      );
    }

    if (rounds.length > 0) {
      const finalMatch = rounds[rounds.length - 1].matches[0];
      const champ = calc.winnerOf(finalMatch);
      pages.push(
        <section key={`${c.id}-cuadro`} className="tp-page">
          {header(c.name, "Cuadro final")}
          <div className="tp-body">
            <BracketTree
              className="bk-print"
              rounds={rounds}
              renderMatch={(m) => {
                if (isByeMatch(m)) {
                  const real = name(c.id, m.a?.bye ? m.b : m.a);
                  return (
                    <div className="bk-match is-bye">
                      <div className={`bk-side${real.tbd ? " is-tbd" : ""}`}>
                        <span className="bk-name">{real.text}</span>
                      </div>
                      <div className="bk-side is-tbd">
                        <span className="bk-name">Pasa directo</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="bk-match">
                    <div className="bk-head">
                      <span>{when(m)}</span>
                      <span>{courtName(m.court)}</span>
                    </div>
                    {["a", "b"].map((k) => {
                      const sd = name(c.id, m[k]);
                      return (
                        <div
                          key={k}
                          className={`bk-side${sd.tbd ? " is-tbd" : ""}${m.winner === k ? " is-winner" : ""}${m.winner && m.winner !== k ? " is-loser" : ""}`}
                        >
                          <span className="bk-name">{sd.text}</span>
                          {m.score ? (
                            <SetScores score={m.score} side={k} />
                          ) : (
                            <span className="bk-blank" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }}
              champion={
                <div className={`bk-champ${champ ? " is-set" : ""}`}>
                  <span className="bk-champ-cup">🏆</span>
                  <span>{champ ? shortPairName(pairsById[champ]) : ""}</span>
                </div>
              }
            />
          </div>
          {footer}
        </section>,
      );
    }
  }

  if (includeGrid && gridDays.length) {
    const usedCourts = courts.filter((ct) =>
      gridDays.some(([, times]) =>
        Object.values(times).some((byCourt) => byCourt[ct.id]),
      ),
    );
    pages.push(
      <section key="grilla" className="tp-page">
        {header("Horarios", "Grilla por cancha")}
        <div className="tp-body">
          {gridDays.map(([day, times]) => (
            <div key={day} className="tp-grid-day">
              <h2 className="tp-h2">{longDayLabel(day)}</h2>
              <table className="tp-table tp-grid">
                <thead>
                  <tr>
                    <th>Hora</th>
                    {usedCourts.map((ct) => (
                      <th key={ct.id} style={{ textAlign: "center" }}>
                        {ct.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(times)
                    .sort()
                    .map((time) => (
                      <tr key={time}>
                        <td className="tp-grid-time">{time}</td>
                        {usedCourts.map((ct) => (
                          <td key={ct.id} className="tp-grid-cell">
                            {(times[time][ct.id] || []).map(({ m, c }) => (
                              <div key={m.id} className="tp-grid-match">
                                <small>
                                  {withFixture.length > 1 ? `${c.name} · ` : ""}
                                  {matchLabel(m).replace(" · Fecha ", " · F")}
                                </small>
                                <span>
                                  {name(c.id, m.a).text} <em>vs</em>{" "}
                                  {name(c.id, m.b).text}
                                </span>
                              </div>
                            ))}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        {footer}
      </section>,
    );
  }

  return createPortal(
    <div
      className="tp-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa del PDF"
    >
      <div className="tp-toolbar">
        <div className="tp-toolbar-group">
          <strong>PDF del torneo</strong>
          {withFixture.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={cats.includes(c.id)}
                onChange={(e) =>
                  setCats(
                    e.target.checked
                      ? [...cats, c.id]
                      : cats.filter((x) => x !== c.id),
                  )
                }
              />
              {c.name}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={includeGrid}
              onChange={(e) => setIncludeGrid(e.target.checked)}
            />
            Grilla de horarios
          </label>
          {withFixture.length < t.categories.length && (
            <label>
              <input
                type="checkbox"
                checked={includePairs}
                onChange={(e) => setIncludePairs(e.target.checked)}
              />
              Inscriptos sin sortear
            </label>
          )}
        </div>
        <div className="tp-toolbar-group">
          <button type="button" className="tp-btn" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="tp-btn is-primary"
            onClick={() => window.print()}
            disabled={!pages.length}
          >
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>
      <div className="tp-sheet">
        {pages.length ? (
          pages
        ) : (
          <section className="tp-page">
            {header(null)}
            <div className="tp-body">
              <p>
                Todavía no hay nada para imprimir: sorteá al menos una categoría
                o anotá parejas.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}

const signed = (n) => (n > 0 ? `+${n}` : String(n));
