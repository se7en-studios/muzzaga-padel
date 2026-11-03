"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildWhatsAppLink } from "../data/club";

// Cada toma corresponde a un tramo de la ruta de cámara de public/recorrido/index.html (modo ?embed=1).
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
    kick: "Recepción",
    title: "Recepción y cantina",
    text: "Pizzas al horno, empanadas, tostados y cerveza fría. Con opciones sin TACC.",
  },
  {
    kick: "Tercer tiempo",
    title: "Living y vestuarios",
    text: "Sillones con vista a las canchas y baños y vestuarios para cambiarte antes y después de jugar.",
  },
  {
    kick: "Te esperamos",
    title: "Ahora, a jugar",
    text: "Elegí tu día y horario y reservá tu cancha.",
  },
];

// Puntos de interés: `p` es la posición (0..1) del recorrido a la que viaja la cámara al tocarlos.
// Son las posiciones de los cuadros clave de la ruta (8 cuadros → i / 7).
const POIS = [
  { label: "Vista general", p: 0 },
  { label: "Canchas", p: 2 / 7 },
  { label: "Recepción y cantina", p: 4 / 7 },
  { label: "Zona de descanso", p: 5 / 7 },
  { label: "Vestuarios", p: 6 / 7 },
];

const WHATSAPP_HREF = buildWhatsAppLink("Hola! Quiero reservar una cancha");
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const nearestPoi = (p) =>
  POIS.reduce(
    (best, poi, i) =>
      Math.abs(poi.p - p) < Math.abs(POIS[best].p - p) ? i : best,
    0,
  );

export default function ClubRecorrido() {
  const sectionRef = useRef(null);
  const frameRef = useRef(null);
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [poi, setPoi] = useState(0);

  const post = useCallback((msg) => {
    frameRef.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);

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
      { rootMargin: "300% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.muzzaga === "ready") setReady(true);
      // la maqueta informa qué toma se está mostrando
      if (e.data?.muzzaga === "shot") {
        setStep(Math.min(STOPS.length - 1, Math.max(0, Number(e.data.i) || 0)));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // La maqueta solo dibuja mientras la sección está a la vista (el iframe no puede saberlo por sí solo).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !ready) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => post({ muzzaga: "visible", v: entry.isIntersecting }),
      { rootMargin: "20% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ready, post]);

  // Scroll → progreso 0..1 → cámara del iframe.
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
      setPoi(nearestPoi(p));
      post({ muzzaga: "tour", p });
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
  }, [ready, post]);

  // Parallax suave: la posición del cursor se manda a la maqueta (se apaga con "reducir movimiento").
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return undefined;
    let raf = 0;
    let pending = null;
    const flush = () => {
      raf = 0;
      post({ muzzaga: "pointer", ...pending });
    };
    const onMove = (e) => {
      pending = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
      if (!raf) raf = requestAnimationFrame(flush);
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [post]);

  // Tocar un punto de interés: scroll suave hasta ese tramo, la cámara lo sigue.
  const goTo = (p) => {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({
      top: top + p * (el.offsetHeight - window.innerHeight),
      behavior: reduce ? "auto" : "smooth",
    });
  };

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

        <nav className="club-tour-poi" aria-label="Zonas del club">
          {POIS.map((item, i) => (
            <button
              key={item.label}
              type="button"
              className={i === poi ? "on" : ""}
              aria-current={i === poi ? "true" : undefined}
              onClick={() => goTo(item.p)}
            >
              <span className="club-tour-poi-dot" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="club-tour-card" role="status" aria-live="polite">
          <div key={step} className="club-tour-card-body">
            <span className="club-tour-kick">{stop.kick}</span>
            <h2 className="club-tour-title">{stop.title}</h2>
            <p className="club-tour-text">{stop.text}</p>
          </div>
          <div className="club-tour-actions">
            <a
              className={`btn club-tour-btn ${isLast ? "btn-orange-primary" : "btn-ghost"}`}
              href="#turnos"
            >
              Reservar turno
            </a>
            <a
              className="btn club-tour-btn club-tour-wa"
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
            <a className="club-tour-link" href="/recorrido">
              Recorrer el club →
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
