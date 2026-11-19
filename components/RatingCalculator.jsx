"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Mascota from "./Mascota";
import { getCategoryForRating } from "../data/levels";
import {
  buildLevelShareMessage,
  buildLevelWhatsAppUrl,
  evaluatePlayerSkills,
} from "../lib/levelShare";
import {
  Clock,
  BrickWall,
  Zap,
  Share2,
  Trophy,
  MessageCircle,
  Activity,
  Users,
  Medal,
  RotateCcw,
} from "lucide-react";

// 6 preguntas de 0 a 2 cubren toda la escala 1.0-7.0 (8va a 1era):
// score = 1.0 + suma(respuestas) * 0.5.
const QUESTIONS = [
  {
    key: "exp",
    emoji: "⏱️",
    question: "¿Cuánto tiempo llevás jugando al pádel?",
    options: [
      { emoji: "🌱", label: "Menos de 6 meses", val: 0 },
      { emoji: "📈", label: "Entre 6 meses y 2 años", val: 1 },
      { emoji: "💪", label: "Más de 2 años", val: 2 },
    ],
  },
  {
    key: "wall",
    emoji: "🧱",
    question: "Te tiran una bola profunda que pega de lleno en la pared de fondo. ¿Qué hacés?",
    options: [
      { emoji: "😅", label: "Dudo el rebote y la devuelvo como puedo", val: 0 },
      { emoji: "🙂", label: "Calculo el rebote y la paso con control", val: 1 },
      { emoji: "🔥", label: "Ataco de fondo y cambio el ritmo del punto", val: 2 },
    ],
  },
  {
    key: "net",
    emoji: "🎯",
    question: "Tu pareja te deja una bola cómoda cerca de la red. ¿Qué hacés?",
    options: [
      { emoji: "🛡️", label: "Prefiero quedarme atrás, no me la juego en la red", val: 0 },
      { emoji: "🙌", label: "Resuelvo con volea firme o bandeja", val: 1 },
      { emoji: "💥", label: "Remato por 3 y busco cerrar el punto", val: 2 },
    ],
  },
  {
    key: "serve",
    emoji: "🚀",
    question: "Te toca sacar en un punto importante. ¿Cómo lo resolvés?",
    options: [
      { emoji: "🤷", label: "Saco básico y me cuesta cubrir la cancha después", val: 0 },
      { emoji: "🎯", label: "Tengo variantes de saque y buen desplazamiento", val: 1 },
      { emoji: "⚡", label: "Saco con efecto/potencia y cubro toda la cancha", val: 2 },
    ],
  },
  {
    key: "position",
    emoji: "🧭",
    question: "Tu pareja sube a la red. ¿Qué hacés vos?",
    options: [
      { emoji: "🙈", label: "Cada uno cubre lo que puede, sin coordinar mucho", val: 0 },
      { emoji: "🤝", label: "Subo con ella/él, pero a veces dudamos quién cubre qué", val: 1 },
      { emoji: "🧠", label: "Subimos juntos y cerramos la cancha en equipo", val: 2 },
    ],
  },
  {
    key: "tactic",
    emoji: "🏅",
    question: "¿Jugaste torneos o ligas organizadas?",
    options: [
      { emoji: "🙅", label: "Nunca jugué torneos", val: 0 },
      { emoji: "🎲", label: "Torneo social o amistoso", val: 1 },
      { emoji: "🏆", label: "Compito en torneos/ligas federadas", val: 2 },
    ],
  },
];

const DEFAULT_ANSWERS = {
  exp: 1,
  wall: 1,
  net: 1,
  serve: 1,
  position: 1,
  tactic: 1,
};

const ANSWER_ADVANCE_DELAY = 380;
const CONFETTI_DURATION = 1400;

// Posiciones fijas (no al azar) para que el confeti no cambie entre el
// render de servidor y el de cliente.
const CONFETTI_PIECES = [
  { left: "6%", delay: "0s", emoji: "🎾" },
  { left: "16%", delay: "0.08s", emoji: "🎉" },
  { left: "26%", delay: "0.16s", emoji: "⭐" },
  { left: "36%", delay: "0.04s", emoji: "🔥" },
  { left: "46%", delay: "0.22s", emoji: "🏆" },
  { left: "56%", delay: "0.1s", emoji: "🎾" },
  { left: "66%", delay: "0.28s", emoji: "🎉" },
  { left: "76%", delay: "0.06s", emoji: "⭐" },
  { left: "86%", delay: "0.18s", emoji: "🔥" },
  { left: "94%", delay: "0.12s", emoji: "🏆" },
];

