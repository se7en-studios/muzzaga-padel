"use client";

import { requestSlotPick } from "../lib/pickSlot";
import { scrollBehavior } from "../lib/motion";
import { useFreeSlots } from "../lib/useFreeSlots";
import Mascota from "./Mascota";
import ScrollRow from "./ScrollRow";

// Chips de relleno mientras llega la disponibilidad: misma estructura y mismo
// alto que los reales, así la tarjeta ocupa su lugar desde el primer render y
// no empuja la página cuando termina el fetch.
const SKELETON_CHIPS = [0, 1, 2, 3];

export default function TodayFlashSlots() {
  const { status, date, label, today, upcoming, courts } = useFreeSlots();

  function handleSelectSlot(slot) {
    document.getElementById("turnos")?.scrollIntoView({ behavior: scrollBehavior() });
    requestSlotPick({ date: slot.date || date, courtId: slot.courtId, start: slot.start });
  }

  // Hoy completo: se recomiendan los próximos libres de la semana.
  const showWeek = status === "ready" && today.length === 0 && upcoming.length > 0;
  const slots = showWeek ? upcoming : today;

  // Precio por jugador real de cada franja (pico/valle); se anuncia el menor.
  const minPerPlayer = slots.reduce(
    (min, s) => Math.min(min, s.price?.perPlayer || Infinity),
    Infinity,
  );

  // Sin fetch no sabemos si está completo: se dice eso y se manda a la grilla,
  // en vez de afirmar "Canchas al 100 %".
  if (status === "error") {
    return (
      <div className="container flash-wrap">
        <div className="flash-card is-full">
          <img src="/img/iconos/biblioteca/icono-paleta.webp" alt="" width={56} height={56} className="icono-3d flash-full-3d" aria-hidden="true" />
          <div className="flash-full-text">
            <strong className="flash-title">Turnos de {label.toLowerCase()}</strong>
            <div className="flash-meta">
              No pudimos cargar los turnos libres. Los ves en la grilla de abajo.
            </div>
          </div>
          <a href="#turnos" className="btn btn-secondary">
            Ver horarios →
          </a>
        </div>
      </div>
    );
  }

  if (status === "ready" && slots.length === 0) {
    return (
      <div className="container flash-wrap">
        <div className="flash-card is-full">
          <img src="/img/iconos/biblioteca/icono-paleta.webp" alt="" width={56} height={56} className="icono-3d flash-full-3d" aria-hidden="true" />
          <div className="flash-full-text">
            <strong className="flash-title">Canchas al 100% esta semana</strong>
            <div className="flash-meta">
              No quedan turnos libres en los próximos días. Si se libera uno, aparece acá.
            </div>
          </div>
          <a href="#turnos" className="btn btn-secondary">
            Ver calendario completo →
          </a>
        </div>
      </div>
    );
  }

  const loading = status === "loading";

  return (
    <div className="container flash-wrap">
      <div className={`flash-card${loading ? " is-loading" : ""}${showWeek ? " is-week" : ""}`} aria-busy={loading || undefined}>
        <Mascota
          pose="golpe-pelota"
          alt=""
          className="flash-mascot"
        />

        <div className="flash-body">
          <div className="flash-head">
            <div className="flash-head-left">
              <span className="flash-live">
                {showWeek ? `${label} completo` : "Disponible ya"}
              </span>
              <strong className="flash-title">
                {loading
                  ? `Turnos · ${label}`
                  : showWeek
                    ? "Próximos turnos libres"
                    : `Turnos libres · ${label}`}
              </strong>
            </div>
            {loading ? (
              <span className="flash-meta flash-skeleton-text" aria-hidden="true">
                Desde $00.000 por jugador (4p)
              </span>
            ) : (
              Number.isFinite(minPerPlayer) && (
                <span className="flash-meta">
                  Desde <strong>${minPerPlayer.toLocaleString("es-AR")}</strong> por jugador (4p)
                </span>
              )
            )}
          </div>

          <ScrollRow className="flash-chips">
            {loading
              ? SKELETON_CHIPS.map((i) => (
                  <div key={i} className="flash-chip is-skeleton" aria-hidden="true">
                    <div>
                      <div className="flash-chip-time">00:00</div>
                      <div className="flash-chip-court">Cancha 1 · hasta 00:00</div>
                    </div>
                    <span className="flash-chip-cta">Reservar →</span>
                  </div>
                ))
              : slots.map((slot) => {
                  const court = courts.find((c) => c.id === slot.courtId);
                  return (
                    <button
                      key={`${slot.date || date}-${slot.courtId}-${slot.start}`}
                      type="button"
                      onClick={() => handleSelectSlot(slot)}
                      className="flash-chip"
                    >
                      <div>
                        {showWeek && (
                          <div className="flash-chip-day">
                            {slot.dayName} {slot.dayNumber}
                          </div>
                        )}
                        <div className="flash-chip-time">{slot.start}</div>
                        <div className="flash-chip-court">
                          {court?.name || "Cancha"} · hasta {slot.end}
                        </div>
                      </div>
                      <span className="flash-chip-cta">Reservar →</span>
                    </button>
                  );
                })}
          </ScrollRow>
        </div>
      </div>
    </div>
  );
}
