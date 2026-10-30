// Lectura de la carta de la cantina desde Realtime Database. Server-only:
// importalo solo desde server components, route handlers o server actions.
import { cache } from "react";
import { getDb, isFirebaseConfigured } from "./firebase.js";
import { normalizeMenu } from "./cantinaMenu.js";

// Igual que siteContent: las páginas son ISR y se regeneran al guardar la
// carta, así que se lee siempre fresco. Lo último bueno queda de respaldo
// para que una falla de la base no vuelva a los precios viejos de la carta
// original.
let lastGood = null;

/** Carta normalizada; ante una falla devuelve lo último leído o la original. */
export const getCantinaMenu = cache(async () => {
  if (!isFirebaseConfigured()) return normalizeMenu(null);
  try {
    const snap = await getDb().ref("cantinaMenu").once("value");
    lastGood = normalizeMenu(snap.val());
    return lastGood;
  } catch (error) {
    console.warn("cantinaMenu: no se pudo leer, uso el respaldo:", error.message);
    return lastGood || normalizeMenu(null);
  }
});
