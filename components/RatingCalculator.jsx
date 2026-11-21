"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Mascota from "./Mascota";
import { PADEL_LEVELS, getCategoryForRating } from "../data/levels";
import { WhatsAppLogo } from "./BrandLogos";
import {
  buildLevelShareMessage,
  buildLevelWhatsAppUrl,
  evaluatePlayerSkills,
} from "../lib/levelShare";
import {
  Clock,
  BrickWall,
  Zap,
  Trophy,
  MessageCircle,
  Activity,
  Users,
  Medal,
  RotateCcw,
  ArrowLeft,
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
  // Qué preguntas ya respondió la persona: sin esto, la opción del medio
  // (el valor de arranque) aparecía marcada en cada pregunta nueva.
  const [answered, setAnswered] = useState({});

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
    setAnswered((prev) => ({ ...prev, [key]: true }));
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
    setAnswered({});
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
  // Dónde cae la pelota en la escala 1.0 → 7.0.
  const scalePct = ((Number(computedRating) - 1) / 6) * 100;

  const skillRows = [
    { icon: Clock, label: "Experiencia", value: skills.experience },
    { icon: BrickWall, label: "Rebote en el cristal", value: skills.wallPlay },
    { icon: Zap, label: "Red y remate", value: skills.netPlay },
    { icon: Activity, label: "Saque y desplazamiento", value: skills.serve },
    { icon: Users, label: "Posicionamiento en pareja", value: skills.position },
    { icon: Medal, label: "Experiencia competitiva", value: skills.tactic },
  ];

  return (
    <div className="hx-card hx-nv">
      <div className="hx-segmento" role="group" aria-label="Modo del test">
        <button
          type="button"
          className={mode === "quiz" ? "is-on" : ""}
          aria-pressed={mode === "quiz"}
          onClick={() => setMode("quiz")}
        >
          {/* Un solo span: como hijos sueltos del botón, el espacio antes
              de "(6 preguntas)" se perdía. */}
          <span>
            Test guiado<span className="hx-segmento-extra"> · 6 preguntas</span>
          </span>
        </button>
        <button
          type="button"
          className={mode === "slider" ? "is-on" : ""}
          aria-pressed={mode === "slider"}
          onClick={() => setMode("slider")}
        >
          Ajuste manual
        </button>
      </div>

      {mode === "quiz" && !quizDone && (
        <div>
          <div className="hx-nv-progreso">
            <span className="hx-nv-progreso-txt">
              Pregunta <b>{step + 1}</b> de {QUESTIONS.length}
            </span>
            <ol className="hx-nv-pelotas" aria-hidden="true">
              {QUESTIONS.map((q, i) => (
                <li
                  key={q.key}
                  className={i < step ? "is-hecha" : i === step ? "is-actual" : ""}
                />
              ))}
            </ol>
          </div>

          <div className="hx-nv-paso" key={step}>
            <span className="hx-nv-emoji" aria-hidden="true">
              {currentQuestion.emoji}
            </span>
            <h2 className="hx-nv-pregunta" id={`pregunta-${currentQuestion.key}`}>
              {currentQuestion.question}
            </h2>
            <div
              className="hx-nv-opciones"
              role="group"
              aria-labelledby={`pregunta-${currentQuestion.key}`}
            >
              {currentQuestion.options.map((opt) => {
                const on =
                  answered[currentQuestion.key] &&
                  quizAnswers[currentQuestion.key] === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    className={`hx-nv-opcion${on ? " is-on" : ""}`}
                    aria-pressed={Boolean(on)}
                    onClick={() => handleAnswer(currentQuestion.key, opt.val)}
                  >
                    <span className="hx-nv-opcion-emoji" aria-hidden="true">
                      {opt.emoji}
                    </span>
                    <span>{opt.label}</span>
                    <span className="hx-nv-opcion-check" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            {step > 0 && (
              <button type="button" className="hx-nv-volver" onClick={handleBack}>
                <ArrowLeft size={16} aria-hidden="true" /> Pregunta anterior
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "slider" && (
        <div className="hx-nv-slider">
          <label className="hx-etiqueta" htmlFor="nivel-manual">
            Mové la pelota hasta tu nivel estimado:
          </label>
          <input
            id="nivel-manual"
            type="range"
            min="10"
            max="70"
            step="1"
            value={raw}
            onChange={(e) => setRaw(Number(e.target.value))}
            aria-valuetext={`${computedRating}, ${category.name}`}
          />
          <div className="hx-nv-slider-marcas" aria-hidden="true">
            <span>1.0 · 8va</span>
            <span>3.5 · 5ta</span>
            <span>7.0 · 1era</span>
          </div>
        </div>
      )}

      {/* FICHA DEL JUGADOR: recién aparece cuando el test termina (el ajuste
          manual la muestra siempre, al ser instantáneo). */}
      {showResult && (
        <div className="hx-ficha" key={category.id} aria-live="polite">
          <div className="hx-ficha-cancha">
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

            <p className="hx-ficha-kicker">
              <span>Ficha de jugador</span>
              <span>{playerName.trim() || "Muzzaga Pádel"}</span>
            </p>

            <div>
              <strong className="hx-ficha-cat">
                {category.shortName}
                <small>{category.tag}</small>
              </strong>
              <span className="hx-ficha-rating">
                <b>{computedRating}</b> / 7.0
              </span>
            </div>

            <Mascota
              pose={category.mascotPose}
              size="s"
              alt={`Muzzaguito festejando categoría ${category.name}`}
              className="hx-ficha-masc"
            />
          </div>

          <div className="hx-escala" aria-hidden="true">
            <div className="hx-escala-pista">
              {PADEL_LEVELS.map((lvl, i) => (
                <span
                  key={lvl.id}
                  className={`hx-escala-seg${lvl.id === category.id ? " is-on" : ""}`}
                  style={{
                    flexGrow: lvl.maxRating - lvl.minRating + 0.1,
                    "--i": i,
                  }}
                />
              ))}
              <span className="hx-escala-marca" style={{ left: `${scalePct}%` }} />
            </div>
            <div className="hx-escala-nombres">
              <span>8va · 1.0</span>
              <span>{category.ratingRange}</span>
              <span>1era · 7.0</span>
            </div>
          </div>

          <div className="hx-ficha-cuerpo">
            <div>
              <label className="hx-etiqueta" htmlFor="nivel-nombre">
                Tu nombre para la ficha (opcional)
              </label>
              <input
                id="nivel-nombre"
                type="text"
                className="hx-campo"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ej. Lucas"
                autoComplete="given-name"
              />
            </div>

            <ul className="hx-skills" aria-label="Diagnóstico de habilidades">
              {skillRows.map(({ icon: Icon, label, value }) => (
                <li className="hx-skill" key={label}>
                  <span className="hx-skill-ico">
                    <Icon className="icono-marca" aria-hidden="true" />
                  </span>
                  <span className="hx-skill-txt">
                    {label}
                    <strong>{value}</strong>
                  </span>
                </li>
              ))}
            </ul>

            <p className="hx-ficha-desc">{category.desc}</p>

            <div className="hx-acciones">
              <a
                href={shareWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hx-wa"
                title="Compartir mi nivel de pádel con mi compañero o grupo"
              >
                <WhatsAppLogo size={22} color="#ffffff" />
                <span>Compartir mi ficha</span>
              </a>

              <div className="hx-acciones-2">
                <a href="/torneos" className="hx-btn2">
                  <Trophy size={18} className="icono-marca" aria-hidden="true" /> Ver torneos
                </a>
                <a
                  href={clubContactWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hx-btn2"
                >
                  <MessageCircle size={18} className="icono-marca" aria-hidden="true" /> Partidos parejos
                </a>
              </div>

              {mode === "quiz" && quizDone && (
                <button type="button" className="hx-nv-otra" onClick={handleRestart}>
                  <RotateCcw size={16} aria-hidden="true" /> Volver a hacer el test
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
