"use client";

import { useState } from "react";
import { depositFor, slotTimesFor } from "../../lib/clubConfig";
import { formatARS } from "../../lib/format";
import { toWhatsappNumber } from "../../lib/phone";
import { categorizeClient } from "../../lib/clientsExport";
import {
  adminMoveBooking,
  adminSettleCantinaSale,
  adminDeleteBooking,
  adminSetBookingPlayers,
} from "./actions";
import { readPlayerNames } from "../../lib/playerNames";
import PlayerNamesFields from "./ui/PlayerNamesFields";
import { bookingTotal, onAccountTotal } from "../../lib/metrics";
import { formatDate, plural } from "../../lib/format";
import StaffPinModal from "./ui/StaffPinModal";
import {
  IconClose,
  IconTrash,
  PAYMENT_METHODS,
  WhatsAppMiniIcon,
  paidAmount,
  pendingAmount,
  buildReminderMessage,
  buildDepositRequestMessage,
  buildConfirmationMessage,
} from "./adminHelpers";

/**
 * Detalle de un turno. Ordenado por la pregunta que se hace el dueño:
 * "¿me pagó?" → cartel grande con lo que debe y cobro de un toque por
 * medio de pago. Lo que se usa poco (mover, cancelar, eliminar) va plegado
 * en "Más opciones" para que no se toque sin querer.
 */
