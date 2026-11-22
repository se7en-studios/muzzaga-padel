"use client";

import { useEffect, useState } from "react";
import { nowInClubTimezone, isoWeekday } from "../lib/booking";
import LiveWeatherRadar from "./LiveWeatherRadar";

// La semana del club como un tablero: los siete días (lunes primero), los
// que abren encendidos y los que no apagados, el de hoy marcado, y debajo el
// horario. Todo sale del horario de Configuración (config.schedule, 0 =
// domingo): si el club cambia un día, el tablero cambia solo.

const DIAS = [
  { i: 1, corto: "Lun", largo: "lunes" },
  { i: 2, corto: "Mar", largo: "martes" },
  { i: 3, corto: "Mié", largo: "miércoles" },
  { i: 4, corto: "Jue", largo: "jueves" },
  { i: 5, corto: "Vie", largo: "viernes" },
  { i: 6, corto: "Sáb", largo: "sábado" },
  { i: 0, corto: "Dom", largo: "domingo" },
];

const horas = (d) => `${d.start} a ${d.end} hs`;
const clave = (d) => (d?.open ? `${d.start}-${d.end}` : "cerrado");
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Días seguidos con el mismo horario: [{ desde, hasta, dia }]. */
function grupos(schedule) {
  const out = [];
  for (const d of DIAS) {
    const dia = schedule[d.i];
    const last = out[out.length - 1];
    if (last && clave(last.dia) === clave(dia)) last.hasta = d;
    else out.push({ desde: d, hasta: d, dia });
  }
  return out;
}

function rango(g) {
  if (g.desde === g.hasta) return g.desde.largo;
  const seguidos = DIAS.indexOf(g.hasta) - DIAS.indexOf(g.desde);
  return seguidos === 1 ? `${g.desde.largo} y ${g.hasta.largo}` : `${g.desde.largo} a ${g.hasta.largo}`;
}

export default function HorarioSemana({ schedule, blockedDates = [] }) {
  // El día de hoy recién en el navegador: la home es estática (ISR).
  const [hoy, setHoy] = useState(null);

  useEffect(() => {
    const update = () => {
      const { isoDate } = nowInClubTimezone();
      setHoy({ weekday: isoWeekday(isoDate), blocked: blockedDates.includes(isoDate) });
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [blockedDates]);

  const lista = grupos(schedule);
  const abiertos = lista.filter((g) => g.dia?.open);
  const cerrados = lista.filter((g) => !g.dia?.open);
  // Mismo horario todos los días que abre: la hora va grande una sola vez.
  const unico = new Set(abiertos.map((g) => clave(g.dia))).size === 1;

  return (
    <div className="horario-tablero">
      <div className="horario-cabecera">
        <span className="horario-titulo">Horarios</span>
        {hoy && (
          <span className="horario-hoy-txt">
            Hoy es {DIAS.find((d) => d.i === hoy.weekday)?.largo}
          </span>
        )}
      </div>

      <ol className="horario-dias" aria-label="Días que abre el club">
        {DIAS.map((d) => {
          const dia = schedule[d.i];
          const esHoy = hoy?.weekday === d.i;
          const abre = dia?.open && !(esHoy && hoy.blocked);
          return (
            <li
              key={d.i}
              className={`horario-dia${abre ? " is-open" : " is-closed"}${esHoy ? " is-today" : ""}`}
              aria-current={esHoy ? "date" : undefined}
            >
              <span aria-hidden="true">{d.corto}</span>
              <span className="sr-only">
                {mayuscula(d.largo)}: {abre ? horas(dia) : "cerrado"}
                {esHoy ? " (hoy)" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="horario-detalle" aria-hidden="true">
        {unico ? (
          <>
            <strong className="horario-horas">{horas(abiertos[0].dia)}</strong>
            <span className="horario-resumen">
              {[
                mayuscula(abiertos.map(rango).join(", ")),
                ...cerrados.map((g) => `${rango(g)} cerrado`),
              ].join(" · ")}
            </span>
          </>
        ) : abiertos.length ? (
          <ul className="horario-lista">
            {lista.map((g) => (
              <li key={g.desde.i}>
                <span>{mayuscula(rango(g))}</span>
                <strong>{g.dia?.open ? horas(g.dia) : "Cerrado"}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <strong className="horario-horas">Cerrado por ahora</strong>
        )}
      </div>

      {/* Abierto ahora / cerrado: la misma lógica que el hero. */}
      <LiveWeatherRadar schedule={schedule} blockedDates={blockedDates} />
    </div>
  );
}
