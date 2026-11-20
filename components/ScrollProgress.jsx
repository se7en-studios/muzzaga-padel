"use client";

import { useEffect, useRef } from "react";

/** Barra fina fija arriba de todo que marca cuánto queda de la página. */
export default function ScrollProgress() {
  const fillRef = useRef(null);
  const ballRef = useRef(null);

  useEffect(() => {
    // Se escribe directo en el DOM (sin setState): un re-render de React por cada evento de scroll era trabajo de más.
    function update() {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct = scrollable > 0 ? window.scrollY / scrollable : 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${pct})`;
      // La pelotita viaja con la barra y gira (una vuelta cada ~10%).
      if (ballRef.current)
        ballRef.current.style.transform = `translateX(${pct * (window.innerWidth - 10)}px) rotate(${pct * 3600}deg)`;
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="scroll-progress-track" aria-hidden="true">
      <div
        ref={fillRef}
        className="scroll-progress-fill"
        style={{ transform: "scaleX(0)" }}
      />
      <span ref={ballRef} className="scroll-progress-ball" />
    </div>
  );
}
