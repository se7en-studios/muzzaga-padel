"use client";

import { useEffect, useRef, useState } from "react";

const BOOKED_KEY = "muzzaga_has_booked";
const DISMISSED_KEY = "muzzaga_install_dismissed";

function readFlag(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Sin almacenamiento local simplemente se vuelve a mostrar la próxima vez.
  }
}

/**
 * Invita a instalar la web como app, solo en celular y solo después de una
 * reserva (cuando ya tiene motivo para volver). En Android/Chrome usa el
 * diálogo nativo; en iPhone (Safari no lo tiene) explica el gesto a mano.
 * No aparece si ya está instalada o si la persona dijo "Ahora no".
 */
export default function InstallPrompt() {
  const [mode, setMode] = useState(null); // "native" | "ios" | null
  const deferredPrompt = useRef(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isStandalone || !isMobile || readFlag(DISMISSED_KEY)) return undefined;

    const isIos =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
    let booked = readFlag(BOOKED_KEY);

    const maybeShow = () => {
      if (!booked || readFlag(DISMISSED_KEY)) return;
      if (deferredPrompt.current) setMode("native");
      else if (isIos) setMode("ios");
    };

    const onBeforeInstall = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      maybeShow();
    };
    const onBooked = () => {
      booked = true;
      maybeShow();
    };
    const onInstalled = () => setMode(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("muzzaga:booked", onBooked);
    window.addEventListener("appinstalled", onInstalled);
    maybeShow();
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("muzzaga:booked", onBooked);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    writeFlag(DISMISSED_KEY);
    setMode(null);
  }

  async function install() {
    const evt = deferredPrompt.current;
    if (!evt) return;
    evt.prompt();
    try {
      await evt.userChoice;
    } finally {
      deferredPrompt.current = null;
      setMode(null);
    }
  }

  if (!mode) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="Instalar la app">
      <div className="install-prompt-text">
        <strong>Tené Muzzaga en tu celu</strong>
        <span>
          {mode === "ios"
            ? "Tocá Compartir y elegí «Agregar a inicio» para reservar más rápido."
            : "Instalala y reservá más rápido la próxima vez."}
        </span>
      </div>
      <div className="install-prompt-actions">
        {mode === "native" && (
          <button
            type="button"
            className="install-prompt-btn"
            onClick={install}
          >
            Instalar
          </button>
        )}
        <button
          type="button"
          className="install-prompt-dismiss"
          onClick={dismiss}
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
