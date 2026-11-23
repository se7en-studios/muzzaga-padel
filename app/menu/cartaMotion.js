"use client";

// Movimiento de la carta (/menu): la pelota que vuela al pedido y el
// indicador de categorías que sigue el scroll. Todo con transform/opacity y
// nada corre con "reducir movimiento".

import { useEffect, useLayoutEffect, useState } from "react";
import { scrollBehavior } from "../../lib/motion";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function motionOk() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: no-preference)").matches
  );
}

/** Adónde vuela la pelota: el pedido que está a la vista. */
function cartTarget() {
  const visible = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? el : null;
  };
  return (
    visible(document.querySelector(".menu-cart-bar-icon")) ||
    visible(document.querySelector(".menu-cart-aside .menu-cart-head .carta-pelota")) ||
    visible(document.querySelector(".carta .menu-cart-open"))
  );
}

/** El carrito "pica" donde cae la pelota: salto + anillo de impacto. */
function pique(target) {
  target.animate(
    [
      { transform: "translateY(0) scale(1)" },
      { transform: "translateY(3px) scale(1.18, 0.86)", offset: 0.25 },
      { transform: "translateY(-6px) scale(0.94, 1.08)", offset: 0.55 },
      { transform: "translateY(0) scale(1)" },
    ],
    { duration: 420, easing: "cubic-bezier(.3,.7,.4,1)" },
  );
  const r = target.getBoundingClientRect();
  const ring = document.createElement("span");
  ring.className = "carta-fx-pique";
  ring.setAttribute("aria-hidden", "true");
  ring.style.left = `${r.left + r.width / 2}px`;
  ring.style.top = `${r.top + r.height / 2}px`;
  document.body.appendChild(ring);
  ring.addEventListener("animationend", () => ring.remove(), { once: true });
  setTimeout(() => ring.remove(), 900);
}

/**
 * La pelota sale del botón "Agregar" y vuela en parábola hasta el pedido
 * (la barra de abajo en celu, el panel del costado en compu). Se llama
 * después de que React dibujó la barra (la primera vez recién aparece).
 */
export function lanzarPelota(fromEl) {
  if (!fromEl || !motionOk()) return;
  const from = fromEl.getBoundingClientRect();
  // Dos cuadros: el primero dibuja la barra, el segundo ya se puede medir.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const target = cartTarget();
      if (!target) return;
      const to = target.getBoundingClientRect();
      const x0 = from.left + from.width / 2;
      const y0 = from.top + from.height / 2;
      const dx = to.left + to.width / 2 - x0;
      const dy = to.top + to.height / 2 - y0;
      // Globo de saque: sube por encima del más alto de los dos puntos.
      const peak = Math.min(0, dy) - Math.min(140, 60 + Math.abs(dx) * 0.25);

      const outer = document.createElement("span");
      outer.className = "carta-vuelo";
      outer.setAttribute("aria-hidden", "true");
      outer.style.left = `${x0}px`;
      outer.style.top = `${y0}px`;
      const inner = document.createElement("span");
      inner.className = "carta-vuelo-y";
      const ball = document.createElement("span");
      ball.className = "carta-pelota carta-vuelo-pelota";
      inner.appendChild(ball);
      outer.appendChild(inner);
      document.body.appendChild(outer);

      const duration = 620;
      outer.animate(
        [{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }],
        { duration, easing: "cubic-bezier(.35,.1,.55,1)", fill: "forwards" },
      );
      ball.animate(
        [{ transform: "rotate(0)" }, { transform: `rotate(${dx >= 0 ? 540 : -540}deg)` }],
        { duration, fill: "forwards" },
      );
      const fly = inner.animate(
        [
          { transform: "translateY(0) scale(1.25)", easing: "cubic-bezier(.2,.6,.4,1)" },
          { transform: `translateY(${peak}px) scale(1.1)`, offset: 0.42, easing: "cubic-bezier(.55,0,.85,.4)" },
          { transform: `translateY(${dy}px) scale(0.8)` },
        ],
        { duration, fill: "forwards" },
      );
      const done = () => {
        outer.remove();
        pique(target);
      };
      fly.onfinish = done;
      fly.oncancel = () => outer.remove();
      // Pestaña en segundo plano: que no quede la pelota colgada.
      setTimeout(() => outer.isConnected && outer.remove(), duration + 400);
    }),
  );
}

/**
 * Qué categoría se está leyendo. Con un filtro elegido es esa; con "Todo",
 * el grupo que pasa por debajo de las pestañas pegadas (o "all" arriba de
 * todo).
 */
export function useCategoriaEnVista(selectedCat, filtrosRef, listaRef, depsKey) {
  const [enVista, setEnVista] = useState(selectedCat);

  useEffect(() => {
    if (selectedCat !== "all") {
      setEnVista(selectedCat);
      return undefined;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const bar = filtrosRef.current;
      const list = listaRef.current;
      if (!bar || !list) return;
      const line = bar.getBoundingClientRect().bottom + 24;
      let current = "all";
      for (const section of list.querySelectorAll("[data-grupo]")) {
        if (section.getBoundingClientRect().top <= line) current = section.dataset.grupo;
        else break;
      }
      setEnVista(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [selectedCat, filtrosRef, listaRef, depsKey]);

  return enVista;
}

/**
 * Ubica el indicador (raya de cal + pelota) debajo de la pestaña `catId`.
 * Se mueve con transform; si saltó de pestaña, la pelota pica al llegar.
 * Si la pestaña quedó fuera de la fila, la fila se corre para mostrarla.
 */
export function useIndicadorCategoria(indRef, catId) {
  useIsoLayoutEffect(() => {
    const ind = indRef.current;
    const row = ind?.parentElement;
    if (!ind || !row) return undefined;
    const line = ind.querySelector(".carta-cat-linea");
    const ball = ind.querySelector(".carta-cat-bola");
    // Dónde estaba antes (sobrevive al cambio de pestaña).
    const prev = ind.dataset.x === undefined ? null : Number(ind.dataset.x);

    const place = (animate) => {
      const tab = row.querySelector(`[data-cat="${catId}"]`);
      if (!tab) return;
      const x = tab.offsetLeft;
      const w = tab.offsetWidth;
      const inset = Math.min(14, w * 0.18);
      line.style.transform = `translateX(${x + inset}px) scaleX(${Math.max(0, w - inset * 2) / 100})`;
      ball.style.transform = `translateX(${x + w / 2 - 5}px)`;
      ind.classList.add("is-listo");
      if (animate && prev !== null && prev !== x && motionOk()) {
        ball.firstElementChild?.animate(
          [
            { transform: "translateY(0)" },
            { transform: "translateY(-9px)", offset: 0.45, easing: "ease-in" },
            { transform: "translateY(0) scale(1.2, 0.8)", offset: 0.8 },
            { transform: "translateY(0)" },
          ],
          { duration: 380, easing: "ease-out" },
        );
      }
      ind.dataset.x = String(x);
      // La pestaña del grupo que se lee queda a la vista en la fila.
      const left = row.scrollLeft;
      const pad = 32;
      if (x < left + pad || x + w > left + row.clientWidth - pad) {
        row.scrollTo({ left: Math.max(0, x - pad), behavior: animate ? scrollBehavior() : "auto" });
      }
    };

    place(true);
    const ro = new ResizeObserver(() => place(false));
    ro.observe(row);
    return () => ro.disconnect();
  }, [indRef, catId]);
}
