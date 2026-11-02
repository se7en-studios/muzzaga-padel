"use client";

import { useEffect, useRef, useState } from "react";

// Cada parada corresponde, en orden, a un cuadro de cámara de public/recorrido/index.html (modo ?embed=1).
const STOPS = [
  {
    kick: "El club · Catriel",
    title: "Así es Muzzaga",
    text: "Toda la sede en una maqueta. Scrolleá y recorrela.",
  },
  {
    kick: "Pistas",
    title: "Dos canchas de cristal",
    text: "El Tano y La Vasca: cristal templado, cubiertas y sin viento.",
  },
  {
    kick: "Cantina",
    title: "Cantina propia",
    text: "Pizzas al horno, empanadas, tostados y cerveza fría. Con opciones sin TACC.",
  },
  {
    kick: "Tercer tiempo",
    title: "Living con vista a las canchas",
    text: "Sillones para seguir el partido y comentar las mejores jugadas.",
  },
  {
    kick: "Torneos",
    title: "Torneos todo el año",
    text: "Libre, Caballeros y Damas. Anotate por WhatsApp para el próximo.",
  },
  {
    kick: "Te esperamos",
    title: "Ahora, a jugar",
    text: "Elegí tu día y horario y reservá tu cancha.",
  },
];

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export default function ClubRecorrido() {
  const sectionRef = useRef(null);
  const frameRef = useRef(null);
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);

  // El iframe (three.js + texturas, ~1,3 MB) solo se pide cuando la sección está cerca.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin === window.location.origin && e.data?.muzzaga === "ready")
        setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Scroll → progreso 0..1 → cámara del iframe + texto de la parada.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;
    let raf = 0;
    let last = -1;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const p = clamp01(
        -rect.top / Math.max(1, rect.height - window.innerHeight),
      );
      if (p === last) return;
      last = p;
      setStep(Math.round(p * (STOPS.length - 1)));
      frameRef.current?.contentWindow?.postMessage(
        { muzzaga: "tour", p },
        window.location.origin,
      );
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ready]);

  const stop = STOPS[step];
  const isLast = step === STOPS.length - 1;

  return (
    <section
      ref={sectionRef}
      id="recorrido"
      className="club-tour"
      aria-label="Recorrido 3D del club"
      style={{ "--stops": STOPS.length }}
    >
      <div className="club-tour-sticky">
        {load && (
          <iframe
            ref={frameRef}
            className={`club-tour-frame${ready ? " is-ready" : ""}`}
            src="/recorrido/index.html?embed=1"
            title="Maqueta 3D del club Muzzaga"
            tabIndex={-1}
            aria-hidden="true"
          />
        )}
        {!ready && <div className="club-tour-loading">Armando la maqueta…</div>}

        <div className="club-tour-card" role="status" aria-live="polite">
          <span className="club-tour-kick">{stop.kick}</span>
          <h2 className="club-tour-title">{stop.title}</h2>
          <p className="club-tour-text">{stop.text}</p>
          <div className="club-tour-actions">
            <a
              className={`btn ${isLast ? "btn-orange-primary" : "btn-ghost"}`}
              href="#turnos"
            >
              Reservar turno
            </a>
            <a className="club-tour-link" href="/recorrido">
              Recorrelo vos →
            </a>
          </div>
          <ol className="club-tour-dots" aria-hidden="true">
            {STOPS.map((s, i) => (
              <li key={s.title} className={i === step ? "on" : ""} />
            ))}
          </ol>
        </div>

        <span
          className="club-tour-scroll"
          aria-hidden="true"
          data-hide={step > 0}
        >
          Scrolleá ↓
        </span>
      </div>
    </section>
  );
}
