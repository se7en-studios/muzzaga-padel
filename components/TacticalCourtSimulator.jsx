"use client";

import { useState, useEffect } from "react";
import {
  buildTacticWhatsAppUrl,
  buildRopeWhatsAppUrl,
} from "../lib/tacticalShare";
import { Share2, Handshake } from "lucide-react";
import ScrollRow from "./ScrollRow";

const PRESET_TACTICS = [
  {
    id: "vibora",
    title: "Víbora con peso a la reja",
    category: "Ataque",
    difficulty: "★★★★☆",
    effectiveness: "88%",
    badge: "Ataque · Nivel 3.5+",
    badgeColor: "badge-amber",
    desc: "Impacto lateral a la altura de la cabeza con efecto cortado agresivo. La bola busca picar profundo y morir en la malla lateral con rebote impredecible.",
    tip: "Girá los hombros rápido, no busques potencia pura sino fricción lateral con la pala a 45°.",
    players: {
      p1: { x: 130, y: 195, label: "J1 (Vos)" }, // Atacante que pega la víbora
      p2: { x: 190, y: 220, label: "J2 (Pareja)" }, // Pareja cubriendo el medio
      r1: { x: 90, y: 440, label: "R1" }, // Rival defendiendo fondo
      r2: { x: 210, y: 430, label: "R2" }, // Rival en esquina
    },
    bouncePos: { x: 245, y: 430 },
    wallPos: { x: 282, y: 395 },
    trajectory: "M 130 195 Q 185 300, 245 430 Q 268 420, 282 397",
    phases: [
      {
        phase: "1. Armado",
        desc: "Perfilado lateral rápido, pala alta detrás de la nuca.",
      },
      {
        phase: "2. Impacto",
        desc: "Corte lateral raspando la pelota por el costado derecho.",
      },
      {
        phase: "3. Pique",
        desc: "Pique rasante a 1 metro de la pared de fondo.",
      },
      {
        phase: "4. Malla",
        desc: "Impacto en la reja metálica: rebote aleatorio hacia el piso.",
      },
    ],
  },
  {
    id: "smash_x3",
    title: "Smash por 3 (definición)",
    category: "Definición",
    difficulty: "★★★★★",
    effectiveness: "94%",
    badge: "Potencia & Topspin · Avanzado",
    badgeColor: "badge-amber",
    desc: "Remate con efecto liftado (topspin) buscando que la pelota pique antes de la línea de saque, impacte alto en el cristal de fondo y salga por el lateral de 3 metros.",
    tip: "Ubicá el cuerpo debajo de la bola, arqueá la espalda e impactá en el punto más alto con aceleración de muñeca.",
    players: {
      p1: { x: 165, y: 210, label: "J1 (Vos)" },
      p2: { x: 95, y: 230, label: "J2 (Pareja)" },
      r1: { x: 100, y: 450, label: "R1" },
      r2: { x: 200, y: 450, label: "R2" },
    },
    bouncePos: { x: 130, y: 400 },
    wallPos: { x: 110, y: 470 },
    trajectory: "M 165 210 L 130 400 L 110 472 Q 100 480, 290 485",
    phases: [
      {
        phase: "1. Salto",
        desc: "Ajuste de pasos cortos y flexión profunda para ganar altura.",
      },
      {
        phase: "2. Aceleración",
        desc: "Impacto a las 12 en punto con 'muñecazo' hacia afuera.",
      },
      {
        phase: "3. Rebote en el cristal",
        desc: "Impacto en el cristal de fondo a más de 2,5 m de altura.",
      },
      {
        phase: "4. Salida x3",
        desc: "La pelota supera la pared lateral y sale de la pista.",
      },
    ],
  },
  {
    id: "salida_pared",
    title: "Salida de pared con globo milimétrico",
    category: "Defensa",
    difficulty: "★★★☆☆",
    effectiveness: "82%",
    badge: "Defensa · Todos los niveles",
    badgeColor: "badge-emerald",
    desc: "Acompañá la bola cuando sale del cristal de fondo. Ganá tiempo con un globo alto y profundo para que tu pareja y vos puedan tomar la red.",
    tip: "Flexioná las rodillas, pala por debajo de la pelota y terminá el gesto apuntando al techo.",
    players: {
      p1: { x: 95, y: 440, label: "J1 (Vos)" },
      p2: { x: 185, y: 440, label: "J2 (Pareja)" },
      r1: { x: 100, y: 190, label: "R1 (Red)" },
      r2: { x: 200, y: 190, label: "R2 (Red)" },
    },
    bouncePos: { x: 48, y: 462 },
    wallPos: null,
    trajectory: "M 48 462 Q 90 280, 225 90",
    phases: [
      {
        phase: "1. Espera",
        desc: "Lectura del rebote en el cristal sin precipitarse.",
      },
      {
        phase: "2. Cuchara",
        desc: "Entrada de pala por abajo con trayectoria parabólica.",
      },
      {
        phase: "3. Altura",
        desc: "Globo alto (6-8 metros) superando a los rivales en la red.",
      },
      {
        phase: "4. Contraataque",
        desc: "Subida inmediata de la pareja a ganar la posición ofensiva.",
      },
    ],
  },
  {
    id: "chiquita",
    title: "Chiquita al centro a los pies",
    category: "Transición",
    difficulty: "★★★★☆",
    effectiveness: "86%",
    badge: "Táctica · Transición",
    badgeColor: "badge-indigo",
    desc: "Tiro suave y rasante que cae justo por debajo de la cinta de la red, obligando a los rivales a volear por debajo de la cintura y levantar la pelota para que vos entres a definir.",
    tip: "Mantené la pala firme y no aceleres el brazo. La suavidad y el control de muñeca son la clave.",
    players: {
      p1: { x: 80, y: 390, label: "J1 (Vos)" },
      p2: { x: 180, y: 390, label: "J2 (Pareja)" },
      r1: { x: 105, y: 220, label: "R1 (Red)" },
      r2: { x: 195, y: 220, label: "R2 (Red)" },
    },
    bouncePos: { x: 150, y: 235 },
    wallPos: null,
    trajectory: "M 80 390 Q 115 285, 150 235",
    phases: [
      {
        phase: "1. Lectura",
        desc: "Detección del hueco entre ambos voleadores rivales.",
      },
      {
        phase: "2. Toque",
        desc: "Impacto sin fuerza, acariciando la bola por encima de la red.",
      },
      {
        phase: "3. Caída",
        desc: "La pelota cae a los pies del rival obligándolo a levantar.",
      },
      {
        phase: "4. Volea firme",
        desc: "Paso adelante de tu pareja para liquidar en la red.",
      },
    ],
  },
  {
    id: "bandeja_doble",
    title: "Bandeja a la doble pared (esquina)",
    category: "Construcción",
    difficulty: "★★★★☆",
    effectiveness: "90%",
    badge: "Control Táctico · Medio/Avanzado",
    badgeColor: "badge-indigo",
    desc: "Bandeja flotada y profunda dirigida a la esquina rival para que pegue en el cristal lateral y luego en el de fondo (o viceversa), descolocando completamente la defensa.",
    tip: "Entrá de costado, punto de impacto adelantado a la altura de los ojos con empuje continuo.",
    players: {
      p1: { x: 175, y: 190, label: "J1 (Vos)" },
      p2: { x: 85, y: 215, label: "J2 (Pareja)" },
      r1: { x: 90, y: 440, label: "R1" },
      r2: { x: 220, y: 440, label: "R2" },
    },
    bouncePos: { x: 240, y: 410 },
    wallPos: { x: 275, y: 435 },
    trajectory:
      "M 175 190 Q 215 300, 240 410 Q 260 425, 275 435 Q 265 470, 230 465",
    phases: [
      {
        phase: "1. Retroceso",
        desc: "Pasos laterales hacia atrás sin perder la red de vista.",
      },
      {
        phase: "2. Impacto Plano/Cortado",
        desc: "Golpe a media altura sin arriesgar la red.",
      },
      {
        phase: "3. Doble Rebote",
        desc: "Cristal lateral -> Cristal de fondo: la bola gira hacia adentro.",
      },
      {
        phase: "4. Mantenimiento",
        desc: "Se mantiene a los rivales encerrados en el fondo.",
      },
    ],
  },
  {
    id: "dormilona",
    title: "Dormilona tras smash rival",
    category: "Fantasía",
    difficulty: "★★★★★",
    effectiveness: "96%",
    badge: "Recurso Pro · Definición",
    badgeColor: "badge-amber",
    desc: "Cuando el smash del rival rebota en tu cristal de fondo y cruza la red despacio, amortiguás la bola con toque ultra cortado para dejarla pegada a la red de su lado.",
    tip: "Aflojá la muñeca en el último instante y retrocedé la pala ligeramente al impactar para quitar toda la inercia.",
    players: {
      p1: { x: 140, y: 285, label: "J1 (Vos)" },
      p2: { x: 80, y: 350, label: "J2" },
      r1: { x: 130, y: 150, label: "R1 (Pegador)" },
      r2: { x: 220, y: 180, label: "R2" },
    },
    bouncePos: { x: 165, y: 238 },
    wallPos: null,
    trajectory:
      "M 130 150 Q 140 400, 140 460 Q 140 350, 140 285 Q 152 250, 165 238",
    phases: [
      {
        phase: "1. Anticipación",
        desc: "Correr pegado a la red siguiendo la trayectoria del smash.",
      },
      {
        phase: "2. Amortiguación",
        desc: "Mano de seda: absorber la energía de la pelota.",
      },
      {
        phase: "3. Caída Muerta",
        desc: "La bola cae a 10 cm de la red del campo rival.",
      },
      {
        phase: "4. Punto Ganado",
        desc: "Inalcanzable para cualquier rival fuera de posición.",
      },
    ],
  },
];

