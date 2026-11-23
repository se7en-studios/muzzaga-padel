"use client";

import { useEffect, useRef, useState } from "react";
import { onToastSignal } from "./motion";

// Cuánto queda el tilde a la vista antes de volver al texto del botón.
const DONE_MS = 1100;
const FAIL_MS = 420;
// El aviso suele salir en la misma tanda que el fin de la carga; por si
// llega un toque después, se lo espera este rato.
const WAIT_MS = 300;

/**
 * Botón con estado de carga y de resultado. Mientras `busy` está en true pica
 * una pelotita al lado del texto; cuando termina, si el panel mostró un aviso
 * de éxito se dibuja un tilde, y si fue un error el botón hace "no" con la
 * cabeza. No cambia qué hace el botón: es el mismo <button> con sus props.
 */
export default function BusyButton({ busy = false, className = "", children, ...rest }) {
  const [flash, setFlash] = useState(null);
  // Cada vez que termina una carga sube este número (ajuste durante el
  // render, así también anda con los efectos dobles de desarrollo).
  const [finished, setFinished] = useState(0);
  const [prevBusy, setPrevBusy] = useState(busy);
  const lastTone = useRef(null);

  if (busy !== prevBusy) {
    setPrevBusy(busy);
    if (busy) setFlash(null);
    else setFinished((n) => n + 1);
  }

  useEffect(
    () =>
      onToastSignal((tone) => {
        lastTone.current = tone;
      }),
    [],
  );

  useEffect(() => {
    if (busy) lastTone.current = null;
  }, [busy]);

  useEffect(() => {
    if (!finished) return;
    let hold;
    const decide = () => {
      const tone = lastTone.current;
      if (!tone) return;
      lastTone.current = null;
      const failed = tone === "error";
      setFlash(failed ? "fail" : "done");
      hold = setTimeout(() => setFlash(null), failed ? FAIL_MS : DONE_MS);
    };
    const wait = setTimeout(decide, lastTone.current ? 0 : WAIT_MS);
    return () => {
      clearTimeout(wait);
      clearTimeout(hold);
    };
  }, [finished]);

  const state = busy ? " is-busy" : flash === "done" ? " is-done" : flash === "fail" ? " is-failed" : "";

  return (
    <button
      {...rest}
      className={`${className} admin-busy-btn${state}`}
      aria-busy={busy || undefined}
    >
      {busy && <span className="admin-busy-ball" aria-hidden="true" />}
      {children}
      {flash === "done" && (
        <span className="admin-done-tick" aria-hidden="true">
          <i />
          <i />
        </span>
      )}
    </button>
  );
}
