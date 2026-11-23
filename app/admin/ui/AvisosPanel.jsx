"use client";

import { useEffect, useRef } from "react";
import {
  AlarmClock,
  ArrowRight,
  BellRing,
  CircleAlert,
  Info,
  KeyRound,
  NotebookPen,
  ReceiptText,
  ShoppingBag,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import { findNavItem, preselectAjustesSection } from "../nav";

// Cada aviso con su dibujito, así se reconoce sin leer el título entero.
const ALERT_ICON = {
  "web-orders": ShoppingBag,
  "staff-setup": KeyRound,
  "yesterday-open": Wallet,
  overdue: AlarmClock,
  "paid-no-payment": ReceiptText,
  "on-account": NotebookPen,
};

const TONE_ICON = { danger: CircleAlert, warning: TriangleAlert, info: Info };

// Lo urgente arriba; lo informativo al final.
const GROUPS = [
  { tone: "danger", title: "Resolver ya" },
  { tone: "warning", title: "Para revisar hoy" },
  { tone: "info", title: "Para tener en cuenta" },
];

/**
 * Panel de avisos de la campana: en compu se abre al costado derecho, en el
 * celu sube desde abajo como la hoja "Más". Cada aviso es una tarjeta con el
 * color de su urgencia y un botón que lleva a la sección donde se resuelve.
 */
export default function AvisosPanel({ alerts, closing, onClose, onNavigate }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  const groups = GROUPS.map((g) => ({
    ...g,
    items: alerts.filter((a) => (a.tone || "info") === g.tone),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      className={`admin-avisos-backdrop${closing ? " is-closing" : ""}`}
      onClick={onClose}
    >
      <section
        className="admin-avisos"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-avisos-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-sheet-handle" aria-hidden="true" />
        <header className="admin-avisos-head">
          <span className="admin-avisos-head-icon" aria-hidden="true">
            <BellRing size={20} strokeWidth={1.9} />
          </span>
          <div>
            <h2 id="admin-avisos-title">Avisos</h2>
            <p>
              {alerts.length === 0
                ? "Nada pendiente"
                : `${alerts.length} para resolver`}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="admin-avisos-close"
            onClick={onClose}
            aria-label="Cerrar avisos"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <div className="admin-avisos-body">
          {groups.length === 0 ? (
            <div className="admin-avisos-empty">
              <span className="admin-avisos-empty-court" aria-hidden="true">
                <span className="admin-avisos-empty-ball" />
              </span>
              <strong>Todo en orden</strong>
              <p>
                Si entra un pedido de la carta, queda una caja sin cerrar o un
                turno con saldo, te avisamos acá.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.tone} className="admin-avisos-group">
                <p className="admin-avisos-group-title" data-tone={group.tone}>
                  {group.title}
                  <span>{group.items.length}</span>
                </p>
                <ul>
                  {group.items.map((alert) => {
                    const Icon =
                      ALERT_ICON[alert.id] || TONE_ICON[group.tone] || Info;
                    return (
                      <li
                        key={alert.id}
                        className="admin-aviso"
                        data-tone={group.tone}
                      >
                        <span className="admin-aviso-icon" aria-hidden="true">
                          <Icon size={20} strokeWidth={1.8} />
                        </span>
                        <div className="admin-aviso-text">
                          <strong>{alert.title}</strong>
                          {alert.detail && <span>{alert.detail}</span>}
                          {alert.view && (
                            <button
                              type="button"
                              className="admin-aviso-go"
                              onClick={() => {
                                onClose();
                                // Ajustes va por partes: este aviso abre
                                // directo en Equipo.
                                if (alert.id === "staff-setup") {
                                  preselectAjustesSection("equipo");
                                }
                                onNavigate(alert.view);
                              }}
                            >
                              Ir a {findNavItem(alert.view).label}
                              <ArrowRight
                                size={16}
                                strokeWidth={2}
                                aria-hidden
                              />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <p className="admin-avisos-foot">Se actualiza solo cada 30 segundos.</p>
      </section>
    </div>
  );
}
