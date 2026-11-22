"use client";

import { useEffect, useRef, useState } from "react";

const LETRAS = "MUZZAGA".split("");

/** El nombre gigante al pie del footer: las letras suben una por una cuando
 *  llega a la pantalla, una pelota las recorre picando de letra en letra
 *  (cada una se hunde un poco con el pique) y después las cruza un brillo.
 *  Es decorativo (el nombre ya está en el footer), así que queda fuera del
 *  árbol accesible. */
export default function FooterWordmark() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  // El punto "en vivo" de los títulos del pie late en loop: solo mientras
  // el pie está en pantalla (fuera de ella, la animación queda en pausa).
  useEffect(() => {
    const pie = ref.current?.closest("footer");
    if (!pie || !("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      pie.classList.toggle("pie-en-pantalla", entry.isIntersecting);
    });
    io.observe(pie);
    return () => io.disconnect();
  }, []);

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
      {/* La fila mide lo mismo que las letras: la pelota se ubica contra su
          borde derecho (sobre la última A) y recorre la palabra en em. */}
      <span className="footer-wordmark-fila">
        {LETRAS.map((letra, i) => (
          <span
            key={i}
            className={`footer-wordmark-letter${i === 0 ? " is-accent" : ""}`}
            style={{ "--d": `${i * 80}ms` }}
          >
            {letra}
          </span>
        ))}
        {/* La pelota que pica de letra en letra y queda sobre la última A
            (estilos en la home). Va afuera de las letras: si no, cada
            cuadro de su recorrido volvía a pintar la sombra de la letra. */}
        <span className="footer-wordmark-ball" />
      </span>
    </div>
  );
}
