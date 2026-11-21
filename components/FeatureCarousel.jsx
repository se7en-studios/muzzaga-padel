"use client";

// Galería de Instalaciones: un carrusel con scroll-snap nativo (se desliza
// con el dedo, la rueda o las flechas) en vez de animarlo con JS. Las
// pastillas de arriba saltan a cada foto y se marcan solas al deslizar.
// El JS solo sabe cuál es la foto activa y la rota sola mientras nadie la
// toca. CSS en app/secciones/camaras-instalaciones.css (prefijo ig-).

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// Íconos 3D de la marca (public/img/iconos), los mismos de la ficha técnica.
// La foto de cada tarjeta sale de Configuración → Sitio web (slot
// `inst-<id>` en lib/siteContent.js, que también tiene las de por defecto).
const FEATURES = [
  {
    id: "canchas",
    label: "Canchas de cristal",
    icon: "/img/iconos/icono-cristal.webp",
    description: "2 canchas de cristal templado con rebote parejo.",
  },
  {
    id: "led",
    label: "Iluminación LED",
    icon: "/img/iconos/icono-led.webp",
    description:
      "Luz LED en todas las canchas para jugar de noche sin perder nitidez.",
  },
  {
    id: "cantina",
    label: "Cantina propia",
    icon: "/img/iconos/icono-cantina.webp",
    description: "Pizzas caseras, minutas y bebidas para el tercer tiempo.",
  },
  {
    id: "torneos",
    label: "Torneos todo el año",
    icon: "/img/iconos/biblioteca/icono-trofeo.webp",
    description: "Torneos y ligas internas durante toda la temporada.",
  },
  {
    id: "living",
    label: "Living y tercer tiempo",
    icon: "/img/iconos/biblioteca/icono-living.webp",
    description:
      "Pantalla grande, mesas y buena previa para quedarte después de jugar.",
  },
  {
    id: "vestuarios",
    label: "Vestuarios y duchas",
    icon: "/img/iconos/biblioteca/icono-ducha.webp",
    description: "Duchas y baños para cambiarte después de jugar.",
  },
];

const TOTAL = FEATURES.length;
const pad = (n) => String(n).padStart(2, "0");
// Rotación automática: da tiempo a leer el texto de cada foto. Se apaga
// para siempre apenas la persona toca, desliza o usa el teclado.
const AUTOPLAY_MS = 6000;

export default function FeatureCarousel({ photos }) {
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const wrapRef = useRef(null);
  const trackRef = useRef(null);
  const chipsRef = useRef(null);

  // Centra la tarjeta `i` dentro de la tira (solo en horizontal: nunca
  // mueve la página).
  const irA = (i, smooth = true) => {
    const track = trackRef.current;
    const card = track?.children[(i + TOTAL) % TOTAL];
    if (!card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({
      left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
      behavior: smooth && !reduce ? "smooth" : "auto",
    });
  };

  // La foto activa es la que quedó más cerca del centro de la tira.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    let frame = 0;
    const medir = () => {
      frame = 0;
      const centro = track.scrollLeft + track.clientWidth / 2;
      let mejor = 0;
      let dist = Infinity;
      [...track.children].forEach((card, i) => {
        const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - centro);
        if (d < dist) {
          dist = d;
          mejor = i;
        }
      });
      setActive(mejor);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(medir);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Rota sola solo si la galería se ve, la pestaña está activa y no hay
  // "reducir movimiento".
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let enPantalla = false;
    let tocada = false;
    const actualizar = () => setAutoplay(enPantalla && !tocada && !document.hidden);
    const io = new IntersectionObserver(
      ([entry]) => {
        enPantalla = entry.isIntersecting;
        actualizar();
      },
      { threshold: 0.5 },
    );
    io.observe(wrap);
    const tomarControl = () => {
      tocada = true;
      actualizar();
    };
    const eventos = ["pointerdown", "wheel", "keydown", "touchstart"];
    eventos.forEach((ev) => wrap.addEventListener(ev, tomarControl, { passive: true }));
    document.addEventListener("visibilitychange", actualizar);
    return () => {
      io.disconnect();
      eventos.forEach((ev) => wrap.removeEventListener(ev, tomarControl));
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, []);

  useEffect(() => {
    if (!autoplay) return undefined;
    const id = setTimeout(() => irA(active + 1), AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [autoplay, active]);

  // La pastilla activa siempre a la vista dentro de su fila (en celu la
  // fila se desliza de costado).
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.children[active];
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({
      left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [active]);

  return (
    <div
      className="ig-wrap"
      ref={wrapRef}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Fotos de las instalaciones"
    >
      <div className="ig-chips" ref={chipsRef}>
        {FEATURES.map((f, i) => (
          <button
            key={f.id}
            type="button"
            className="ig-chip"
            aria-current={i === active ? "true" : undefined}
            aria-controls={`ig-foto-${f.id}`}
            onClick={() => irA(i)}
          >
            <Image src={f.icon} alt="" width={30} height={30} className="icono-3d ig-chip-3d" aria-hidden="true" />
            <span className="ig-chip-num" aria-hidden="true">{pad(i + 1)}</span>
            <span className="ig-chip-label">{f.label}</span>
          </button>
        ))}
      </div>

      <div className="ig-stage">
        <ul className="ig-track" ref={trackRef} tabIndex={0} aria-label="Deslizá para ver las fotos">
          {FEATURES.map((f, i) => {
            const photo = photos[`inst-${f.id}`];
            return (
              <li
                key={f.id}
                id={`ig-foto-${f.id}`}
                className={`ig-card${i === active ? " is-activa" : ""}`}
                aria-roledescription="foto"
                aria-label={`${i + 1} de ${TOTAL}: ${f.label}`}
              >
                {/* Mide 78vw (máx. 340 px) en celu y 400 px en compu:
                    next/image sirve ese ancho y no el archivo entero. */}
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 1023px) min(78vw, 340px), 400px"
                  draggable={false}
                  className="ig-img"
                />
                <span className="ig-marcador" aria-hidden="true">
                  <b>{pad(i + 1)}</b> / {pad(TOTAL)}
                </span>
                <div className="ig-caption">
                  <span className="ig-tag">{f.label}</span>
                  <p className="ig-desc">{f.description}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="ig-controles">
          <button
            type="button"
            className="ig-flecha"
            aria-label="Foto anterior"
            onClick={() => irA(active - 1)}
          >
            <span aria-hidden="true">←</span>
          </button>
          {/* Un tramo por foto: el activo se llena (naranja) mientras rota sola. */}
          <div className="ig-tramos" aria-hidden="true">
            {FEATURES.map((f, i) => (
              <span
                key={f.id}
                className={`ig-tramo${i === active ? " is-activo" : ""}${i < active ? " is-visto" : ""}`}
              >
                {i === active && autoplay && (
                  <span key={active} className="ig-tramo-relleno" style={{ "--ig-ms": `${AUTOPLAY_MS}ms` }} />
                )}
              </span>
            ))}
          </div>
          <span className="ig-contador" aria-live={autoplay ? "off" : "polite"}>
            <b>{pad(active + 1)}</b> / {pad(TOTAL)}
          </span>
          <button
            type="button"
            className="ig-flecha"
            aria-label="Foto siguiente"
            onClick={() => irA(active + 1)}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
