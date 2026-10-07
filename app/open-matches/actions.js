"use server";

import { getDb, isFirebaseConfigured } from "../../lib/firebase";
import { todayInClub } from "../../lib/booking";
import { PRECIO_POR_JUGADOR } from "../../data/pricing";
import { checkPublicRateLimit } from "../../lib/adminRateLimit";
import { RATE_LIMIT_ERROR } from "../../lib/rateLimit";
import {
  badgeFor,
  checkJoinable,
  claimSlot,
  toPublicMatch,
  validateCreate,
  validateJoin,
} from "../../lib/openMatches";

/** Listado público: sin teléfonos ni apellidos (ver toPublicMatch). */
export async function getOpenMatches() {
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDb().ref("openMatches").get();
      if (snap.exists()) {
        const today = todayInClub();
        const list = Object.entries(snap.val())
          .map(([id, val]) => toPublicMatch(id, val))
          // Los partidos de días pasados ya no sirven para sumarse.
          .filter((m) => !m.date || m.date >= today)
          .sort((a, b) => b.createdAt - a.createdAt);
        return { ok: true, matches: list };
      }
    } catch (error) {
      console.warn("Aviso Firebase Open Matches:", error.message);
    }
  }

  // Si no hay partidos creados en Firebase, devolvemos lista vacía (sin jugadores ficticios)
  return { ok: true, matches: [] };
}

export async function joinOpenMatch(
  matchId,
  slotIndex,
  playerName,
  playerPhone,
) {
  const input = validateJoin({ matchId, slotIndex, playerName, playerPhone });
  if (!input.ok) return input;
  const { name, phone } = input.value;

  if (!isFirebaseConfigured()) {
    return {
      ok: false,
      error: "No se pudo registrar tu lugar. Probá de nuevo.",
    };
  }
  const gate = await checkPublicRateLimit("joinOpenMatch");
  if (!gate.allowed) return { ok: false, error: RATE_LIMIT_ERROR };

  try {
    const matchRef = getDb().ref(`openMatches/${matchId}`);
    const snap = await matchRef.get();
    const state = checkJoinable(
      snap.exists() ? snap.val() : null,
      slotIndex,
      todayInClub(),
    );
    if (!state.ok) return state;

    // Transacción sobre el lugar: dos personas que se suman a la vez ya no
    // se pisan (antes era leer todo el partido y reescribirlo con set).
    const player = { name, phone, taken: true, joinedAt: Date.now() };
    const tx = await matchRef
      .child(`players/${slotIndex}`)
      .transaction((current) => claimSlot(current, player));
    if (!tx.committed) return { ok: false, error: "Ese lugar ya fue ocupado." };
    return { ok: true };
  } catch (error) {
    console.error("Error al unirse a Cancha Abierta", error);
    return {
      ok: false,
      error: "No se pudo registrar tu lugar. Probá de nuevo.",
    };
  }
}

export async function createOpenMatch(data) {
  const input = validateCreate(data, todayInClub());
  if (!input.ok) return input;
  const { category, courtName, date, time, desc, name, phone } = input.value;

  const newMatch = {
    category,
    badgeColor: badgeFor(category),
    courtName,
    date,
    time,
    desc,
    pricePerPlayer: PRECIO_POR_JUGADOR,
    createdAt: Date.now(),
    players: [
      { name: `${name} (Org.)`, phone, taken: true },
      { name: "", phone: "", taken: false },
      { name: "", phone: "", taken: false },
      { name: "", phone: "", taken: false },
    ],
  };

  try {
    if (isFirebaseConfigured()) {
      const gate = await checkPublicRateLimit("createOpenMatch");
      if (!gate.allowed) return { ok: false, error: RATE_LIMIT_ERROR };
      const matchRef = getDb().ref("openMatches").push();
      await matchRef.set(newMatch);
      return { ok: true, matchId: matchRef.key };
    }
    return { ok: true, matchId: "local-" + Date.now() };
  } catch (error) {
    console.error("Error al crear Cancha Abierta en Firebase", error);
    return { ok: false, error: "No se pudo publicar la convocatoria." };
  }
}
