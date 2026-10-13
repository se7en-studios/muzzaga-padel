// Achica una foto en el navegador antes de subirla: la del celular pesa 4 a
// 12 MB y la web nunca la muestra a más de ~2000 px. Solo para el cliente.

const MAX_SIDE = 2000;
const QUALITY = 0.82;
const MAX_BYTES = 3.8 * 1024 * 1024; // por debajo del límite del server action

const toBlob = (canvas, type) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));

/**
 * @param {File} file
 * @returns {Promise<Blob>} WebP (o JPEG si el navegador no codifica WebP)
 */
export async function compressImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" no es una foto.`);
  }
  let bitmap;
  try {
    // from-image: respeta la rotación EXIF de las fotos del celular.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`No se pudo abrir "${file.name}". Probá con una foto JPG o PNG.`);
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  let blob = await toBlob(canvas, "image/webp");
  // Safari viejo ignora image/webp y devuelve PNG, que pesa mucho más.
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg");
  if (!blob) throw new Error(`No se pudo procesar "${file.name}".`);
  if (blob.size > MAX_BYTES) {
    throw new Error(`"${file.name}" sigue pesando demasiado después de achicarla.`);
  }
  return blob;
}
