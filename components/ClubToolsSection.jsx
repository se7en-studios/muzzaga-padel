"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const TOOLS = [
  {
    key: "dividir",
    short: "Dividir gastos",
    href: "/herramientas/dividir-gastos",
    badge: "Para grupos",
    badgeColor: "badge-emerald",
    icon: "/img/iconos/icono-dividir.webp",
    title: "Dividir cancha y tercer tiempo",
    desc: "Calculá en segundos cuánto paga cada uno por el turno y los consumos de cantina. Copiá el desglose directo al grupo de WhatsApp.",
    cta: "Abrir calculadora",
  },
  {
    key: "nivel",
    short: "Test de nivel",
    href: "/herramientas/nivel",
    badge: "Competencia",
    badgeColor: "badge-indigo",
    icon: "/img/iconos/icono-nivel-v2.webp",
    title: "Test de nivel y categorías",
    desc: "6 situaciones de partido para saber tu categoría, de 8va a 1era, en la escala internacional (1.0 a 7.0). Ideal para anotarte en partidos parejos.",
    cta: "Calcular mi nivel",
  },
  {
    key: "pizarra",
    short: "Pizarra táctica",
    href: "/herramientas/pizarra",
    badge: "Estrategia",
    badgeColor: "badge-amber",
    icon: "/img/iconos/icono-pizarra.webp",
    title: "Pizarra táctica interactiva",
    desc: "Simulador interactivo de jugadas en cancha de cristal: repasá paso a paso la víbora a la reja, el smash por 3, bandejas y chiquitas.",
    cta: "Ver simulador táctico",
  },
  {
    key: "americano",
    short: "Americano",
    href: "/herramientas/americano",
    badge: "Torneos express",
    badgeColor: "badge-emerald",
    icon: "/img/iconos/icono-americano.webp",
    title: "Generador de torneo americano",
    desc: "Armá el fixture de rotación para 4 a 8 jugadores donde todos juegan con todos en partidos cortos y equilibrados.",
    cta: "Generar fixture",
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
          <path d="M98 14 L105 22 L95 25" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="14" cy="54" r="6" fill="#e8722a" stroke="#fff" strokeWidth="1.5" />
          <circle cx="62" cy="50" r="6" fill="#e8722a" stroke="#fff" strokeWidth="1.5" />
          <circle className="tool-prev-pelota" cx="104" cy="22" r="4.5" fill="#d7f03a" />
        </svg>
        <span className="tool-prev-cap">Víbora a la reja</span>
      </span>
    );
  }
  return (
    <span className="tool-prev tool-prev-americano">
      <span><b>R1</b> A·B vs C·D</span>
      <span><b>R2</b> A·C vs B·D</span>
      <span><b>R3</b> A·D vs B·C</span>
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
            <h2 className="section-title">
              Herramientas para jugar mejor
            </h2>
            <p className="section-desc">
              Herramientas interactivas creadas para ayudarte a organizar tus
              partidos, mejorar tu táctica y saber tu categoría.
            </p>
          </div>
        </div>

        <div className="tools-grid" ref={trackRef}>
          {TOOLS.map((tool, idx) => (
            <div
              key={tool.href}
              className={`club-tool-card tool-${tool.key}${active === idx ? " is-active" : ""}`}
            >
              <div className="tool-cancha">
                <span className="tool-num" aria-hidden="true">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className={`badge-linear ${tool.badgeColor}`}>
                  {tool.badge}
                </span>
                <span className="club-tool-icon" aria-hidden="true">
                  <Image src={tool.icon} alt="" width={76} height={76} className="icono-3d" />
                </span>
                <span aria-hidden="true">
                  <ToolPreview tool={tool} />
                </span>
              </div>

              <div className="tool-body">
                <h3 className="club-tool-title">{tool.title}</h3>
                <p className="club-tool-desc">{tool.desc}</p>
              </div>

              <Link href={tool.href} className="club-tool-link">
                {tool.cta}
              </Link>
            </div>
          ))}
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
