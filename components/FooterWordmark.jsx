"use client";

import { useEffect, useRef, useState } from "react";

const LETRAS = "MUZZAGA".split("");

/** El nombre gigante al pie del footer: las letras suben una por una cuando
 *  llega a la pantalla y después las cruza un brillo. Es decorativo (el
 *  nombre ya está en el footer), así que queda fuera del árbol accesible. */
export default function FooterWordmark() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`footer-wordmark${visible ? " is-in" : ""}`}
      aria-hidden="true"
    >
      {LETRAS.map((letra, i) => (
        <span
          key={i}
          className={`footer-wordmark-letter${i === 0 ? " is-accent" : ""}`}
          style={{ "--d": `${i * 80}ms` }}
        >
          {letra}
        </span>
      ))}
    </div>
  );
}
