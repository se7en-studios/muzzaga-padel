import { createHash } from "node:crypto";

/**
 * Límite de envíos públicos (reservas, canchas abiertas) por IP hasheada.
 * Ventana fija guardada en RTDB con una transacción: en Vercel cada request
 * puede caer en otra instancia, así que un contador en memoria no sirve.
 * Sin Next ni Firebase importados acá para poder testearlo con un db falso.
 */

const MIN = 60 * 1000;
export const PUBLIC_LIMITS = {
  createBooking: { max: 5, windowMs: 10 * MIN },
  joinOpenMatch: { max: 10, windowMs: 10 * MIN },
  createOpenMatch: { max: 3, windowMs: 60 * MIN },
};

const DB_TIMEOUT_MS = 3000;

/** Hasheamos la IP: sirve para contar sin guardar el dato personal en claro. */
export function hashIp(raw) {
  return createHash("sha256")
    .update(raw || "desconocida")
    .digest("hex")
    .slice(0, 32);
}

/** Updater de la transacción: undefined = tope alcanzado (aborta). */
export function nextRecord(current, now, { max, windowMs }) {
  if (typeof current?.windowStart !== "number" || now - current.windowStart >= windowMs) {
    return { count: 1, windowStart: now };
  }
  if ((current.count || 0) >= max) return undefined;
  return { count: (current.count || 0) + 1, windowStart: current.windowStart };
}

/**
 * Suma un envío y dice si se permite. Si la base no responde, deja pasar
 * (fail-open): preferimos disponibilidad a bloquear reservas legítimas.
 */
export async function hitRateLimit(
  db,
  action,
  key,
  { now = Date.now(), timeoutMs = DB_TIMEOUT_MS } = {},
) {
  const limit = PUBLIC_LIMITS[action];
  if (!limit) throw new Error(`Rate limit desconocido: ${action}`);
  let timer;
  try {
    const tx = db
      .ref(`rateLimits/${action}/${key}`)
      .transaction((current) => nextRecord(current, now, limit));
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    });
    const result = await Promise.race([tx, timeout]);
    return { allowed: Boolean(result?.committed) };
  } catch (err) {
    console.warn(
      `Rate limit ${action}: base no disponible, se permite`,
      err.message,
    );
    return { allowed: true };
  } finally {
    clearTimeout(timer);
  }
}

export const RATE_LIMIT_ERROR =
  "Hiciste demasiados envíos seguidos. Esperá unos minutos y probá de nuevo.";
