"use client";

import { useEffect } from "react";

// Lo que se puede tocar en la landing y merece el "pelotazo".
const TARGETS =
  ".btn, .hero-btn-primary, .booking-slot:not(:disabled), .booking-date-btn, .booking-court-tab, .flash-chip, .club-tool-card, .faq-question-btn, .bottom-bar-item";

/**
 * Efectos al tocar: un anillo con una pelotita donde apoya el dedo (como el
 * impacto de la pelota en el césped) y una vibración cortita al elegir un
 * turno en los celus que la permiten. No renderiza nada.
 */
export default function MotionFx() {
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches)
      return undefined;

    function onDown(e) {
      const target = e.target.closest?.(TARGETS);
      if (!target) return;
      const fx = document.createElement("span");
      fx.className = "fx-impacto";
      fx.setAttribute("aria-hidden", "true");
      fx.style.left = `${e.clientX}px`;
      fx.style.top = `${e.clientY}px`;
      document.body.appendChild(fx);
      fx.addEventListener("animationend", () => fx.remove(), { once: true });
      // Por si la animación no corre (pestaña en segundo plano).
      setTimeout(() => fx.remove(), 900);

      if (target.matches(".booking-slot") && navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {
          // Algunos navegadores lo bloquean sin gesto válido: no pasa nada.
        }
      }
    }

    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  return null;
}
