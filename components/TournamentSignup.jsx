"use client";

import { useState } from "react";
import { signupTournament } from "../app/torneos/actions";
import { CLUB_INFO } from "../data/club";
import { formatARS, plural } from "../lib/format";
import { tournamentDateText } from "../lib/tournament";

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

  return (
    <article className="tsu-card" aria-labelledby={`tsu-${id}`}>
      <div className="tsu-info">
        <span className="badge-linear badge-amber">Inscripción abierta</span>
        <h2 id={`tsu-${id}`} className="tsu-title">{name}</h2>
        <p className="tsu-when">{when}</p>
        <ul className="tsu-facts">
          {price > 0 && (
            <li>
              <strong>{formatARS(price)}</strong> por pareja
            </li>
          )}
          <li>
            {categories.length === 1 ? "Categoría " : "Categorías: "}
            <strong>{categories.map((c) => c.name).join(" · ")}</strong>
          </li>
        </ul>
      </div>

      {done ? (
        <div className="tsu-done" role="status">
          <strong>¡Listo, quedaron anotados!</strong>
          <p>
            {done.name} / {done.partner}
            {done.category ? ` en ${done.category}` : ""}. Te escribimos al
            WhatsApp para confirmar{price > 0 ? " el pago de la inscripción" : ""}.
          </p>
          <div className="tsu-row">
            <a
              href={waLink(
                `¡Hola Muzzaga! Anoté a la pareja ${done.name} / ${done.partner} en el torneo ${name}${done.category ? ` (${done.category})` : ""}. ¿Cómo pago la inscripción?`,
              )}
              target="_blank"
              rel="noopener"
              className="btn btn-linear-primary"
            >
              Avisar por WhatsApp →
            </a>
            <button type="button" className="tsu-link" onClick={() => setDone(null)}>
              Anotar otra pareja
            </button>
          </div>
        </div>
      ) : (
        <form className="tsu-form" onSubmit={handleSubmit} noValidate>
          {categories.length > 1 && (
            <fieldset className="tsu-cats">
              <legend className="tsu-label">Categoría</legend>
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
          )}
          <div className="tsu-fields">
            <label className="tsu-field">
              <span className="tsu-label">Tu nombre y apellido</span>
              <input
                className="tsu-input"
                value={form.name}
                onChange={set("name")}
                autoComplete="name"
                maxLength={60}
                required
              />
            </label>
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
            <label className="tsu-field">
              <span className="tsu-label">WhatsApp</span>
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
            </label>
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
          </div>
          {error && (
            <p className="tsu-error" role="alert">
              {error}
            </p>
          )}
          <div className="tsu-row">
            <button type="submit" className="btn btn-linear-primary" disabled={sending}>
              {sending ? "Anotando…" : "Inscribir pareja"}
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
