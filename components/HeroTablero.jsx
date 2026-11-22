"use client";

import { requestSlotPick } from "../lib/pickSlot";
import { scrollBehavior } from "../lib/motion";
import { useFreeSlots } from "../lib/useFreeSlots";

// Tablero de turnos del hero: como el marcador de una transmisión, una fila
// por cancha con sus próximos horarios libres. Tocar un horario baja a la
// grilla con ese turno ya elegido (mismo evento que usan las otras
// tarjetas de turnos libres). Los datos son los de useFreeSlots: se piden una
// sola vez para toda la home y se actualizan solos cada minuto.

const POR_CANCHA = 4;

function irATurnos() {
  document.getElementById("turnos")?.scrollIntoView({ behavior: scrollBehavior() });
}

function elegir(slot) {
  irATurnos();
  requestSlotPick({ date: slot.date, courtId: slot.courtId, start: slot.start });
}

export default function HeroTablero({ precio, precioSub }) {
  const { status, date, label, today, upcoming, courts } = useFreeSlots();

  // Hoy si quedan turnos; si no, el primer día de la semana que tenga.
  let dia = label === "Hoy" ? "Hoy" : "Mañana";
  let pool = today.map((s) => ({ ...s, date }));
  if (status === "ready" && pool.length === 0 && upcoming.length > 0) {
    const primero = upcoming[0];
    pool = upcoming.filter((s) => s.date === primero.date);
    dia = primero.dayLabel;
  }
  const total = pool.length;
  const masCercano = pool[0];
  const filas = courts.map((court) => ({
    court,
    slots: pool.filter((s) => s.courtId === court.id),
  }));

  const cargando = status === "loading";
  const sinTurnos = status === "ready" && total === 0;
  const error = status === "error";
  const diaTexto = dia.toLowerCase();

  return (
    <section className="htab" aria-labelledby="htab-titulo">
      <header className="htab-head">
        <div className="htab-head-txt">
          <span className="htab-kicker">
            <span className={`htab-vivo${status === "ready" ? " is-on" : ""}`} aria-hidden="true" />
            Turnos libres<span className="htab-kicker-extra">&nbsp;· en vivo</span>
          </span>
          <h2 id="htab-titulo" className="htab-dia">
            {cargando ? "Buscando…" : error ? "Turnos" : dia}
          </h2>
        </div>
        <div className="htab-precio" aria-label={`Turno ${precio}, ${precioSub}`}>
          <strong>{precio}</strong>
          <span>{precioSub}</span>
        </div>
      </header>

      <div className="htab-cancha">
        {filas.map(({ court, slots }, i) => (
          <div className="htab-fila" key={court.id}>
            <div className="htab-nombre">
              <span className="htab-num" aria-hidden="true">{i + 1}</span>
              <span className="htab-nombre-txt">
                <b>{court.name}</b>
                <small>{court.type || "Cristal"}</small>
              </span>
            </div>
            <ul className="htab-horas" aria-label={`Horarios libres en ${court.name}`}>
              {cargando
                ? Array.from({ length: POR_CANCHA }, (_, k) => (
                    <li key={k}>
                      <span className="htab-hora is-skel" aria-hidden="true" />
                    </li>
                  ))
                : slots.slice(0, POR_CANCHA).map((s) => {
                    const primero = masCercano && s === masCercano;
                    return (
                      <li key={s.start}>
                        <button
                          type="button"
                          className={`htab-hora${primero ? " is-primero" : ""}`}
                          onClick={() => elegir(s)}
                          aria-label={`Reservar ${court.name} ${diaTexto} a las ${s.start}`}
                        >
                          {s.start}
                        </button>
                      </li>
                    );
                  })}
              {!cargando && !error && slots.length === 0 ? (
                <li className="htab-lleno">Sin turnos libres {diaTexto}</li>
              ) : null}
              {!cargando && slots.length > POR_CANCHA ? (
                <li className="htab-mas" aria-hidden="true">+{slots.length - POR_CANCHA}</li>
              ) : null}
            </ul>
          </div>
        ))}
      </div>

      <footer className="htab-pie">
        <span className="htab-pie-txt" aria-live="polite">
          {cargando
            ? "Mirando la grilla…"
            : error
              ? "No pudimos leer los turnos"
              : sinTurnos
                ? "Semana completa"
                : `${total} ${total === 1 ? "turno libre" : "turnos libres"} ${diaTexto}`}
        </span>
        <button type="button" className="htab-pie-link" onClick={irATurnos}>
          Ver toda la grilla <span aria-hidden="true">→</span>
        </button>
      </footer>
    </section>
  );
}
