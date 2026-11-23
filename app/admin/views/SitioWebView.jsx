"use client";

import SitioWebSection from "./SitioWebSection";

/**
 * Sitio web como sección propia del menú: antes era la última parte de
 * Ajustes, pero acá cada cambio se publica al instante (no espera Guardar),
 * así que mezclado con el resto confundía.
 */
export default function SitioWebView({ onExpiredSession, onToast }) {
  return (
    <div className="admin-cfg admin-sitio-view">
      <SitioWebSection onExpiredSession={onExpiredSession} onToast={onToast} />
    </div>
  );
}
