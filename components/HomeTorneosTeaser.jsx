"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { useLightbox } from "./LightboxProvider";
import { CLUB_INFO } from "../data/club";
import Mascota from "./Mascota";

// Fotos y textos: Configuración → Sitio web → Torneos en el inicio.
const FEATURED_SLOTS = ["torneo-1", "torneo-2", "torneo-3", "torneo-4", "torneo-5"];

export default function HomeTorneosTeaser({ photos }) {
  const openLightbox = useLightbox();
  const featured = FEATURED_SLOTS.map((id) => ({ id, ...photos[id] }));

  return (
    <section id="torneos" className="section-turnos" style={{ background: "var(--bg-surface)" }}>
      <div className="container">
        <div className="section-header-row" style={{ alignItems: "center" }}>
          <div>
            <span className="badge-linear badge-amber" style={{ marginBottom: 6 }}>
              Competencia y comunidad
            </span>
            <h2 className="section-title">Torneos en Muzzaga</h2>
            <p className="section-desc">
              Torneos por categoría todo el año. Mirá las fotos de los últimos torneos y anotate para el próximo.
            </p>
          </div>
          <div className="mascot-section-badge">
            <Mascota
              pose="trofeo-bolso"
              alt="Muzzaguito Campeón con Copa de Torneo"
              className="mascot-section-img"
            />
          </div>
        </div>
        {/* CARD PROXIMO TORNEO */}
        <div className="next-event">
          <div className="next-event-date" aria-hidden="true">
            <CalendarClock strokeWidth={2.2} />
            <span>Fecha</span>
          </div>
          <div className="next-event-body">
            <span className="next-event-tag">Próximo torneo</span>
            <h3 className="next-event-title">Fecha a confirmar</h3>
            <p className="next-event-desc">
              Escribinos por WhatsApp y te avisamos la fecha y las categorías apenas estén definidas.
            </p>
          </div>
          <a
            href={`https://wa.me/${CLUB_INFO.phoneRaw}?text=${encodeURIComponent("¡Hola Muzzaga! Quiero información sobre fecha e inscripción para el próximo torneo.")}`}
            target="_blank"
            rel="noopener"
            className="next-event-cta"
          >
            Anotarme por WhatsApp <span aria-hidden="true">→</span>
          </a>
        </div>

        {/* GRILLA RESUMIDA DE 5 FOTOS */}
        <div className="torneo-thumb-grid torneo-bento">
          {featured.map((photo, i) => (
            <button
              type="button"
              key={photo.id}
              className="torneo-thumb"
              onClick={() => openLightbox(photo.src, photo.alt)}
              aria-label={`Ampliar foto: ${photo.caption || photo.alt}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                loading="lazy"
                // La primera ocupa dos columnas y dos filas del bento.
                sizes={i === 0 ? "(max-width: 900px) 92vw, 570px" : "(max-width: 900px) 46vw, 280px"}
              />
              {photo.caption && (
                <div className="torneo-thumb-badge">
                  <span>{photo.caption}</span>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="section-more">
          <Link href="/torneos" className="section-more-link">
            Ver galería completa <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
