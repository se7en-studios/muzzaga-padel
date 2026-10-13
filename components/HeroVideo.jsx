"use client";

import { useEffect, useState } from "react";

/**
 * Video de fondo del hero. La foto de abajo sigue siendo el primer cuadro (y
 * lo único que se ve con "reducir movimiento" o ahorro de datos; con 2G/3G va
 * una versión más liviana): el video se
 * monta recién en el navegador, solo si corresponde, y aparece con un fade
 * cuando ya puede reproducirse.
 */
const SRC_HD = "/video/hero-cancha.mp4"; // 1080p, ~3,7 MB
const SRC_LIGHT = "/video/hero-cancha-liviana.mp4"; // 720p, ~0,8 MB
const SLOW_CONNECTIONS = ["slow-2g", "2g", "3g"];

export default function HeroVideo() {
  const [src, setSrc] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const connection = navigator.connection;
    const saveData = connection?.saveData === true;
    if (reduceMotion || saveData) return;
    // Con 2G/3G se manda la versión liviana; con buena señal, la nítida.
    setSrc(SLOW_CONNECTIONS.includes(connection?.effectiveType) ? SRC_LIGHT : SRC_HD);
  }, []);

  if (!src) return null;

  return (
    <video
      className={`hero-night-video${ready ? " is-ready" : ""}`}
      src={src}
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
