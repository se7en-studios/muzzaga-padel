"use client";

import { useEffect, useRef } from "react";
import "./ScrollProgress.css";

/** Barra fina fija arriba de todo que marca cuánto queda de la página. */
export default function ScrollProgress() {
  const fillRef = useRef(null);
  const ballRef = useRef(null);

  useEffect(() => {
    // Donde el navegador sabe atar animaciones al scroll, la barra y la
    // pelotita las mueve el CSS (ScrollProgress.css) sin JavaScript: antes se
    // medía el alto de la página en cada evento de scroll y eso obligaba a
    // recalcular el diseño en pleno scroll.
    if (window.CSS?.supports?.("animation-timeline: scroll()")) return undefined;

    // Respaldo (navegadores viejos): una sola escritura por cuadro y el alto
    // de la página guardado (se vuelve a medir solo si cambia de tamaño).
    let scrollable = 1;
    let raf = 0;
    const medir = () => {
      scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };
    const pintar = () => {
      raf = 0;
      const pct = Math.min(1, window.scrollY / scrollable);
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${pct})`;
      // La pelotita viaja con la barra y gira (una vuelta cada ~10%).
      if (ballRef.current) {
        ballRef.current.style.transform = `translateX(${pct * (window.innerWidth - 10)}px) rotate(${pct * 3600}deg)`;
        ballRef.current.classList.toggle("is-on", pct > 0.004);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(pintar);
    };
    const onResize = () => {
      medir();
      onScroll();
    };
    medir();
    pintar();
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="scroll-progress-track" aria-hidden="true">
      <div ref={fillRef} className="scroll-progress-fill" />
      <span ref={ballRef} className="scroll-progress-ball" />
    </div>
  );
}
