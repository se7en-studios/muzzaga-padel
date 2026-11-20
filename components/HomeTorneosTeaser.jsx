"use client";

import Image from "next/image";
import Link from "next/link";
import { useLightbox } from "./LightboxProvider";
import { CLUB_INFO } from "../data/club";
import Mascota from "./Mascota";
import { formatARS } from "../lib/format";
import { tournamentDateText } from "../lib/tournament";

// Fotos y textos: Configuración → Sitio web → Torneos en el inicio.
const FEATURED_SLOTS = ["torneo-1", "torneo-2", "torneo-3", "torneo-4", "torneo-5"];

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Medalla según la leyenda que carga el admin ("1er puesto…", "2do…"). */
function medalla(caption = "") {
  if (/\b(1|1er|1ro|primer)\s*(°|º)?\s*puesto|campe[oó]n/i.test(caption)) return "oro";
  if (/\b(2|2do|segundo)\s*(°|º)?\s*puesto|subcampe/i.test(caption)) return "plata";
  if (/\b(3|3er|3ro|tercer)\s*(°|º)?\s*puesto/i.test(caption)) return "bronce";
  return null;
}
const PUESTO = { oro: "1°", plata: "2°", bronce: "3°" };

/** Llave decorativa: cuartos → semis → final → copa. Solo adorno. */
function Llave() {
  return (
    <div className="tc-llave" aria-hidden="true">
      <div className="tc-llave-col">
        <i /><i /><i /><i />
      </div>
      <div className="tc-llave-col">
        <i /><i />
      </div>
      <div className="tc-llave-col">
        <i className="tc-llave-vos">¿Tu pareja?</i>
      </div>
      <span className="tc-llave-copa">🏆</span>
    </div>
  );
}

/** `tournament`: el próximo con inscripción abierta (lo crea el admin en Torneos). */
export default function HomeTorneosTeaser({ photos, tournament }) {
  const openLightbox = useLightbox();
  const featured = FEATURED_SLOTS.map((id) => ({ id, ...photos[id] }));
  // "2026-09-12" → 12 / SEP para el marcador; sin fecha, signos de pregunta.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(tournament?.date || "") ? tournament.date : "";
  const day = iso ? iso.slice(8, 10) : "";
  const month = iso ? MESES[Number(iso.slice(5, 7)) - 1] : "";

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
        {/* PRÓXIMO TORNEO: cartel sobre la cancha azul, con la fecha como
            marcador y un cuadrito de llave que termina en la copa. */}
        <div className="next-event tc-cartel">
          <div className="next-event-date tc-marcador" aria-hidden="true">
            <span className="tc-marcador-label">Fecha</span>
            {day ? (
              <>
                <strong className="tc-marcador-num">{day}</strong>
                <span className="tc-marcador-mes">{month}</span>
              </>
            ) : (
              <>
                <strong className="tc-marcador-num">¿?</strong>
                <span className="tc-marcador-mes">Pronto</span>
              </>
            )}
          </div>
          {tournament ? (
            <>
              <div className="next-event-body">
                <span className="next-event-tag">Inscripción abierta</span>
                <h3 className="next-event-title">{tournament.name}</h3>
                <p className="next-event-desc">
                  {tournamentDateText(tournament.date, tournament.dateEnd)}
                  {tournament.price > 0 ? ` · ${formatARS(tournament.price)} por pareja` : ""}
                </p>
                {tournament.categories.length > 0 && (
                  <ul className="tc-cats" aria-label="Categorías">
                    {tournament.categories.map((c) => (
                      <li key={c.id || c.name}>{c.name}</li>
                    ))}
                  </ul>
                )}
              </div>
              <Llave />
              <Link href="/torneos#inscripcion" className="next-event-cta">
                Inscribir mi pareja <span aria-hidden="true">→</span>
              </Link>
            </>
          ) : (
            <>
              <div className="next-event-body">
                <span className="next-event-tag">Próximo torneo</span>
                <h3 className="next-event-title">Fecha a confirmar</h3>
                <p className="next-event-desc">
                  Escribinos por WhatsApp y te avisamos la fecha y las categorías apenas estén definidas.
                </p>
              </div>
              <Llave />
              <a
                href={`https://wa.me/${CLUB_INFO.phoneRaw}?text=${encodeURIComponent("¡Hola Muzzaga! Quiero información sobre fecha e inscripción para el próximo torneo.")}`}
                target="_blank"
                rel="noopener"
                className="next-event-cta"
              >
                Anotarme por WhatsApp <span aria-hidden="true">→</span>
              </a>
            </>
          )}
        </div>

        {/* CUADRO DE HONOR: los ganadores llevan medalla según la leyenda. */}
        <p className="tc-honor">
          <span className="tc-honor-copa" aria-hidden="true">🏆</span>
          Cuadro de honor
        </p>

        {/* GRILLA RESUMIDA DE 5 FOTOS */}
        <div className="torneo-thumb-grid torneo-bento">
          {featured.map((photo, i) => {
            const medal = medalla(photo.caption);
            return (
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
                {medal && (
                  <span className={`tc-medalla is-${medal}`} aria-hidden="true">
                    {PUESTO[medal]}
                  </span>
                )}
                {photo.caption && (
                  <div className="torneo-thumb-badge">
                    <span>{photo.caption}</span>
                  </div>
                )}
              </button>
            );
          })}
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
