// Foto de la maqueta 3D para que el monitor arranque al instante.
//
// En la tele la maqueta tarda 15-30 s en armarse la primera vez. Cuando
// termina, la maqueta saca una foto de lo que dibujó y la página la guarda
// acá junto con dónde cae cada cancha. La próxima vez se muestra esa foto
// (con los globos ya puestos) mientras la maqueta se arma detrás, y al
// terminar se funde con la de verdad.
//
// Se guarda en IndexedDB y no en la Cache API: el service worker borra todas
// las cachés que no son la suya cada vez que se actualiza. Hay una sola foto
// (la última); si cambia el tamaño de la pantalla, la cámara o la versión de
// la maqueta, la clave no coincide y se saca otra.

const DB = "muzzaga-monitor";
const STORE = "fotos";
const ID = "maqueta";

// Cada cuánto se vuelve a sacar aunque nada haya cambiado.
export const FOTO_MAX_EDAD_MS = 24 * 60 * 60 * 1000;

/** Clave de la foto: tamaño de la maqueta en pantalla + cámara y versión (van en la URL). */
export function claveFoto(rect, src) {
  const dpr = window.devicePixelRatio || 1;
  return `${Math.round(rect.width)}x${Math.round(rect.height)}@${dpr}|${src}`;
}

function abrir() {
  return new Promise((ok, mal) => {
    if (typeof indexedDB === "undefined") return mal(new Error("sin IndexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}

/** La foto guardada ({ key, at, pts, blob }) o null. Nunca falla. */
export async function leerFoto() {
  try {
    const db = await abrir();
    try {
      return await new Promise((ok) => {
        const req = db.transaction(STORE).objectStore(STORE).get(ID);
        req.onsuccess = () => ok(req.result || null);
        req.onerror = () => ok(null);
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Reemplaza la foto guardada. Si no se puede (modo incógnito, sin lugar), no pasa nada. */
export async function guardarFoto(foto) {
  try {
    const db = await abrir();
    try {
      await new Promise((ok, mal) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(foto, ID);
        tx.oncomplete = ok;
        tx.onerror = () => mal(tx.error);
        tx.onabort = () => mal(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    /* sin foto: arranca como siempre */
  }
}

/** ¿Hay que sacar una foto nueva? (no hay, es de otra pantalla/versión o es vieja) */
export function fotoVencida(foto, key, ahora = Date.now()) {
  return !foto || foto.key !== key || !(ahora - foto.at < FOTO_MAX_EDAD_MS);
}
