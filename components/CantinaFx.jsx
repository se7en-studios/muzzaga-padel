"use client";

import { useEffect, useRef, useState } from "react";

// Movimiento de la cantina en la home (estilos en
// app/secciones/anim-cantina-herramientas.css, prefijo cf-).
//
// CantinaFx no dibuja nada: pone clases en #cantina.
// - cf-on: hay JS y movimiento permitido (recién ahí el CSS puede pausar o
//   esconder cosas; sin JS todo se ve quieto y completo).
// - cf-armada: la pizarra estaba abajo al cargar; sus renglones esperan.
// - cf-escribe: la pizarra entró a la pantalla; se escribe renglón por
//   renglón y se llena la pinta. Avisa con el evento "cf-escribe" para que
//   los precios cuenten.
// - cf-fotos: las fotos entraron; caen como polaroids sobre la mesa.
// - cf-visible: la sección está en pantalla (fuera, se pausan los loops).

const RENGLON_MS = 90; // escalonado entre renglones (igual que en el CSS)

export default function CantinaFx() {
  useEffect(() => {
    const sec = document.getElementById("cantina");
    if (!sec || typeof IntersectionObserver === "undefined") return undefined;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches)
      return undefined;

    const board = sec.querySelector(".tc-pizarra");
    const photos = sec.querySelector(".cantina-photos");
    // Solo se anima lo que todavía no se vio: si ya estaba a la vista al
    // cargar, queda como está (nada de esconder y volver a mostrar).
    const abajo = (el) =>
      el && el.getBoundingClientRect().top > window.innerHeight * 0.92;

    sec.classList.add("cf-on");
    const armarPizarra = abajo(board);
    const armarFotos = abajo(photos);
    if (armarPizarra) sec.classList.add("cf-armada");

    const vista = new IntersectionObserver(([e]) => {
      sec.classList.toggle("cf-visible", e.isIntersecting);
    });
    vista.observe(sec);

    const entrada = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          entrada.unobserve(e.target);
          if (e.target === board) {
            sec.classList.add("cf-escribe");
            sec.dispatchEvent(new CustomEvent("cf-escribe"));
          } else if (e.target === photos) {
            sec.classList.add("cf-fotos");
          }
        });
      },
      { threshold: 0.18 },
    );
    if (armarPizarra) entrada.observe(board);
    if (armarFotos) entrada.observe(photos);

    return () => {
      vista.disconnect();
      entrada.disconnect();
      sec.classList.remove("cf-on", "cf-armada", "cf-visible");
    };
  }, []);

  return null;
}

/**
 * Precio de la pizarra que "cuenta" como un marcador de LED cuando se
 * escribe su renglón. Arranca de un número con la misma cantidad de cifras
 * (y una copia invisible fija el ancho), así el renglón no salta. Sin JS o
 * sin animación muestra el precio final, igual que antes.
 */
export function PrecioTiza({ value, orden = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const sec = ref.current?.closest("#cantina");
    if (!sec) return undefined;
    let raf = 0;
    let timer = 0;
    const contar = () => {
      const digitos = String(Math.round(value)).length;
      const piso = digitos > 1 ? 10 ** (digitos - 1) : 0;
      const desde = Math.max(piso, Math.round(value * 0.35));
      const dur = 750;
      timer = setTimeout(() => {
        const t0 = performance.now();
        const tick = (now) => {
          const t = Math.min((now - t0) / dur, 1);
          const e = 1 - Math.pow(1 - t, 3);
          const v = desde + (value - desde) * e;
          setShown(t < 1 ? Math.round(v / 10) * 10 : value);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        setShown(desde);
        raf = requestAnimationFrame(tick);
      }, 180 + orden * RENGLON_MS);
    };
    sec.addEventListener("cf-escribe", contar, { once: true });
    return () => {
      sec.removeEventListener("cf-escribe", contar);
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, orden]);

  const final = `$${value.toLocaleString("es-AR")}`;
  return (
    <span ref={ref} className="menu-board-price cf-precio">
      <span className="cf-precio-molde" aria-hidden="true">
        {final}
      </span>
      <span className="cf-precio-valor">
        {shown === value ? final : `$${shown.toLocaleString("es-AR")}`}
      </span>
    </span>
  );
}
