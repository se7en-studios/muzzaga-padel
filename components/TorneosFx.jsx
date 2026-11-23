"use client";

import { useEffect } from "react";

// Lo que tiene animaciones en loop en /torneos (luz de "en vivo", la copa,
// "¿Tu pareja?" que late, la pelotita de la portada, la tira de fotos).
const LOOPS = ".tt-intro, .tsu-poster, .tg .marquee-container";

/**
 * No renderiza nada: frena los loops de /torneos cuando salen de pantalla
 * (clase tt-quieto → animation-play-state: paused) para no gastar batería
 * en celus modestos. Sin JS siguen andando como siempre.
 */
export default function TorneosFx() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle("tt-quieto", !e.isIntersecting));
    });
    document.querySelectorAll(LOOPS).forEach((el) => io.observe(el));
    // La llave del afiche se arma recién cuando se ve casi entera (en PC
    // suele quedar al pie de la pantalla): hasta entonces queda en pausa.
    const llave = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => e.target.classList.toggle("tt-quieto", !e.isIntersecting));
      },
      { threshold: 0.6 },
    );
    document.querySelectorAll(".tt-llave").forEach((el) => llave.observe(el));
    return () => {
      io.disconnect();
      llave.disconnect();
    };
  }, []);
  return null;
}
