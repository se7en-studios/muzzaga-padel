// Equipo del club y PINs que identifican quién hizo cada cambio.
// Solo servidor: nunca importar desde un componente "use client", el material
// de los PINs no puede llegar al navegador. El equipo vive en Firebase
// (`staffMembers`) y se administra desde Configuración → Equipo.
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export const STAFF_PIN = /^\d{4,6}$/;
export const STAFF_ROLES = [
  "Administrador",
  "Encargado",
  "Recepción",
  "Cantina",
  "Profesor",
];

const SCRYPT_ALGO = "scrypt";

// Un PIN de 4 dígitos tiene solo 10.000 combinaciones: scrypt (lento a
// propósito) hace que probarlas todas contra una copia de la base lleve
// mucho más que con un hash rápido. El freno online sigue siendo el rate
// limit (adminRateLimit, scope "pin").
function hashWith(algo, pin, salt) {
  if (algo === SCRYPT_ALGO) {
    return scryptSync(String(pin), String(salt), 32).toString("hex");
  }
  // Registros viejos (antes de scrypt): se migran al primer PIN correcto.
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

/** Sal + hash listos para guardar; nunca incluyen el PIN en claro. */
export function hashPinFields(pin) {
  const salt = randomBytes(16).toString("hex");
  return {
    salt,
    pinHash: hashWith(SCRYPT_ALGO, pin, salt),
    pinAlgo: SCRYPT_ALGO,
  };
}

/** Registro listo para guardar en Firebase: nunca incluye el PIN en claro. */
export function makeStaffRecord({ name, role, pin }) {
  return {
    name: String(name || "")
      .trim()
      .slice(0, 40),
    role: STAFF_ROLES.includes(role) ? role : "Recepción",
    ...hashPinFields(String(pin)),
  };
}

function pinMatches(member, pin) {
  if (!member?.pinHash || !member?.salt) return false;
  const a = Buffer.from(hashWith(member.pinAlgo, pin, member.salt), "hex");
  const b = Buffer.from(String(member.pinHash), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Busca al integrante activo dueño del PIN.
 * @param {string} pin
 * @param {Array<{id:string,name:string,role:string,salt:string,pinHash:string,active?:boolean}>} members
 * @returns {{ valid: boolean, legacy?: boolean, staff: { id: string, name: string, role: string } | null }}
 */
export function verifyStaffPin(pin, members = []) {
  const clean = String(pin || "").trim();
  if (!STAFF_PIN.test(clean) || !Array.isArray(members)) {
    return { valid: false, staff: null };
  }
  const member = members.find(
    (m) => m.active !== false && pinMatches(m, clean),
  );
  if (!member) return { valid: false, staff: null };
  return {
    valid: true,
    // true si el PIN todavía está guardado con el hash viejo: hay que migrarlo.
    legacy: member.pinAlgo !== SCRYPT_ALGO,
    staff: { id: member.id, name: member.name, role: member.role },
  };
}

/**
 * true si otro integrante ya usa (o usó) ese PIN. Incluye a los dados de baja:
 * así reactivar a alguien nunca deja dos personas con el mismo PIN.
 */
export function isPinTaken(pin, members, exceptId = null) {
  return members.some((m) => m.id !== exceptId && pinMatches(m, String(pin)));
}

/** Datos del equipo aptos para mandar al navegador. */
export function publicStaff(members) {
  return members.map(({ id, name, role, active, createdAt }) => ({
    id,
    name,
    role,
    active: active !== false,
    createdAt: createdAt || null,
  }));
}
