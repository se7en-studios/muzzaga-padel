"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Delete, KeyRound, ShieldAlert, X } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
const MAX_PIN = 6;

/**
 * Confirmación con PIN personal: identifica en el servidor a quién hace una
 * acción crítica (borrar, cancelar, cerrar caja). El PIN nunca se muestra ni
 * se valida en el navegador.
 *
 * Se monta en un portal (sobre .admin-root, o <body> si no está) para que
 * Esc y los clics no lleguen a los modales que tenga abajo.
 *
 * @param {{
 *   isOpen: boolean,
 *   title?: string,
 *   description?: import("react").ReactNode,
 *   targetName?: string,
 *   confirmButtonText?: string,
 *   confirmButtonTone?: "danger" | "primary",
 *   requireReason?: boolean,
 *   reasonLabel?: string,
 *   reasonPlaceholder?: string,
 *   onConfirm: (input: { pin: string, reason: string }) => Promise<void>,
 *   onClose: () => void,
 * }} props onConfirm tiene que lanzar un Error con el mensaje si falla.
 */
export default function StaffPinModal({
  isOpen,
  title = "Autorización del equipo",
  description,
  targetName,
  confirmButtonText = "Confirmar",
  confirmButtonTone = "danger",
  requireReason = false,
  reasonLabel,
  reasonPlaceholder = "ej. Cargado por error, pedido del cliente",
  onConfirm,
  onClose,
}) {
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pinRef = useRef(null);

  useEffect(() => {
    if (isOpen) pinRef.current?.focus();
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const isDanger = confirmButtonTone === "danger";
  const canSubmit =
    pin.length >= 4 && (!requireReason || reason.trim()) && !loading;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) {
      setError(
        pin.length < 4
          ? "Ingresá tu PIN (4 a 6 números)."
          : "Indicá el motivo.",
      );
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onConfirm({ pin, reason: reason.trim() });
    } catch (err) {
      setError(err?.message || "No se pudo completar la acción.");
      setPin("");
      pinRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  function press(key) {
    setError("");
    if (key === "del") setPin((p) => p.slice(0, -1));
    else if (key) setPin((p) => (p.length < MAX_PIN ? p + key : p));
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!loading) onClose();
    }
  }

  return createPortal(
    <div
      className="admin-root admin-pin-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      onKeyDown={handleKeyDown}
      data-admin-modal
    >
      <div
        className={`admin-pin-card${isDanger ? " is-danger" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-pin-title"
      >
        <div className="admin-pin-head">
          <span className="admin-pin-head-icon" aria-hidden>
            {isDanger ? <ShieldAlert size={18} /> : <KeyRound size={18} />}
          </span>
          <div>
            <h3 id="staff-pin-title">{title}</h3>
            <span>Tu PIN deja registrado quién hizo este cambio</span>
          </div>
          <button
            type="button"
            className="admin-pin-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-pin-body">
          {description && <div className="admin-pin-desc">{description}</div>}
          {targetName && (
            <div className="admin-pin-target">
              <span>Elemento</span>
              <strong>{targetName}</strong>
            </div>
          )}

          <label className="admin-field-label" htmlFor="staff-pin-input">
            PIN personal
          </label>
          <input
            id="staff-pin-input"
            ref={pinRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={MAX_PIN}
            className="admin-pin-input"
            placeholder="••••"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, MAX_PIN));
              setError("");
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "staff-pin-error" : undefined}
          />

          <div className="admin-pin-keypad" aria-hidden="true">
            {KEYS.map((k, i) =>
              k ? (
                <button
                  key={k}
                  type="button"
                  tabIndex={-1}
                  onClick={() => press(k)}
                  disabled={loading}
                  className={k === "del" ? "is-del" : undefined}
                >
                  {k === "del" ? <Delete size={16} /> : k}
                </button>
              ) : (
                <span key={`gap-${i}`} />
              ),
            )}
          </div>

          <label className="admin-field-label" htmlFor="staff-reason-input">
            {reasonLabel ||
              (requireReason ? "Motivo (obligatorio)" : "Motivo (opcional)")}
          </label>
          <input
            id="staff-reason-input"
            type="text"
            maxLength={120}
            className="admin-input-field"
            placeholder={reasonPlaceholder}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError("");
            }}
            required={requireReason}
          />

          {error && (
            <div id="staff-pin-error" role="alert" className="admin-pin-error">
              {error}
            </div>
          )}

          <div className="admin-pin-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`btn admin-pin-submit${isDanger ? " is-danger" : ""}`}
              disabled={!canSubmit}
            >
              {loading ? "Verificando…" : confirmButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>,
    // Dentro de .admin-root (y no suelto en <body>) para heredar la fuente
    // Inter del panel; si no está, como antes, en <body>.
    document.querySelector(".admin-root") || document.body,
  );
}
