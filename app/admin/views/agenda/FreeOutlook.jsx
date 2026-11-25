"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Flame, Megaphone, MessageCircle } from "lucide-react";
import { buildFreeSlotsPromoMessage } from "../../../../lib/adminMessages";
import { isoWeekday } from "../../../../lib/booking";
import { formatPct } from "../../../../lib/format";
import {
  freeSlotsLabel,
  freeSlotsOutlook,
  freeSlotsPct,
  freeSlotsTone,
} from "../../../../lib/freeSlots";
import { SITE_URL } from "../../../../lib/site";

const ICON = { size: 15, strokeWidth: 1.9, "aria-hidden": true };
const WEEKDAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEKDAY_LONG = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
// La promo lleva como mucho 4 días: más largo, en el grupo no se lee.
const PROMO_MAX_DAYS = 4;

const dayShort = (iso, todayIso) =>
  iso === todayIso ? "Hoy" : `${WEEKDAY[isoWeekday(iso)]} ${Number(iso.slice(8, 10))}`;
const dayLong = (iso, todayIso) =>
  iso === todayIso
    ? "hoy"
    : `${WEEKDAY_LONG[isoWeekday(iso)]} ${Number(iso.slice(8, 10))}`;

/**
 * "Próximos 7 días": cuántos turnos quedan libres para vender, qué día viene
 * más lleno y cuál conviene promocionar. Tocar un día lo abre en la grilla;
 * "Copiar promo" arma el mensaje de WhatsApp con los horarios libres de los
 * días más flojos, listo para pegar en los grupos.
 * `freeSlots`: null = cargando, false = falló, objeto = listo.
 */
