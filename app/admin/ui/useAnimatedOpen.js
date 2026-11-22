"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Abrir/cerrar con salida animada: al cerrar queda montado `ms` milisegundos
 * con `closing` en true (el CSS hace la salida) y recién ahí se desmonta.
 * Si la persona pidió menos movimiento, cierra al toque.
 */
export function useAnimatedOpen(ms = 200) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);

  const show = useCallback(() => {
    clearTimeout(timer.current);
    setClosing(false);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setOpen(false);
      setClosing(false);
      return;
    }
    setClosing(true);
    timer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, ms);
  }, [ms]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { open, closing, show, hide };
}