export default function BookingDetailModal({
  booking,
  clubConfig,
  clients = [],
  paymentForm,
  setPaymentForm,
  paymentSubmitting,
  onClose,
  onAddPayment,
  onRemovePayment,
  onCancel,
  onCancelSeries,
  onToggleTest,
  onMoved,
  onDeletedBooking,
  sales = [],
  onSalesChanged,
  onToast,
  onBookingChanged,
}) {
  const [isMoving, setIsMoving] = useState(false);
  const [isOtherAmount, setIsOtherAmount] = useState(false);
  const [isDeletePinOpen, setIsDeletePinOpen] = useState(false);
  const [moveCourtId, setMoveCourtId] = useState(booking.courtId || "cancha-1");
  const [moveDate, setMoveDate] = useState(booking.date || "");
  const [moveStartTime, setMoveStartTime] = useState(
    booking.startTime || "14:00",
  );
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState("");
  // Jugadores: lo guardado se muestra al toque, sin esperar que se recargue
  // el día (savedPlayers pisa lo que trae el turno hasta entonces).
  const [savedPlayers, setSavedPlayers] = useState(null);
  const [playersDraft, setPlayersDraft] = useState(null);
  const [playersSaving, setPlayersSaving] = useState(false);
  const playerNames = savedPlayers ?? readPlayerNames(booking);

  async function savePlayers(e) {
    e.preventDefault();
    setPlayersSaving(true);
    const res = await adminSetBookingPlayers(booking.id, playersDraft || []);
    setPlayersSaving(false);
    if (!res.ok) {
      onToast?.(res.error || "No se pudieron guardar los jugadores.", {
        tone: "error",
      });
      return;
    }
    setSavedPlayers(res.playerNames);
    setPlayersDraft(null);
    onToast?.("Jugadores guardados");
    onBookingChanged?.();
  }

  async function handleMoveSubmit(e) {
    e.preventDefault();
    setMoveSubmitting(true);
    setMoveError("");

    try {
      const res = await adminMoveBooking({
        bookingId: booking.id,
        oldDate: booking.date,
        oldCourtId: booking.courtId,
        oldStartTime: booking.startTime,
        newDate: moveDate,
        newCourtId: moveCourtId,
        newStartTime: moveStartTime,
      });

      if (!res.ok) {
        setMoveError(res.error || "No se pudo mover el turno.");
        setMoveSubmitting(false);
        return;
      }

      if (onMoved) {
        onMoved();
      } else {
        onClose();
        window.location.reload();
      }
    } catch (err) {
      setMoveError(err.message || "Error al procesar el traslado.");
      setMoveSubmitting(false);
    }
  }

  const clientData = (clients || []).find(
    (c) =>
      (booking.playerPhone && c.phone && c.phone === booking.playerPhone) ||
      (booking.playerName &&
        c.name &&
        c.name.toLowerCase() === booking.playerName.toLowerCase()),
  );
  const clientCat = clientData ? categorizeClient(clientData.count) : null;
  const moveTimes = moveDate
    ? slotTimesFor(clubConfig, moveDate).map((s) => s.start)
    : [];
  const accountSales = sales.filter(
    (s) => s.method === "cuenta" && s.chargeTo === booking.id && !s.voided,
  );
  // bookingTotal y no booking.total: los turnos web no guardan total y se
  // valúan con la tarifa del horario (antes el detalle mostraba "Total $0").
  const total = bookingTotal(booking);
  const paid = paidAmount(booking);
  const pending = pendingAmount(booking);
  // Seña según el % de Configuración (antes fija en $15.000).
  const deposit = depositFor(clubConfig, total);
  const phone = booking.playerPhone
    ? toWhatsappNumber(booking.playerPhone)
    : null;
  const waLink = (text) =>
    `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  const isCancelled = booking.status === "cancelado";

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div
        className="admin-modal-card admin-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-detail-head">
          <div>
            <p className="admin-detail-when admin-detail-court">
              {booking.courtName} · {formatDate(booking.date)} ·{" "}
              {booking.startTime}
              {booking.endTime ? ` a ${booking.endTime}` : ""} hs
            </p>
            <h3 id="admin-detail-title" className="admin-detail-name">
              {booking.playerName}
            </h3>
            <div className="admin-detail-tags">
              {booking.isTest && (
                <span className="admin-detail-tag">Prueba</span>
              )}
              {isCancelled && (
                <span className="admin-detail-tag is-danger">Cancelado</span>
              )}
              {clientCat?.category === "VIP" && (
                <span
                  className="admin-detail-tag is-vip"
                  title={`${plural(clientData.count, "turno jugado", "turnos jugados")} en Muzzaga`}
                >
                  Cliente VIP · {plural(clientData.count, "turno", "turnos")}
                </span>
              )}
              {clientCat?.category === "Frecuente" && (
                <span className="admin-detail-tag">
                  Viene seguido · {plural(clientData.count, "turno", "turnos")}
                </span>
              )}
              {clientCat?.category === "Nuevo" && (
                <span className="admin-detail-tag is-new">Primera vez</span>
              )}
              {booking.recurringId && (
                <span className="admin-detail-tag is-fixed">
                  Turno fijo (todas las semanas)
                </span>
              )}
            </div>
            {booking.playerPhone && (
              <p className="admin-detail-phone">Tel. {booking.playerPhone}</p>
            )}
            {booking.notes && (
              <p className="admin-detail-notes">Nota: {booking.notes}</p>
            )}
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

        {/* Quiénes juegan: opcional, además del que reserva. Los bloqueos
            de cancha no llevan. */}
        {booking.status !== "bloqueado" && (
          <div className="admin-detail-players">
            {playersDraft ? (
              <form onSubmit={savePlayers} className="admin-players">
                <span className="admin-field-label">
                  Quiénes juegan con {booking.playerName}
                </span>
                <PlayerNamesFields
                  idPrefix="admin-detail-player"
                  value={playersDraft}
                  onChange={setPlayersDraft}
                />
                <div className="admin-detail-row">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPlayersDraft(null)}
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    className="btn btn-linear-primary"
                    disabled={playersSaving}
                  >
                    {playersSaving ? "Guardando…" : "Guardar jugadores"}
                  </button>
                </div>
              </form>
            ) : playerNames.length > 0 ? (
              <div className="admin-players-view">
                <span className="admin-field-label">Juegan</span>
                <ul className="admin-players-list">
                  <li className="is-owner" title="Hizo la reserva">
                    {booking.playerName}
                  </li>
                  {playerNames.map((name, i) => (
                    <li key={`${name}-${i}`}>{name}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="admin-detail-link admin-players-toggle"
                  onClick={() => setPlayersDraft(playerNames)}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="admin-detail-link admin-players-toggle"
                onClick={() => setPlayersDraft([])}
              >
                + Anotar quiénes juegan (opcional)
              </button>
            )}
          </div>
        )}

        {/* ¿ME PAGÓ? */}
        {booking.isTest ? (
          <div className="admin-detail-money">
            <strong>Turno de prueba</strong>
            <span>No suma en la caja ni en los números del mes.</span>
          </div>
        ) : (
          !isCancelled && (
            <div
              className={`admin-detail-money${pending > 0 ? " is-owing" : " is-paid"}`}
            >
              <strong>
                {pending > 0
                  ? `Debe ${formatARS(pending)}`
                  : "✓ Pagado completo"}
              </strong>
              <span>
                Turno {formatARS(total)} · Ya pagó {formatARS(paid)}
              </span>
              {/* Con seña: cuánto del turno ya está cobrado, de un vistazo. */}
              {pending > 0 && paid > 0 && total > 0 && (
                <span className="admin-detail-progress" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.round((paid / total) * 100))}%` }} />
                </span>
              )}
            </div>
          )
        )}

        {!isCancelled && pending > 0 && (
          <div className="admin-detail-pay">
            <p className="admin-detail-question">
              ¿Cómo te pagó los {formatARS(pending)}?
            </p>
            <div className="admin-detail-pay-methods">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className="admin-detail-pay-btn"
                  disabled={paymentSubmitting}
                  onClick={() =>
                    onAddPayment(null, { method: m.value, amount: pending })
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>

            {!isOtherAmount ? (
              <button
                type="button"
                className="admin-detail-link"
                onClick={() => setIsOtherAmount(true)}
              >
                Pagó solo una parte (por ejemplo, la seña)
              </button>
            ) : (
              <form onSubmit={onAddPayment} className="admin-detail-partial">
                <label>
                  <span className="admin-field-label">¿Cuánto pagó?</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    className="admin-input-field"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, amount: e.target.value })
                    }
                    autoFocus
                  />
                </label>
                {deposit > 0 && deposit < pending && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      setPaymentForm({
                        ...paymentForm,
                        amount: String(deposit),
                      })
                    }
                  >
                    Poner la seña ({formatARS(deposit)})
                  </button>
                )}
                <label>
                  <span className="admin-field-label">¿Con qué pagó?</span>
                  <select
                    className="admin-modal-select"
                    value={paymentForm.method}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, method: e.target.value })
                    }
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="btn btn-linear-primary admin-detail-submit"
                  disabled={paymentSubmitting || !paymentForm.amount}
                >
                  {paymentSubmitting
                    ? "Guardando…"
                    : paymentForm.amount
                      ? `Anotar cobro de ${formatARS(paymentForm.amount)}`
                      : "Anotar cobro"}
                </button>
              </form>
            )}
          </div>
        )}

        {booking.payments && Object.keys(booking.payments).length > 0 && (
          <div className="admin-detail-section">
            <h4 className="admin-detail-subtitle">Pagos anotados</h4>
            <ul className="admin-detail-payments">
              {Object.entries(booking.payments)
                .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0))
                .map(([id, p]) => (
                  <li key={id}>
                    <span>
                      {PAYMENT_METHODS.find((m) => m.value === p.method)
                        ?.label || p.method}
                    </span>
                    <strong>{formatARS(Number(p.amount))}</strong>
                    <button
                      type="button"
                      className="admin-detail-link is-danger"
                      onClick={() => onRemovePayment(id)}
                    >
                      Borrar
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {accountSales.length > 0 && (
          <div className="admin-account-block">
            <div className="admin-account-head">
              <strong>Lo que consumió en la cantina (a cuenta)</strong>
              <strong>{formatARS(onAccountTotal(accountSales))}</strong>
            </div>
            <ul>
              {accountSales.map((sale) => (
                <li key={sale.id}>
                  <span>
                    {(sale.items || [])
                      .map((it) => `${it.qty}× ${it.name}`)
                      .join(", ")}
                  </span>
                  <strong>{formatARS(sale.total)}</strong>
                  <select
                    aria-label="Cobrar consumo con"
                    value=""
                    onChange={async (e) => {
                      const how = e.target.value;
                      if (!how) return;
                      const res = await adminSettleCantinaSale(sale.id, how);
                      if (res.ok) {
                        onToast?.(`Consumo cobrado · ${formatARS(sale.total)}`);
                        onSalesChanged?.();
                      } else {
                        onToast?.(
                          res.error || "No se pudo cobrar el consumo.",
                          { tone: "error" },
                        );
                      }
                    }}
                  >
                    <option value="">Cobrar con…</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )}

        {phone && (
          <div className="admin-detail-section">
            <h4 className="admin-detail-subtitle">Mandarle un WhatsApp</h4>
            <div className="admin-detail-wa">
              <a href={waLink()} target="_blank" rel="noopener">
                <WhatsAppMiniIcon size={18} /> Abrir el chat
              </a>
              <a
                href={waLink(buildReminderMessage(booking))}
                target="_blank"
                rel="noopener"
              >
                Recordarle el turno
              </a>
              {pending > 0 && (
                <a
                  href={waLink(
                    buildDepositRequestMessage(
                      booking,
                      clubConfig.paymentAlias,
                      deposit,
                    ),
                  )}
                  target="_blank"
                  rel="noopener"
                >
                  Pedirle la seña
                </a>
              )}
              <a
                href={waLink(buildConfirmationMessage(booking))}
                target="_blank"
                rel="noopener"
              >
                Confirmarle el turno
              </a>
            </div>
          </div>
        )}

        <details className="admin-detail-more">
          <summary>Más opciones (cambiar horario, cancelar…)</summary>

          <div className="admin-detail-more-body">
            {!isMoving ? (
              <button
                type="button"
                className="btn btn-secondary admin-detail-wide"
                onClick={() => {
                  setIsMoving(true);
                  setMoveError("");
                }}
              >
                Cambiar de cancha, día u horario
              </button>
            ) : (
              <form onSubmit={handleMoveSubmit} className="admin-detail-move">
                <p className="admin-detail-hint">
                  El turno se pasa al nuevo horario con la seña y los pagos que
                  ya tiene.
                </p>

                {moveError && (
                  <div className="admin-detail-error" role="alert">
                    {moveError}
                  </div>
                )}

                <label>
                  <span className="admin-field-label">Cancha</span>
                  <select
                    className="admin-modal-select"
                    value={moveCourtId}
                    onChange={(e) => setMoveCourtId(e.target.value)}
                  >
                    {clubConfig.courts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.type ? `${c.name} (${c.type})` : c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="admin-field-label">Día</span>
                  <input
                    type="date"
                    className="admin-input-field"
                    value={moveDate}
                    onChange={(e) => setMoveDate(e.target.value)}
                    required
                  />
                </label>
                <label>
                  <span className="admin-field-label">Horario</span>
                  <select
                    className="admin-modal-select"
                    value={moveStartTime}
                    onChange={(e) => setMoveStartTime(e.target.value)}
                  >
                    {moveTimes.length === 0 && (
                      <option value="">Ese día el club no abre</option>
                    )}
                    {moveTimes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="admin-detail-row">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsMoving(false)}
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    className="btn btn-linear-primary"
                    disabled={moveSubmitting}
                  >
                    {moveSubmitting ? "Cambiando…" : "Guardar el cambio"}
                  </button>
                </div>
              </form>
            )}

            {!isCancelled && (
              <button
                type="button"
                className="admin-detail-danger"
                onClick={() => {
                  onCancel(booking.id, booking.courtId, booking.startTime);
                  onClose();
                }}
              >
                <IconTrash size={14} /> Cancelar este turno (libera la cancha)
              </button>
            )}

            {booking.recurringId && onCancelSeries && (
              <button
                type="button"
                className="admin-detail-danger"
                onClick={() => {
                  onCancelSeries(booking.recurringId, booking.playerName);
                  onClose();
                }}
              >
                <IconTrash size={14} /> Cancelar el turno fijo de todas las
                semanas
              </button>
            )}

            {onToggleTest && (
              <button
                type="button"
                className="btn btn-secondary admin-detail-wide"
                onClick={() => onToggleTest(booking)}
                title="Los datos de prueba siguen ocupando el horario pero no suman en caja, reportes ni clientes"
              >
                {booking.isTest
                  ? "Es un turno real (que cuente en la caja)"
                  : "Es una prueba (que no cuente en la caja)"}
              </button>
            )}

            <button
              type="button"
              className="admin-detail-danger is-strong"
              onClick={() => setIsDeletePinOpen(true)}
            >
              <IconTrash size={14} /> Borrar el turno para siempre
            </button>
          </div>
        </details>
      </div>

      {isDeletePinOpen && (
        <StaffPinModal
          isOpen={isDeletePinOpen}
          title="Borrar el turno para siempre"
          description={`¿Seguro que querés borrar el turno de ${booking.playerName}? Se libera la cancha y el turno desaparece del sistema. No se puede deshacer.`}
          targetName={`${booking.playerName} · ${booking.courtName} (${booking.date} ${booking.startTime} hs)`}
          confirmButtonText="Sí, borrar"
          confirmButtonTone="danger"
          onClose={() => setIsDeletePinOpen(false)}
          onConfirm={async ({ pin, reason }) => {
            const res = await adminDeleteBooking({
              bookingId: booking.id,
              pin,
              reason,
            });
            if (res.ok) {
              setIsDeletePinOpen(false);
              onToast?.(`Turno borrado por ${res.staff}`);
              onDeletedBooking?.();
              onClose();
            } else {
              throw new Error(res.error || "No se pudo borrar el turno.");
            }
          }}
        />
      )}
    </div>
  );
}
