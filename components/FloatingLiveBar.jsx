"use client";

import { useEffect, useState } from "react";
import { clubStatusLine, getClubStatus } from "../data/horarios";
import "./Flotantes.css";

/**
 * Píldora de escritorio que aparece al dejar atrás el hero. Antes decía
 * "Canchas 1 & 2: Turnos Abiertos" fijo, sin mirar nada. Ahora muestra el
 * mismo estado que la barra del hero (sale del horario de Configuración) y
 * el acceso a reservar.
 */
export default function FloatingLiveBar({ schedule, blockedDates }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero || !("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: "-420px 0px 0px 0px" },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  // La hora de quien mira, actualizada cada 30 s mientras se ve (como la
  // barra del hero), para que "cierra en X min" no quede congelado.
  const [now, setNow] = useState(null);
  useEffect(() => {
    if (!visible) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible || !now) return null;

  const status = getClubStatus(now, {
    ...(schedule ? { schedule } : {}),
    blockedDates: blockedDates || [],
  });

  return (
    <aside className="floating-live-pill" aria-label="Acceso rápido a reservas">
      <div className="floating-live-inner">
        <div className="floating-live-status">
          <span className={`floating-live-dot${status.isOpen ? " is-open" : ""}`} aria-hidden="true" />
          <span className="floating-status-txt">{clubStatusLine(status)}</span>
        </div>

        <a href="#reservar" className="floating-live-action">
          Reservar turno →
        </a>
      </div>
    </aside>
  );
}
