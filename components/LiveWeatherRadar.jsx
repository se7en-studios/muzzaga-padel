"use client";

import { useEffect, useState } from "react";
import { clubStatusLine, getClubStatus } from "../data/horarios";
import "./Extras.css";

/**
 * Estado del club en el hero, calculado del horario de Configuración (y los
 * días bloqueados): "Abierto ahora · cierra a las 00:30" o "Cerrado · abre
 * mañana a las 14:00". Antes sumaba "Iluminación LED activa" o "Cristales
 * panorámicos" según la hora y "Pistas cubiertas · cero viento": nada de eso
 * se mide, así que salió.
 */
export default function LiveWeatherRadar({ schedule, blockedDates }) {
  // null hasta el montaje: la home es estática (ISR), así que el servidor no
  // sabe la hora de quien la mira. Reserva el lugar sin texto y aparece con
  // el estado real.
  const [now, setNow] = useState(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  const ready = now !== null;
  const status = ready
    ? getClubStatus(now, { ...(schedule ? { schedule } : {}), blockedDates: blockedDates || [] })
    : null;

  // "Abierto ahora · cierra a las 00:30": la primera parte va resaltada.
  const line = status ? clubStatusLine(status) : "Abierto ahora · cierra a las 00:30";
  const [estado, ...detalle] = line.split(" · ");
  const dotState = status?.isOpen
    ? status.state === "cierra-pronto"
      ? " is-open is-soon"
      : " is-open"
    : "";

  return (
    <div
      className={`live-weather-radar-bar${ready ? " is-ready" : ""}`}
      aria-hidden={ready ? undefined : true}
    >
      <div className="radar-status-item">
        <span className={`pulse-dot radar-dot${dotState}`} />
        <span className="radar-texto">
          <strong className="radar-estado">{estado}</strong>
          {detalle.length > 0 && (
            <span className="radar-detalle"> · {detalle.join(" · ")}</span>
          )}
        </span>
      </div>
    </div>
  );
}
