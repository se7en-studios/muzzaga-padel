// Lectura de siteContent (fotos de la web) desde Realtime Database.
// Server-only: importalo solo desde server components, route handlers o
// server actions.
import { cache } from "react";
import { getDb, isFirebaseConfigured } from "./firebase.js";
import { normalizeSiteContent } from "./siteContent.js";

// Sin cache con TTL como clubConfig: la landing y /torneos ya son ISR y se
// regeneran al guardar (revalidatePath), así que leer siempre fresco hace que
// el cambio se vea en la próxima visita. Lo último bueno queda de respaldo
// para que una falla de la base no vuelva a las fotos por defecto.
let lastGood = null;

/**
 * Contenido normalizado; ante una falla devuelve lo último leído o los defaults.
 * Con `cache` el layout, la página y el footer comparten una sola lectura.
 */
export const getSiteContent = cache(async () => {
  if (!isFirebaseConfigured()) return normalizeSiteContent(null);
  try {
    const snap = await getDb().ref("siteContent").once("value");
    lastGood = normalizeSiteContent(snap.val());
    return lastGood;
  } catch (error) {
    console.warn("siteContent: no se pudo leer, uso el respaldo:", error.message);
    return lastGood || normalizeSiteContent(null);
  }
});
