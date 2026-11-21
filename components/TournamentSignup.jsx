"use client";

import { useState } from "react";
import { signupTournament } from "../app/torneos/actions";
import { CLUB_INFO } from "../data/club";
import { formatARS, plural } from "../lib/format";
import { tournamentDateText } from "../lib/tournament";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Llave decorativa: cuartos → semis → final → copa, como en el inicio. */
function Llave() {
  return (
    <div className="tt-llave" aria-hidden="true">
      <div className="tt-llave-col">
        <i /><i /><i /><i />
      </div>
      <div className="tt-llave-col">
        <i /><i />
      </div>
      <div className="tt-llave-col">
        <i className="tt-llave-vos">¿Tu pareja?</i>
      </div>
      <span className="tt-llave-copa">🏆</span>
    </div>
  );
}

const waLink = (text) =>
  `https://wa.me/${CLUB_INFO.phoneRaw}?text=${encodeURIComponent(text)}`;

/**
 * Tarjeta de un torneo con la inscripción abierta (los crea el admin en
 * Torneos) y el formulario para anotar la pareja: queda directo en el panel.
 */
export default function TournamentSignup({ tournament }) {
  const { id, name, date, dateEnd, price, categories } = tournament;
  const [categoryId, setCategoryId] = useState(
    categories.length === 1 ? categories[0].id : "",
  );
  const [form, setForm] = useState({ name: "", partner: "", phone: "", website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const category = categories.find((c) => c.id === categoryId);
  const when = tournamentDateText(date, dateEnd);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!categoryId) {
      setError("Elegí la categoría.");
      return;
    }
    setSending(true);
    setError("");
    let res;
    try {
      res = await signupTournament({ tournamentId: id, categoryId, ...form });
    } catch {
      res = { ok: false, error: "No se pudo anotar la pareja. Probá de nuevo." };
    }
    setSending(false);
    if (res.ok) {
      setDone({ ...form, category: category?.name || "" });
      setForm({ name: "", partner: "", phone: "", website: "" });
    } else {
      setError(res.error || "No se pudo anotar la pareja. Probá de nuevo.");
    }
  }

  // Solo para pintar: cada paso se tilda cuando ya está completo, así en
  // el celu se ve de un vistazo qué falta (la validación real es la de siempre).
  const okPair = form.name.trim().length >= 2 && form.partner.trim().length >= 2;
  const okPhone = form.phone.replace(/\D/g, "").length >= 8;
  // "2026-12-12" → 12 / DIC para el marcador; sin fecha, signos de pregunta.
  const day = date ? date.slice(8, 10) : "";
  const month = date ? MESES[Number(date.slice(5, 7)) - 1] : "";

  return (
    <article className="tsu-card" aria-labelledby={`tsu-${id}`}>
      {/* AFICHE: el torneo pegado sobre la cancha azul. */}
      <div className="tsu-poster">
        <div className="tt-marcador" aria-hidden="true">
          <span className="tt-marcador-label">Fecha</span>
          <strong className="tt-marcador-num">{day || "¿?"}</strong>
          <span className="tt-marcador-mes">{month || "Pronto"}</span>
        </div>
        <div className="tsu-info">
          <span className="tt-tag">Inscripción abierta</span>
          <h2 id={`tsu-${id}`} className="tsu-title">{name}</h2>
          <p className="tsu-when">{when}</p>
          <ul className="tsu-facts">
            {price > 0 && (
              <li className="tsu-fact-precio">
                <strong>{formatARS(price)}</strong> por pareja
              </li>
            )}
            {categories.map((c) => (
              <li key={c.id}>
                {categories.length === 1 && <span className="tt-sr">Categoría </span>}
                <strong>{c.name}</strong>
                {c.pairs > 0 && (
                  <span className="tsu-fact-count">· {plural(c.pairs, "pareja", "parejas")}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <Llave />
      </div>

      {done ? (
        <div className="tsu-done" role="status">
          <span className="tsu-done-check" aria-hidden="true">✓</span>
          <strong className="tsu-done-title">¡Listo, quedaron anotados!</strong>
          <p className="tsu-done-pareja">
            {done.name} <span aria-hidden="true">/</span> {done.partner}
          </p>
          {done.category && <span className="tsu-done-cat">{done.category}</span>}
          <p>
            Te escribimos al WhatsApp para confirmar
            {price > 0 ? " el pago de la inscripción" : ""}.
          </p>
          <div className="tsu-row">
            <a
              href={waLink(
                `¡Hola Muzzaga! Anoté a la pareja ${done.name} / ${done.partner} en el torneo ${name}${done.category ? ` (${done.category})` : ""}. ¿Cómo pago la inscripción?`,
              )}
              target="_blank"
              rel="noopener"
              className="tt-cta tt-cta--wa"
            >
              Avisar por WhatsApp <span aria-hidden="true">→</span>
            </a>
            <button type="button" className="tsu-link" onClick={() => setDone(null)}>
              Anotar otra pareja
            </button>
          </div>
        </div>
      ) : (
        <form className="tsu-form" onSubmit={handleSubmit} noValidate>
          <p className="tsu-form-head">
            Inscribí tu pareja <span>Tarda un minuto</span>
          </p>
          <ol className="tsu-steps">
            {categories.length > 1 && (
              <li className={`tsu-step${categoryId ? " is-ok" : ""}`}>
                <fieldset className="tsu-cats">
                  <legend className="tsu-step-title">Elegí la categoría</legend>
                  <div className="tsu-chips">
                    {categories.map((c) => (
                      <label
                        key={c.id}
                        className={`tsu-chip${c.id === categoryId ? " is-on" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`cat-${id}`}
                          value={c.id}
                          checked={c.id === categoryId}
                          onChange={() => setCategoryId(c.id)}
                        />
                        {c.name}
                        {c.pairs > 0 && (
                          <span className="tsu-chip-count">
                            {plural(c.pairs, "pareja", "parejas")}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            )}
            <li className={`tsu-step${okPair ? " is-ok" : ""}`}>
              <p className="tsu-step-title">La pareja</p>
              <div className="tsu-pareja">
                <label className="tsu-field">
                  <span className="tsu-label">Vos · nombre y apellido</span>
                  <input
                    className="tsu-input"
                    value={form.name}
                    onChange={set("name")}
                    autoComplete="name"
                    placeholder="Ej. Juan Pérez"
                    maxLength={60}
                    required
                  />
                </label>
                <span className="tsu-pareja-y" aria-hidden="true">+</span>
                <label className="tsu-field">
                  <span className="tsu-label">Tu compañero/a</span>
                  <input
                    className="tsu-input"
                    value={form.partner}
                    onChange={set("partner")}
                    placeholder="Nombre y apellido"
                    maxLength={60}
                    required
                  />
                </label>
              </div>
            </li>
            <li className={`tsu-step${okPhone ? " is-ok" : ""}`}>
              <label className="tsu-field">
                <span className="tsu-step-title">Tu WhatsApp</span>
                <input
                  className="tsu-input"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  autoComplete="tel"
                  placeholder="Ej. 299 555 1234"
                  maxLength={30}
                  required
                />
                <span className="tsu-hint">Por acá te confirmamos la inscripción.</span>
              </label>
            </li>
          </ol>
          {/* Trampa para bots: fuera de pantalla y fuera del tab. */}
          <input
            className="tsu-trap"
            name="website"
            value={form.website}
            onChange={set("website")}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
          {error && (
            <p className="tsu-error" role="alert">
              {error}
            </p>
          )}
          <div className="tsu-row">
            <button type="submit" className="tt-cta tsu-submit" disabled={sending}>
              {sending ? "Anotando…" : "Inscribir pareja"}
              {!sending && <span aria-hidden="true">→</span>}
            </button>
            <a
              href={waLink(`¡Hola Muzzaga! Tengo una consulta sobre el torneo ${name}.`)}
              target="_blank"
              rel="noopener"
              className="tsu-link"
            >
              ¿Dudas? Escribinos
            </a>
          </div>
        </form>
      )}
    </article>
  );
}
