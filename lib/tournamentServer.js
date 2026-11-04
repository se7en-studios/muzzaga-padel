// Lectura de los torneos con inscripción abierta para la web (/torneos y la
// tarjeta del inicio). Server-only: importalo solo desde server components o
// server actions.
import { cache } from "react";
import { getDb, isFirebaseConfigured } from "./firebase.js";
import { todayInClub } from "./booking.js";
import { openTournamentsForWeb } from "./tournament.js";

// Lo último bueno queda de respaldo: si la base falla un momento, la página
// sigue mostrando el torneo en vez de volver a "Fecha a confirmar".
let lastGood = [];

/** Torneos abiertos, el más próximo primero. Con `cache` se lee una vez por render. */
export const getOpenTournaments = cache(async () => {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDb().ref("tournaments").once("value");
    lastGood = openTournamentsForWeb(snap.val(), todayInClub());
    return lastGood;
  } catch (error) {
    console.warn("Torneos: no se pudieron leer, uso el respaldo:", error.message);
    return lastGood;
  }
});
