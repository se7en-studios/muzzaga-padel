"use client";

import { useEffect, useState } from "react";

/**
 * En la home, el id de la sección que cruza la franja del medio de la
 * pantalla (null fuera de la home). Lo usan el header y la barra de abajo
 * para marcar dónde estás. Se observan todas las secciones con id: si no,
 * la última marcada quedaba encendida al pasar a una que no está en el menú.
 *
 * @param {boolean} enabled
 * @returns {string | null}
 */
export default function useHomeSection(enabled) {
  const [section, setSection] = useState(enabled ? "top" : null);
  useEffect(() => {
    if (!enabled || !("IntersectionObserver" in window)) return;
    const targets = [...document.querySelectorAll("section[id]")];
    if (!targets.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setSection(entry.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [enabled]);
  return enabled ? section : null;
}
