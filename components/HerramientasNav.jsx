"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";

// Mismo orden y número que el rótulo de cada encabezado ("Herramienta 01…").
const TOOLS = [
  { id: "dividir-gastos", num: "01", label: "Dividir" },
  { id: "nivel", num: "02", label: "Nivel" },
  { id: "pizarra", num: "03", label: "Pizarra" },
  { id: "americano", num: "04", label: "Americano" },
];

const KEY = "hx-nav-desde";

/**
 * Las cuatro herramientas como el tablero de cambio de cancha. La ficha azul
 * con la pelota marca dónde estás; al pasar de una herramienta a otra viaja
 * desde la anterior (se guarda en sessionStorage) en vez de aparecer de golpe.
 * Sin JS queda quieta en la actual.
 */
export default function HerramientasNav({ actual }) {
  const idx = Math.max(0, TOOLS.findIndex((t) => t.id === actual));
  const fichaRef = useRef(null);

  useLayoutEffect(() => {
    let desde = null;
    try {
      desde = sessionStorage.getItem(KEY);
      sessionStorage.setItem(KEY, String(idx));
    } catch {
      // Navegación privada o almacenamiento bloqueado: sin viaje, no pasa nada.
    }
    const ficha = fichaRef.current;
    const from = Number(desde);
    if (!ficha || desde === null || !Number.isInteger(from) || from === idx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // La ficha mide una columna: moverla (from - idx) * 100 % la pone en la vieja.
    ficha.animate(
      [
        { transform: `translateX(${from * 100}%)` },
        { transform: `translateX(${idx * 100}%)` },
      ],
      { duration: 520, easing: "cubic-bezier(0.34, 1.25, 0.64, 1)" },
    );
    const pelota = ficha.firstElementChild;
    pelota?.animate(
      [
        { transform: "translateY(0) rotate(0)" },
        { transform: `translateY(-9px) rotate(${(idx - from) * 140}deg)`, offset: 0.45 },
        { transform: "translateY(0) rotate(0)" },
      ],
      { duration: 520, easing: "ease-out" },
    );
  }, [idx]);

  return (
    <nav className="hx-nav container" aria-label="Herramientas">
      <div className="hx-nav-tablero">
        <span
          ref={fichaRef}
          className="hx-nav-ficha"
          style={{ transform: `translateX(${idx * 100}%)` }}
          aria-hidden="true"
        >
          <i className="hx-nav-pelota" />
        </span>
        {TOOLS.map((t, i) => (
          <Link
            key={t.id}
            href={`/herramientas/${t.id}`}
            className={`hx-nav-link${i === idx ? " is-on" : ""}`}
            aria-current={i === idx ? "page" : undefined}
          >
            <span className="hx-nav-num">{t.num}</span>
            <span className="hx-nav-txt">{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
