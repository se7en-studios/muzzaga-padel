"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Número que cuenta hasta su valor como un marcador: al aparecer arranca de
 * cero y, si cambia, viaja desde el valor anterior. Dura medio segundo y no
 * frena nada (el valor final es el que importa). Con "reducir movimiento"
 * muestra el número directo. Si `value` no es un número, lo muestra tal cual.
 */
export default function CountUp({ value, format = String, duration = 520, className = "" }) {
  const isNum = typeof value === "number" && Number.isFinite(value);
  const [shown, setShown] = useState(isNum ? 0 : value);
  const from = useRef(0);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    if (!isNum) return;
    if (prefersReducedMotion() || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = typeof shownRef.current === "number" ? shownRef.current : 0;
    const integer = Number.isInteger(value) && Number.isInteger(start);
    let raf = 0;
    let t0 = 0;
    const tick = (now) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / duration);
      const v = start + (value - start) * easeOut(p);
      setShown(p === 1 ? value : integer ? Math.round(v) : v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    from.current = value;
    return () => {
      cancelAnimationFrame(raf);
      setShown(value);
    };
  }, [value, isNum, duration]);

  return (
    <span className={`admin-countup ${className}`.trim()}>
      {isNum ? format(shown) : value}
    </span>
  );
}
