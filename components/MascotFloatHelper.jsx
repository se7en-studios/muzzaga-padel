"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import Mascota from "./Mascota";
import { CLUB_INFO } from "../data/club";
import "./Flotantes.css";

const WHATSAPP_URL = `https://wa.me/${CLUB_INFO.phoneRaw}?text=${encodeURIComponent(
  "¡Hola Muzzaga! Quería hacer una consulta.",
)}`;

/**
 * Ayudante flotante de notebook: tocarlo abre WhatsApp, nada más. Antes era
 * una píldora "¿Jugamos? 🎾" con pulso que abría un popup con tres botones
 * que repetían la barra inferior y el header.
 *
 * Solo aparece donde entra en el margen lateral sin pisar contenido (ver
 * .mascot-float en Flotantes.css) y recién después del hero, para no competir
 * con la mascota grande. En celu y tablet no está: ahí está la barra
 * inferior, que ya tiene WhatsApp.
 */
export default function MascotFloatHelper() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting));
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener"
      className={`mascot-float${visible ? " is-visible" : ""}`}
      aria-label="Escribinos por WhatsApp"
      aria-hidden={visible ? undefined : true}
      tabIndex={visible ? undefined : -1}
    >
      <span className="mascot-float-label">
        <MessageCircle size={14} strokeWidth={2.4} aria-hidden="true" />
        Escribinos
      </span>
      <Mascota pose="guino-paleta-pulgar" size="s" />
    </a>
  );
}
