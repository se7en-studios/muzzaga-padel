"use client";

import { useCallback, useRef, useState } from "react";
import { CircleAlert, X } from "lucide-react";
import { emitToastSignal, prefersReducedMotion } from "./motion";

const DEFAULT_DURATION_MS = 5000;
// Lo que tarda el aviso en irse (CSS en rediseno/movimiento.css).
const LEAVE_MS = 180;

/**
 * Toasts para confirmar acciones ("Venta registrada · $12.000 · Deshacer").
 * show(message, { tone: "success" | "error", action: { label, onClick } })
 */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    const remove = () => setToasts((list) => list.filter((t) => t.id !== id));
    if (prefersReducedMotion()) return remove();
    // Primero se marca "saliendo" (se desliza afuera) y después se saca.
    setToasts((list) =>
      list.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    );
    setTimeout(remove, LEAVE_MS);
  }, []);

  const show = useCallback(
    (
      message,
      { tone = "success", action, duration = DEFAULT_DURATION_MS } = {},
    ) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((list) => [...list, { id, message, tone, action, duration }]);
      setTimeout(() => dismiss(id), duration);
      // Los botones con estado de carga festejan (o niegan) con esta señal.
      emitToastSignal(tone);
    },
    [dismiss],
  );

  return { toasts, show, dismiss };
}

function ToastItem({ toast: t, onDismiss }) {
  return (
    <div
      className={`admin-toast${t.leaving ? " is-leaving" : ""}`}
      data-tone={t.tone}
    >
      {t.tone === "error" ? (
        <CircleAlert size={18} strokeWidth={1.75} aria-hidden />
      ) : (
        // Tilde que se dibuja (dos palitos que crecen), en su circulito.
        <span className="admin-toast-tick" aria-hidden="true">
          <i />
          <i />
        </span>
      )}
      <span className="admin-toast-msg">{t.message}</span>
      {t.action && (
        <button
          type="button"
          className="admin-toast-action"
          onClick={() => {
            onDismiss(t.id);
            t.action.onClick();
          }}
        >
          {t.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(t.id)}
        aria-label="Cerrar aviso"
      >
        <X size={16} strokeWidth={1.75} aria-hidden />
      </button>
      {/* Cuánto le queda al aviso antes de irse solo. */}
      <span
        className="admin-toast-timer"
        aria-hidden="true"
        style={{ animationDuration: `${t.duration || DEFAULT_DURATION_MS}ms` }}
      />
    </div>
  );
}

/** Los errores van en una región role="alert" para que el lector los anuncie ya. */
export function Toaster({ toasts, onDismiss }) {
  const errors = toasts.filter((t) => t.tone === "error");
  const others = toasts.filter((t) => t.tone !== "error");
  return (
    <div className="admin-toaster">
      <div role="alert" style={{ display: "contents" }}>
        {errors.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
      <div role="status" aria-live="polite" style={{ display: "contents" }}>
        {others.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}
