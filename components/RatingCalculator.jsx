"use client";

import { useMemo, useState } from "react";
import Mascota from "./Mascota";
import Link from "next/link";
import { getCategoryForRating } from "../data/levels";
import {
  buildLevelShareMessage,
  buildLevelWhatsAppUrl,
  evaluatePlayerSkills,
} from "../lib/levelShare";
import { Clock, BrickWall, Zap, Share2, Trophy, MessageCircle } from "lucide-react";

export default function RatingCalculator() {
  const [mode, setMode] = useState("quiz"); // 'quiz' | 'slider'
  const [playerName, setPlayerName] = useState("");
  const [quizAnswers, setQuizAnswers] = useState({
    exp: 1, // 0: <6m, 1: 6m-2a, 2: >2a
    wall: 1, // 0: basico, 1: intermedio, 2: avanzado
    net: 1, // 0: defiendo, 1: voleo firme, 2: remate
  });
  const [raw, setRaw] = useState(37);

  // Calculate rating from quiz if in quiz mode, otherwise from raw slider
  const computedRating = useMemo(() => {
    if (mode === "slider") {
      return (raw / 10).toFixed(1);
    }
    // Quiz weights: 1.5 baseline + exp*0.7 + wall*0.7 + net*0.7
    const score =
      1.6 +
      quizAnswers.exp * 0.7 +
      quizAnswers.wall * 0.7 +
      quizAnswers.net * 0.7;
    return Math.min(5.5, Math.max(1.8, Number(score.toFixed(1))));
  }, [mode, raw, quizAnswers]);

  const category = useMemo(
    () => getCategoryForRating(Number(computedRating)),
    [computedRating],
  );

  const skills = useMemo(
    () => evaluatePlayerSkills(quizAnswers),
    [quizAnswers],
  );

  const shareWhatsappUrl = useMemo(() => {
    return buildLevelWhatsAppUrl({
      rating: computedRating,
      categoryName: category.name,
      categoryLabel: category.label,
      playerName,
    });
  }, [computedRating, category, playerName]);

  const clubContactWhatsappUrl = `https://wa.me/5492995974176?text=${encodeURIComponent(
    `¡Hola Muzzaga! Hice el test de nivel en la web y me dio ${computedRating} (${category.name}). Quiero sumarme a los partidos abiertos y torneos.`,
  )}`;

  return (
    <div className="rating-box">
      <div className="rating-mode-switch">
        <button
          type="button"
          className={`rating-tab-btn${mode === "quiz" ? " active" : ""}`}
          onClick={() => setMode("quiz")}
        >
          {/* Un solo span: como hijos sueltos del botón (flex), el espacio antes
              de "(3 preguntas)" se perdía. */}
          <span>
            Test guiado<span className="rating-tab-extra"> (3 preguntas)</span>
          </span>
        </button>
        <button
          type="button"
          className={`rating-tab-btn${mode === "slider" ? " active" : ""}`}
          onClick={() => setMode("slider")}
        >
          Ajuste manual
        </button>
      </div>

      {mode === "quiz" ? (
        <div className="quiz-questions-wrapper">
          <div className="quiz-question-group">
            <label className="quiz-label">
              1. ¿Cuánto tiempo llevás jugando al pádel?
            </label>
            <div className="quiz-options-grid">
              {[
                { label: "Menos de 6 meses", val: 0 },
                { label: "Entre 6 meses y 2 años", val: 1 },
                { label: "Más de 2 años", val: 2 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  className={`quiz-opt-btn${quizAnswers.exp === opt.val ? " selected" : ""}`}
                  onClick={() =>
                    setQuizAnswers((prev) => ({ ...prev, exp: opt.val }))
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="quiz-question-group">
            <label className="quiz-label">
              2. ¿Cómo te manejás en el rebote con pared de cristal?
            </label>
            <div className="quiz-options-grid">
              {[
                { label: "Me cuesta calcular el rebote", val: 0 },
                { label: "Paso la bola con control", val: 1 },
                { label: "Ataco de fondo y cambio ritmo", val: 2 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  className={`quiz-opt-btn${quizAnswers.wall === opt.val ? " selected" : ""}`}
                  onClick={() =>
                    setQuizAnswers((prev) => ({ ...prev, wall: opt.val }))
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="quiz-question-group">
            <label className="quiz-label">3. En la red y definición:</label>
            <div className="quiz-options-grid">
              {[
                { label: "Prefiero jugar en el fondo", val: 0 },
                { label: "Voleas firmes y bandeja", val: 1 },
                { label: "Remate por 3 / definición", val: 2 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  className={`quiz-opt-btn${quizAnswers.net === opt.val ? " selected" : ""}`}
                  onClick={() =>
                    setQuizAnswers((prev) => ({ ...prev, net: opt.val }))
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            Ajustá con la barra deslizante tu nivel estimado:
          </label>
          <input
            type="range"
            min="15"
            max="55"
            step="1"
            value={raw}
            onChange={(e) => setRaw(Number(e.target.value))}
            aria-label="Nivel de juego estimado"
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 4,
            }}
          >
            <span>1.5 (Iniciación)</span>
            <span>3.5 (Intermedio)</span>
            <span>5.5+ (Avanzado)</span>
          </div>
        </div>
      )}

      {/* CARNET DIGITAL OFICIAL DEL JUGADOR */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--color-surface-card), var(--color-canvas-soft))",
          border: "1.5px solid var(--color-hairline-strong, #e2e8f0)",
          borderRadius: "var(--radius-lg, 14px)",
          padding: "16px 18px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          margin: "18px 0 16px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #ff7a1a, #ff3300)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--color-accent-orange-text)",
                display: "block",
              }}
            >
              Ficha de jugador
            </span>
            <strong style={{ fontSize: 15, color: "var(--color-ink)" }}>
              Muzzaga Pádel Club
            </strong>
          </div>

          <Mascota
            pose="enredado-grip"
            size="s"
            alt="Muzzaguito enredado con el grip"
            className="mascot-card"
          />
        </div>

        {/* Input opcional de nombre para personalizar */}
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Escribí tu nombre (ej. Lucas)"
            style={{
              width: "100%",
              height: 34,
              fontSize: 12.5,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--color-hairline-strong)",
              background: "var(--color-canvas)",
              color: "var(--color-ink)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            background: "rgba(255, 122, 26, 0.06)",
            border: "1px solid rgba(255, 122, 26, 0.2)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Categoría Argentina
            </div>
            <strong style={{ fontSize: 18, color: "var(--color-ink)" }}>
              {category.name}
            </strong>
            <span style={{ fontSize: 12, color: "var(--color-muted)", display: "block" }}>
              {category.tag} · {category.ratingRange}
            </span>
          </div>

          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <div style={{ fontSize: 10, color: "var(--color-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Rating Int.
            </div>
            <strong style={{ fontSize: 22, color: "var(--color-accent-orange)", fontWeight: 800 }}>
              {computedRating}
            </strong>
            <span style={{ fontSize: 11, color: "var(--color-muted)" }}>/7.0</span>
          </div>
        </div>

        {/* Diagnóstico de Habilidades */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 6,
            fontSize: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px dashed var(--color-hairline, #e2e8f0)", paddingBottom: 4 }}>
            <span style={{ color: "var(--color-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}><Clock size={20} className="icono-marca" aria-hidden="true" /> Experiencia:</span>
            <strong style={{ color: "var(--color-ink)", textAlign: "right" }}>{skills.experience}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px dashed var(--color-hairline, #e2e8f0)", paddingBottom: 4 }}>
            <span style={{ color: "var(--color-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}><BrickWall size={20} className="icono-marca" aria-hidden="true" /> Rebote en el cristal:</span>
            <strong style={{ color: "var(--color-ink)", textAlign: "right" }}>{skills.wallPlay}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--color-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}><Zap size={20} className="icono-marca" aria-hidden="true" /> Red y remate:</span>
            <strong style={{ color: "var(--color-ink)", textAlign: "right" }}>{skills.netPlay}</strong>
          </div>
        </div>

        <p className="rating-desc-text" style={{ margin: "0 0 14px", fontSize: 12.5, lineHeight: 1.45 }}>
          {category.desc}
        </p>

        {/* Acciones del Carnet */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a
            href={shareWhatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-whatsapp"
            style={{
              width: "100%",
              justifyContent: "center",
              minHeight: 44,
              fontSize: 13.5,
              textDecoration: "none",
            }}
            title="Compartir mi nivel de pádel con mi compañero o grupo"
          >
            <Share2 size={20} aria-hidden="true" />
            <span>Compartir ficha por WhatsApp</span>
          </a>

          <div className="rating-share-actions">
            {/* Antes era "#torneos", que en esta página no existe: no llevaba a ningún lado. */}
            <a
              href="/torneos"
              className="btn btn-secondary"
              style={{
                justifyContent: "center",
                fontSize: 12,
                height: 36,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              <Trophy size={20} className="icono-marca" aria-hidden="true" /> Ver torneos
            </a>

            <a
              href={clubContactWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{
                justifyContent: "center",
                fontSize: 12,
                height: 36,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              <MessageCircle size={20} className="icono-marca" aria-hidden="true" /> Partidos parejos
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
