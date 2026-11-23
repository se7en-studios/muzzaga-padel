"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Número que "corre" hasta el valor nuevo, como un tablero que suma.
 * Solo cambia lo que se muestra: el valor real es siempre `target`.
 * Con "reducir movimiento" (o `enabled` en false) salta directo.
 *
 * @param {number} target valor final
 * @param {{ from?: number, duration?: number, enabled?: boolean }} [opts]
 *   `from`: desde dónde arranca la primera vez (por defecto, el mismo target:
 *   al cargar no cuenta, solo cuando cambia).
 * @returns {number}
 */
export function useCountTo(target, { from, duration = 600, enabled = true } = {}) {
  const [shown, setShown] = useState(from ?? target);
  const shownRef = useRef(from ?? target);

  useEffect(() => {
    const start = shownRef.current;
    const reduce =
      typeof window === "undefined" ||
      !window.matchMedia ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!enabled || reduce || start === target) {
      shownRef.current = target;
      setShown(target);
      return undefined;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      // Sale rápido y frena al final, como la pelota que llega a la red.
      const eased = 1 - Math.pow(1 - p, 3);
      const value = start + (target - start) * eased;
      shownRef.current = p < 1 ? value : target;
      setShown(shownRef.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);

  return shown;
}
