"use client";

import { formatARS } from "../../../lib/format";

/**
 * Al cancelar un turno: ¿se cancela sin más o con multa por cancelar sobre
 * la hora (típico del turno fijo que cede el horario tarde)? La multa
 * sugerida es el % de Ajustes → Cobros sobre el valor del turno y se puede
 * corregir antes de confirmar. El horario se libera igual en los dos casos.
 *
 * @param {{
 *   value: number,          // valor del turno
 *   pct: number,            // % de multa de Ajustes
 *   suggested: number,      // multa sugerida (redondeada)
 *   paid?: number,          // lo que ya pagó (seña): cuenta para la multa
 *   isFixed?: boolean,      // turno fijo: aclara que es solo esta semana
 *   mode: "sin" | "multa",
 *   onMode: (mode: "sin" | "multa") => void,
 *   amount: string,
 *   onAmount: (v: string) => void,
 * }} props
 */
export default function MultaChoice({
  value,
  pct,
  suggested,
  paid = 0,
  isFixed = false,
  mode,
  onMode,
  amount,
  onAmount,
}) {
  const amountNum = Math.round(Number(amount) || 0);
  const tooHigh = value > 0 && amountNum > value;
  const remaining = Math.max(0, amountNum - paid);

  return (
    <fieldset className="admin-multa">
      <legend className="admin-field-label">¿Cobra multa?</legend>
      {isFixed && (
        <p className="admin-multa-note">
          Es un turno fijo: se cancela solo esta semana. Las demás siguen.
        </p>
      )}

      <label className={`admin-multa-opt${mode === "sin" ? " is-on" : ""}`}>
        <input
          type="radio"
          name="admin-multa-mode"
          value="sin"
          checked={mode === "sin"}
          onChange={() => onMode("sin")}
        />
        <span className="admin-multa-opt-body">
          <strong>Sin multa</strong>
          <small>
            Se libera la cancha y no se cobra nada
            {paid > 0 ? ` (lo que pagó, ${formatARS(paid)}, sale de la caja)` : ""}.
          </small>
        </span>
      </label>

      <label className={`admin-multa-opt is-multa${mode === "multa" ? " is-on" : ""}`}>
        <input
          type="radio"
          name="admin-multa-mode"
          value="multa"
          checked={mode === "multa"}
          onChange={() => onMode("multa")}
        />
        <span className="admin-multa-opt-body">
          <strong>
            Con multa por cancelar sobre la hora · {formatARS(suggested)}
          </strong>
          <small>
            {pct}% del turno de {formatARS(value)}. Se libera la cancha igual y
            la multa queda para cobrar.
          </small>
        </span>
      </label>

      {mode === "multa" && (
        <div className="admin-multa-amount">
          <label className="admin-field-label" htmlFor="admin-multa-input">
            Monto de la multa
          </label>
          <div className="admin-multa-amount-row">
            <span aria-hidden="true">$</span>
            <input
              id="admin-multa-input"
              type="number"
              inputMode="numeric"
              min="1"
              max={value || undefined}
              step="1"
              className="admin-input-field"
              value={amount}
              onChange={(e) => onAmount(e.target.value)}
              aria-invalid={tooHigh || amountNum <= 0}
            />
          </div>
          {tooHigh ? (
            <p className="admin-multa-warn" role="alert">
              No puede ser mayor al valor del turno ({formatARS(value)}).
            </p>
          ) : paid > 0 && amountNum > 0 ? (
            <p className="admin-multa-note">
              Ya pagó {formatARS(paid)} de seña: cuenta como parte de la multa.
              {remaining > 0
                ? ` Queda por cobrar ${formatARS(remaining)}.`
                : " La multa queda paga."}
            </p>
          ) : null}
        </div>
      )}
    </fieldset>
  );
}
