"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCATION } from "../lib/siteLocation";
import useDialogFocus from "../lib/useDialogFocus";
import useHomeSection from "../lib/useHomeSection";
import { clubStatusLine, getClubStatus } from "../data/horarios";
import ScrollRow from "./ScrollRow";
import { WhatsAppLogo, GoogleMapsLogo } from "./BrandLogos";
import "./Header.css";

// `icon` y `desc` los usa el menú del celu (íconos 3D de la biblioteca).
const NAV_LINKS = [
  { key: "turnos", href: "/#turnos", label: "Turnos", icon: "calendario", desc: "Elegí día y horario" },
  { key: "torneos", href: "/torneos", label: "Torneos", icon: "trofeo", desc: "Anotate a la próxima fecha" },
  { key: "cantina", href: "/menu", label: "Cantina", icon: "menu", desc: "La carta del tercer tiempo" },
  { key: "instalaciones", href: "/#instalaciones", label: "Instalaciones", icon: "living", desc: "Canchas, vestuarios y más" },
  { key: "ubicacion", href: "/#ubicacion", label: "Ubicación", icon: "ubicacion", desc: "Dónde estamos en Catriel" },
];

const TOOLS_LINKS = [
  // `short`: el menú del celu los muestra en dos columnas.
  { href: "/herramientas/dividir-gastos", label: "Calculadora de gastos", short: "Dividir gastos", desc: "Dividir cancha y cantina" },
  { href: "/herramientas/nivel", label: "Test de nivel", desc: "Calculá tu categoría de pádel" },
  { href: "/herramientas/pizarra", label: "Pizarra táctica", desc: "Simulador interactivo de jugadas" },
  { href: "/herramientas/americano", label: "Torneo americano", short: "Americano", desc: "Generador de fixtures express" },
];

// En la home, qué link del header corresponde a la sección que estás mirando.
const HOME_SECTION_LINK = {
  turnos: "turnos",
  "canchas-abiertas": "turnos",
  torneos: "torneos",
  cantina: "cantina",
  camaras: "instalaciones",
  instalaciones: "instalaciones",
  recorrido: "instalaciones",
  ubicacion: "ubicacion",
  herramientas: "herramientas",
};

const WHATSAPP_URL = "https://wa.me/5492995974176";
const SCROLLED_PX = 16;

function activeFromPath(pathname) {
  if (pathname.startsWith("/torneos")) return "torneos";
  if (pathname.startsWith("/menu")) return "cantina";
  if (pathname.startsWith("/herramientas")) return "herramientas";
  return null;
}

/** "Abierto ahora · cierra a las 00:30" → título y bajada para el menú. */
function splitStatus(line) {
  const [title, ...rest] = line.split(" · ");
  const sub = rest.join(" · ");
  return { title, sub: sub ? sub[0].toUpperCase() + sub.slice(1) : "" };
}

