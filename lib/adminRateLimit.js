import { headers } from "next/headers";
import { getDb, isFirebaseConfigured } from "./firebase";
import {
  ATTEMPT_LIMITS,
  hashIp,
  hitRateLimit,
  nextAttemptRecord,
} from "./rateLimit";

/**
 * Límite de intentos del login del panel y de los PINs de equipo.
 *
 * El check de contraseña es un HMAC contra una sola constante, así que sin
 * freno se puede probar en bucle. Guardamos el contador en Realtime Database
 * (no en memoria) porque en Vercel cada request puede caer en una instancia
 * distinta y un contador local se reinicia solo.
 *
 * El intento se cuenta con una transacción ANTES de verificar la clave: así
 * una ráfaga de requests en paralelo no puede pasar todas con el contador en
 * cero. Si la clave es correcta, el caller limpia el contador.
 *
 * Si Firebase no está configurado caemos a un Map en memoria: peor, pero mejor
 * que nada en desarrollo.
 *
 * La IP sale de x-forwarded-for / x-real-ip: en Vercel los pone la plataforma
 * y no se pueden falsificar. Fuera de Vercel habría que confiar solo en un
 * proxy propio.
 */

const memoryStore = new Map();

/** Hasheamos la IP: sirve para contar sin guardar el dato personal en claro. */
async function clientKey() {
  const h = await headers();
  const raw =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "desconocida";
  return hashIp(raw);
}

/**
 * Límite de envíos públicos (createBooking, joinOpenMatch, createOpenMatch).
 * Comparte el hash de IP con el login; los topes viven en lib/rateLimit.js.
 * `subject` limita por otra clave (ej. el teléfono) en vez de por IP.
 */
export async function checkPublicRateLimit(action, subject = null) {
  if (!isFirebaseConfigured()) return { allowed: true };
  try {
    const key = subject ? hashIp(subject) : await clientKey();
    return await hitRateLimit(getDb(), action, key);
  } catch (err) {
    // Fail-open, igual que hitRateLimit cuando la base no responde.
    console.warn(
      `Rate limit ${action}: no se pudo evaluar, se permite`,
      err.message,
    );
    return { allowed: true };
  }
}

function blockedMessage(lockedUntil) {
  const min = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
  return `Demasiados intentos fallidos. Probá de nuevo en ${min} minuto${
    min === 1 ? "" : "s"
  }.`;
}

/** Cuenta un intento en la clave dada. → { allowed, record } */
async function countAttempt(key, limits) {
  const now = Date.now();
  if (isFirebaseConfigured()) {
    try {
      const res = await getDb()
        .ref(`adminLoginAttempts/${key}`)
        .transaction((current) => nextAttemptRecord(current, now, limits));
      return { allowed: Boolean(res.committed), record: res.snapshot.val() };
    } catch (err) {
      console.warn("Rate limit: no se pudo usar Firebase", err.message);
    }
  }
  const record = nextAttemptRecord(memoryStore.get(key), now, limits);
  if (record) memoryStore.set(key, record);
  return { allowed: Boolean(record), record: record || memoryStore.get(key) };
}

async function readRecord(key) {
  if (!isFirebaseConfigured()) return memoryStore.get(key) || null;
  try {
    const snap = await getDb().ref(`adminLoginAttempts/${key}`).get();
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    console.warn("Rate limit: no se pudo leer de Firebase", err.message);
    return memoryStore.get(key) || null;
  }
}

async function clearRecord(key) {
  memoryStore.delete(key);
  if (!isFirebaseConfigured()) return;
  try {
    await getDb().ref(`adminLoginAttempts/${key}`).remove();
  } catch (err) {
    console.warn("Rate limit: no se pudo limpiar en Firebase", err.message);
  }
}

/**
 * Se llama antes de validar la contraseña (scope "login") o un PIN de staff
 * (scope "pin"): cada uno lleva su propio contador. Esta llamada YA cuenta el
 * intento; si la clave es correcta, el caller llama clearLoginAttempts.
 */
export async function checkLoginAllowed(scope = "login") {
  const ipKey = await clientKey();
  const key = scope === "login" ? ipKey : `${scope}-${ipKey}`;
  if (process.env.NODE_ENV !== "production") {
    return { allowed: true, key };
  }
  const limits = ATTEMPT_LIMITS[scope] || ATTEMPT_LIMITS.login;
  const mine = await countAttempt(key, limits);
  if (!mine.allowed) {
    return {
      allowed: false,
      error: blockedMessage(mine.record?.lockedUntil || Date.now()),
    };
  }
  if (scope === "pin") {
    const all = await countAttempt("pin-global", ATTEMPT_LIMITS.pinGlobal);
    if (!all.allowed) {
      return {
        allowed: false,
        error: blockedMessage(all.record?.lockedUntil || Date.now()),
      };
    }
  }
  return { allowed: true, key };
}

/** Arma el mensaje de un intento fallido (el intento ya fue contado). */
export async function registerFailedLogin(
  key,
  label = "Contraseña incorrecta",
) {
  const record = await readRecord(key);
  const { max, lockMs } = ATTEMPT_LIMITS.login;
  const count = record?.count || 0;
  const restantes = max - count;
  if (record?.lockedUntil && Date.now() < record.lockedUntil) {
    return `Demasiados intentos fallidos. El acceso queda bloqueado por ${lockMs / 60000} minutos.`;
  }
  if (count > 0 && restantes <= 2) {
    return `${label}. Te ${restantes === 1 ? "queda" : "quedan"} ${restantes} intento${
      restantes === 1 ? "" : "s"
    } antes del bloqueo.`;
  }
  return `${label}.`;
}

export async function clearLoginAttempts(key) {
  await clearRecord(key);
}