const ROPE_THEORY_PHASES = [
  {
    id: "saque",
    name: "1. Saque y subida",
    desc: "El sacador avanza a la red en línea recta mientras el compañero ya está afirmado esperando la devolución.",
    p1: { x: 175, y: 260, label: "Sacador" },
    p2: { x: 85, y: 210, label: "Compañero" },
    dangerZone: { x: 130, y: 300, w: 100, h: 60, label: "Zona de transición" },
  },
  {
    id: "bloqueo",
    name: "2. Bloqueo en la red (ataque)",
    desc: "Ambos pegados a 2 metros de la red. La 'cuerda' imaginaria los mantiene a 3 metros de distancia mutua cubriendo el centro y esquinas.",
    p1: { x: 180, y: 200, label: "Drive Red" },
    p2: { x: 90, y: 200, label: "Revés Red" },
    dangerZone: {
      x: 20,
      y: 350,
      w: 260,
      h: 100,
      label: "Espalda libre (cuidado con globos)",
    },
  },
  {
    id: "defensa",
    name: "3. Defensa en el fondo",
    desc: "Ambos detrás de la línea de saque para defender con cristales. Si uno sale a la esquina, el otro cubre el centro.",
    p1: { x: 210, y: 440, label: "Drive Fondo" },
    p2: { x: 120, y: 425, label: "Revés Cobertura" },
    dangerZone: { x: 20, y: 150, w: 260, h: 100, label: "Red cedida al rival" },
  },
  {
    id: "cobertura_globo",
    name: "4. Basculación por globo",
    desc: "El rival tira globo cruzado: el jugador de revés retrocede en diagonal y su compañero bascula al centro para defender juntos.",
    p1: { x: 140, y: 380, label: "Apoyo Central" },
    p2: { x: 80, y: 450, label: "Recupera Globo" },
    dangerZone: { x: 180, y: 340, w: 90, h: 80, label: "Espacio a cubrir" },
  },
];

