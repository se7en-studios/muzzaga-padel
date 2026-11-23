"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  generateFixtures,
  buildAmericanoShareMessage,
  buildAmericanoWhatsAppUrl,
} from "../lib/americano";
import Image from "next/image";
import { WhatsAppLogo } from "./BrandLogos";
import { Check, Copy } from "lucide-react";

const DEFAULT_NAMES = ["Jugador 1", "Jugador 2", "Jugador 3", "Jugador 4"];

export default function AmericanoGenerator() {
  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [scores, setScores] = useState({}); // { [round]: { t1: number, t2: number } }
  const [copied, setCopied] = useState(false);

  const handleCountChange = (count) => {
    setPlayerCount(count);
    const newNames = Array.from(
      { length: count },
      (_, i) => names[i] || `Jugador ${i + 1}`,
    );
    setNames(newNames);
    setScores({});
  };

  const handleNameChange = (idx, val) => {
    setNames((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const handleScoreChange = (round, team, val) => {
    const num = val === "" ? "" : Math.max(0, Math.min(20, Number(val) || 0));
    setScores((prev) => ({
      ...prev,
      [round]: {
        ...(prev[round] || { t1: "", t2: "" }),
        [team]: num,
      },
    }));
  };

  const fixtures = useMemo(() => generateFixtures(names), [names]);

  const whatsappUrl = useMemo(() => {
    return buildAmericanoWhatsAppUrl({
      names,
      fixtures,
      scores,
    });
  }, [names, fixtures, scores]);

  const copyFixture = () => {
    const msg = buildAmericanoShareMessage({
      names,
      fixtures,
      scores,
    });
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Tabla en vivo: solo lectura de lo que ya anotaron (no cambia el fixture
  // ni el texto de WhatsApp). Cada jugador suma los games de su pareja.
  const ranking = useMemo(() => {
    const totals = new Map(names.map((n) => [n, 0]));
    let anyScore = false;
    fixtures.forEach((fix) => {
      const s = scores[fix.round];
      if (!s || (s.t1 === "" && s.t2 === "")) return;
      anyScore = true;
      const a = Number(s.t1) || 0;
      const b = Number(s.t2) || 0;
      [fix.p1, fix.p2].forEach((p) => totals.set(p, (totals.get(p) || 0) + a));
      [fix.p3, fix.p4].forEach((p) => totals.set(p, (totals.get(p) || 0) + b));
    });
    if (!anyScore) return [];
    return [...totals.entries()].sort((x, y) => y[1] - x[1]);
  }, [names, fixtures, scores]);

  const matchesPerPlayer = Math.round((fixtures.length * 4) / playerCount);

  // Tabla en vivo: cuando alguien pasa adelante, la fila viaja a su lugar
  // (FLIP con transform) en vez de saltar. Solo visual.
  const tablaRef = useRef(null);
  const tablaPos = useRef(new Map());
  useLayoutEffect(() => {
    const ol = tablaRef.current;
    if (!ol) {
      tablaPos.current = new Map();
      return;
    }
    const rows = [...ol.children];
    const next = new Map(rows.map((li) => [li.dataset.jugador, li.getBoundingClientRect().top]));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      rows.forEach((li) => {
        const before = tablaPos.current.get(li.dataset.jugador);
        const now = next.get(li.dataset.jugador);
        if (before === undefined || Math.abs(before - now) < 1) return;
        li.animate(
          [{ transform: `translateY(${before - now}px)` }, { transform: "none" }],
          { duration: 420, easing: "cubic-bezier(0.34, 1.3, 0.64, 1)" },
        );
      });
    }
    tablaPos.current = next;
  }, [ranking]);

  return (
    <section id="generador-americano" className="hx-tool hx-tool--americano">
      <div className="container">
        <header className="hx-hero">
          <span className="hx-hero-pelota" aria-hidden="true" />
          <Image
            src="/img/iconos/icono-americano.webp"
            alt=""
            width={124}
            height={124}
            priority
            className="hx-hero-icono icono-3d"
          />
          <div className="hx-hero-cabeza">
            <p className="hx-hero-kicker">Herramienta 04 · Torneo express</p>
            <h1 className="hx-hero-titulo">Torneo americano</h1>
          </div>
          <p className="hx-hero-desc">
            Armá las rotaciones al instante para que todos jueguen con y contra
            todos. Anotá los games en vivo y mandá el fixture al grupo.
          </p>
          <ul className="hx-hero-chips" aria-label="Características">
            <li>4 a 8 jugadores</li>
            <li>Todos con todos</li>
            <li>Tabla en vivo</li>
          </ul>
        </header>

        <div className="hx-am-grid">
          {/* CONFIGURACIÓN */}
          <div className="hx-am-config">
            <div className="hx-card">
              <div className="hx-paso">
                <span className="hx-paso-num" aria-hidden="true">1</span>
                <div>
                  <h2 className="hx-paso-titulo">¿Cuántos juegan?</h2>
                  <p className="hx-paso-desc">Una cancha, parejas que rotan</p>
                </div>
              </div>

              <div className="hx-numeros" role="group" aria-label="Cantidad de jugadores">
                {[4, 5, 6, 7, 8].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={`hx-num${playerCount === count ? " is-on" : ""}`}
                    aria-pressed={playerCount === count}
                    onClick={() => handleCountChange(count)}
                  >
                    <span className="hx-num-valor">{count}</span>
                    <span className="hx-num-cap">jug.</span>
                    <span className="sr-only"> jugadores</span>
                  </button>
                ))}
              </div>

              <ul className="hx-am-meta">
                <li>{fixtures.length} rondas</li>
                <li>{matchesPerPlayer} partidos c/u</li>
              </ul>
            </div>

            <div className="hx-card">
              <div className="hx-paso">
                <span className="hx-paso-num" aria-hidden="true">2</span>
                <div>
                  <h2 className="hx-paso-titulo">Los jugadores</h2>
                  <p className="hx-paso-desc">Tocá cada nombre para cambiarlo</p>
                </div>
              </div>

              <div className="hx-am-nombres">
                {names.map((name, idx) => (
                  <div key={idx} className="hx-am-nombre">
                    <span className="hx-paso-num" aria-hidden="true">{idx + 1}</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(idx, e.target.value)}
                      placeholder={`Jugador ${idx + 1}`}
                      aria-label={`Nombre del jugador ${idx + 1}`}
                      className="hx-campo"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FIXTURE */}
          <div className="hx-am-fixture">
            <div className="hx-paso" style={{ marginBottom: 0 }}>
              <span className="hx-paso-num" aria-hidden="true">3</span>
              <div>
                <h2 className="hx-paso-titulo">Fixture y games</h2>
                <p className="hx-paso-desc">Anotá los games de cada pareja al terminar</p>
              </div>
            </div>

            {/* key: al cambiar la cantidad, el cuadro nuevo "da vuelta"
                ronda por ronda como un tablero (ver herramientas.css). */}
            <ol className="hx-am-rondas" key={playerCount}>
              {fixtures.map((fix, i) => {
                const roundScore = scores[fix.round] || { t1: "", t2: "" };
                const hasScore = roundScore.t1 !== "" || roundScore.t2 !== "";
                const a = Number(roundScore.t1) || 0;
                const b = Number(roundScore.t2) || 0;
                return (
                  <li
                    key={fix.round}
                    className="hx-marcador hx-am-ronda"
                    style={{ "--i": Math.min(i, 8) }}
                  >
                    <div className="hx-am-ronda-cabeza">
                      <span className="hx-am-ronda-num">Ronda {fix.round}</span>
                      {fix.bye && (
                        <span className="hx-am-descansa">
                          Descansa: <b>{fix.bye}</b>
                        </span>
                      )}
                    </div>

                    <div className={`hx-am-fila${hasScore && a > b ? " is-gana" : ""}`}>
                      <span className="hx-am-saque" aria-hidden="true" />
                      <span className="hx-am-pareja">
                        {fix.p1} <i>&amp;</i> {fix.p2}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="20"
                        className="hx-am-games"
                        value={roundScore.t1}
                        onChange={(e) => handleScoreChange(fix.round, "t1", e.target.value)}
                        placeholder="0"
                        aria-label={`Games de ${fix.p1} y ${fix.p2}, ronda ${fix.round}`}
                      />
                    </div>

                    <div className={`hx-am-fila${hasScore && b > a ? " is-gana" : ""}`}>
                      <span className="hx-am-saque" aria-hidden="true" />
                      <span className="hx-am-pareja">
                        {fix.p3} <i>&amp;</i> {fix.p4}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="20"
                        className="hx-am-games"
                        value={roundScore.t2}
                        onChange={(e) => handleScoreChange(fix.round, "t2", e.target.value)}
                        placeholder="0"
                        aria-label={`Games de ${fix.p3} y ${fix.p4}, ronda ${fix.round}`}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>

            {ranking.length > 0 && (
              <div className="hx-card">
                <div className="hx-paso" style={{ marginBottom: 8 }}>
                  <span className="hx-paso-num" aria-hidden="true">🏆</span>
                  <div>
                    <h2 className="hx-paso-titulo">Tabla en vivo</h2>
                    <p className="hx-paso-desc">Games ganados por cada jugador</p>
                  </div>
                </div>
                <ol className="hx-am-tabla" ref={tablaRef}>
                  {ranking.map(([name, games], i) => (
                    <li key={name} data-jugador={name}>
                      <span className="hx-am-pos">{i + 1}</span>
                      <span className="hx-am-tabla-nombre">{name || `Jugador ${i + 1}`}</span>
                      <span className="hx-am-tabla-pts">
                        <b>{games}</b> games
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="hx-acciones">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hx-wa"
                title="Abrir en WhatsApp y enviar fixture al grupo"
              >
                <WhatsAppLogo size={22} color="#ffffff" />
                <span>Mandar fixture al grupo</span>
              </a>
              <button
                type="button"
                className={`hx-btn2${copied ? " is-ok" : ""}`}
                onClick={copyFixture}
                title="Copiar fixture completo al portapapeles"
              >
                {copied ? (
                  <><Check size={18} aria-hidden="true" /> Fixture copiado</>
                ) : (
                  <><Copy size={18} className="icono-marca" aria-hidden="true" /> Copiar fixture</>
                )}
              </button>
            </div>

            <p className="hx-nota">
              Formato recomendado: partidos a 4 o 6 games corridos con punto de
              oro en el 40-40. Los games anotados se incluyen al compartir.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
