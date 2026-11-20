// Nombres de los jugadores de un turno (opcional, solo se cargan desde el
// admin). Van aparte de `playerName` (quien reserva), que sigue siendo el
// dato de siempre: los turnos viejos no tienen este campo y no pasa nada.

/** Además del que reserva: en pádel juegan 4, así que con 4 alcanza y sobra. */
export const MAX_PLAYER_NAMES = 4;
export const PLAYER_NAME_MAX_LENGTH = 40;

/**
 * Limpia lo que manda el formulario: solo textos, espacios de más afuera,
 * sin vacíos, cada uno hasta 40 caracteres y como mucho 4. Se recorta en vez
 * de rechazar para no frenar al mostrador por un nombre largo.
 * @returns {string[]}
 */
export function normalizePlayerNames(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((n) => typeof n === "string")
    .map((n) => n.replace(/\s+/g, " ").trim().slice(0, PLAYER_NAME_MAX_LENGTH).trim())
    .filter(Boolean)
    .slice(0, MAX_PLAYER_NAMES);
}

/**
 * Lee los nombres guardados en un turno. Tolera turnos sin el campo y el
 * formato objeto ({0: "...", 1: "..."}) en que Firebase a veces devuelve
 * las listas.
 * @returns {string[]}
 */
export function readPlayerNames(booking) {
  const raw = booking?.playerNames;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : typeof raw === "object" ? Object.values(raw) : [];
  return normalizePlayerNames(list);
}
