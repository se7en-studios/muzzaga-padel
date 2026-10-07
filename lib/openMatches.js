// Reglas de "Canchas Abiertas", separadas del server action para poder
// testearlas sin Firebase ni Next.

export const OPEN_MATCH_CATEGORIES = [
  "7ma / Iniciación (1.5 - 2.9)",
  "6ta Categoría (3.0 - 3.9)",
  "5ta / Libre (4.0 - 5.5+)",
  "Torneo Damas A/B",
];

export const SLOTS_PER_MATCH = 4;
const MATCH_ID = /^[A-Za-z0-9_-]{1,64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^[+\d\s().-]{6,25}$/;

const text = (v) => (typeof v === "string" ? v.trim() : "");
const isPhone = (v) => PHONE.test(v) && v.replace(/\D/g, "").length >= 6;

export function badgeFor(category) {
  if (category.includes("7ma")) return "badge-emerald";
  if (category.includes("6ta")) return "badge-amber";
  return "badge-indigo";
}

/**
 * Lo único que ve el público: nombre de pila y si el lugar está tomado.
 * Teléfonos y apellidos quedan en la base para el club, nunca en el listado.
 */
export function toPublicMatch(id, val) {
  const players = Array.isArray(val?.players) ? val.players : [];
  return {
    id,
    category: String(val?.category || ""),
    badgeColor: String(val?.badgeColor || "badge-indigo"),
    courtName: String(val?.courtName || ""),
    date: String(val?.date || ""),
    time: String(val?.time || ""),
    desc: String(val?.desc || ""),
    pricePerPlayer: Number(val?.pricePerPlayer) || 0,
    createdAt: Number(val?.createdAt) || 0,
    players: players.map((p) => {
      const full = String(p?.name || "");
      const first = full.split(" ")[0] || "";
      return {
        name: first && full.endsWith("(Org.)") ? `${first} (Org.)` : first,
        taken: Boolean(p?.taken),
      };
    }),
  };
}

export function validateJoin({ matchId, slotIndex, playerName, playerPhone }) {
  if (typeof matchId !== "string" || !MATCH_ID.test(matchId)) {
    return { ok: false, error: "Partido no encontrado." };
  }
  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= SLOTS_PER_MATCH
  ) {
    return { ok: false, error: "Lugar inválido." };
  }
  const name = text(playerName);
  const phone = text(playerPhone);
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: "Ingresá tu nombre (2 a 60 caracteres)." };
  }
  if (!isPhone(phone)) {
    return { ok: false, error: "Ingresá un teléfono válido." };
  }
  return { ok: true, value: { matchId, slotIndex, name, phone } };
}

/** Estado del partido (ya leído de la base) frente a un pedido de unión. */
export function checkJoinable(match, slotIndex, today) {
  if (!match || !Array.isArray(match.players)) {
    return { ok: false, error: "Partido no encontrado." };
  }
  if (match.date && match.date < today) {
    return { ok: false, error: "Ese partido ya se jugó." };
  }
  if (match.players.every((p) => p?.taken)) {
    return { ok: false, error: "El partido ya está completo." };
  }
  if (!match.players[slotIndex] || match.players[slotIndex].taken) {
    return { ok: false, error: "Ese lugar ya fue ocupado." };
  }
  return { ok: true };
}

/**
 * Updater de la transacción sobre `players/<slot>`: si alguien lo tomó entre
 * la lectura y la escritura, aborta (undefined) en vez de pisarlo.
 */
export function claimSlot(current, player) {
  if (current?.taken) return undefined;
  return player;
}

export function validateCreate(data, today) {
  const d = data && typeof data === "object" ? data : {};
  const category = text(d.category);
  if (!OPEN_MATCH_CATEGORIES.includes(category)) {
    return { ok: false, error: "Elegí una categoría." };
  }
  const name = text(d.creatorName);
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: "Ingresá tu nombre (2 a 60 caracteres)." };
  }
  const phone = text(d.creatorPhone);
  if (phone && !isPhone(phone)) {
    return { ok: false, error: "Ingresá un teléfono válido." };
  }
  const date = text(d.date) || today;
  if (!ISO_DATE.test(date) || date < today) {
    return { ok: false, error: "Elegí una fecha de hoy en adelante." };
  }
  const courtName = text(d.courtName) || "Cancha 1 · Cristal";
  const time = text(d.time) || "20:00 hs";
  const desc = text(d.desc) || "Convocatoria abierta para jugar al pádel.";
  if (courtName.length > 40) return { ok: false, error: "Cancha inválida." };
  if (time.length > 20) return { ok: false, error: "Horario inválido." };
  if (desc.length > 200) {
    return { ok: false, error: "La descripción admite hasta 200 caracteres." };
  }
  return {
    ok: true,
    value: { category, courtName, date, time, desc, name, phone },
  };
}
