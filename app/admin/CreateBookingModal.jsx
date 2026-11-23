"use client";

import { useState } from "react";
import { depositFor, priceFor, slotTimesFor } from "../../lib/clubConfig";
import { formatARS, formatDate } from "../../lib/format";
import { IconClose } from "./adminHelpers";
import BusyButton from "./ui/BusyButton";
import { useExitAnimation } from "./ui/motion";
import PlayerNamesFields from "./ui/PlayerNamesFields";

const weekdayShort = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  timeZone: "UTC",
});

/** "mar 24/11" para el ticket. */
function shortDay(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const wd = weekdayShort.format(new Date(Date.UTC(y, m - 1, d))).replace(".", "");
  return `${wd} ${formatDate(isoDate)}`;
}

/**
 * Nueva reserva o bloqueo de cancha. Solo dos tipos a propósito: los pagos
 * se anotan después desde el detalle del turno (marcar "pagado" acá dejaba
 * turnos pagos sin plata en la caja).
 *
 * Armado en tres pasos que se leen de arriba abajo (cuándo → quién → pago)
 * y un ticket al costado (abajo en el celu) que se actualiza mientras se
 * completa, con el botón de guardar siempre a mano.
 */
export default function CreateBookingModal({
  activeDate,
  clubConfig,
  modalForm,
  setModalForm,
  modalSubmitting,
  clients,
  onClose,
  onSubmit,
  onPlayerNameBlur,
}) {
  // Mismo cálculo que hace el server action, para que el modal muestre
  // exactamente el total que se va a guardar.
  const slotTimes = slotTimesFor(clubConfig, activeDate);
  const selectedSlot =
    slotTimes.find((s) => s.start === modalForm.startTime) || slotTimes[0];
  const modalRate = priceFor(clubConfig, activeDate, modalForm.startTime);
  const modalPrice = modalForm.fullCourt
    ? modalRate.total
    : (modalForm.playersCount || 4) * modalRate.perPlayer;
  const isBlock = modalForm.status === "bloqueado";
  const set = (patch) => setModalForm({ ...modalForm, ...patch });
  const playerNames = modalForm.playerNames || [];
  // Plegado de entrada: casi nunca se anotan, y así el formulario sigue corto.
  const [showPlayers, setShowPlayers] = useState(() =>
    playerNames.some((n) => n.trim()),
  );

  // Solo para mostrar: la seña sugerida según el % de Configuración.
  const deposit = depositFor(clubConfig, modalPrice);
  const court = clubConfig.courts.find((c) => c.id === modalForm.courtId);
  const hasTime = slotTimes.some((s) => s.start === modalForm.startTime);
  const who = (modalForm.playerName || "").trim();
  // Al cerrar con la X o tocando afuera, la hoja sale antes de desmontarse.
  const exit = useExitAnimation(onClose);
  const steps = [
    { n: 1, label: "Cuándo", done: Boolean(court) && hasTime },
    { n: 2, label: isBlock ? "Motivo" : "Quién", done: Boolean(who) },
    { n: 3, label: isBlock ? "Detalles" : "Pago", done: Boolean(court) && hasTime && Boolean(who) },
  ];

  return (
    <div
      className={`admin-modal-backdrop${exit.closing ? " is-closing" : ""}`}
      onClick={exit.close}
    >
      <div
        className="admin-modal-card admin-detail admin-bk admin-bk--create"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-create-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-bk-head">
          <div className="admin-bk-head-text">
            <p className="admin-bk-eyebrow">{formatDate(activeDate, "long")}</p>
            <h3 id="admin-create-title" className="admin-bk-title">
              {isBlock ? "Bloquear la cancha" : "Nueva reserva"}
            </h3>
          </div>
          <button
            type="button"
            className="admin-detail-close admin-bk-close"
            onClick={exit.close}
            aria-label="Cerrar"
          >
            <IconClose size={18} /> <span>Cerrar</span>
          </button>
          <ol className="admin-bk-stepper" aria-hidden="true">
            {steps.map((s) => (
              <li key={s.n} className={s.done ? "is-done" : undefined}>
                <span className="admin-bk-stepper-num">{s.n}</span>
                {s.label}
              </li>
            ))}
          </ol>
        </header>

        <form onSubmit={onSubmit} className="admin-create-form admin-bk-form">
          <div className="admin-bk-scroll">
            <div
              className="admin-bk-type"
              role="radiogroup"
              aria-label="Tipo"
            >
              <button
                type="button"
                role="radio"
                aria-checked={!isBlock}
                onClick={() => set({ status: "confirmado" })}
              >
                Reserva de un cliente
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={isBlock}
                onClick={() => set({ status: "bloqueado" })}
              >
                Bloquear la cancha
                <small>Mantenimiento, clase, evento</small>
              </button>
            </div>

            {/* 1 · CUÁNDO */}
            <section
              className={`admin-bk-step${steps[0].done ? " is-done" : ""}`}
              aria-labelledby="admin-create-step-1"
            >
              <h4 className="admin-bk-step-title" id="admin-create-step-1">
                <span className="admin-bk-step-num" aria-hidden="true">1</span>
                Cuándo
              </h4>

              {/* Las canchas como mini canchas para tocar, igual que en la
                  agenda; con muchas canchas vuelve la lista desplegable. */}
              {clubConfig.courts.length <= 3 ? (
                <div className="admin-create-field">
                  <span className="admin-field-label" id="admin-create-court">
                    Cancha
                  </span>
                  <div
                    className="admin-bk-courts"
                    role="radiogroup"
                    aria-labelledby="admin-create-court"
                  >
                    {clubConfig.courts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={modalForm.courtId === c.id}
                        className="admin-bk-court"
                        onClick={() => set({ courtId: c.id })}
                      >
                        <span className="admin-bk-court-name">{c.name}</span>
                        {c.type && (
                          <span className="admin-bk-court-type">{c.type}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <label className="admin-bk-field">
                  <span className="admin-field-label">Cancha</span>
                  <select
                    className="admin-modal-select"
                    value={modalForm.courtId}
                    onChange={(e) => set({ courtId: e.target.value })}
                  >
                    {clubConfig.courts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="admin-create-field">
                <span className="admin-field-label" id="admin-create-time">
                  Horario
                </span>
                {slotTimes.length === 0 ? (
                  <p className="admin-detail-hint">Ese día el club no abre.</p>
                ) : (
                  <div
                    className="admin-bk-times"
                    role="radiogroup"
                    aria-labelledby="admin-create-time"
                  >
                    {slotTimes.map(({ start: t, end }) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={modalForm.startTime === t}
                        aria-label={`${t} a ${end}`}
                        className="admin-bk-time"
                        onClick={() => set({ startTime: t })}
                      >
                        <strong>{t}</strong>
                        <small aria-hidden="true">a {end}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 2 · QUIÉN */}
            <section
              className={`admin-bk-step${steps[1].done ? " is-done" : ""}`}
              aria-labelledby="admin-create-step-2"
            >
              <h4 className="admin-bk-step-title" id="admin-create-step-2">
                <span className="admin-bk-step-num" aria-hidden="true">2</span>
                {isBlock ? "Motivo" : "Quién"}
              </h4>

              <label className="admin-bk-field">
                <span className="admin-field-label">
                  {isBlock ? "¿Por qué se bloquea?" : "Nombre de quien reserva"}
                </span>
                <input
                  type="text"
                  required
                  list="admin-clients-datalist"
                  autoComplete="off"
                  placeholder={
                    isBlock ? "Ej. Clase del profe Nico" : "Ej. Juan Pérez"
                  }
                  className="admin-input-field"
                  value={modalForm.playerName}
                  onChange={(e) => set({ playerName: e.target.value })}
                  onBlur={onPlayerNameBlur}
                />
                {!isBlock && (
                  <datalist id="admin-clients-datalist">
                    {clients.map((c) => (
                      <option key={c.phone || c.name} value={c.name} />
                    ))}
                  </datalist>
                )}
              </label>

              {!isBlock && (
                <>
                  <label className="admin-bk-field">
                    <span className="admin-field-label">
                      Teléfono <small>(opcional)</small>
                    </span>
                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="Ej. 299 597 4176"
                      className="admin-input-field"
                      value={modalForm.playerPhone}
                      onChange={(e) => set({ playerPhone: e.target.value })}
                    />
                  </label>

                  {/* Opcional: quiénes juegan, además del que reserva. */}
                  {showPlayers ? (
                    <fieldset className="admin-players">
                      <legend className="admin-field-label">
                        Quiénes juegan <small>(opcional)</small>
                      </legend>
                      <PlayerNamesFields
                        idPrefix="admin-create-player"
                        value={playerNames}
                        onChange={(next) => set({ playerNames: next })}
                      />
                    </fieldset>
                  ) : (
                    <button
                      type="button"
                      className="admin-bk-add"
                      onClick={() => setShowPlayers(true)}
                    >
                      <span aria-hidden="true">+</span> Anotar los nombres de
                      los jugadores (opcional)
                    </button>
                  )}
                </>
              )}
            </section>

            {/* 3 · PAGO (o detalles del bloqueo) */}
            <section
              className={`admin-bk-step${steps[2].done ? " is-done" : ""}`}
              aria-labelledby="admin-create-step-3"
            >
              <h4 className="admin-bk-step-title" id="admin-create-step-3">
                <span className="admin-bk-step-num" aria-hidden="true">3</span>
                {isBlock ? "Detalles" : "Pago"}
              </h4>

              {!isBlock && (
                <>
                  <div
                    className="admin-bk-seg"
                    role="radiogroup"
                    aria-label="¿Cómo pagan?"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={Boolean(modalForm.fullCourt)}
                      onClick={() => set({ fullCourt: true })}
                    >
                      Cancha entera
                      <small>{formatARS(modalRate.total)}</small>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!modalForm.fullCourt}
                      onClick={() => set({ fullCourt: false })}
                    >
                      Por jugador
                      <small>{formatARS(modalRate.perPlayer)} cada uno</small>
                    </button>
                  </div>

                  {!modalForm.fullCourt && (
                    <div className="admin-create-field">
                      <span
                        className="admin-field-label"
                        id="admin-create-count"
                      >
                        ¿Cuántos jugadores pagan?
                      </span>
                      <div
                        className="admin-bk-times admin-bk-count"
                        role="radiogroup"
                        aria-labelledby="admin-create-count"
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={
                              Number(modalForm.playersCount) === n
                            }
                            aria-label={`${n} ${n === 1 ? "jugador" : "jugadores"}`}
                            className="admin-bk-time"
                            onClick={() => set({ playersCount: n })}
                          >
                            <strong>{n}</strong>
                            <small aria-hidden="true">
                              {n === 1 ? "jugador" : "jugadores"}
                            </small>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <label className="admin-create-check admin-bk-check">
                <input
                  type="checkbox"
                  checked={modalForm.isRecurring}
                  onChange={(e) => set({ isRecurring: e.target.checked })}
                />
                <span>
                  Repetir todas las semanas
                  <small>Turno fijo</small>
                </span>
              </label>
              {modalForm.isRecurring && (
                <label className="admin-bk-field">
                  <span className="admin-field-label">
                    ¿Por cuántas semanas?
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={26}
                    className="admin-input-field admin-bk-weeks"
                    value={modalForm.recurringWeeks}
                    onChange={(e) =>
                      set({ recurringWeeks: Number(e.target.value) })
                    }
                  />
                  <span className="admin-detail-hint">
                    Si alguna semana ese horario ya está ocupado o el club
                    está cerrado, esa semana se saltea y te avisamos.
                  </span>
                </label>
              )}

              <label className="admin-bk-field">
                <span className="admin-field-label">
                  Nota <small>(opcional)</small>
                </span>
                <input
                  type="text"
                  placeholder="Ej. Cumpleaños"
                  className="admin-input-field"
                  value={modalForm.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                />
              </label>
            </section>
          </div>

          {/* El ticket: se completa solo mientras se carga el turno. En el
              celu queda abajo de todo, fijo, con el botón. */}
          <aside className="admin-bk-ticket" aria-label="Resumen">
            <div className="admin-bk-ticket-paper">
              <div className="admin-bk-ticket-head">
                <span className="admin-bk-ticket-kicker">
                  {isBlock ? "Bloqueo" : "Tu reserva"}
                </span>
                <span className="admin-bk-ticket-time">
                  {hasTime
                    ? `${selectedSlot.start} – ${selectedSlot.end}`
                    : "Elegí horario"}
                </span>
                <span className="admin-bk-ticket-court">
                  {court?.name || "Cancha"} · {shortDay(activeDate)}
                </span>
              </div>
              <dl className="admin-bk-ticket-rows">
                <div>
                  <dt>Cancha</dt>
                  <dd>
                    {court?.name || "—"}
                    {court?.type ? ` · ${court.type}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Día</dt>
                  <dd>{shortDay(activeDate)}</dd>
                </div>
                <div>
                  <dt>Horario</dt>
                  <dd>
                    {hasTime
                      ? `${selectedSlot.start} a ${selectedSlot.end} hs`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{isBlock ? "Motivo" : "A nombre de"}</dt>
                  <dd className={who ? undefined : "is-empty"}>
                    {who || "Falta completar"}
                  </dd>
                </div>
                {!isBlock && !modalForm.fullCourt && (
                  <div>
                    <dt>Pagan</dt>
                    <dd>
                      {modalForm.playersCount || 4} ×{" "}
                      {formatARS(modalRate.perPlayer)}
                    </dd>
                  </div>
                )}
                {modalForm.isRecurring && (
                  <div>
                    <dt>Turno fijo</dt>
                    <dd>{modalForm.recurringWeeks || "—"} semanas</dd>
                  </div>
                )}
              </dl>
              <div className="admin-bk-ticket-total">
                {isBlock ? (
                  <p className="admin-bk-ticket-block">
                    Cancha bloqueada · no se cobra
                  </p>
                ) : (
                  <>
                    <div className="admin-bk-ticket-amount">
                      <span>Total</span>
                      <strong>{formatARS(modalPrice)}</strong>
                    </div>
                    {deposit > 0 && (
                      <div className="admin-bk-ticket-deposit">
                        <span>Seña sugerida ({clubConfig.depositPct}%)</span>
                        <strong>{formatARS(deposit)}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <BusyButton
              type="submit"
              className="btn btn-linear-primary admin-detail-submit admin-bk-submit"
              disabled={modalSubmitting}
              busy={modalSubmitting}
            >
              <span className="admin-bk-submit-label">
                {modalSubmitting
                  ? "Guardando…"
                  : isBlock
                    ? "Bloquear la cancha"
                    : modalForm.isRecurring
                      ? "Guardar turno fijo"
                      : "Guardar la reserva"}
              </span>
              {!isBlock && !modalSubmitting && (
                <span className="admin-bk-submit-price" aria-hidden="true">
                  {formatARS(modalPrice)}
                </span>
              )}
            </BusyButton>
          </aside>
        </form>
      </div>
    </div>
  );
}
