"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

// Cada herramienta tiene su color (--hl-acento): se reconoce de lejos y
// combina con el encabezado de su página (/herramientas/*, clases hx-).
const TOOLS = [
  {
    key: "dividir",
    short: "Dividir gastos",
    href: "/herramientas/dividir-gastos",
    badge: "Para grupos",
    icon: "/img/iconos/icono-dividir.webp",
    title: "Dividir cancha y tercer tiempo",
    desc: "Cuánto pone cada uno por la cancha y la cantina. Lo mandás al grupo de WhatsApp en un toque.",
    cta: "Abrir calculadora",
  },
  {
    key: "nivel",
    short: "Test de nivel",
    href: "/herramientas/nivel",
    badge: "Competencia",
    icon: "/img/iconos/icono-nivel-v2.webp",
    title: "Test de nivel",
    desc: "6 situaciones de partido y te decimos tu categoría, de 8va a 1era (escala 1.0 a 7.0).",
    cta: "Calcular mi nivel",
  },
  {
    key: "pizarra",
    short: "Pizarra táctica",
    href: "/herramientas/pizarra",
    badge: "Estrategia",
    icon: "/img/iconos/icono-pizarra.webp",
    title: "Pizarra táctica",
    desc: "Víbora a la reja, smash por 3, bandeja: mirá cada jugada paso a paso sobre la cancha.",
    cta: "Ver jugadas",
  },
  {
    key: "americano",
    short: "Americano",
    href: "/herramientas/americano",
    badge: "Torneo express",
    icon: "/img/iconos/icono-americano.webp",
    title: "Torneo americano",
    desc: "Fixture para 4 a 8 jugadores: todos con todos, partidos cortos y tabla en vivo.",
    cta: "Armar fixture",
  },
];

/* Vista previa de lo que hace cada herramienta, dibujada sobre la cancha.
   Es decorativa (aria-hidden): el texto de la tarjeta ya lo explica. */
function ToolPreview({ tool }) {
  if (tool.key === "dividir") {
    return (
      <span className="tool-prev tool-prev-dividir">
        <span className="tool-prev-cap">Turno + cantina ÷ 4</span>
        <span className="tool-prev-balls">
          <i>¼</i>
          <i>¼</i>
          <i>¼</i>
          <i>¼</i>
        </span>
      </span>
    );
  }
  if (tool.key === "nivel") {
    return (
      <span className="tool-prev tool-prev-nivel">
        <span className="tool-prev-cap">8va → 1era</span>
        <span className="tool-prev-escala">
          <i className="tool-prev-marca" />
        </span>
        <span className="tool-prev-extremos">
          <span>1.0</span>
          <span>7.0</span>
        </span>
      </span>
    );
  }
  if (tool.key === "pizarra") {
    return (
      <span className="tool-prev tool-prev-pizarra">
        <svg viewBox="0 0 120 64" width="120" height="64" fill="none">
          <path
            className="tool-prev-trazo"
            d="M14 54 C 40 6, 84 4, 104 22"
            stroke="#fff"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <path
            d="M98 14 L105 22 L95 25"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="14"
            cy="54"
            r="6"
            fill="#e8722a"
            stroke="#fff"
            strokeWidth="1.5"
          />
          <circle
            cx="62"
            cy="50"
            r="6"
            fill="#e8722a"
            stroke="#fff"
            strokeWidth="1.5"
          />
          <circle
            className="tool-prev-pelota"
            cx="104"
            cy="22"
            r="4.5"
            fill="#d7f03a"
          />
        </svg>
        <span className="tool-prev-cap">Víbora a la reja</span>
      </span>
    );
  }
  return (
    <span className="tool-prev tool-prev-americano">
      <span>
        <b>R1</b> A·B vs C·D
      </span>
      <span>
        <b>R2</b> A·C vs B·D
      </span>
      <span>
        <b>R3</b> A·D vs B·C
      </span>
    </span>
  );
}

export default function ClubToolsSection() {
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  // Carrusel del celu: miramos qué tarjeta quedó al frente para prender su
  // pelotita. Con rAF para no recalcular en cada píxel de scroll (J7).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const cards = track.children;
      if (!cards.length) return;
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 0) return;
      if (track.scrollLeft >= max - 4) {
        setActive(cards.length - 1);
        return;
      }
      const step = cards[1]
        ? cards[1].offsetLeft - cards[0].offsetLeft
        : track.clientWidth;
      setActive(Math.round(track.scrollLeft / step));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const goTo = (idx) => {
    const track = trackRef.current;
    const card = track?.children[idx];
    if (!card) return;
    const left =
      track.scrollLeft +
      card.getBoundingClientRect().left -
      track.getBoundingClientRect().left -
      16;
    const smooth = window.matchMedia(
      "(prefers-reduced-motion: no-preference)",
    ).matches;
    track.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <section
      id="herramientas"
      className="section-turnos"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="container">
        <div className="section-header-row">
          <div>
            <span
              className="badge-linear badge-amber"
              style={{ marginBottom: 8 }}
            >
              Herramientas gratis
            </span>
            <h2 className="section-title">Herramientas para jugar mejor</h2>
            <p className="section-desc">
              Gratis y desde el celu: dividí la cuenta, medí tu nivel, repasá
              jugadas o armá un americano con amigos.
            </p>
          </div>
        </div>

        <div className="hl-track" ref={trackRef}>
          {TOOLS.map((tool, idx) => {
            const num = String(idx + 1).padStart(2, "0");
            return (
              <article
                key={tool.href}
                className={`hl-card hl-${tool.key}${active === idx ? " is-active" : ""}`}
              >
                <div className="hl-cancha" aria-hidden="true">
                  <span className="hl-pelota" />
                  <span className="hl-num">{num}</span>
                  <span className="hl-icono">
                    <Image
                      src={tool.icon}
                      alt=""
                      width={104}
                      height={104}
                      className="icono-3d"
                    />
                  </span>
                  <ToolPreview tool={tool} />
                </div>

                <div className="hl-body">
                  <p className="hl-kicker">
                    Herramienta {num} · {tool.badge}
                  </p>
                  <h3 className="hl-title">{tool.title}</h3>
                  <p className="hl-desc">{tool.desc}</p>
                </div>

                <Link href={tool.href} className="hl-cta">
                  {tool.cta}
                  <span className="hl-cta-flecha" aria-hidden="true">
                    →
                  </span>
                </Link>
              </article>
            );
          })}
        </div>

        {/* Indicador del carrusel (solo celu): una pelotita por herramienta. */}
        <div className="tools-dots">
          <span className="tools-dots-num" aria-hidden="true">
            {String(active + 1).padStart(2, "0")}
            <span> / {String(TOOLS.length).padStart(2, "0")}</span>
          </span>
          <div className="tools-dots-row">
            {TOOLS.map((tool, idx) => (
              <button
                key={tool.key}
                type="button"
                className={`tools-dot${active === idx ? " is-active" : ""}`}
                aria-label={`Ver ${tool.short}`}
                aria-current={active === idx ? "true" : undefined}
                onClick={() => goTo(idx)}
              />
            ))}
          </div>
          <span className="tools-dots-name" aria-hidden="true">
            {TOOLS[active].short}
          </span>
        </div>
      </div>
    </section>
  );
}
