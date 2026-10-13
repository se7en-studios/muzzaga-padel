// Fotos subidas desde Configuración → Sitio web, guardadas en Vercel Blob.
// Server-only. El navegador ya las achica (lib/compressImage.js) antes de
// mandarlas; acá se valida de nuevo porque el server action es invocable a
// mano.
import { del, put } from "@vercel/blob";
import { isStoredPhoto } from "./siteContent.js";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** El store se conecta al proyecto desde Vercel → Storage; agrega una de estas. */
export function isPhotoStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

/** Tipo real según los primeros bytes: no confía en el que manda el navegador. */
function sniffType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  const ascii = (from, to) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * Sube una foto y devuelve su URL pública.
 * @param {File} file
 * @param {string} name prefijo del archivo, ej. "hero" o "torneo-abc"
 * @returns {Promise<{ url: string } | { error: string }>}
 */
export async function storePhoto(file, name) {
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) {
    return { error: "No llegó ninguna foto." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "La foto pesa demasiado (máximo 4 MB)." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type) return { error: "El archivo no es una foto JPG, PNG o WebP." };

  const safeName = String(name).replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "foto";
  const blob = await put(`sitio/${safeName}.${EXTENSIONS[type]}`, Buffer.from(bytes), {
    access: "public",
    addRandomSuffix: true,
    contentType: type,
    // Cada subida tiene URL propia (sufijo al azar): nunca cambia de contenido.
    cacheControlMaxAge: 365 * 24 * 60 * 60,
  });
  return { url: blob.url };
}

/** Borra del store las fotos que ya no se usan. Ignora las de /public/img. */
export async function deleteStoredPhotos(srcs) {
  const urls = [...new Set(srcs.filter(isStoredPhoto))];
  if (!urls.length) return;
  try {
    await del(urls);
  } catch (error) {
    // Queda un archivo huérfano en el store, pero la web ya no lo usa.
    console.warn("sitePhotoStorage: no se pudieron borrar fotos viejas:", error.message);
  }
}
