"use client";

import { useState } from "react";
import StaffPinModal from "./StaffPinModal";
import MultaChoice from "./MultaChoice";
import { adminCancelBooking } from "../actions";
import { penaltyFor } from "../../../lib/clubConfig";
import { paidAmount, slotValue } from "../../../lib/metrics";

/**
 * Cancelar un turno (con PIN): libera la cancha y, si corresponde, deja una
 * multa por cancelar sobre la hora. Para un bloqueo de cancha o un turno de
 * prueba no se ofrece multa.
 *
 * @param {{
 *   booking: object,
 *   clubConfig: object,
 *   onClose: () => void,
 *   onDone: (res: { staff: string, penalty: object|null }) => void,
 * }} props
 */
export default function CancelBookingModal({ booking, clubConfig, onClose, onDone }) {
  const value = slotValue(booking);
  const pct = Number.isFinite(Number(clubConfig?.penaltyPct))
    ? Number(clubConfig.penaltyPct)
    : 50;
  const suggested = penaltyFor(clubConfig, value);
  const canPenalize =
    booking.status !== "bloqueado" && !booking.isTest && value > 0 && suggested > 0;
  const [mode, setMode] = useState("sin");
  const [amount, setAmount] = useState(String(suggested));

  const isBlock = booking.status === "bloqueado";

  return (
    <StaffPinModal
      isOpen
      title={isBlock ? "Liberar la cancha" : "Cancelar turno"}
      description={
        isBlock
          ? `¿Sacás el bloqueo de las ${booking.startTime} hs y liberás la cancha?`
          : `¿Cancelás el turno de ${booking.playerName || "este cliente"} de las ${booking.startTime} hs y liberás la cancha?`
      }
      confirmButtonText={
        isBlock
          ? "Liberar"
          : mode === "multa"
            ? "Cancelar con multa"
            : "Cancelar turno"
      }
      confirmButtonTone="danger"
      onClose={onClose}
      onConfirm={async ({ pin, reason }) => {
        const withPenalty = canPenalize && mode === "multa";
        if (withPenalty) {
          const n = Math.round(Number(amount));
          if (!(n > 0)) throw new Error("Ingresá el monto de la multa.");
          if (n > value) {
            throw new Error("La multa no puede ser mayor al valor del turno.");
          }
        }
        const res = await adminCancelBooking({
          bookingId: booking.id,
          pin,
          reason,
          ...(withPenalty ? { penaltyAmount: Math.round(Number(amount)) } : {}),
        });
        if (!res.ok) throw new Error(res.error || "No se pudo cancelar el turno.");
        onDone(res);
      }}
    >
      {canPenalize && (
        <MultaChoice
          value={value}
          pct={pct}
          suggested={suggested}
          paid={paidAmount(booking)}
          isFixed={Boolean(booking.recurringId)}
          mode={mode}
          onMode={setMode}
          amount={amount}
          onAmount={setAmount}
        />
      )}
    </StaffPinModal>
  );
}
