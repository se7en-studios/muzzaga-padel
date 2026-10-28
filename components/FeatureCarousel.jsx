"use client";

// Adaptado de un componente shadcn/Tailwind/TS (motion + hugeicons) al stack
// real del proyecto: JS + CSS plano en globals.css, sin Tailwind ni TS. Los
// íconos son los 3D de la marca que ya usa AmenitiesSection, y las fotos son
// las reales del club (public/img), no placeholders de stock.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import Image from "next/image";

// Íconos 3D de la marca (fieltro naranja, como Muzzaguito), los mismos de la
// ficha técnica y la biblioteca en public/img/iconos.
function Icon3D({ src }) {
  return (
    <Image src={src} alt="" width={30} height={30} className="icono-3d fc-pill-3d" aria-hidden="true" />
  );
}

const IconCourt = () => <Icon3D src="/img/iconos/icono-cristal.webp" />;
const IconBulb = () => <Icon3D src="/img/iconos/icono-led.webp" />;
const IconCantina = () => <Icon3D src="/img/iconos/icono-cantina.webp" />;
const IconTrophy = () => <Icon3D src="/img/iconos/biblioteca/icono-trofeo.webp" />;
const IconSofa = () => <Icon3D src="/img/iconos/biblioteca/icono-living.webp" />;
const IconShower = () => <Icon3D src="/img/iconos/biblioteca/icono-ducha.webp" />;

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
