"use client";

import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Número que corre hasta su valor como el tanteador de una transmisión: la
 * primera vez desde 0 y después desde lo que mostraba. Solo cambia el texto
 * (nada de layout animado) y con "reducir movimiento" pone el valor de una.
 * El lector de pantalla siempre lee el valor final, no los intermedios.
 *
 * @param {{ value: number, format?: (n: number) => string, duration?: number }} props
 */
export default function Tanteador({ value, format = String, duration = 650 }) {
  const target = Number(value) || 0;
  // Arranca en 0 (si hay movimiento) para no mostrar un cuadro con el valor
  // final y después saltar a 0.
  const [shown, setShown] = useState(() =>
    prefersReducedMotion() ? target : 0,
  );
  const shownRef = useRef(null);

  useEffect(() => {
    const from = shownRef.current ?? 0;
    if (from === target || prefersReducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return undefined;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      // Arranca rápido y frena al final, como el marcador que "cae" al número.
      const eased = 1 - Math.pow(1 - p, 3);
      const n = p === 1 ? target : Math.round(from + (target - from) * eased);
      shownRef.current = n;
      setShown(n);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  const running = shown !== target;
  return (
    <span className={`admin-tanteador${running ? " is-running" : ""}`}>
      <span className="sr-only">{format(target)}</span>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  );
}
