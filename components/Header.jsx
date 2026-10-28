"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { DEFAULT_LOCATION } from "../lib/siteLocation";
import ScrollRow from "./ScrollRow";

const NAV_LINKS = [
  { href: "/#turnos", label: "Turnos" },
  { href: "/torneos", label: "Torneos" },
  { href: "/menu", label: "Cantina" },
  { href: "/#instalaciones", label: "Instalaciones" },
  { href: "/#ubicacion", label: "Ubicación" },
];

const TOOLS_LINKS = [
  // `short`: el menú de celu los muestra en dos columnas.
  { href: "/herramientas/dividir-gastos", label: "Calculadora de gastos", short: "Dividir gastos", desc: "Dividir cancha y cantina" },
  { href: "/herramientas/nivel", label: "Test de nivel", desc: "Calculá tu categoría de pádel" },
  { href: "/herramientas/pizarra", label: "Pizarra táctica", desc: "Simulador interactivo de jugadas" },
  { href: "/herramientas/americano", label: "Torneo americano", short: "Americano", desc: "Generador de fixtures express" },
];

import { WhatsAppLogo, GoogleMapsLogo } from "./BrandLogos";

const WHATSAPP_URL = "https://wa.me/5492995974176";

/**
 * `mapsHref` llega de Configuración → Sitio web vía SiteHeader; las páginas
 * de error (client) lo usan sin prop y abren el link original.
 */
export default function Header({ mapsHref = DEFAULT_LOCATION.mapsUrl }) {
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const menuBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      // Cerrado, el panel es inert: si el foco estaba adentro, vuelve al
      // botón que lo abrió en vez de caer en <body>.
      if (document.activeElement?.closest("#mobile-nav-panel")) {
        menuBtnRef.current?.focus();
      }
      setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <header className="app-top-nav">
        <div className="container nav-inner">
          <Link
            href="/#top"
            className="brand-group"
          >
            {/* next/image: el PNG original pesa 374 KB y acá se muestra a 34 px. */}
            <Image
              src="/img/logo_badge.png"
              alt=""
              width={34}
              height={34}
              priority
              style={{
                width: 34,
                height: 34,
                objectFit: "contain",
                display: "block",
              }}
            />
            <span className="brand-text">Muzzaga</span>
          </Link>

          <nav className="nav-links-row" aria-label="Navegación principal">
            {NAV_LINKS.map((link) => (
              <a key={link.href} className="nav-link" href={link.href}>
                {link.label}
              </a>
            ))}

            {/* Dropdown de Herramientas */}
            <div
              className="tools-dropdown-wrapper"
              style={{ position: "relative" }}
              onMouseEnter={() => setToolsOpen(true)}
              onMouseLeave={() => setToolsOpen(false)}
            >
              <button
                type="button"
                className="nav-link tools-trigger"
                onClick={() => setToolsOpen((v) => !v)}
                aria-expanded={toolsOpen}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 10px",
                }}
              >
                <span>Herramientas</span>
                <span style={{ fontSize: 10, transition: "transform var(--t-estado) var(--ease)", transform: toolsOpen ? "rotate(180deg)" : "none" }}>
                  ▼
                </span>
              </button>

              {toolsOpen && (
                <div
                  className="tools-dropdown-menu"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    width: 250,
                    background: "var(--color-surface-card)",
                    border: "1px solid var(--color-hairline-strong)",
                    borderRadius: "var(--radius-md)",
                    padding: 8,
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
                    zIndex: 100,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {TOOLS_LINKS.map((tool) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="tools-dropdown-item"
                      onClick={() => setToolsOpen(false)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        textDecoration: "none",
                        color: "var(--text-primary)",
                      }}
                    >
                      <strong style={{ display: "block", fontSize: 13 }}>{tool.label}</strong>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{tool.desc}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a
              href="/#turnos"
              className="btn btn-orange-primary header-reserve-btn"
              style={{ height: 36, padding: "6px 16px", fontWeight: 700 }}
            >
              Reservar
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener"
              className="btn btn-secondary-whatsapp header-whatsapp-btn"
              style={{ height: 36, padding: "6px 14px", gap: 6 }}
            >
              <WhatsAppLogo color="currentColor" /> WhatsApp
            </a>
            <button
              type="button"
              className="mobile-menu-btn"
              ref={menuBtnRef}
              onClick={() => setOpen((v) => !v)}
              aria-label="Abrir menú"
              aria-expanded={open}
              aria-controls="mobile-nav-panel"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Cerrado es invisible (opacidad 0) pero seguía en el orden de Tab:
          con teclado se recorrían links que no se ven. inert lo saca. */}
      <div
        id="mobile-nav-panel"
        className={`mobile-nav-panel${open ? " open" : ""}`}
        inert={!open}
      >
        <ScrollRow axis="y" className="mobile-nav-scroll">
        <a
          href="/#turnos"
          className="btn btn-orange-primary"
          onClick={() => setOpen(false)}
          style={{ width: "100%", height: 42, justifyContent: "center", marginBottom: 12 }}
        >
          Reservar cancha →
        </a>

        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            className="mobile-nav-link"
            href={link.href}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </a>
        ))}

        <div className="mobile-nav-group">
          <span className="mobile-nav-group-title">Herramientas del club</span>
          <div className="mobile-nav-tools">
            {TOOLS_LINKS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="mobile-nav-link"
                onClick={() => setOpen(false)}
              >
                {tool.short || tool.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mobile-nav-contact">
        <a
          className="mobile-nav-link maps-text"
          href={mapsHref}
          target="_blank"
          rel="noopener"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <GoogleMapsLogo /> Google Maps
        </a>
        <a
          className="mobile-nav-link whatsapp-text"
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 600,
          }}
        >
          <WhatsAppLogo /> WhatsApp
        </a>
        </div>
        </ScrollRow>
      </div>
      <div
        id="mobile-nav-backdrop"
        className={`mobile-nav-backdrop${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
      />
    </>
  );
}
