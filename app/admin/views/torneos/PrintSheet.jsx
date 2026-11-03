"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CLUB_INFO } from "../../../../data/club";
import {
  computeFixture,
  isByeMatch,
  matchLabel,
  roundName,
  shortPairName,
  sortedMatches,
  sourceLabel,
} from "../../../../lib/tournament";
import { bracketRounds } from "./BracketTab";
import { courtNamer, dayLabel, longDayLabel, tournamentDates } from "./shared";

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

  const header = (badge) => (
    <header className="tp-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/logo_full.png" alt="Muzzaga · más que pádel" />
      <div className="tp-header-text">
        <div className="tp-kicker">Torneo de pádel</div>
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
          {header("Inscriptos")}
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
    pages.push(
      <section key={c.id} className="tp-page">
        {header(c.name)}
        <div className="tp-body">
          {fx.format === "zonas" && (
            <>
              <h2 className="tp-h2">Zonas</h2>
              <div className="tp-zones">
                {fx.groups.map((g) => (
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
                    <ol>
                      {(calc.groupDone[g.id]
                        ? calc.standings[g.id].map((r) => r.pairId)
                        : g.pairIds
                      ).map((id) => (
                        <li key={id}>{shortPairName(pairsById[id]) || "—"}</li>
                      ))}
                    </ol>
                    <table className="tp-table">
                      <tbody>
                        {matches
                          .filter(
                            (m) => m.stage === "group" && m.group === g.id,
                          )
                          .map((m) => (
                            <tr key={m.id}>
                              <td className="tp-when">
                                {when(m)}
                                <br />
                                <span style={{ fontWeight: 500 }}>
                                  {courtName(m.court)}
                                </span>
                              </td>
                              <td>
                                {name(c.id, m.a).text}
                                <br />
                                {name(c.id, m.b).text}
                              </td>
                              <td>
                                <div className="tp-result">{m.score || ""}</div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </>
          )}

          {rounds.length > 0 && (
            <div className="tp-keep">
              <h2 className="tp-h2">Cuadro final</h2>
              <div className="tp-bracket">
                {rounds.map((r) => (
                  <div key={r.size} className="tp-bracket-col">
                    <div className="tp-round">{roundName(r.size)}</div>
                    <div className="tp-bracket-matches">
                      {r.matches.map((m) => {
                        if (isByeMatch(m)) {
                          const real = name(c.id, m.a?.bye ? m.b : m.a);
                          return (
                            <div
                              key={m.id}
                              className="tp-bm"
                              style={{ opacity: 0.6, borderStyle: "dashed" }}
                            >
                              <div
                                className={`tp-bm-side${real.tbd ? " is-tbd" : ""}`}
                              >
                                {real.text}
                              </div>
                              <div className="tp-bm-side is-tbd">
                                Pasa directo
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={m.id} className="tp-bm">
                            <div className="tp-bm-head">
                              <span>{when(m)}</span>
                              <span>{courtName(m.court)}</span>
                            </div>
                            {["a", "b"].map((k) => {
                              const s = name(c.id, m[k]);
                              return (
                                <div
                                  key={k}
                                  className={`tp-bm-side${s.tbd ? " is-tbd" : ""}${m.winner === k ? " is-winner" : ""}`}
                                >
                                  <span>{s.text}</span>
                                </div>
                              );
                            })}
                            {m.score && (
                              <div
                                className="tp-bm-head"
                                style={{ justifyContent: "center" }}
                              >
                                {m.score}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {footer}
      </section>,
    );
  }

  if (includeGrid && gridDays.length) {
    const usedCourts = courts.filter((ct) =>
      gridDays.some(([, times]) =>
        Object.values(times).some((byCourt) => byCourt[ct.id]),
      ),
    );
    pages.push(
      <section key="grilla" className="tp-page">
        {header("Horarios")}
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
                              <div key={m.id}>
                                <small>
                                  {withFixture.length > 1 ? `${c.name} · ` : ""}
                                  {matchLabel(m).replace(" · Fecha", " F")}
                                </small>
                                {name(c.id, m.a).text}
                                <br />
                                vs {name(c.id, m.b).text}
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
