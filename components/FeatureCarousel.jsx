"use client";

// Adaptado de un componente shadcn/Tailwind/TS (motion + hugeicons) al stack
// real del proyecto: JS + CSS plano en globals.css, sin Tailwind ni TS. Los
// íconos son los mismos SVG inline que ya usa AmenitiesSection, y las fotos
// son las reales del club (public/img), no placeholders de stock.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import Image from "next/image";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function IconCourt() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  );
}

function IconBulb() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconCantina() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3a2 2 0 0 1-2 4h-1M7 5H4a2 2 0 0 0 2 4h1" />
    </svg>
  );
}

function IconSofa() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5" />
      <path d="M2 12h20v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4Z" />
      <line x1="4" y1="18" x2="4" y2="21" />
      <line x1="20" y1="18" x2="20" y2="21" />
    </svg>
  );
}

function IconShower() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 21V6a3 3 0 0 1 3-3h1" />
      <path d="M8 3a6 6 0 0 1 6 6H8" />
      <line x1="9" y1="13" x2="9" y2="14" />
      <line x1="12" y1="13" x2="12" y2="14" />
      <line x1="15" y1="13" x2="15" y2="14" />
      <line x1="10.5" y1="17" x2="10.5" y2="18" />
      <line x1="13.5" y1="17" x2="13.5" y2="18" />
    </svg>
  );
}

// La foto de cada tarjeta sale de Configuración → Sitio web (slot
// `inst-<id>` en lib/siteContent.js, que también tiene las de por defecto).
// No hay foto real de "alquiler de paletas": se sacó esa feature en vez de
// ilustrarla con una imagen que no la muestra.
const FEATURES = [
  {
    id: "canchas",
    label: "Canchas de cristal",
    icon: IconCourt,
    description: "2 canchas de cristal templado con rebote parejo.",
  },
  {
    id: "led",
    label: "Iluminación LED",
    icon: IconBulb,
    description:
      "Luz LED en todas las canchas para jugar de noche sin perder nitidez.",
  },
  {
    id: "cantina",
    label: "Cantina propia",
    icon: IconCantina,
    description: "Pizzas caseras, minutas y bebidas para el tercer tiempo.",
  },
  {
    id: "torneos",
    label: "Torneos todo el año",
    icon: IconTrophy,
    description: "Torneos y ligas internas durante toda la temporada.",
  },
  {
    id: "living",
    label: "Living y tercer tiempo",
    icon: IconSofa,
    description:
      "Pantalla grande, mesas y buena previa para quedarte después de jugar.",
  },
  {
    id: "vestuarios",
    label: "Vestuarios y duchas",
    icon: IconShower,
    description: "Duchas y baños para cambiarte después de jugar.",
  },
];

// Misma curva que --ease en globals.css: motion no lee variables CSS.
const EASE = [0.16, 1, 0.3, 1];
const MOVE = { duration: 0.4, ease: EASE };
const ITEM_HEIGHT = 52;
// Deslizar la foto: pasa si se arrastró más que esto o se soltó rápido.
const SWIPE_PX = 50;
const SWIPE_VELOCITY = 400;
// Rotación automática: da tiempo a leer el texto de cada foto. Cada toque o
// deslizamiento reinicia la cuenta (el efecto depende de `step`).
const AUTOPLAY_MS = 5500;

const wrap = (min, max, v) => {
  const rangeSize = max - min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
};

