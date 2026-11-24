"use client";

import { useState } from "react";
import StaffPinModal from "./StaffPinModal";
import { adminSetBookingPenalty } from "../actions";
import { penaltyFor } from "../../../lib/clubConfig";
import { formatARS } from "../../../lib/format";
import { hasPenalty, paidAmount, slotValue } from "../../../lib/metrics";

/**
 * Multa de un turno YA cancelado, con PIN: ponerla (si se decide después de
 * cancelar), corregir el monto o sacarla. Sacarla solo se puede si todavía
 * no tiene cobros (el servidor lo vuelve a controlar).
 *
 * @param {{
 *   booking: object,
 *   clubConfig: object,
 *   action: "poner" | "sacar",
 *   onClose: () => void,
 *   onDone: (res: { staff: string, penalty: object|null }) => void,
 * }} props
 */
export default function PenaltyEditModal({ booking, clubConfig, action, onClose, onDone }) {
  const value = slotValue(booking);
  const current = hasPenalty(booking) ? Number(booking.penalty.amount) : 0;
  const suggested = penaltyFor(clubConfig, value);
  const [amount, setAmount] = useState(String(current || suggested));
  const pct = Number.isFinite(Number(clubConfig?.penaltyPct))
    ? Number(clubConfig.penaltyPct)
    : 50;
  const paid = paidAmount(booking);
  const removing = action === "sacar";
  const amountNum = Math.round(Number(amount) || 0);
  const tooHigh = value > 0 && amountNum > value;

  return (
    <StaffPinModal
      isOpen
      title={
        removing
          ? "Sacar la multa"
          : current
            ? "Corregir la multa"
            : "Cobrar multa por cancelar sobre la hora"
      }
      description={
        removing
          ? `¿Sacás la multa de ${formatARS(current)} del turno de ${booking.playerName}? Deja de figurar como deuda.`
          : `Turno de ${booking.playerName} del ${booking.date} a las ${booking.startTime} hs (ya cancelado). La multa queda para cobrar.`
      }
      confirmButtonText={removing ? "Sacar la multa" : current ? "Guardar el monto" : "Poner la multa"}
      confirmButtonTone={removing ? "danger" : "primary"}
      onClose={onClose}
      onConfirm={async ({ pin }) => {
        if (!removing) {
          if (!(amountNum > 0)) throw new Error("Ingresá el monto de la multa.");
          if (tooHigh) throw new Error("La multa no puede ser mayor al valor del turno.");
        }
        const res = await adminSetBookingPenalty({
          bookingId: booking.id,
          pin,
          amount: removing ? 0 : amountNum,
        });
        if (!res.ok) throw new Error(res.error || "No se pudo guardar la multa.");
        onDone(res);
      }}
    >
      {!removing && (
        <div className="admin-multa">
          <div className="admin-multa-amount">
            <label className="admin-field-label" htmlFor="admin-multa-edit">
              Monto de la multa
            </label>
            <div className="admin-multa-amount-row">
              <span aria-hidden="true">$</span>
              <input
                id="admin-multa-edit"
                type="number"
                inputMode="numeric"
                min="1"
                max={value || undefined}
                step="1"
                className="admin-input-field"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={tooHigh || amountNum <= 0}
              />
            </div>
            {tooHigh ? (
              <p className="admin-multa-warn" role="alert">
                No puede ser mayor al valor del turno ({formatARS(value)}).
              </p>
            ) : (
              <p className="admin-multa-note">
                Sugerida: {formatARS(suggested)} ({pct}% del turno de {formatARS(value)}).
                {paid > 0 ? ` Ya pagó ${formatARS(paid)}: cuenta como parte de la multa.` : ""}
              </p>
            )}
          </div>
        </div>
      )}
    </StaffPinModal>
  );
}
