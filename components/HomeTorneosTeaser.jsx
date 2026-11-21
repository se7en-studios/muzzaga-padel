"use client";

import Image from "next/image";
import Link from "next/link";
import { useLightbox } from "./LightboxProvider";
import { CLUB_INFO } from "../data/club";
import Mascota from "./Mascota";
import { formatARS } from "../lib/format";
import { tournamentDateText } from "../lib/tournament";

// Fotos y textos: Configuración → Sitio web → Torneos en el inicio.
const FEATURED_SLOTS = [
  "torneo-1",
  "torneo-2",
  "torneo-3",
  "torneo-4",
  "torneo-5",
];

const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const WA_TORNEO = `https://wa.me/${CLUB_INFO.phoneRaw}?text=${encodeURIComponent(
  "¡Hola Muzzaga! Quiero información sobre fecha e inscripción para el próximo torneo.",
)}`;

/** Medalla según la leyenda que carga el admin ("1er puesto…", "2do…"). */
function medalla(caption = "") {
  if (/\b(1|1er|1ro|primer)\s*(°|º)?\s*puesto|campe[oó]n/i.test(caption))
    return "oro";
  if (/\b(2|2do|segundo)\s*(°|º)?\s*puesto|subcampe/i.test(caption))
    return "plata";
  if (/\b(3|3er|3ro|tercer)\s*(°|º)?\s*puesto/i.test(caption)) return "bronce";
  return null;
}
const PUESTO = { oro: "1°", plata: "2°", bronce: "3°" };

/** Llave decorativa: cuartos → semis → final → copa. Solo adorno (compu). */
function Llave() {
  return (
    <div className="tn-llave" aria-hidden="true">
      <div className="tn-llave-col">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="tn-llave-col">
        <i />
        <i />
      </div>
      <div className="tn-llave-col">
        <i className="tn-llave-vos">¿Tu pareja?</i>
      </div>
      <span className="tn-llave-copa">🏆</span>
    </div>
  );
}

/** `tournament`: el próximo con inscripción abierta (lo crea el admin en Torneos). */
export default function HomeTorneosTeaser({ photos, tournament }) {
  const openLightbox = useLightbox();
  const featured = FEATURED_SLOTS.map((id) => ({ id, ...photos[id] })).filter(
    (p) => p.src,
  );
  // "2026-09-12" → 12 / SEP para el marcador; sin fecha, signos de pregunta.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(tournament?.date || "")
    ? tournament.date
    : "";
  const day = iso ? iso.slice(8, 10) : "";
  const month = iso ? MESES[Number(iso.slice(5, 7)) - 1] : "";
  const parejas = tournament
    ? tournament.categories.reduce((n, c) => n + (c.pairs || 0), 0)
    : 0;

  return (
    <section
      id="torneos"
      className="section-turnos"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="container">
        <div className="section-header-row tn-cabecera">
          <div>
            <span
              className="badge-linear badge-amber"
              style={{ marginBottom: 6 }}
            >
              Competencia y comunidad
            </span>
            <h2 className="section-title">Torneos en Muzzaga</h2>
            <p className="section-desc">
              Torneos por categoría todo el año. Anotate para el próximo y mirá
              a los últimos campeones.
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

        {/* PRÓXIMO TORNEO: afiche sobre la cancha azul. La fecha va en un
            marcador de LED y el nombre en letra de cartel. */}
        <article
          className={`tn-afiche tc-cartel ${tournament ? "is-abierto" : "is-pronto"}`}
          aria-labelledby="tn-afiche-titulo"
        >
          <span className="tn-afiche-fondo" aria-hidden="true">
            Torneo
          </span>
          <span className="tn-afiche-pelota" aria-hidden="true" />

          <p className="tn-afiche-kicker">
            <i aria-hidden="true" />
            {tournament ? "Inscripción abierta" : "Próximo torneo"}
          </p>

          <div className="tn-afiche-main">
            <div className="tn-led" aria-hidden="true">
              <span className="tn-led-label">Fecha</span>
              <strong className="tn-led-num">{day || "¿?"}</strong>
              <span className="tn-led-mes">{day ? month : "Pronto"}</span>
            </div>
            <div className="tn-afiche-cabeza">
              <h3 id="tn-afiche-titulo" className="tn-afiche-titulo">
                {tournament ? tournament.name : "Se viene el próximo"}
              </h3>
              {tournament ? (
                <p className="tn-afiche-fecha">
                  {tournamentDateText(tournament.date, tournament.dateEnd)}
                </p>
              ) : (
                <p className="tn-sello">Fecha a confirmar</p>
              )}
            </div>
          </div>

          {tournament ? (
            <ul className="tn-datos" aria-label="Datos del torneo">
              {tournament.price > 0 && (
                <li className="tn-dato-precio">
                  <b>{formatARS(tournament.price)}</b> por pareja
                </li>
              )}
              {tournament.categories.map((c) => (
                <li key={c.id || c.name}>{c.name}</li>
              ))}
              {parejas > 0 && (
                <li className="tn-dato-parejas">
                  {parejas}{" "}
                  {parejas === 1 ? "pareja anotada" : "parejas anotadas"}
                </li>
              )}
            </ul>
          ) : (
            <p className="tn-afiche-desc">
              Escribinos y te avisamos la fecha y las categorías apenas estén
              definidas.
            </p>
          )}

          <Llave />

          {tournament ? (
            <Link href="/torneos#inscripcion" className="tn-afiche-cta">
              Inscribir mi pareja <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <a
              href={WA_TORNEO}
              target="_blank"
              rel="noopener"
              className="tn-afiche-cta"
            >
              Anotarme por WhatsApp <span aria-hidden="true">→</span>
            </a>
          )}
        </article>

        {/* CUADRO DE HONOR: tira que se desliza en el celu; cada ganador con
            su medalla y el marco del color del puesto (según la leyenda). */}
        <div className="tn-honor-cabeza">
          <h3 className="tn-honor">
            <span className="tn-honor-copa" aria-hidden="true">
              🏆
            </span>
            Cuadro de honor
          </h3>
          <Link href="/torneos" className="tn-honor-link">
            Ver galería<span className="tn-solo-ancho"> completa</span>{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {featured.length > 0 && (
          <ul className="tn-podio" aria-label="Fotos de ganadores y jugadores">
            {featured.map((photo) => {
              const medal = medalla(photo.caption);
              return (
                <li
                  key={photo.id}
                  className={`tn-foto${medal ? ` is-${medal}` : ""}`}
                >
                  <button
                    type="button"
                    className="tn-foto-btn"
                    onClick={() => openLightbox(photo.src, photo.alt)}
                    aria-label={`Ampliar foto: ${photo.caption || photo.alt}`}
                  >
                    <Image
                      src={photo.src}
                      alt={photo.alt || ""}
                      fill
                      loading="lazy"
                      sizes="(max-width: 640px) 66vw, (max-width: 1023px) 34vw, 230px"
                      className="tn-foto-img"
                    />
                    {medal && (
                      <span
                        className={`tn-medalla is-${medal}`}
                        aria-hidden="true"
                      >
                        {PUESTO[medal]}
                      </span>
                    )}
                    {photo.caption && (
                      <span className="tn-foto-cap">{photo.caption}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
