"use client";

import { useMemo, useState } from "react";
import { PRECIO_TURNO, PRECIO_POR_JUGADOR } from "../data/pricing";
import {
  buildSplitCostMessage,
  buildSplitCostWhatsAppUrl,
} from "../lib/splitCost";
import Mascota from "./Mascota";
import ScrollRow from "./ScrollRow";
import { CreditCard, Share2, Check, Copy } from "lucide-react";

const CANCHA_PRICE = PRECIO_TURNO;

// Arranca con un ejemplo armado, si esos productos siguen destacados en la carta.
const EXAMPLE_EXTRAS = { heineken_litro: 2, pizza_muzza: 1 };

/** `extras`: los productos destacados de la carta. */
export default function SplitCostCalculator({ extras }) {
  const [players, setPlayers] = useState(4);
  const [selectedExtras, setSelectedExtras] = useState(() =>
    Object.fromEntries(
      Object.entries(EXAMPLE_EXTRAS).filter(([id]) => extras.some((e) => e.id === id)),
    ),
  );
  const [alias, setAlias] = useState("");
  const [copied, setCopied] = useState(false);

  const canchaPrice = CANCHA_PRICE;

  const addExtra = (id) => {
    setSelectedExtras((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  const removeExtra = (id) => {
    setSelectedExtras((prev) => {
      const current = prev[id] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: current - 1 };
    });
  };

  const extrasTotal = useMemo(() => {
    return Object.entries(selectedExtras).reduce((acc, [id, qty]) => {
      const item = extras.find((e) => e.id === id);
      return acc + (item ? item.price * qty : 0);
    }, 0);
  }, [extras, selectedExtras]);

  const grandTotal = canchaPrice + extrasTotal;
  const perPerson = Math.round(grandTotal / (players || 1));

  const handleCopySummary = () => {
    const msg = buildSplitCostMessage({
      canchaPrice,
      players,
      selectedExtras,
      menuItems: extras,
      alias,
    });
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const whatsappUrl = useMemo(() => {
    return buildSplitCostWhatsAppUrl({
      canchaPrice,
      players,
      selectedExtras,
      menuItems: extras,
      alias,
    });
  }, [canchaPrice, players, selectedExtras, extras, alias]);

  return (
    <section id="split-cost" className="section-turnos">
      <div className="container">
        <div className="section-header-row">
          <div>
            <span
              className="badge-linear badge-emerald"
              style={{ marginBottom: 8 }}
            >
              Herramienta para grupos
            </span>
            <h2 className="section-title">
              Calculadora de partido y tercer tiempo
            </h2>
            <p className="section-desc">
              Dividí en segundos la cancha y lo que van a comer o tomar en la
              cantina. Copiá el desglose y pasalo al grupo.
            </p>
          </div>
          <div className="mascot-section-badge">
            <Mascota
              pose="pizza-padel-mood"
              alt="Muzzaguito disfrutando una pizza en el tercer tiempo"
              className="mascot-section-img"
            />
          </div>
        </div>

        <div className="split-calculator-grid">
          {/* COLUMNA IZQUIERDA: CONFIGURACIÓN */}
          <div className="split-config-card">
            <div className="split-section-header">
              <span className="split-step-badge">1</span>
              <div>
                <h3 className="split-step-title">Turno de cancha (90 min)</h3>
                <p className="split-step-desc">
                  Tarifa fija para todos los días y horarios
                </p>
              </div>
            </div>

            <div
              style={{
                marginBottom: 20,
                padding: "12px 16px",
                background: "var(--color-canvas-soft)",
                border: "1px solid var(--color-hairline-strong)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--color-ink)",
                    fontSize: 14,
                  }}
                >
                  Cancha de cristal
                </div>
                <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
                  Turno de 90 minutos
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "var(--color-ink)",
                  }}
                >
                  ${canchaPrice.toLocaleString("es-AR")}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--color-text-link)",
                    fontWeight: 600,
                  }}
                >
                  ${PRECIO_POR_JUGADOR.toLocaleString("es-AR")} c/u (cuarteto)
                </div>
              </div>
            </div>

            <div className="split-section-header">
              <span className="split-step-badge">2</span>
              <div>
                <h3 className="split-step-title">Jugadores a dividir</h3>
                <p className="split-step-desc">
                  ¿Entre cuántos dividen los gastos?
                </p>
              </div>
            </div>

            <div className="players-selector-row">
              {[2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`player-count-btn${players === num ? " active" : ""}`}
                  onClick={() => setPlayers(num)}
                >
                  {num === 4 ? "4 (Estándar)" : `${num} jugadores`}
                </button>
              ))}
            </div>

            <div className="split-section-header" style={{ marginTop: 24 }}>
              <span className="split-step-badge">3</span>
              <div>
                <h3 className="split-step-title">Sumar cantina y extras</h3>
                <p className="split-step-desc">
                  Pizzas, birras, bebidas y minutas para el partido.
                </p>
              </div>
            </div>

            <p className="mobile-swipe-hint">← Deslizá para ver más extras →</p>
            <ScrollRow className="extras-selector-list">
              {extras.map((extra) => {
                const qty = selectedExtras[extra.id] || 0;
                return (
                  <div key={extra.id} className="extra-item-row">
                    <div className="extra-info">
                      <div>
                        <strong className="extra-name">{extra.name}</strong>
                        <span className="extra-price">
                          ${extra.price.toLocaleString("es-AR")}
                        </span>
                      </div>
                    </div>
                    <div className="extra-counter-controls">
                      {qty > 0 && (
                        <button
                          type="button"
                          className="counter-btn minus"
                          onClick={() => removeExtra(extra.id)}
                          aria-label="Restar uno"
                        >
                          −
                        </button>
                      )}
                      {qty > 0 && <span className="counter-qty">{qty}</span>}
                      <button
                        type="button"
                        className="counter-btn plus"
                        onClick={() => addExtra(extra.id)}
                        aria-label="Agregar uno"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </ScrollRow>
          </div>

          {/* COLUMNA DERECHA: TICKET FINTECH & COPIAR */}
          <div className="split-summary-card">
            <div className="split-ticket-top">
              <span className="split-ticket-badge">Resumen del partido</span>
              <div className="split-amount-big">
                ${perPerson.toLocaleString("es-AR")}
                <span className="split-amount-sub">
                  por jugador ({players} pers.)
                </span>
              </div>
            </div>

            <div className="split-ticket-breakdown">
              <div className="ticket-row">
                <div>
                  <span>Cancha (90 min)</span>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    ${(canchaPrice / 4).toLocaleString("es-AR")} por jugador si
                    son cuatro
                  </div>
                </div>
                <strong>${canchaPrice.toLocaleString("es-AR")}</strong>
              </div>

              {Object.entries(selectedExtras).map(([id, qty]) => {
                const item = extras.find((e) => e.id === id);
                if (!item) return null;
                return (
                  <div key={id} className="ticket-row extra">
                    <span>
                      {qty}x {item.name}
                    </span>
                    <strong>
                      ${(item.price * qty).toLocaleString("es-AR")}
                    </strong>
                  </div>
                );
              })}

              <div className="ticket-divider" />

              <div className="ticket-row total">
                <span>Total</span>
                <strong>${grandTotal.toLocaleString("es-AR")}</strong>
              </div>
            </div>

            <div style={{ margin: "14px 0 16px" }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                <CreditCard size={20} className="icono-marca" aria-hidden="true" /> Tu alias o CBU para cobrar (opcional):
              </label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="Ej. lucas.padel.mp o 00000031..."
                style={{
                  width: "100%",
                  height: 38,
                  fontSize: 13,
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm, 6px)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  minHeight: 46,
                  fontSize: 14.5,
                  textDecoration: "none",
                }}
              >
                <Share2 size={20} aria-hidden="true" /> Enviar al grupo de WhatsApp
              </a>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  minHeight: 44,
                  fontSize: 13,
                }}
                onClick={handleCopySummary}
              >
                {copied ? (
                  <><Check size={20} className="icono-marca" aria-hidden="true" /> Desglose copiado</>
                ) : (
                  <><Copy size={20} className="icono-marca" aria-hidden="true" /> Copiar texto del desglose</>
                )}
              </button>
            </div>

            <div className="split-alias-notice">
              <span>Coordinación de pago:</span>{" "}
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>
                Avisá por WhatsApp al <strong>299 597-4176</strong> para señar tu turno
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
