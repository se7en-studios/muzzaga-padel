"use client";

import { useEffect, useRef } from "react";

// Puntos de una curva (cubic Bézier, en % del mapa) que sale de la esquina
// de abajo a la izquierda y llega al pie del pin, en el centro.
const P = [
  [7, 94],
  [9, 52],
  [32, 74],
  [48.5, 53],
];
const N = 11;
const PUNTOS = Array.from({ length: N }, (_, k) => {
  const t = k / (N - 1);
  const u = 1 - t;
  const c = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [0, 1].map((j) => +c.reduce((acc, w, i) => acc + w * P[i][j], 0).toFixed(2));
});

/**
 * La ruta punteada hasta el club: los puntos aparecen uno por uno (solo
 * opacidad y escala) y después cae el pin. Decorativa. Además arma el
 * movimiento del mapa: "mr-fx" en el cuadro si corre este JS y se acepta
 * movimiento, y "mr-in" cuando el mapa llega a pantalla (estilos en
 * app/secciones/anim-faq-ubicacion.css). Sin JS el pin queda quieto.
 */
export default function MapaRuta() {
  const ref = useRef(null);

  useEffect(() => {
    const pane = ref.current?.closest(".location-map-pane");
    if (!pane || !("IntersectionObserver" in window)) return undefined;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches)
      return undefined;
    pane.classList.add("mr-fx");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        pane.classList.add("mr-in");
        io.disconnect();
      },
      { threshold: 0.45 },
    );
    io.observe(pane);
    return () => {
      io.disconnect();
      pane.classList.remove("mr-fx", "mr-in");
    };
  }, []);

  return (
    <span ref={ref} className="mapa-ruta" aria-hidden="true">
      {PUNTOS.map(([x, y], i) => (
        <i key={i} style={{ left: `${x}%`, top: `${y}%`, "--i": i }} />
      ))}
    </span>
  );
}
