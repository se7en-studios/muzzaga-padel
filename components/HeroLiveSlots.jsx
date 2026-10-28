"use client";

import { useEffect, useRef, useState } from "react";
import { requestSlotPick } from "../lib/pickSlot";
import { scrollBehavior } from "../lib/motion";
import { useFreeSlots } from "../lib/useFreeSlots";

// Tarjetita del hero con los turnos en vivo: cuántos quedan hoy y el próximo,
// o, si hoy está completo, el próximo libre de la semana. Se actualiza sola
// (useFreeSlots pide cada minuto) y avisa cuando se libera un turno.
export default function HeroLiveSlots() {
  const { status, date, label, today, upcoming } = useFreeSlots();
  const [freed, setFreed] = useState(false);
  const prevToday = useRef(null);

  useEffect(() => {
    if (status !== "ready") return;
    if (prevToday.current === 0 && today.length > 0) {
      setFreed(true);
      const id = setTimeout(() => setFreed(false), 12_000);
      prevToday.current = today.length;
      return () => clearTimeout(id);
    }
    prevToday.current = today.length;
  }, [status, today.length]);

  const next = today[0] || upcoming[0] || null;
  const dayWord = label === "Hoy" ? "hoy" : label.toLowerCase();

  let kicker = "Turnos en vivo";
  let main = "Buscando turnos…";
  let tone = "is-loading";
  if (status === "error") {
    kicker = "Turnos";
    main = "Ver horarios";
    tone = "";
  } else if (status === "ready" && today.length > 0) {
    kicker = freed ? "¡Se liberó un turno!" : `Turnos libres ${dayWord}`;
    main = `${today.length} ${today.length === 1 ? "libre" : "libres"} · próximo ${today[0].start}`;
    tone = freed ? "is-free is-new" : "is-free";
  } else if (status === "ready" && upcoming.length > 0) {
    kicker = `${label}: turnos ocupados`;
    main = `Próximo libre: ${upcoming[0].dayName} ${upcoming[0].dayNumber} · ${upcoming[0].start}`;
    tone = "is-busy";
  } else if (status === "ready") {
    kicker = "Semana completa";
    main = "Mirá la grilla de turnos";
    tone = "is-busy";
  }

  function handleClick() {
    document.getElementById("turnos")?.scrollIntoView({ behavior: scrollBehavior() });
    if (next) requestSlotPick({ date: next.date || date, courtId: next.courtId, start: next.start });
  }

  return (
    <button
      type="button"
      className={`hero-float-card hero-float-glass hero-live ${tone}`}
      onClick={handleClick}
      aria-live="polite"
    >
      <img src="/img/iconos/pelota.webp" alt="" width={30} height={30} className="hero-live-ball" aria-hidden="true" />
      <span className="hero-live-text">
        <span className="hero-live-kicker">{kicker}</span>
        <span className="hero-live-main">{main}</span>
      </span>
      <span className="hero-live-arrow" aria-hidden="true">→</span>
    </button>
  );
}
