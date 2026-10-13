"use client";

import Image from "next/image";
import { MarqueeCard } from "./PhotoCard";
import { useLightbox } from "./LightboxProvider";

const WHATSAPP = "5492995974176";

// Los torneos y sus fotos salen de Configuración → Sitio web → Galería de
// torneos (ver lib/siteContent.js). Con pocas fotos de jugadores la tira que
// se mueve sola deja huecos en pantallas anchas: va en grilla.
const MARQUEE_MIN = 10;

function WhatsappIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.067-1.127-.072-.27-.087-.621-.21-1.077-.407-1.927-.834-3.176-2.778-3.272-2.906-.096-.129-.778-1.037-.778-1.977 0-.94.492-1.401.667-1.593.175-.192.38-.24.507-.24.127 0 .254.002.365.007.119.006.279-.045.437.334.162.388.555 1.353.603 1.451.048.098.08.213.016.341-.064.128-.096.208-.192.32-.096.112-.202.25-.288.336-.096.096-.197.201-.085.393.112.192.497.82 1.066 1.328.733.654 1.352.857 1.544.953.192.096.304.08.416-.048.112-.128.48-1.558.608-.752.128-.192.256-.16.432-.096.176.064 1.114.525 1.306.621.192.096.32.144.368.224.048.08.048.464-.096.869z" />
    </svg>
  );
}

/** Continuous auto-scrolling strip of jugador photos, same visual language as the hero marquee. */
function JugadoresMarquee({ photos }) {
  const durationSec = Math.round(photos.length * 4.6);
  return (
    <div
      className="marquee-container"
      aria-label="Fotos de jugadores"
      style={{ padding: "4px 0 20px" }}
    >
      <div
        className="marquee-track"
        style={{ animationDuration: `${durationSec}s` }}
      >
        {photos.map((photo) => (
          <MarqueeCard key={photo.id} {...photo} />
        ))}
        {photos.map((photo) => (
          <MarqueeCard key={`${photo.id}-dup`} {...photo} duplicate />
        ))}
      </div>
    </div>
  );
}

function TorneoThumb({ src, alt, label }) {
  const openLightbox = useLightbox();
  return (
    <div className="torneo-thumb" onClick={() => openLightbox(src, alt)}>
      <Image
        src={src}
        alt={alt}
        fill
        loading="lazy"
        sizes="(max-width: 640px) 45vw, 160px"
      />
      {label && (
        <div className="torneo-thumb-badge">
          <span>{label}</span>
        </div>
      )}
    </div>
  );
}

const SUBTITLE_STYLE = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--text-secondary)",
};

function TorneoBlock({ title, jugadores, ganadores }) {
  const marquee = jugadores.length >= MARQUEE_MIN;
  return (
    <div style={{ marginBottom: 40 }}>
      <div className="container">
        <span className="badge-linear badge-amber" style={{ marginBottom: 8 }}>
          {title}
        </span>
        {jugadores.length > 0 && (
          <h4 style={{ ...SUBTITLE_STYLE, margin: marquee ? "14px 0 4px" : "14px 0 10px" }}>
            Jugadores
          </h4>
        )}
        {jugadores.length > 0 && !marquee && (
          <div className="torneo-thumb-grid" style={{ marginBottom: 12 }}>
            {jugadores.map((photo) => (
              <TorneoThumb key={photo.id} src={photo.src} alt={photo.alt} />
            ))}
          </div>
        )}
      </div>

      {marquee && <JugadoresMarquee photos={jugadores} />}

      {ganadores.length > 0 && (
        <div className="container">
          <h4 style={{ ...SUBTITLE_STYLE, margin: "8px 0 10px" }}>Ganadores</h4>
          <div className="torneo-thumb-grid">
            {ganadores.map((photo) => (
              <TorneoThumb
                key={photo.id}
                src={photo.src}
                alt={photo.alt}
                label={photo.label}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TorneosGallery({ tournaments }) {
  return (
    <section id="torneos" className="section-bento">
      <div className="container">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Torneos en Muzzaga</h2>
            <p className="section-desc">
              Torneos organizados durante todo el año, en todas las categorías.
              Consultá fechas y premios por WhatsApp.
            </p>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
              "Hola Muzzaga! Quiero inscribir mi pareja al próximo torneo.",
            )}`}
            target="_blank"
            rel="noopener"
            className="btn btn-secondary-whatsapp"
            style={{ gap: 8 }}
          >
            <WhatsappIcon />
            Inscribir mi pareja por WhatsApp →
          </a>
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Así se vivieron nuestros torneos
        </h3>
      </div>

      {tournaments.length === 0 && (
        <div className="container">
          <p className="section-desc">Pronto vas a ver acá las fotos de los torneos.</p>
        </div>
      )}

      {tournaments.map((t) => (
        <TorneoBlock
          key={t.id}
          title={t.title}
          jugadores={t.jugadores}
          ganadores={t.ganadores}
        />
      ))}
    </section>
  );
}