function useScrolledClass(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      node.classList.toggle("is-scrolled", window.scrollY > SCROLLED_PX);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

/**
 * `mapsHref`, `schedule` y `blockedDates` llegan de Configuración vía
 * SiteHeader; las páginas de error (client) lo usan sin props y toman el
 * link y el horario originales.
 */
export default function Header({ mapsHref = DEFAULT_LOCATION.mapsUrl, schedule, blockedDates }) {
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [now, setNow] = useState(null);
  const headerRef = useRef(null);
  const toolsRef = useRef(null);
  const closeBtnRef = useRef(null);
  const pathname = usePathname() || "/";
  const isHome = pathname === "/";
  const homeSection = useHomeSection(isHome);
  const active = isHome ? (HOME_SECTION_LINK[homeSection] ?? null) : activeFromPath(pathname);
  useScrolledClass(headerRef);

  const close = () => setOpen(false);
  // Foco adentro, Tab que no se escapa, Escape cierra y el foco vuelve a la
  // hamburguesa. Va antes del efecto que enfoca la X: así toma como "el que
  // abrió" a la hamburguesa y no a la X.
  const sheetRef = useDialogFocus(open, close);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus({ preventScroll: true });
    setNow(new Date());
    // La página de atrás no scrollea mientras el menú está abierto.
    const root = document.documentElement;
    root.classList.add("menu-abierto");
    // Si se agranda la ventana hasta escritorio, el menú del celu no tiene
    // botón para cerrarse: se cierra solo.
    const desktop = window.matchMedia("(min-width: 1181px)");
    const onChange = (e) => e.matches && setOpen(false);
    desktop.addEventListener("change", onChange);
    return () => {
      root.classList.remove("menu-abierto");
      desktop.removeEventListener("change", onChange);
    };
  }, [open]);

  // Herramientas (escritorio): Escape o un clic afuera lo cierran.
  useEffect(() => {
    if (!toolsOpen) return;
    const onKey = (e) => e.key === "Escape" && setToolsOpen(false);
    const onDown = (e) => !toolsRef.current?.contains(e.target) && setToolsOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [toolsOpen]);

  const status = now
    ? getClubStatus(now, { ...(schedule ? { schedule } : {}), blockedDates: blockedDates || [] })
    : null;
  const statusText = status ? splitStatus(clubStatusLine(status)) : null;
  const current = (key) => (active === key ? (isHome ? "location" : "page") : undefined);

  return (
    <>
      <header ref={headerRef} className="app-top-nav">
        <div className="container nav-inner">
          <Link href="/#top" className="brand-group">
            {/* next/image: el PNG original pesa 374 KB y acá se muestra a 34 px. */}
            <Image src="/img/logo_badge.png" alt="" width={34} height={34} priority className="brand-badge" />
            <span className="brand-text">Muzzaga</span>
          </Link>

          <nav className="nav-links-row" aria-label="Navegación principal">
            {NAV_LINKS.map((link) => (
              <a key={link.href} className="nav-link" href={link.href} aria-current={current(link.key)}>
                {link.label}
              </a>
            ))}

            <div
              ref={toolsRef}
              className="tools-dropdown-wrapper"
              onMouseEnter={() => setToolsOpen(true)}
              onMouseLeave={() => setToolsOpen(false)}
            >
              <button
                type="button"
                className="nav-link tools-trigger"
                onClick={() => setToolsOpen((v) => !v)}
                aria-expanded={toolsOpen}
                aria-controls="tools-dropdown-menu"
                aria-current={active === "herramientas" ? "page" : undefined}
              >
                <span>Herramientas</span>
                <svg className="tools-caret" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                  <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {toolsOpen && (
                <div id="tools-dropdown-menu" className="tools-dropdown-menu">
                  {TOOLS_LINKS.map((tool) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="tools-dropdown-item"
                      aria-current={pathname === tool.href ? "page" : undefined}
                      onClick={() => setToolsOpen(false)}
                    >
                      <strong>{tool.label}</strong>
                      <span>{tool.desc}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="nav-actions">
            <a href="/#reservar" className="btn btn-orange-primary header-reserve-btn">
              Reservar
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener"
              className="btn btn-secondary-whatsapp header-whatsapp-btn"
            >
              <WhatsAppLogo color="currentColor" /> WhatsApp
            </a>
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={open}
              aria-controls="mobile-nav-panel"
            >
              <span className="mobile-menu-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Menú del celu: una hoja a pantalla completa. Cerrada es inert (fuera
          del orden de Tab y de los lectores de pantalla). */}
      <div
        id="mobile-nav-panel"
        ref={sheetRef}
        className={`menu-sheet${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú del sitio"
        tabIndex={-1}
        inert={!open}
      >
        <div className="menu-sheet-top">
          <Link href="/#top" className="menu-sheet-brand" onClick={close}>
            <Image src="/img/logo_badge.png" alt="" width={34} height={34} className="brand-badge" />
            <span>Muzzaga</span>
          </Link>
          <button ref={closeBtnRef} type="button" className="menu-sheet-close" onClick={close} aria-label="Cerrar menú">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <ScrollRow axis="y" className="menu-sheet-scroll">
          {/* El estado del club, como un tablero sobre la cancha. */}
          <div className={`menu-status${status?.isOpen ? " is-open" : ""}`} style={{ "--i": 0 }}>
            <span className="menu-status-ball" aria-hidden="true" />
            <div className="menu-status-text">
              <span className="menu-status-kicker">Muzzaga Pádel · Catriel</span>
              <strong className="menu-status-title">{statusText?.title ?? " "}</strong>
              {statusText?.sub ? <span className="menu-status-sub">{statusText.sub}</span> : null}
            </div>
          </div>

          <div className="menu-quick" style={{ "--i": 1 }}>
            <a href="/#reservar" className="menu-quick-reserve" onClick={close}>
              <span>Reservar turno</span>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener" className="menu-quick-btn is-wa" onClick={close}>
              <WhatsAppLogo size={20} color="currentColor" /> WhatsApp
            </a>
            <a href={mapsHref} target="_blank" rel="noopener" className="menu-quick-btn" onClick={close}>
              <GoogleMapsLogo size={20} /> Cómo llegar
            </a>
          </div>

          <nav className="menu-sections" aria-label="Secciones" style={{ "--i": 2 }}>
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="menu-section-link"
                aria-current={current(link.key)}
                onClick={close}
              >
                <img src={`/img/iconos/biblioteca/icono-${link.icon}.webp`} alt="" width={30} height={30} className="menu-section-icon" />
                <span className="menu-section-text">
                  <span className="menu-section-label">{link.label}</span>
                  <span className="menu-section-desc">{link.desc}</span>
                </span>
                <svg className="menu-section-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ))}
          </nav>

          <div className="menu-tools" style={{ "--i": 3 }}>
            <span className="menu-tools-title">Herramientas del club</span>
            <div className="menu-tools-grid">
              {TOOLS_LINKS.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="menu-tool"
                  aria-current={pathname === tool.href ? "page" : undefined}
                  onClick={close}
                >
                  <strong>{tool.short || tool.label}</strong>
                  <span>{tool.desc}</span>
                </Link>
              ))}
            </div>
          </div>
        </ScrollRow>
      </div>
    </>
  );
}
