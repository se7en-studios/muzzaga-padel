"use client";

import { useState } from "react";
import { priceFor, slotTimesFor } from "../../lib/clubConfig";
import { formatARS, formatDate } from "../../lib/format";
import { IconClose } from "./adminHelpers";
import PlayerNamesFields from "./ui/PlayerNamesFields";

/**
 * Nueva reserva o bloqueo de cancha. Solo dos tipos a propósito: los pagos
 * se anotan después desde el detalle del turno (marcar "pagado" acá dejaba
 * turnos pagos sin plata en la caja).
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

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div
        className="admin-modal-card admin-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-create-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-detail-head">
          <div>
            <p className="admin-detail-when">
              {formatDate(activeDate, "long")}
            </p>
            <h3 id="admin-create-title" className="admin-detail-name">
              {isBlock ? "Bloquear la cancha" : "Nueva reserva"}
            </h3>
          </div>
          <button
            type="button"
            className="admin-detail-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <IconClose size={16} /> Cerrar
          </button>
        </div>

        <form onSubmit={onSubmit} className="admin-create-form">
          <div
            className="admin-create-type"
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

          <div className="admin-create-row">
            {/* Las canchas como mini canchas para tocar, igual que en la
                agenda; con muchas canchas vuelve la lista desplegable. */}
            {clubConfig.courts.length <= 3 ? (
              <div className="admin-create-field">
                <span className="admin-field-label" id="admin-create-court">
                  Cancha
                </span>
                <div
                  className="admin-create-courts"
                  role="radiogroup"
                  aria-labelledby="admin-create-court"
                >
                  {clubConfig.courts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={modalForm.courtId === c.id}
                      className="admin-create-court"
                      onClick={() => set({ courtId: c.id })}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <label>
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

            <label>
              <span className="admin-field-label">Horario</span>
              <select
                className="admin-modal-select"
                value={modalForm.startTime}
                onChange={(e) => set({ startTime: e.target.value })}
              >
                {slotTimes.map(({ start: t, end }) => (
                  <option key={t} value={t}>
                    {t} a {end}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
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
              <label>
                <span className="admin-field-label">Teléfono (opcional)</span>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="Ej. 299 597 4176"
                  className="admin-input-field"
                  value={modalForm.playerPhone}
                  onChange={(e) => set({ playerPhone: e.target.value })}
                />
              </label>

              <label className="admin-create-check">
                <input
                  type="checkbox"
                  checked={modalForm.fullCourt}
                  onChange={(e) => set({ fullCourt: e.target.checked })}
                />
                <span>
                  Pagan la cancha entera ({formatARS(modalRate.total)})
                </span>
              </label>

              {/* Opcional: quiénes juegan, además del que reserva. */}
              {showPlayers ? (
                <fieldset className="admin-players">
                  <legend className="admin-field-label">
                    Quiénes juegan (opcional)
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
                  className="admin-detail-link admin-players-toggle"
                  onClick={() => setShowPlayers(true)}
                >
                  + Anotar los nombres de los jugadores (opcional)
                </button>
              )}

              {!modalForm.fullCourt && (
                <label>
                  <span className="admin-field-label">
                    ¿Cuántos jugadores pagan? ({formatARS(modalRate.perPlayer)}{" "}
                    cada uno)
                  </span>
                  <select
                    className="admin-modal-select"
                    value={modalForm.playersCount}
                    onChange={(e) =>
                      set({ playersCount: Number(e.target.value) })
                    }
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "jugador" : "jugadores"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          <label className="admin-create-check">
            <input
              type="checkbox"
              checked={modalForm.isRecurring}
              onChange={(e) => set({ isRecurring: e.target.checked })}
            />
            <span>Repetir todas las semanas (turno fijo)</span>
          </label>
          {modalForm.isRecurring && (
            <label>
              <span className="admin-field-label">¿Por cuántas semanas?</span>
              <input
                type="number"
                inputMode="numeric"
                min={2}
                max={26}
                className="admin-input-field"
                value={modalForm.recurringWeeks}
                onChange={(e) =>
                  set({ recurringWeeks: Number(e.target.value) })
                }
              />
              <span className="admin-detail-hint">
                Si alguna semana ese horario ya está ocupado o el club está
                cerrado, esa semana se saltea y te avisamos.
              </span>
            </label>
          )}

          <label>
            <span className="admin-field-label">Nota (opcional)</span>
            <input
              type="text"
              placeholder="Ej. Cumpleaños"
              className="admin-input-field"
              value={modalForm.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </label>

          <div className="admin-create-summary">
            <span className="admin-create-summary-when">
              <small>
                {clubConfig.courts.find((c) => c.id === modalForm.courtId)?.name ||
                  "Cancha"}
                {isBlock ? " · bloqueada" : ""}
              </small>
              {selectedSlot?.start} a {selectedSlot?.end} hs
            </span>
            {!isBlock && <strong>{formatARS(modalPrice)}</strong>}
          </div>

          <button
            type="submit"
            className="btn btn-linear-primary admin-detail-submit"
            disabled={modalSubmitting}
          >
            {modalSubmitting
              ? "Guardando…"
              : isBlock
                ? "Bloquear la cancha"
                : modalForm.isRecurring
                  ? "Guardar turno fijo"
                  : "Guardar la reserva"}
          </button>
        </form>
      </div>
    </div>
  );
}
