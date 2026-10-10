"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Hasta acá arriba la pastilla queda siempre abierta, y hace falta mover
// este tanto en una dirección para que cambie (un temblor del dedo no).
const TOP_PX = 80;
const DIRECTION_PX = 12;
const BOTTOM_PX = 40;

const ICON = { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true };

function useCompactOnScroll(ref) {
  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    let lastY = window.scrollY;
    let travel = 0;
    let frame = 0;
    const set = (compact) => nav.classList.toggle("is-compact", compact);
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - BOTTOM_PX;
      if (y < TOP_PX || atBottom) {
        travel = 0;
        set(false);
        return;
      }
      if (delta === 0) return;
      if (Math.sign(delta) !== Math.sign(travel)) travel = 0;
      travel += delta;
      if (travel > DIRECTION_PX) set(true);
      else if (travel < -DIRECTION_PX) set(false);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

// En la home, la pestaña de la sección que se está mirando. Se observan todas
// las secciones: si no, "Abiertas" quedaba marcada al volver al hero o al
// seguir bajando a instalaciones, FAQ, etc.
const HOME_SECTION_TAB = { top: "turnos", turnos: "turnos", instalaciones: "ubicacion", ubicacion: "ubicacion", torneos: "torneos", cantina: "menu" };

function useHomeSection(enabled) {
  const [section, setSection] = useState("turnos");
  useEffect(() => {
    if (!enabled) return;
    const targets = [...document.querySelectorAll("section[id]")];
    if (!targets.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setSection(HOME_SECTION_TAB[entry.target.id] ?? null);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [enabled]);
  return section;
}

export default function BottomNav() {
  const ref = useRef(null);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const homeSection = useHomeSection(isHome);
  useCompactOnScroll(ref);

  const active = isHome
    ? homeSection
    : pathname.startsWith("/torneos")
      ? "torneos"
      : pathname.startsWith("/menu")
        ? "menu"
        : null;
  const item = (key) => ({
    className: `bottom-bar-item${active === key ? " active" : ""}`,
    "aria-current": active === key ? (isHome ? "location" : "page") : undefined,
  });

  return (
    <nav ref={ref} className="mobile-bottom-bar" aria-label="Navegación móvil inferior">
      <span className="bottom-bar-bg" aria-hidden="true" />

      <a {...item("turnos")} href="/#turnos" aria-label="Ir a turnos" style={{ "--k": 2 }}>
        <span className="bottom-bar-icon">
          <svg {...ICON}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </span>
        <span className="bottom-bar-label">Turnos</span>
      </a>

      <a {...item("ubicacion")} href="/#ubicacion" aria-label="Cómo llegar y ubicación del club" style={{ "--k": 1 }}>
        <span className="bottom-bar-icon">
          <svg {...ICON}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
            <circle cx="12" cy="9" r="2.5"></circle>
          </svg>
        </span>
        <span className="bottom-bar-label">Club</span>
      </a>

      <Link {...item("torneos")} href="/torneos" aria-label="Ver torneos" style={{ "--k": 0 }}>
        <span className="bottom-bar-icon">
          <svg {...ICON}>
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
            <path d="M4 22h16"></path>
            <path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-2c-.55 0-1-.45-1-1v-2.34"></path>
            <path d="M6 4h12a2 2 0 0 1 2 2v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V6a2 2 0 0 1 2-2z"></path>
          </svg>
        </span>
        <span className="bottom-bar-label">Torneos</span>
      </Link>

      <Link {...item("menu")} href="/menu" aria-label="Ver el menú de la cantina" style={{ "--k": -1 }}>
        <span className="bottom-bar-icon">
          <svg {...ICON}>
            <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
            <line x1="6" y1="1" x2="6" y2="4"></line>
            <line x1="10" y1="1" x2="10" y2="4"></line>
            <line x1="14" y1="1" x2="14" y2="4"></line>
          </svg>
        </span>
        <span className="bottom-bar-label">Menú</span>
      </Link>

      {/* Solo el logo, más grande: se reconoce sin el nombre. */}
      <a
        className="bottom-bar-item bottom-bar-item--wa"
        href="https://wa.me/5492995974176"
        target="_blank"
        rel="noopener"
        aria-label="Abrir WhatsApp del club"
        style={{ "--k": -2 }}
      >
        <span className="bottom-bar-icon">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="#25D366" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
          </svg>
        </span>
      </a>
    </nav>
  );
}
