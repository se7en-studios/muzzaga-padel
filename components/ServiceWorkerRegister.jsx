"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        // Sin caché HTTP para sw.js: cada publicación lo actualiza enseguida.
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          // Registrado exitosamente
        })
        .catch(() => {
          // Silencioso en caso de bloqueo o modo incógnito
        });
    }
  }, []);

  return null;
}
