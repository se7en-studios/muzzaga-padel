"use client";

import {
  MAX_PLAYER_NAMES,
  PLAYER_NAME_MAX_LENGTH,
} from "../../../lib/playerNames";

/**
 * Cuatro casilleros para anotar quiénes juegan (además del que reserva).
 * `value` es una lista de hasta 4 textos; los vacíos se limpian al guardar.
 * La comparten "Nueva reserva" y el detalle del turno; ahí se pintan como
 * posiciones en una mini cancha (el número es el del jugador).
 */
export default function PlayerNamesFields({ value = [], onChange, idPrefix = "players" }) {
  const slots = Array.from({ length: MAX_PLAYER_NAMES }, (_, i) => value[i] ?? "");

  return (
    <div className="admin-players-fields">
      {slots.map((name, i) => (
        <label key={i} htmlFor={`${idPrefix}-${i}`}>
          <span className="sr-only">Jugador {i + 2}</span>
          <span className="admin-players-slot" aria-hidden="true">
            {i + 2}
          </span>
          <input
            id={`${idPrefix}-${i}`}
            type="text"
            autoComplete="off"
            maxLength={PLAYER_NAME_MAX_LENGTH}
            placeholder={`Jugador ${i + 2}`}
            className="admin-input-field"
            value={name}
            onChange={(e) => {
              const next = [...slots];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}
