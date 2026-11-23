"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ExternalLink, LogOut, MoreHorizontal, Plus, Tv } from "lucide-react";
import { ICON_PROPS, MOBILE_PRIMARY_IDS, NAV_ITEMS } from "../nav";
import { useAnimatedOpen } from "./useAnimatedOpen";
import { useNavIndicator } from "./motion";

/**
 * Celu, tablet chica y celu apaisado (≤900px de ancho o ≤500px de alto):
 * bottom nav con 4 secciones + "Más", y "Nueva Reserva"
 * como FAB. En desktop no se renderiza nada visible (CSS).
 */
const FAB_VIEWS = ["agenda", "calendario", "clientes"];

export default function MobileNav({
  view,
  onNavigate,
  onNewBooking,
  onLogout,
}) {
  const more = useAnimatedOpen(220);
  const isMoreOpen = more.open;
  const primary = MOBILE_PRIMARY_IDS.map((id) =>
    NAV_ITEMS.find((n) => n.id === id),
  );
  const secondary = NAV_ITEMS.filter((n) => !MOBILE_PRIMARY_IDS.includes(n.id));
  const isSecondaryActive = secondary.some((n) => n.id === view);
  // La pastilla de cancha detrás del ícono activo: una sola que viaja.
  const slider = useNavIndicator(isSecondaryActive ? "mas" : view, {
    selector: '[aria-current="page"] svg',
  });

  useEffect(() => {
    if (!isMoreOpen) return;
    function onKey(e) {
      if (e.key === "Escape") more.hide();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMoreOpen, more.hide]);

  function go(id) {
    if (isMoreOpen) more.hide();
    onNavigate(id);
  }

  return (
    <>
      {/* Solo donde se reserva: en Caja o Cantina tapaba contenido y no aplica. */}
      {FAB_VIEWS.includes(view) && (
        <button type="button" className="admin-fab" onClick={onNewBooking}>
          <Plus size={22} strokeWidth={2.25} aria-hidden />
          Nueva reserva
        </button>
      )}

      <nav
        ref={slider.ref}
        className={`admin-bottom-nav${slider.style ? " has-slider" : ""}`}
        aria-label="Secciones"
      >
        {slider.style && (
          <span
            className="admin-nav-slider"
            aria-hidden="true"
            style={slider.style}
          />
        )}
        {primary.map(({ id, label, shortLabel, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={view === id ? "page" : undefined}
            onClick={() => go(id)}
          >
            <Icon {...ICON_PROPS} />
            <span>{shortLabel || label}</span>
          </button>
        ))}
        <button
          type="button"
          aria-current={isSecondaryActive ? "page" : undefined}
          aria-expanded={isMoreOpen && !more.closing}
          onClick={isMoreOpen ? more.hide : more.show}
        >
          <MoreHorizontal {...ICON_PROPS} />
          <span>Más</span>
        </button>
      </nav>

      {isMoreOpen && (
        <div
          className={`admin-sheet-backdrop${more.closing ? " is-closing" : ""}`}
          onClick={more.hide}
        >
          <div
            className="admin-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Más secciones"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-sheet-handle" />
            <p className="admin-sheet-title">Más secciones</p>
            {/* Grilla de fichas: con el pulgar se acierta más fácil que a una
                lista larga, y entran todas sin hacer scroll. */}
            <div className="admin-sheet-grid">
              {secondary.map(({ id, label, icon: Icon }, i) => (
                <button
                  key={id}
                  type="button"
                  style={{ "--i": i }}
                  aria-current={view === id ? "page" : undefined}
                  onClick={() => go(id)}
                >
                  <span className="admin-sheet-tile-icon" aria-hidden="true">
                    <Icon {...ICON_PROPS} />
                  </span>
                  {label}
                </button>
              ))}
            </div>
            <div className="admin-sheet-foot">
              <Link href="/admin/monitor" target="_blank">
                <Tv {...ICON_PROPS} />
                Pantalla de la TV
              </Link>
              <Link href="/" target="_blank">
                <ExternalLink {...ICON_PROPS} />
                Ver la web del club
              </Link>
              <button
                type="button"
                className="admin-sheet-logout"
                onClick={() => {
                  more.hide();
                  onLogout();
                }}
              >
                <LogOut {...ICON_PROPS} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