export default function FreeOutlook({ freeSlots, dates, todayIso, activeDate, onSelect }) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  if (freeSlots === false) return null;
  const ready = freeSlots && typeof freeSlots === "object";
  const outlook = ready ? freeSlotsOutlook(freeSlots, dates) : null;

  const promoDays = outlook
    ? outlook.promoDates.slice(0, PROMO_MAX_DAYS).map((date) => ({
        date,
        starts: (freeSlots[date]?.freeStarts || []).map((s) => s.start),
      }))
    : [];
  const promo = buildFreeSlotsPromoMessage(promoDays, {
    todayIso,
    link: SITE_URL ? `${SITE_URL}/#reservar` : "",
  });

  // Está debajo de la grilla: al elegir un día se sube a la tira, así se
  // ve el día que se abrió.
  function goTo(date) {
    onSelect(date);
    const strip = document.querySelector(".admin-agenda .admin-daystrip");
    if (strip) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      strip.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  async function copyPromo() {
    try {
      await navigator.clipboard.writeText(promo);
    } catch {
      // Sin permiso de portapapeles (http, navegador viejo): se copia a mano.
      const area = document.createElement("textarea");
      area.value = promo;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(area);
      }
    }
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2200);
  }

  return (
    <section className="admin-outlook" aria-labelledby="admin-outlook-title">
      <div className="admin-week-head">
        <h2 id="admin-outlook-title" className="admin-section-title admin-m0">
          Próximos 7 días
        </h2>
        {outlook && outlook.openDays > 0 && (
          <p className="admin-week-totals">
            <span>
              <strong>{outlook.free}</strong>{" "}
              {outlook.free === 1 ? "turno libre" : "turnos libres"} de {outlook.total}
            </span>
            <span>
              <strong>{formatPct(outlook.pct ?? 0)}</strong> reservado
            </span>
          </p>
        )}
      </div>

      {!ready ? (
        <div className="admin-outlook-card is-loading" aria-busy="true" aria-label="Contando turnos libres" />
      ) : (
        <div className="admin-outlook-card">
          {/* Un día por columna: la barra crece con lo reservado y arriba
              va cuántos quedan. Se toca para abrir ese día. */}
          <ol className="admin-outlook-days">
            {dates.map((date) => {
              const day = freeSlots[date];
              const tone = freeSlotsTone(day);
              const pct = freeSlotsPct(day) ?? 0;
              const label = freeSlotsLabel(day);
              const isEmptiest = outlook.emptiest?.date === date;
              const isBusiest = outlook.busiest?.date === date;
              const disabled = tone === "closed";
              return (
                <li key={date}>
                  <button
                    type="button"
                    className={`admin-outlook-day${date === activeDate ? " is-active" : ""}${isEmptiest ? " is-emptiest" : ""}${isBusiest ? " is-busiest" : ""}`}
                    data-tone={tone}
                    disabled={disabled}
                    aria-pressed={date === activeDate}
                    aria-label={`${dayShort(date, todayIso)}: ${label}${tone === "closed" || tone === "done" ? "" : `, ${pct}% reservado`}`}
                    onClick={() => goTo(date)}
                  >
                    <span className="admin-outlook-free">
                      {tone === "closed" ? "—" : tone === "full" ? "Lleno" : tone === "done" ? "✓" : day.free}
                    </span>
                    <span className="admin-outlook-meter" aria-hidden>
                      <span style={{ transform: `scaleY(${tone === "full" ? 1 : pct / 100})` }} />
                    </span>
                    <span className="admin-outlook-name">{dayShort(date, todayIso)}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="admin-outlook-side">
            {outlook.emptiest ? (
              <button
                type="button"
                className="admin-outlook-pick is-emptiest"
                onClick={() => goTo(outlook.emptiest.date)}
              >
                <span className="admin-outlook-pick-label">
                  <Megaphone {...ICON} /> Para promocionar
                </span>
                <strong>
                  {dayShort(outlook.emptiest.date, todayIso)} ·{" "}
                  {freeSlotsLabel(outlook.emptiest)}
                </strong>
                <span className="admin-outlook-pick-cta">Ver el día →</span>
              </button>
            ) : (
              <div className="admin-outlook-pick is-emptiest is-static">
                <span className="admin-outlook-pick-label">
                  <Megaphone {...ICON} /> Para promocionar
                </span>
                <strong>{outlook.openDays > 0 ? "Todo reservado" : "Sin días abiertos"}</strong>
              </div>
            )}
            {outlook.busiest && (
              <button
                type="button"
                className="admin-outlook-pick is-busiest"
                onClick={() => goTo(outlook.busiest.date)}
              >
                <span className="admin-outlook-pick-label">
                  <Flame {...ICON} /> El más lleno
                </span>
                <strong>
                  {dayShort(outlook.busiest.date, todayIso)} ·{" "}
                  {formatPct(outlook.busiest.pct)} reservado
                </strong>
                <span className="admin-outlook-pick-cta">
                  {outlook.busiest.free === 0
                    ? "No queda nada"
                    : `Quedan ${freeSlotsLabel(outlook.busiest).toLowerCase()}`}
                </span>
              </button>
            )}
          </div>

          {promo && (
            <div className="admin-outlook-promo">
              <p className="admin-outlook-promo-text">
                Promo lista con los horarios libres para{" "}
                {promoDays.map((d, i) => (
                  <span key={d.date}>
                    {i > 0 ? (i === promoDays.length - 1 ? " y " : ", ") : ""}
                    <strong>{dayLong(d.date, todayIso)}</strong>
                  </span>
                ))}
                .
              </p>
              <div className="admin-outlook-promo-actions">
                <button
                  type="button"
                  className={`btn btn-secondary admin-outlook-copy${copied ? " is-copied" : ""}`}
                  onClick={copyPromo}
                >
                  {copied ? <Check {...ICON} /> : <Copy {...ICON} />}
                  {copied ? "¡Copiada!" : "Copiar promo"}
                </button>
                <a
                  className="btn btn-secondary admin-outlook-wa"
                  href={`https://wa.me/?text=${encodeURIComponent(promo)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle {...ICON} /> WhatsApp
                </a>
              </div>
              <details className="admin-outlook-preview">
                <summary>Ver el mensaje</summary>
                <pre>{promo}</pre>
              </details>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