export default function TacticalCourtSimulator() {
  const [boardMode, setBoardMode] = useState("presets"); // "presets" | "rope" | "free"
  const [activeTacticId, setActiveTacticId] = useState("vibora");
  const [activeRopeId, setActiveRopeId] = useState("saque");
  const [isPlayingAnim, setIsPlayingAnim] = useState(true);
  const [animKey, setAnimKey] = useState(0);

  // Free Mode Custom Players
  const [freePlayers, setFreePlayers] = useState({
    p1: { x: 90, y: 390, label: "J1" },
    p2: { x: 190, y: 390, label: "J2" },
    r1: { x: 90, y: 190, label: "R1" },
    r2: { x: 190, y: 190, label: "R2" },
  });
  const [selectedFreePlayer, setSelectedFreePlayer] = useState("p1");

  const tactic =
    PRESET_TACTICS.find((t) => t.id === activeTacticId) || PRESET_TACTICS[0];
  const rope =
    ROPE_THEORY_PHASES.find((r) => r.id === activeRopeId) ||
    ROPE_THEORY_PHASES[0];

  const replayAnimation = () => {
    setIsPlayingAnim(false);
    setTimeout(() => {
      setAnimKey((prev) => prev + 1);
      setIsPlayingAnim(true);
    }, 50);
  };

  const handleCourtClick = (e) => {
    if (boardMode !== "free") return;
    const svg = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - svg.left) / svg.width) * 300);
    const y = Math.round(((e.clientY - svg.top) / svg.height) * 500);

    // Keep within court bounds
    const boundedX = Math.max(30, Math.min(270, x));
    const boundedY = Math.max(30, Math.min(470, y));

    setFreePlayers((prev) => ({
      ...prev,
      [selectedFreePlayer]: {
        ...prev[selectedFreePlayer],
        x: boundedX,
        y: boundedY,
      },
    }));
  };

  const resetFreeCourt = () => {
    setFreePlayers({
      p1: { x: 90, y: 390, label: "J1" },
      p2: { x: 190, y: 390, label: "J2" },
      r1: { x: 90, y: 190, label: "R1" },
      r2: { x: 190, y: 190, label: "R2" },
    });
  };

  const currentPlayers =
    boardMode === "presets"
      ? tactic.players
      : boardMode === "rope"
        ? {
            p1: rope.p1,
            p2: rope.p2,
            r1: { x: 90, y: 180, label: "R1" },
            r2: { x: 190, y: 180, label: "R2" },
          }
        : freePlayers;

  return (
    <section
      id="pizarra-tactica"
      className="section-turnos"
    >
      <div className="container">
        {/* HEADER */}
        <div className="section-header-row">
          <div>
            <span
              className="badge-linear badge-indigo"
              style={{ marginBottom: 8 }}
            >
              Simulador táctico · Muzzaga Pádel
            </span>
            <h2 className="section-title">Pizarra táctica interactiva</h2>
            <p className="section-desc">
              Analizá jugadas maestras, entendé la sincronización de pareja y
              posicioná a tus jugadores sobre el césped y cristal de Muzzaga.
            </p>
          </div>

          {/* SELECTOR DE MODOS */}
          <div className="rating-mode-switch rating-mode-switch--triple">
            <button
              type="button"
              className={`rating-tab-btn${boardMode === "presets" ? " active" : ""}`}
              onClick={() => {
                setBoardMode("presets");
                replayAnimation();
              }}
            >
              Jugadas pro
            </button>
            <button
              type="button"
              className={`rating-tab-btn${boardMode === "rope" ? " active" : ""}`}
              onClick={() => setBoardMode("rope")}
            >
              Basculación
            </button>
            <button
              type="button"
              className={`rating-tab-btn${boardMode === "free" ? " active" : ""}`}
              onClick={() => setBoardMode("free")}
            >
              Pizarra libre
            </button>
          </div>
        </div>

        {/* LAYOUT GRID */}
        <div className="tactical-board-grid">
          {/* COLUMNA 1: CANCHA SVG */}
          <div className="tactical-court-wrap">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="live-dot" style={{ background: "#0F7B4F" }} />
                <span
                  style={{
                    fontSize: 12,
                    color: "#ffffff",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {boardMode === "presets"
                    ? "Animación en vivo"
                    : boardMode === "rope"
                      ? "Sincronía de pareja"
                      : "Modo libre"}
                </span>
              </div>

              {boardMode === "presets" && (
                <button
                  type="button"
                  onClick={replayAnimation}
                  className="btn btn-secondary"
                  style={{
                    height: 28,
                    padding: "2px 10px",
                    fontSize: 11,
                    background: "rgba(255,255,255,0.1)",
                    color: "#ffffff",
                    borderColor: "rgba(255,255,255,0.2)",
                  }}
                >
                  Repetir tiro
                </button>
              )}
            </div>

            <svg
              className="tactical-court-svg"
              viewBox="0 0 300 500"
              preserveAspectRatio="xMidYMid meet"
              aria-label="Cancha de pádel interactiva de cristal"
              onClick={handleCourtClick}
              style={{ cursor: boardMode === "free" ? "crosshair" : "default" }}
            >
              <defs>

                {/* Césped sintético azul (la misma foto de la banda de
                    Instalaciones) en mosaico, y la luz de los reflectores. */}
                <pattern
                  id="turfTexture"
                  patternUnits="userSpaceOnUse"
                  width="130"
                  height="130"
                >
                  <image
                    href="/img/fondo/textura-cesped.jpg"
                    width="130"
                    height="130"
                    preserveAspectRatio="none"
                  />
                </pattern>

                <radialGradient id="courtLight" cx="50%" cy="50%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
                  <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="100%" stopColor="#050d26" stopOpacity="0.45" />
                </radialGradient>

                <linearGradient
                  id="neonOrange"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#ff7a1a" />
                  <stop offset="100%" stopColor="#ff3300" />
                </linearGradient>

                <filter
                  id="neonGlowPro"
                  x1="-30%"
                  y1="-30%"
                  width="160%"
                  height="160%"
                >
                  <feGaussianBlur stdDeviation="4" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Superficie: césped sintético azul + luz de reflectores, y
                  la línea de fondo/lateral blanca alrededor. */}
              <rect x="20" y="20" width="260" height="460" fill="url(#turfTexture)" />
              <rect x="20" y="20" width="260" height="460" fill="#0a1d5c" opacity="0.38" />
              <rect x="20" y="20" width="260" height="460" fill="url(#courtLight)" />
              <rect
                x="21.5"
                y="21.5"
                width="257"
                height="457"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                opacity="0.9"
              />

              {/* Paredes de cristal */}
              <rect
                x="18"
                y="16"
                width="264"
                height="6"
                fill="#dbeafe"
                opacity="0.55"
                rx="2"
              />
              <rect
                x="18"
                y="478"
                width="264"
                height="6"
                fill="#dbeafe"
                opacity="0.55"
                rx="2"
              />
              <rect
                x="14"
                y="18"
                width="6"
                height="110"
                fill="#dbeafe"
                opacity="0.55"
                rx="2"
              />
              <rect
                x="280"
                y="18"
                width="6"
                height="110"
                fill="#dbeafe"
                opacity="0.55"
                rx="2"
              />
              <rect
                x="14"
                y="372"
                width="6"
                height="110"
                fill="#dbeafe"
                opacity="0.55"
                rx="2"
              />
              <rect
                x="280"
                y="372"
                width="6"
                height="110"
                fill="#dbeafe"
                opacity="0.55"
                rx="2"
              />

              {/* Reja metálica lateral (Malla electro-soldada) */}
              <line
                x1="17"
                y1="130"
                x2="17"
                y2="370"
                stroke="#64748b"
                strokeWidth="3"
                strokeDasharray="3 3"
                opacity="0.7"
              />
              <line
                x1="283"
                y1="130"
                x2="283"
                y2="370"
                stroke="#64748b"
                strokeWidth="3"
                strokeDasharray="3 3"
                opacity="0.7"
              />

              {/* Líneas de saque a 6,95 m de la red (la mitad de la cancha
                  mide 10 m = 230 unidades) y la central entre ellas. */}
              <line x1="20" y1="90" x2="280" y2="90" stroke="#ffffff" strokeWidth="2.5" opacity="0.9" />
              <line x1="20" y1="410" x2="280" y2="410" stroke="#ffffff" strokeWidth="2.5" opacity="0.9" />
              <line x1="150" y1="90" x2="150" y2="410" stroke="#ffffff" strokeWidth="2.5" opacity="0.9" />

              {/* Net Line & Posts */}
              <line x1="14" y1="251.5" x2="286" y2="251.5" stroke="#050d26" strokeWidth="5" opacity="0.55" />
              <line
                x1="14"
                y1="250"
                x2="286"
                y2="250"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeDasharray="1.5 2.5"
                opacity="0.95"
              />
              <circle cx="15" cy="250" r="4" fill="#E8722A" />
              <circle cx="285" cy="250" r="4" fill="#E8722A" />
              {/* En el extremo derecho: en el medio chocaba con jugadores y
                  piques de casi todas las jugadas. Termina antes del vidrio,
                  que si no tapaba la última letra. */}
              <text
                x="271"
                y="242"
                fill="#ffffff"
                fontSize="9"
                textAnchor="end"
                opacity="0.8"
                fontWeight="600"
              >
                RED CENTRAL
              </text>

              {/* MODO ROPE: Danger Zone & Rope Line */}
              {boardMode === "rope" && (
                <>
                  <line
                    x1={currentPlayers.p1.x}
                    y1={currentPlayers.p1.y}
                    x2={currentPlayers.p2.x}
                    y2={currentPlayers.p2.y}
                    stroke="#0F7B4F"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                    opacity="0.9"
                  />
                  <rect
                    x={rope.dangerZone.x}
                    y={rope.dangerZone.y}
                    width={rope.dangerZone.w}
                    height={rope.dangerZone.h}
                    fill="rgba(239, 68, 68, 0.2)"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    rx="6"
                  />
                  <text
                    x={rope.dangerZone.x + rope.dangerZone.w / 2}
                    y={rope.dangerZone.y + rope.dangerZone.h / 2 + 4}
                    fill="#fca5a5"
                    fontSize="9.5"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {rope.dangerZone.label}
                  </text>
                </>
              )}

              {/* MODO PRESETS: Animated Trajectory & Ball.
                  El cambio entre jugadas remonta el <path>/<animateMotion>
                  (necesitan la key nueva para reiniciar el trayecto), lo que
                  antes se veía como un corte seco. Envolviendo en un <g> con
                  opacity ligada a isPlayingAnim (en vez de desmontar el
                  bloque entero) el swap ocurre mientras está invisible, así
                  se ve como un fundido en vez de un salto. */}
              {boardMode === "presets" && (
                <g
                  style={{
                    opacity: isPlayingAnim ? 1 : 0,
                    transition: "opacity var(--t-estado) var(--ease)",
                  }}
                >
                  {/* Trajectory glow path */}
                  <path
                    key={`traj-${animKey}`}
                    d={tactic.trajectory}
                    fill="none"
                    stroke="url(#neonOrange)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    filter="url(#neonGlowPro)"
                    className="animated-ball-trajectory"
                  />

                  {/* Animated Ball Traversing the Path */}
                  <circle
                    r="6"
                    fill="#eab308"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    filter="url(#neonGlowPro)"
                  >
                    <animateMotion
                      key={`ball-${animKey}`}
                      path={tactic.trajectory}
                      dur="2.5s"
                      repeatCount="indefinite"
                      rotate="auto"
                    />
                  </circle>

                  {/* Bounce Indicator */}
                  {tactic.bouncePos && (
                    <g
                      transform={`translate(${tactic.bouncePos.x}, ${tactic.bouncePos.y})`}
                    >
                      <circle
                        r="10"
                        fill="rgba(232, 114, 42, 0.2)"
                        stroke="#E8722A"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                      />
                      <circle r="3.5" fill="#E8722A" />
                      <text
                        x="0"
                        y="-12"
                        fill="#E8722A"
                        fontSize="9.5"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        1° Pique
                      </text>
                    </g>
                  )}

                  {/* Wall Impact Indicator */}
                  {tactic.wallPos && (
                    <g
                      transform={`translate(${tactic.wallPos.x}, ${tactic.wallPos.y})`}
                    >
                      <circle
                        r="8"
                        fill="rgba(56, 189, 248, 0.3)"
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                      />
                      <text
                        x="0"
                        y="18"
                        fill="#38bdf8"
                        fontSize="8.5"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        Rebote
                      </text>
                    </g>
                  )}
                </g>
              )}

              {/* PLAYERS (Equipo Naranja / Muzzaga) */}
              <g
                transform={`translate(${currentPlayers.p1.x}, ${currentPlayers.p1.y})`}
              >
                <circle
                  r="13"
                  fill="rgba(232, 114, 42, 0.25)"
                  stroke="#E8722A"
                  strokeWidth="2.5"
                />
                <circle r="7" fill="#E8722A" />
                <text
                  x="0"
                  y="22"
                  fill="#ffffff"
                  fontSize="9.5"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {currentPlayers.p1.label}
                </text>
              </g>

              <g
                transform={`translate(${currentPlayers.p2.x}, ${currentPlayers.p2.y})`}
              >
                <circle
                  r="13"
                  fill="rgba(232, 114, 42, 0.25)"
                  stroke="#E8722A"
                  strokeWidth="2.5"
                />
                <circle r="7" fill="#E8722A" />
                <text
                  x="0"
                  y="22"
                  fill="#ffffff"
                  fontSize="9.5"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {currentPlayers.p2.label}
                </text>
              </g>

              {/* RIVALS (Equipo Cyan) */}
              <g
                transform={`translate(${currentPlayers.r1.x}, ${currentPlayers.r1.y})`}
              >
                <circle
                  r="12"
                  fill="rgba(56, 189, 248, 0.25)"
                  stroke="#38bdf8"
                  strokeWidth="2"
                />
                <circle r="6" fill="#38bdf8" />
                <text
                  x="0"
                  y="-14"
                  fill="#ffffff"
                  fontSize="9"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {currentPlayers.r1.label}
                </text>
              </g>

              <g
                transform={`translate(${currentPlayers.r2.x}, ${currentPlayers.r2.y})`}
              >
                <circle
                  r="12"
                  fill="rgba(56, 189, 248, 0.25)"
                  stroke="#38bdf8"
                  strokeWidth="2"
                />
                <circle r="6" fill="#38bdf8" />
                <text
                  x="0"
                  y="-14"
                  fill="#ffffff"
                  fontSize="9"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {currentPlayers.r2.label}
                </text>
              </g>
            </svg>

            <div className="court-glass-indicator">
              Césped sintético · Cristal templado
            </div>
          </div>

          {/* COLUMNA 2: CONTROLES & DETALLES TÁCTICOS */}
          <div className="tactical-info-card">
            {/* MODO 1: JUGADAS PRO */}
            {boardMode === "presets" && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 13,
                      color: "var(--color-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      margin: 0,
                    }}
                  >
                    Elegí la jugada táctica:
                  </h3>
                  <span className="badge-linear badge-amber">
                    {tactic.category}
                  </span>
                </div>

                {/* SELECTOR DE JUGADAS */}
                <ScrollRow
                  axis="y"
                  className="tactic-buttons-list"
                  style={{ maxHeight: 220, paddingRight: 4 }}
                >
                  {PRESET_TACTICS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`tactic-select-btn${item.id === activeTacticId ? " active" : ""}`}
                      onClick={() => {
                        setActiveTacticId(item.id);
                        replayAnimation();
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <strong style={{ fontSize: 13.5 }}>{item.title}</strong>
                        <span
                          className={`badge-linear ${item.badgeColor}`}
                          style={{ fontSize: 10 }}
                        >
                          {item.category}
                        </span>
                      </div>
                    </button>
                  ))}
                </ScrollRow>

                {/* DETALLE Y SPECS */}
                <div className="tactic-detail-box">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <h4
                      style={{
                        fontSize: 17,
                        color: "var(--color-ink)",
                        margin: 0,
                        fontWeight: 700,
                      }}
                    >
                      {tactic.title}
                    </h4>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span
                        className="badge-linear badge-amber"
                      >
                        {tactic.category}
                      </span>
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: 13.5,
                      color: "var(--color-body)",
                      lineHeight: 1.55,
                      margin: "6px 0 12px",
                    }}
                  >
                    {tactic.desc}
                  </p>

                  {/* FASES DE EJECUCIÓN */}
                  <div
                    style={{
                      background: "var(--color-surface-card)",
                      border: "1px solid var(--color-hairline)",
                      borderRadius: "var(--radius-md)",
                      padding: "10px 12px",
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        fontWeight: 700,
                        color: "var(--color-muted)",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Secuencia del golpe, paso a paso:
                    </span>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      {tactic.phases.map((ph, idx) => (
                        <div key={idx} style={{ fontSize: 12 }}>
                          <strong
                            style={{
                              color: "var(--color-ink)",
                              display: "block",
                            }}
                          >
                            {ph.phase}
                          </strong>
                          <span
                            style={{
                              color: "var(--color-muted)",
                              fontSize: 11.5,
                            }}
                          >
                            {ph.desc}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pro-tip-box">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--color-accent-orange-text)",
                        fontWeight: 600,
                        fontSize: 12.5,
                        marginBottom: 2,
                      }}
                    >
                      <span>Consejo de los profes:</span>
                    </div>
                    <p
                      style={{
                        fontSize: 12.5,
                        color: "var(--color-ink)",
                        margin: 0,
                        lineHeight: 1.45,
                      }}
                    >
                      {tactic.tip}
                    </p>
                  </div>

                  <a
                    href={buildTacticWhatsAppUrl(tactic)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{
                      width: "100%",
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontSize: 13,
                      padding: "10px 14px",
                      borderColor: "#1fa855",
                      color: "#ffffff",
                      background: "#1fa855",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                    title="Enviar esta jugada táctica a tu compañero por WhatsApp"
                  >
                    <Share2 size={20} aria-hidden="true" />
                    <span>Compartir jugada con mi pareja</span>
                  </a>
                </div>
              </>
            )}

            {/* MODO 2: BASCULACIÓN & TEORÍA DE LA CUERDA */}
            {boardMode === "rope" && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <span
                    className="badge-linear badge-emerald"
                    style={{ marginBottom: 6 }}
                  >
                    Sincronización táctica de pareja
                  </span>
                  <h4
                    style={{
                      fontSize: 18,
                      color: "var(--color-ink)",
                      margin: "4px 0 6px",
                    }}
                  >
                    La teoría de la cuerda en pádel
                  </h4>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: "var(--color-body)",
                      lineHeight: 1.5,
                    }}
                  >
                    En el pádel moderno, una pareja exitosa se mueve unida por
                    una cuerda imaginaria de 3 metros. Si tu compañero bascula
                    al centro o retrocede, vos debés acompañar para no dejar
                    huecos libres.
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  {ROPE_THEORY_PHASES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`tactic-select-btn${r.id === activeRopeId ? " active" : ""}`}
                      onClick={() => setActiveRopeId(r.id)}
                    >
                      <strong
                        style={{
                          fontSize: 14,
                          display: "block",
                          marginBottom: 2,
                        }}
                      >
                        {r.name}
                      </strong>
                      <span
                        style={{ fontSize: 12.5, color: "var(--color-muted)" }}
                      >
                        {r.desc}
                      </span>
                    </button>
                  ))}
                </div>

                <div
                  className="pro-tip-box"
                  style={{ background: "rgba(22, 163, 74, 0.12)", borderColor: "#16a34a" }}
                >
                  <strong
                    style={{
                      color: "#16a34a",
                      fontSize: 13,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Regla de oro del doble:
                  </strong>
                  <span style={{ fontSize: 12.5, color: "var(--color-ink)" }}>
                    "Nunca te quedes mirando el golpe de tu compañero: ajustá tu
                    posición en cada tiro para cerrar la volea al centro o
                    cubrir la pared descubierta."
                  </span>
                </div>

                <a
                  href={buildRopeWhatsAppUrl(rope)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{
                    width: "100%",
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 13,
                    padding: "10px 14px",
                    borderColor: "#1fa855",
                    color: "#ffffff",
                    background: "#1fa855",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                  title="Enviar este movimiento táctico de pareja a tu compañero por WhatsApp"
                >
                  <Handshake size={20} aria-hidden="true" />
                  <span>Compartir sincronización con mi pareja</span>
                </a>
              </>
            )}

            {/* MODO 3: PIZARRA LIBRE */}
            {boardMode === "free" && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <span
                    className="badge-linear badge-amber"
                    style={{ marginBottom: 6 }}
                  >
                    Entrenador táctico interactivo
                  </span>
                  <h4
                    style={{
                      fontSize: 18,
                      color: "var(--color-ink)",
                      margin: "4px 0 6px",
                    }}
                  >
                    Diseñá tu propia estrategia
                  </h4>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: "var(--color-body)",
                      lineHeight: 1.5,
                    }}
                  >
                    Seleccioná qué jugador querés mover y hacé clic en cualquier
                    punto de la cancha para ubicarlo tácticamente.
                  </p>
                </div>

                {/* SELECTOR DE JUGADOR A MOVER */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--color-muted)",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Seleccioná el jugador a mover:
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 8,
                    }}
                  >
                    {[
                      { id: "p1", name: "J1 (tu jugador)", color: "#E8722A" },
                      { id: "p2", name: "J2 (tu pareja)", color: "#E8722A" },
                      { id: "r1", name: "R1 (rival de drive)", color: "#38bdf8" },
                      { id: "r2", name: "R2 (rival de revés)", color: "#38bdf8" },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        className={`quiz-opt-btn${selectedFreePlayer === btn.id ? " selected" : ""}`}
                        onClick={() => setSelectedFreePlayer(btn.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          justifyContent: "center",
                          padding: "10px",
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: btn.color,
                          }}
                        />
                        <strong>{btn.name}</strong>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetFreeCourt}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    Reiniciar posiciones
                  </button>
                </div>
              </>
            )}

            {/* LINK CONSULTA ENTRENAMIENTO */}
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <a
                href={`https://wa.me/5492995974176?text=${encodeURIComponent(
                  `¡Hola Muzzaga! Estuve usando la Pizarra Táctica en la web y me gustaría consultar por clases y clínicas de entrenamiento táctico (${tactic.title}).`,
                )}`}
                target="_blank"
                rel="noopener"
                className="tactical-clases-link whatsapp-text"
              >
                Consultar por clases por WhatsApp →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
