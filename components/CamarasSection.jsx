"use client";

import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import Mascota from "./Mascota";
import { CLUB_INFO } from "../data/club";

// Mismo criterio que HeroVideo: nada de video para quien pidió "reducir
// movimiento" o tiene ahorro de datos activado, y se pide recién cuando el
// navegador está libre (esta sección ya está debajo de los turnos, no hace
// falta que compita por ancho de banda con lo de arriba).
const SRC = "/video/hero-cancha-liviana.mp4";

export default function CamarasSection() {
  const [src, setSrc] = useState(null);
  const beluupUrl = CLUB_INFO.beluupUrl;

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const saveData = navigator.connection?.saveData === true;
    if (reduceMotion || saveData) return;
    let idleId = null;
    let timerId = null;
    const start = () => setSrc(SRC);
    const whenIdle = () => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(start, { timeout: 3000 });
      } else {
        timerId = window.setTimeout(start, 1200);
      }
    };
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });
    return () => {
      window.removeEventListener("load", whenIdle);
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, []);

  const mascot = (
    <Mascota
      pose="guino-paleta-pulgar"
      alt={
        beluupUrl
          ? "Muzzaguito invitándote a ver tus jugadas en Beluup"
          : "Muzzaguito mirando las canchas"
      }
      className="mascot-section-img"
    />
  );

  return (
    <section id="camaras" className="section-turnos">
      <div className="container">
        <div className="section-header-row">
          <div>
            <span className="badge-linear badge-indigo" style={{ marginBottom: 8 }}>
              Muzzaga Play
            </span>
            <h2 className="section-title">Así se juega en Muzzaga</h2>
            <p className="section-desc">
              Un loop de nuestras canchas de cristal templado.{" "}
              {beluupUrl
                ? "Tocá a Muzzaguito y enterate cómo conseguir el video de tu propio partido en Beluup."
                : "Muy pronto vas a poder conseguir el video de tu propio partido en Beluup."}
            </p>
          </div>
          <div className="mascot-section-badge">
            {beluupUrl ? (
              <a
                href={beluupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="camaras-mascot-link"
                aria-label="Ver Muzzaga Pádel en Beluup"
              >
                {mascot}
              </a>
            ) : (
              mascot
            )}
          </div>
        </div>

        <div className="camaras-frame">
          {src && (
            <video
              className="camaras-frame-video"
              src={src}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden="true"
              tabIndex={-1}
            />
          )}
          <span className="camaras-corner camaras-corner--tl" aria-hidden="true" />
          <span className="camaras-corner camaras-corner--tr" aria-hidden="true" />
          <span className="camaras-corner camaras-corner--bl" aria-hidden="true" />
          <span className="camaras-corner camaras-corner--br" aria-hidden="true" />
          <div className="camaras-frame-chrome" aria-hidden="true">
            <span className="pulse-dot camaras-rec-dot" />
            LOOP · CANCHAS MUZZAGA
          </div>
        </div>

        {beluupUrl && (
          <div className="camaras-cta">
            <a
              href={beluupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <Camera size={18} className="icono-marca" aria-hidden="true" />
              Ver tus jugadas en Beluup
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
