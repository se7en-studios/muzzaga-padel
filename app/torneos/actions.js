"use server";

import { revalidatePath } from "next/cache";
import { getDb, isFirebaseConfigured } from "../../lib/firebase";
import { checkPublicRateLimit } from "../../lib/adminRateLimit";
import { RATE_LIMIT_ERROR } from "../../lib/rateLimit";
import {
  checkTournamentSignup,
  validateTournamentSignup,
} from "../../lib/tournament";

/**
 * Inscripción de una pareja desde /torneos. Queda en el admin como cualquier
 * pareja cargada a mano (Torneos → Parejas), con "Debe" y marcada como web.
 */
export async function signupTournament(input = {}) {
  // Campo trampa: invisible para la gente, los bots lo llenan.
  if (input.website) return { ok: true };

  const valid = validateTournamentSignup(input);
  if (!valid.ok) return valid;
  const { tournamentId, categoryId, name, partner, phone } = valid.value;

  if (!isFirebaseConfigured()) {
    return { ok: false, error: "No se pudo anotar la pareja. Probá de nuevo." };
  }
  const gate = await checkPublicRateLimit("tournamentSignup");
  if (!gate.allowed) return { ok: false, error: RATE_LIMIT_ERROR };

  try {
    const db = getDb();
    const ref = db.ref(`tournaments/${tournamentId}`);
    const snap = await ref.once("value");
    const state = checkTournamentSignup(snap.val(), { categoryId, phone });
    if (!state.ok) return state;

    const pairRef = ref.child("players").push();
    await pairRef.set({
      name,
      partner,
      phone,
      categoryId,
      paid: false,
      source: "web",
      createdAt: Date.now(),
    });
    revalidatePath("/torneos");
    return { ok: true };
  } catch (error) {
    console.error("Error al inscribir pareja en el torneo", error);
    return { ok: false, error: "No se pudo anotar la pareja. Probá de nuevo." };
  }
}
