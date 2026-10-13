"use client";

import { useEffect, useState } from "react";

/**
 * Video de fondo del hero. La foto de abajo sigue siendo el primer cuadro (y
 * lo único que se ve con "reducir movimiento" o ahorro de datos): el video se
 * monta recién en el navegador, solo si corresponde, y aparece con un fade
 * cuando ya puede reproducirse.
 */
export default function HeroVideo() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const saveData = navigator.connection?.saveData === true;
    setEnabled(!reduceMotion && !saveData);
  }, []);

  if (!enabled) return null;

  return (
    <video
      className={`hero-night-video${ready ? " is-ready" : ""}`}
      src="/video/hero-cancha.mp4"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      onCanPlay={() => setReady(true)}
    />
  );
}
