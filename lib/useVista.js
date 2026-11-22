"use client";

import { useEffect } from "react";

/**
 * Animaciones que arrancan al entrar en pantalla (sin estado de React: solo
 * clases en el elemento, así no se re-renderiza nada).
 *
 * - `av-listo`: se pone apenas monta (solo con movimiento permitido). Recién
 *   ahí el CSS puede esconder lo que va a entrar: sin JS, todo queda visible.
 * - `av-go`: la primera vez que se ve al menos `umbral` del elemento. Queda.
 * - `av-fuera`: mientras está fuera de pantalla; el CSS pausa los loops.
 */
export function useVista(ref, umbral = 0.3) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches)
      return undefined;
    el.classList.add("av-listo");
    const io = new IntersectionObserver(
      ([e]) => {
        el.classList.toggle("av-fuera", !e.isIntersecting);
        if (e.isIntersecting && e.intersectionRatio >= umbral * 0.98)
          el.classList.add("av-go");
      },
      { threshold: [0, umbral] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, umbral]);
}