export default function FeatureCarousel({ photos }) {
  const [step, setStep] = useState(0);
  const wrapRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const currentIndex =
    ((step % FEATURES.length) + FEATURES.length) % FEATURES.length;

  const handleChipClick = (index) => {
    const diff = (index - currentIndex + FEATURES.length) % FEATURES.length;
    if (diff > 0) setStep((s) => s + diff);
  };

  // Preferencias y visibilidad: solo rota si la sección se ve en pantalla, la
  // pestaña está activa, no hay "reducir movimiento" y nadie la está usando.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReduceMotion(mq.matches);
    const onVisibility = () => setIsTabVisible(!document.hidden);
    onMotion();
    onVisibility();
    mq.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.4 },
    );
    if (wrapRef.current) observer.observe(wrapRef.current);
    return () => {
      mq.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    };
  }, []);

  const shouldAutoplay = inView && isTabVisible && !isPaused && !reduceMotion;
  useEffect(() => {
    if (!shouldAutoplay) return undefined;
    const id = setTimeout(() => setStep((s) => s + 1), AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [shouldAutoplay, step]);

  // El mouse encima pausa la rotación; en celular no hay "encima", así que ahí
  // solo manda el reinicio de la cuenta al tocar o deslizar.
  const pauseProps = {
    onPointerEnter: (e) => e.pointerType === "mouse" && setIsPaused(true),
    onPointerLeave: (e) => e.pointerType === "mouse" && setIsPaused(false),
  };

  const getCardStatus = (index) => {
    const diff = index - currentIndex;
    const len = FEATURES.length;
    let normalizedDiff = diff;
    if (diff > len / 2) normalizedDiff -= len;
    if (diff < -len / 2) normalizedDiff += len;
    if (normalizedDiff === 0) return "active";
    if (normalizedDiff === -1) return "prev";
    if (normalizedDiff === 1) return "next";
    return "hidden";
  };

  // Con "reducir movimiento" motion deja las fotos quietas y solo cambia la
  // opacidad.
  return (
    <MotionConfig reducedMotion="user">
    <div className="fc-wrap" ref={wrapRef} {...pauseProps}>
      <div className="fc-frame">
        <div className="fc-nav">
          <div className="fc-nav-fade fc-nav-fade-top" />
          <div className="fc-nav-fade fc-nav-fade-bottom" />
          <div className="fc-nav-track">
            {FEATURES.map((feature, index) => {
              const isActive = index === currentIndex;
              const distance = index - currentIndex;
              const wrappedDistance = wrap(
                -(FEATURES.length / 2),
                FEATURES.length / 2,
                distance,
              );
              const Icon = feature.icon;

              return (
                <motion.div
                  key={feature.id}
                  style={{ height: ITEM_HEIGHT }}
                  animate={{
                    y: wrappedDistance * ITEM_HEIGHT,
                    opacity: 1 - Math.abs(wrappedDistance) * 0.25,
                  }}
                  transition={MOVE}
                  className="fc-nav-item"
                >
                  <button
                    type="button"
                    onClick={() => handleChipClick(index)}
                    className={`fc-pill${isActive ? " active" : ""}`}
                  >
                    <span className="fc-pill-icon">
                      <Icon />
                    </span>
                    <span className="fc-pill-label">{feature.label}</span>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="fc-stage">
          <div className="fc-stage-card-wrap">
            {FEATURES.map((feature, index) => {
              const status = getCardStatus(index);
              const isActive = status === "active";
              const isPrev = status === "prev";
              const isNext = status === "next";
              const photo = photos[`inst-${feature.id}`];

              return (
                <motion.div
                  key={feature.id}
                  initial={false}
                  animate={{
                    x: isActive ? 0 : isPrev ? -100 : isNext ? 100 : 0,
                    scale: isActive ? 1 : isPrev || isNext ? 0.85 : 0.7,
                    opacity: isActive ? 1 : isPrev || isNext ? 0.4 : 0,
                    rotate: isPrev ? -3 : isNext ? 3 : 0,
                  }}
                  style={{
                    zIndex: isActive ? 20 : isPrev || isNext ? 10 : 0,
                    pointerEvents: isActive ? "auto" : "none",
                    // De costado la arrastra; para arriba y abajo sigue la página.
                    touchAction: "pan-y",
                  }}
                  drag={isActive ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.35}
                  dragSnapToOrigin
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -SWIPE_PX || info.velocity.x < -SWIPE_VELOCITY) {
                      setStep((s) => s + 1);
                    } else if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_VELOCITY) {
                      setStep((s) => s - 1);
                    }
                  }}
                  transition={MOVE}
                  className={`fc-stage-card${isActive ? " is-active" : ""}`}
                >
                  {/* La tarjeta mide 320 × 400 (420 × 525 desde 1024): next/image
                      sirve ese ancho en vez del archivo entero. */}
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(max-width: 1023px) 320px, 420px"
                    draggable={false}
                    className={`fc-stage-img${isActive ? " active" : ""}`}
                  />

                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={MOVE}
                        className="fc-stage-caption"
                      >
                        <span className="fc-stage-tag">
                          {index + 1} · {feature.label}
                        </span>
                        <p className="fc-stage-desc">{feature.description}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}
