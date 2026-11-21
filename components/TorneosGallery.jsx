"use client";

import Image from "next/image";
import { MarqueeCard } from "./PhotoCard";
import { useLightbox } from "./LightboxProvider";
import { plural } from "../lib/format";

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

/** Medalla según la leyenda que carga el admin ("1er puesto…", "2do…"), igual que en el inicio. */
function medalla(caption = "") {
  if (/\b(1|1er|1ro|primer)\s*(°|º)?\s*puesto|campe[oó]n/i.test(caption)) return "oro";
  if (/\b(2|2do|segundo)\s*(°|º)?\s*puesto|subcampe/i.test(caption)) return "plata";
  if (/\b(3|3er|3ro|tercer)\s*(°|º)?\s*puesto/i.test(caption)) return "bronce";
  return null;
}
const PUESTO = { oro: "1°", plata: "2°", bronce: "3°" };

function TorneoThumb({ src, alt, label, sizes = "(max-width: 640px) 45vw, 160px" }) {
  const openLightbox = useLightbox();
  const medal = medalla(label);
  return (
    <button
      type="button"
      className={`torneo-thumb tg-thumb${medal ? ` is-${medal}` : ""}`}
      onClick={() => openLightbox(src, alt)}
      aria-label={`Ampliar foto: ${label || alt}`}
    >
      <Image src={src} alt={alt} fill loading="lazy" sizes={sizes} />
      {medal && (
        <span className={`tg-medalla is-${medal}`} aria-hidden="true">
          {PUESTO[medal]}
        </span>
      )}
      {label && (
        <div className="torneo-thumb-badge">
          <span>{label}</span>
        </div>
      )}
    </button>
  );
}

/** Un torneo del historial: placa con el nombre, el podio y la fecha en fotos. */
function TorneoBlock({ torneo }) {
  const { name, categories, title, jugadores, ganadores } = torneo;
  const marquee = jugadores.length >= MARQUEE_MIN;
  return (
    <li className="tg-torneo">
      <div className="container">
        <div className="tg-placa">
          <span className="tg-placa-pelota" aria-hidden="true" />
          <div className="tg-placa-text">
            <h3 className="tg-placa-title">{name || title}</h3>
            {categories && <span className="tg-placa-cats">{categories}</span>}
          </div>
          <p className="tg-placa-meta">
            {ganadores.length > 0 && <span>{plural(ganadores.length, "podio", "podios")}</span>}
            {jugadores.length > 0 && <span>{plural(jugadores.length, "foto", "fotos")}</span>}
          </p>
        </div>

        {ganadores.length > 0 && (
          <>
            <p className="tg-sub">Podio</p>
            <div className="tg-podio">
              {ganadores.map((photo) => (
                <TorneoThumb
                  key={photo.id}
                  src={photo.src}
                  alt={photo.alt}
                  label={photo.label}
                  sizes="(max-width: 640px) 46vw, 270px"
                />
              ))}
            </div>
          </>
        )}

        {jugadores.length > 0 && <p className="tg-sub">La fecha en fotos</p>}
        {jugadores.length > 0 && !marquee && (
          <div className="torneo-thumb-grid">
            {jugadores.map((photo) => (
              <TorneoThumb key={photo.id} src={photo.src} alt={photo.alt} />
            ))}
          </div>
        )}
      </div>

      {marquee && <JugadoresMarquee photos={jugadores} />}
    </li>
  );
}

/** `signupOpen`: hay un torneo con inscripción abierta arriba (#inscripcion). */
export default function TorneosGallery({ tournaments, signupOpen = false }) {
  // El marcador de la cabecera: cuánta historia tiene el club.
  const podios = tournaments.reduce((n, t) => n + t.ganadores.length, 0);
  const fotos = tournaments.reduce((n, t) => n + t.jugadores.length + t.ganadores.length, 0);
  return (
    <section id="torneos" className="tg">
      <div className="container">
        <div className="tg-head">
          <div className="tg-head-text">
            <p className="tg-honor">
              <span aria-hidden="true">🏆</span> Cuadro de honor
            </p>
            <h2 className="tg-title">La historia del club, torneo por torneo</h2>
            <p className="tg-desc">
              Torneos todo el año, en todas las categorías. Tocá una foto para verla grande.
            </p>
          </div>
          {tournaments.length > 0 && (
            <dl className="tg-tablero">
              <div>
                <dt>Torneos</dt>
                <dd>{tournaments.length}</dd>
              </div>
              <div>
                <dt>Podios</dt>
                <dd>{podios}</dd>
              </div>
              <div>
                <dt>Fotos</dt>
                <dd>{fotos}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      {tournaments.length === 0 && (
        <div className="container">
          <p className="tg-desc">Pronto vas a ver acá las fotos de los torneos.</p>
        </div>
      )}

      <ol className="tg-historia">
        {tournaments.map((t) => (
          <TorneoBlock key={t.id} torneo={t} />
        ))}
      </ol>

      {/* Cierre: después de ver las copas, el llamado a jugar el próximo. */}
      <div className="container">
        <div className="tg-cierre">
          <p>
            <strong>¿La próxima foto es la tuya?</strong>
            {signupOpen ? " La inscripción está abierta." : " Avisanos y te guardamos lugar."}
          </p>
          {signupOpen ? (
            <a href="#inscripcion" className="tt-cta">
              Inscribir mi pareja <span aria-hidden="true">↑</span>
            </a>
          ) : (
            <a
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
                "Hola Muzzaga! Quiero inscribir mi pareja al próximo torneo.",
              )}`}
              target="_blank"
              rel="noopener"
              className="tt-cta tt-cta--wa"
            >
              <WhatsappIcon />
              Inscribir mi pareja por WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
