import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb, isFirebaseConfigured } from "./firebase";

/**
 * Sesión del panel de administración.
 *
 * El login viejo sólo escribía un flag en sessionStorage, así que la contraseña
 * protegía la pantalla pero no los datos: los server actions no verificaban
 * nada y eran invocables por cualquiera que mandara el POST. Acá emitimos una
 * cookie httpOnly firmada con HMAC que cada action valida antes de tocar la
 * base.
 *
 * La clave de firma sale de ADMIN_SESSION_SECRET (aparte de la contraseña, así
 * un token robado no sirve para adivinar la contraseña offline). Si esa
 * variable no está, se deriva de ADMIN_PASSWORD como antes.
 *
 * Cada sesión lleva un id (jti) guardado en Realtime Database: el logout lo
 * borra, así un token robado deja de valer al instante y no recién a las 8 h.
 */

const COOKIE_NAME = "muzzaga_admin_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 h: una jornada del club

/**
 * Sin ADMIN_PASSWORD no hay login posible, tampoco en desarrollo: una
 * contraseña por defecto conocida permitiría entrar y firmar cookies falsas.
 */
function adminSecret() {
  return (process.env.ADMIN_PASSWORD || "").trim() || null;
}

function signingKey() {
  const secret = adminSecret();
  if (!secret) return null;
  const sessionSecret = (process.env.ADMIN_SESSION_SECRET || "").trim();
  return createHmac("sha256", sessionSecret || secret)
    .update("muzzaga:admin:session:v2")
    .digest();
}

function sign(payload, key) {
  return createHmac("sha256", key).update(payload).digest("hex");
}

/** Comparación en tiempo constante; false si las longitudes difieren. */
function safeEquals(a, b) {
  const bufA = Buffer.from(String(a), "utf8");
  const bufB = Buffer.from(String(b), "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Compara la contraseña ingresada contra ADMIN_PASSWORD sin filtrar timing. */
export function passwordMatches(input) {
  const expected = adminSecret();
  if (!expected) return false;
  return safeEquals((input || "").trim(), expected);
}

const SESSIONS_PATH = "adminSessions";

/** Borra de la base las sesiones ya vencidas (se llama al iniciar sesión). */
async function pruneExpiredSessions(db) {
  const snap = await db.ref(SESSIONS_PATH).once("value");
  const now = Date.now();
  const updates = {};
  snap.forEach((child) => {
    if (!(Number(child.val()) > now)) updates[child.key] = null;
  });
  if (Object.keys(updates).length) await db.ref(SESSIONS_PATH).update(updates);
}

export async function createAdminSession() {
  const key = signingKey();
  if (!key) return false;

  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const jti = randomBytes(16).toString("hex");
  if (isFirebaseConfigured()) {
    try {
      const db = getDb();
      await db.ref(`${SESSIONS_PATH}/${jti}`).set(expiresAt);
      await pruneExpiredSessions(db).catch(() => {});
    } catch (err) {
      console.error("No se pudo registrar la sesión admin:", err.message);
      return false;
    }
  }
  const payload = `admin.${expiresAt}.${jti}`;
  const token = `${payload}.${sign(payload, key)}`;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  return true;
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  const jti = cookieStore.get(COOKIE_NAME)?.value?.split(".")[2];
  if (jti && /^[0-9a-f]{32}$/.test(jti) && isFirebaseConfigured()) {
    await getDb()
      .ref(`${SESSIONS_PATH}/${jti}`)
      .remove()
      .catch(() => {});
  }
  cookieStore.delete(COOKIE_NAME);
}

/** @returns {Promise<boolean>} true sólo si la cookie está firmada, vigente y no fue revocada. */
export async function isAdminAuthenticated() {
  const key = signingKey();
  if (!key) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 4) return false;

  const [prefix, expiresAt, jti, signature] = parts;
  if (prefix !== "admin" || !/^[0-9a-f]{32}$/.test(jti)) return false;

  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  if (!safeEquals(signature, sign(`admin.${expiresAt}.${jti}`, key))) {
    return false;
  }
  if (!isFirebaseConfigured()) return true;
  try {
    const snap = await getDb().ref(`${SESSIONS_PATH}/${jti}`).get();
    return snap.exists();
  } catch (err) {
    // Sin poder confirmar que la sesión sigue vigente, se niega el acceso.
    console.error("No se pudo validar la sesión admin:", err.message);
    return false;
  }
}

/**
 * Guard para los server actions. Devuelve null si la sesión es válida, o el
 * objeto de error que el action tiene que retornar tal cual.
 */
export async function requireAdmin() {
  if (await isAdminAuthenticated()) return null;
  return {
    ok: false,
    error: "Sesión expirada o inválida. Volvé a ingresar al panel.",
  };
}
