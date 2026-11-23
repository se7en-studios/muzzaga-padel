"use client";

// Piezas chicas del sistema de movimiento del panel: el indicador que se
// desliza en los menús, el cambio de vista con dirección, la salida animada
// de los modales y la señal que usan los botones para festejar un guardado.
// Todo respeta "reducir movimiento" (CSS en rediseno/movimiento.css).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}

/**
 * Cambia de vista con un desplazamiento corto en la dirección del menú
 * (dir 1 = hacia abajo/derecha, -1 = hacia arriba/izquierda).
 * En compu, si el navegador tiene View Transitions, la vista vieja sale y la
 * nueva entra; si no (o en el celu, para no sacar capturas de páginas largas
 * en equipos modestos), la vista nueva entra sola con CSS.
 * `apply(mode)` hace el cambio de estado; mode es "vt" o "css".
 */
export function changeViewAnimated(apply, dir) {
  const root = document.documentElement;
  const canVT =
    typeof document.startViewTransition === "function" &&
    !prefersReducedMotion() &&
    window.matchMedia?.("(min-width: 768px)").matches;
  if (!canVT) {
    apply("css");
    return;
  }
  root.dataset.adminNav = dir < 0 ? "prev" : "next";
  try {
    const t = document.startViewTransition(() => {
      flushSync(() => apply("vt"));
    });
    t.finished.finally(() => {
      delete root.dataset.adminNav;
    });
  } catch {
    delete root.dataset.adminNav;
    apply("css");
  }
}

/**
 * Mide el elemento activo (`[aria-current="page"]`, o lo que diga `pick`)
 * dentro del contenedor y devuelve la caja donde dibujar el indicador que se
 * desliza. La primera medida (y las de cambio de tamaño) van sin transición.
 */
export function useNavIndicator(active, { selector = '[aria-current="page"]', deps = [] } = {}) {
  const ref = useRef(null);
  const [box, setBox] = useState(null);
  const animate = useRef(false);

  const measure = useCallback(
    (withTransition) => {
      const nav = ref.current;
      if (!nav) return;
      const el = nav.querySelector(selector);
      if (!el || !el.getClientRects().length) {
        setBox(null);
        return;
      }
      const n = nav.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setBox({
        x: Math.round(r.left - n.left + nav.scrollLeft - nav.clientLeft),
        y: Math.round(r.top - n.top + nav.scrollTop - nav.clientTop),
        w: Math.round(r.width),
        h: Math.round(r.height),
        instant: !withTransition,
      });
    },
    [selector],
  );

  useLayoutEffect(() => {
    measure(animate.current);
    animate.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, measure, ...deps]);

  // Si cambia el tamaño (menú achicado, giro del celu) se reubica sin viaje.
  useEffect(() => {
    const nav = ref.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    let last = null;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const key = `${Math.round(width)}x${Math.round(height)}`;
      if (last !== null && key !== last) measure(false);
      last = key;
    });
    ro.observe(nav);
    return () => ro.disconnect();
  }, [measure]);

  const style = box
    ? {
        width: box.w,
        height: box.h,
        transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
        ...(box.instant ? { transition: "none" } : null),
      }
    : null;

  return { ref, style };
}

/**
 * Cierre con salida animada para modales que el padre desmonta al toque:
 * `close()` marca `closing` (el CSS hace la salida) y avisa al padre después.
 */
export function useExitAnimation(onClose, ms = 170) {
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const close = useCallback(() => {
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(onClose, ms);
  }, [onClose, ms]);
  return { closing, close };
}

// Señal "salió bien / salió mal": la dispara el toaster cada vez que muestra
// un aviso, y la escuchan los botones con estado de carga (BusyButton).
const TOAST_SIGNAL = "admin:toast";

export function emitToastSignal(tone) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_SIGNAL, { detail: { tone } }));
}

export function onToastSignal(fn) {
  const handler = (e) => fn(e.detail?.tone || "success");
  window.addEventListener(TOAST_SIGNAL, handler);
  return () => window.removeEventListener(TOAST_SIGNAL, handler);
}
