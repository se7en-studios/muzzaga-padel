"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 1400;

/** Número que cuenta desde 0 cuando aparece al hacer scroll. Sin JS, con
 *  reduced-motion, o si ya está a la vista al cargar la página (el hero),
 *  muestra el valor final directo: contar desde 0 arriba de todo retrasaba
 *  cuándo terminaba de verse la pantalla y se veía parpadear el número. */
export default function StatCounter({ value, prefix = "", suffix = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches)
      return;

    if (el.getBoundingClientRect().top < window.innerHeight) return;

    let raf;
    setShown(0);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min((now - start) / DURATION_MS, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setShown(Math.round(value * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={ref} className="stat-number">
      {prefix}
      {shown.toLocaleString("es-AR")}
      {suffix}
    </span>
  );
}