export default function RatingCalculator() {
  const [mode, setMode] = useState("quiz"); // 'quiz' | 'slider'
  const [playerName, setPlayerName] = useState("");
  const [quizAnswers, setQuizAnswers] = useState(DEFAULT_ANSWERS);
  const [step, setStep] = useState(0); // índice de la pregunta actual; === QUESTIONS.length cuando terminó
  const [justFinished, setJustFinished] = useState(false);
  const [raw, setRaw] = useState(34);

  const advanceTimer = useRef(null);
  const confettiTimer = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(advanceTimer.current);
      clearTimeout(confettiTimer.current);
    };
  }, []);

  const quizDone = step >= QUESTIONS.length;

  function handleAnswer(key, val) {
    setQuizAnswers((prev) => ({ ...prev, [key]: val }));
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      setStep((s) => {
        const next = Math.min(s + 1, QUESTIONS.length);
        if (next === QUESTIONS.length) {
          setJustFinished(true);
          clearTimeout(confettiTimer.current);
          confettiTimer.current = setTimeout(
            () => setJustFinished(false),
            CONFETTI_DURATION,
          );
        }
        return next;
      });
    }, ANSWER_ADVANCE_DELAY);
  }

  function handleBack() {
    clearTimeout(advanceTimer.current);
    setStep((s) => Math.max(0, s - 1));
  }

  function handleRestart() {
    clearTimeout(advanceTimer.current);
    clearTimeout(confettiTimer.current);
    setJustFinished(false);
    setQuizAnswers(DEFAULT_ANSWERS);
    setStep(0);
  }

  // Calculate rating from quiz if in quiz mode, otherwise from raw slider.
  const computedRating = useMemo(() => {
    if (mode === "slider") {
      return (raw / 10).toFixed(1);
    }
    const sum =
      quizAnswers.exp +
      quizAnswers.wall +
      quizAnswers.net +
      quizAnswers.serve +
      quizAnswers.position +
      quizAnswers.tactic;
    const score = 1.0 + sum * 0.5;
    return Math.min(7.0, Math.max(1.0, Number(score.toFixed(1)))).toFixed(1);
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

  const showResult = mode === "slider" || quizDone;
  const currentQuestion = QUESTIONS[step];

  return (
    <div className="rating-box">
      <div className="rating-mode-switch">
        <button
          type="button"
          className={`rating-tab-btn${mode === "quiz" ? " active" : ""}`}
          onClick={() => setMode("quiz")}
        >
          {/* Un solo span: como hijos sueltos del botón (flex), el espacio antes
              de "(6 preguntas)" se perdía. */}
          <span>
            Test guiado<span className="rating-tab-extra"> (6 preguntas)</span>
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
        quizDone ? (
          <p className="quiz-done-label">
            🎉 ¡Test completado! Mirá tu resultado abajo.
          </p>
        ) : (
          <div>
            <div className="quiz-progress-label">
              <span>
                Pregunta {step + 1} de {QUESTIONS.length}
              </span>
              <span aria-hidden="true">{currentQuestion.emoji}</span>
            </div>
            <div className="quiz-progress-track">
              <div
                className="quiz-progress-fill"
                style={{ width: `${(step / QUESTIONS.length) * 100}%` }}
              />
            </div>

            <div className="quiz-step" key={step}>
              <label className="quiz-label">
                {currentQuestion.emoji} {step + 1}. {currentQuestion.question}
              </label>
              <div className="quiz-options-grid">
                {currentQuestion.options.map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    className={`quiz-opt-btn${quizAnswers[currentQuestion.key] === opt.val ? " selected" : ""}`}
                    onClick={() => handleAnswer(currentQuestion.key, opt.val)}
                  >
                    <span className="quiz-opt-emoji" aria-hidden="true">
                      {opt.emoji}
                    </span>
                    {opt.label}
                  </button>
                ))}
              </div>
              {step > 0 && (
                <button
                  type="button"
                  className="quiz-back-btn"
                  onClick={handleBack}
                >
                  ← Volver a la pregunta anterior
                </button>
              )}
            </div>
          </div>
        )
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
            min="10"
            max="70"
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
            <span>1.0 (8va)</span>
            <span>3.5 (5ta)</span>
            <span>7.0 (1era)</span>
          </div>
        </div>
      )}

      {/* CARNET DIGITAL OFICIAL DEL JUGADOR: recién se revela cuando el test
          termina (ajuste manual la muestra siempre, al ser instantánea). */}
      {showResult && (
        <div
          key={category.id}
          className="rating-reveal"
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

          {justFinished && (
            <div className="confetti-layer" aria-hidden="true">
              {CONFETTI_PIECES.map((p, i) => (
                <span
                  key={i}
                  className="confetti-piece"
                  style={{ left: p.left, animationDelay: p.delay }}
                >
                  {p.emoji}
                </span>
              ))}
            </div>
          )}

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
              pose={category.mascotPose}
              size="s"
              alt={`Muzzaguito festejando categoría ${category.name}`}
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
                {category.emoji} {category.name}
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
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px dashed var(--color-hairline, #e2e8f0)", paddingBottom: 4 }}>
              <span style={{ color: "var(--color-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}><Zap size={20} className="icono-marca" aria-hidden="true" /> Red y remate:</span>
              <strong style={{ color: "var(--color-ink)", textAlign: "right" }}>{skills.netPlay}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px dashed var(--color-hairline, #e2e8f0)", paddingBottom: 4 }}>
              <span style={{ color: "var(--color-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}><Activity size={20} className="icono-marca" aria-hidden="true" /> Saque y desplazamiento:</span>
              <strong style={{ color: "var(--color-ink)", textAlign: "right" }}>{skills.serve}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px dashed var(--color-hairline, #e2e8f0)", paddingBottom: 4 }}>
              <span style={{ color: "var(--color-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}><Users size={20} className="icono-marca" aria-hidden="true" /> Posicionamiento en pareja:</span>
              <strong style={{ color: "var(--color-ink)", textAlign: "right" }}>{skills.position}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "var(--color-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}><Medal size={20} className="icono-marca" aria-hidden="true" /> Experiencia competitiva:</span>
              <strong style={{ color: "var(--color-ink)", textAlign: "right" }}>{skills.tactic}</strong>
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

            {mode === "quiz" && quizDone && (
              <button
                type="button"
                className="quiz-restart-btn"
                onClick={handleRestart}
              >
                <RotateCcw size={14} aria-hidden="true" /> Volver a hacer el test
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
