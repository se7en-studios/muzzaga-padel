"use client";

import { useEffect } from "react";
import Link from "next/link";
import EstadoMarca from "../components/EstadoMarca";
import { CLUB_INFO } from "../data/club";

// Error de una página, con la marca. En Next 16 el error boundary recibe
// `retry` (vuelve a pedir y dibujar la página) en vez de `reset`.
export default function Error({ error, retry }) {
  useEffect(() => {
    console.error(error);
    // Un error boundary es de cliente y no admite `metadata`. Al salir
    // (Reintentar o Ir al inicio) vuelve el título de la página.
    const previous = document.title;
    document.title = "Algo falló · Muzzaga Pádel";
    return () => {
      document.title = previous;
    };
  }, [error]);

  return (
    <>
      <EstadoMarca
        pose="enredado-paleta"
        kicker="Algo falló"
        title="Se nos enredó la paleta"
        text="Algo falló de nuestro lado. Probá de nuevo en un rato o escribinos por WhatsApp."
      >
        <button type="button" className="estado-btn estado-btn-primary" onClick={() => retry()}>
          Reintentar
        </button>
        <Link href="/" className="estado-btn estado-btn-secondary">
          <span aria-hidden="true">←</span> Ir al inicio
        </Link>
        <a
          href={`https://wa.me/${CLUB_INFO.phoneRaw}`}
          target="_blank"
          rel="noopener"
          className="estado-btn estado-btn-whatsapp"
        >
          Escribir por WhatsApp
        </a>
      </EstadoMarca>
    </>
  );
}
