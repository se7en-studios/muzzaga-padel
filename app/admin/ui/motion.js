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
    window.matchMedia?.("(min-width: 901px) and (min-height: 501px)").matches;
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
  // Ref por callback: el menú puede montarse después que el componente
  // (por ejemplo, recién al entrar con el PIN).
  const [nav, setNav] = useState(null);
  const [box, setBox] = useState(null);
  const animate = useRef(false);

  const measure = useCallback(
    (withTransition) => {
      if (!nav) return;
      const el = nav.querySelector(selector);
      if (!el || !el.getClientRects().length) {
        setBox(null);
        return;
      }
      const n = nav.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      // Tamaño sin transformaciones (el ícono puede estar en medio de su
      // animación de escala) y posición desde el centro, que no cambia al
      // escalar desde el medio.
      const w = el.offsetWidth || el.clientWidth || r.width;
      const h = el.offsetHeight || el.clientHeight || r.height;
      const cx = r.left + r.width / 2 - n.left + nav.scrollLeft - nav.clientLeft;
      const cy = r.top + r.height / 2 - n.top + nav.scrollTop - nav.clientTop;
      setBox({
        x: Math.round(cx - w / 2),
        y: Math.round(cy - h / 2),
        w: Math.round(w),
        h: Math.round(h),
        instant: !withTransition,
      });
    },
    [nav, selector],
  );

  useLayoutEffect(() => {
    if (!nav) return;
    measure(animate.current);
    animate.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, measure, ...deps]);

  // Si cambia el tamaño (menú achicado, giro del celu) se reubica sin viaje.
  useEffect(() => {
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
  }, [nav, measure]);

  const style = box
    ? {
        width: box.w,
        height: box.h,
        transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
        ...(box.instant ? { transition: "none" } : null),
      }
    : null;

  return { ref: setNav, style };
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
