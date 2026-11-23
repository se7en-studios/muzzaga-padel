"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { MarqueeCard } from "./PhotoCard";
import { useLightbox } from "./LightboxProvider";
import { plural } from "../lib/format";
import { WhatsAppLogo } from "./BrandLogos";

const WHATSAPP = "5492995974176";

// Los torneos y sus fotos salen de Configuración → Sitio web → Galería de
// torneos (ver lib/siteContent.js). Con pocas fotos de jugadores la tira que
// se mueve sola deja huecos en pantallas anchas: va en grilla.
const MARQUEE_MIN = 10;

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
                  sizes="(max-width: 640px) 46vw, (min-width: 1280px) 340px, 270px"
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

  // Entradas al llegar con el scroll: el tablero da vuelta sus números, la
  // pelota cruza la placa de cada torneo y las medallas quedan colgando.
  // El estado oculto depende de la clase tg-fx que pone JS: sin JS (o con
  // "reducir movimiento") todo se ve quieto desde el principio.
  const secRef = useRef(null);
  useEffect(() => {
    const sec = secRef.current;
    if (!sec || !("IntersectionObserver" in window)) return undefined;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return undefined;
    const targets = sec.querySelectorAll(".tg-head, .tg-torneo");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    sec.classList.add("tg-fx");
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <section id="torneos" className="tg" ref={secRef}>
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
              <div style={{ "--d": 0 }}>
                <dt>Torneos</dt>
                <dd>{tournaments.length}</dd>
              </div>
              <div style={{ "--d": 1 }}>
                <dt>Podios</dt>
                <dd>{podios}</dd>
              </div>
              <div style={{ "--d": 2 }}>
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
              {/* El logo entero de WhatsApp (el de todo el sitio); sin
                  flex-shrink se achicaba a un puntito de 6 px. */}
              <WhatsAppLogo size={18} color="currentColor" style={{ flexShrink: 0 }} />
              Inscribir mi pareja por WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
