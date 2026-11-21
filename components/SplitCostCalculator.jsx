"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { PRECIO_TURNO, PRECIO_POR_JUGADOR } from "../data/pricing";
import {
  buildSplitCostMessage,
  buildSplitCostWhatsAppUrl,
} from "../lib/splitCost";
import Mascota from "./Mascota";
import { WhatsAppLogo } from "./BrandLogos";
import { CreditCard, Check, Copy, Minus, Plus, ChevronDown, ArrowDown } from "lucide-react";

const CANCHA_PRICE = PRECIO_TURNO;

// Arranca con un ejemplo armado, si esos productos siguen destacados en la carta.
const EXAMPLE_EXTRAS = { heineken_litro: 2, pizza_muzza: 1 };

// Cuántos productos se ven de entrada: con los 16 a la vista el paso 3 era
// más largo que todo el resto. Los que ya sumaste se ven siempre.
const VISIBLE_EXTRAS = 6;

const money = (n) => `$${n.toLocaleString("es-AR")}`;

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
  const [showAll, setShowAll] = useState(false);

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

  const visibleExtras = showAll
    ? extras
    : extras.filter((e, i) => i < VISIBLE_EXTRAS || selectedExtras[e.id]);
  const hiddenCount = extras.length - visibleExtras.length;

  return (
    <section id="split-cost" className="hx-tool hx-tool--dividir">
      <div className="container">
        <header className="hx-hero">
          <span className="hx-hero-pelota" aria-hidden="true" />
          <Image
            src="/img/iconos/icono-dividir.webp"
            alt=""
            width={124}
            height={124}
            priority
            className="hx-hero-icono icono-3d"
          />
          <div className="hx-hero-cabeza">
            <p className="hx-hero-kicker">Herramienta 01 · Para grupos</p>
            <h1 className="hx-hero-titulo">Dividir cancha y cantina</h1>
          </div>
          <p className="hx-hero-desc">
            Dividí en segundos la cancha y lo que van a comer o tomar en la
            cantina. Mandá el desglose al grupo y listo.
          </p>
          <ul className="hx-hero-chips" aria-label="Características">
            <li>Precios de la cantina al día</li>
            <li>Directo a WhatsApp</li>
          </ul>
        </header>

        <div className="hx-dv-grid">
          <div className="hx-dv-config">
            {/* PASO 1: el turno */}
            <div className="hx-card">
              <div className="hx-paso">
                <span className="hx-paso-num" aria-hidden="true">1</span>
                <div>
                  <h2 className="hx-paso-titulo">El turno</h2>
                  <p className="hx-paso-desc">Tarifa fija para todos los días y horarios</p>
                </div>
              </div>
              <div className="hx-dv-turno">
                <div>
                  <span className="hx-dv-turno-nombre">Cancha de cristal</span>
                  <span className="hx-dv-turno-dur">Turno de 90 minutos</span>
                </div>
                <div className="hx-dv-turno-precio">
                  <strong>{money(canchaPrice)}</strong>
                  <span>{money(PRECIO_POR_JUGADOR)} c/u si son 4</span>
                </div>
              </div>
            </div>

            {/* PASO 2: entre cuántos */}
            <div className="hx-card">
              <div className="hx-paso">
                <span className="hx-paso-num" aria-hidden="true">2</span>
                <div>
                  <h2 className="hx-paso-titulo">¿Entre cuántos?</h2>
                  <p className="hx-paso-desc">Los que ponen plata, jueguen o no</p>
                </div>
              </div>
              <div className="hx-numeros" role="group" aria-label="Jugadores a dividir">
                {[2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`hx-num${players === num ? " is-on" : ""}`}
                    aria-pressed={players === num}
                    aria-label={`${num} jugadores${num === 4 ? " (estándar)" : ""}`}
                    onClick={() => setPlayers(num)}
                  >
                    <span className="hx-num-valor">{num}</span>
                    <span className="hx-num-cap">{num === 4 ? "estándar" : "jug."}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* PASO 3: cantina */}
            <div className="hx-card">
              <div className="hx-paso">
                <span className="hx-paso-num" aria-hidden="true">3</span>
                <div>
                  <h2 className="hx-paso-titulo">Tercer tiempo</h2>
                  <p className="hx-paso-desc">Pizzas, birras y bebidas de la cantina</p>
                </div>
              </div>

              <ul className="hx-dv-extras">
                {visibleExtras.map((extra) => {
                  const qty = selectedExtras[extra.id] || 0;
                  return (
                    <li key={extra.id} className={`hx-dv-extra${qty > 0 ? " is-on" : ""}`}>
                      <div>
                        <strong className="hx-dv-extra-nombre">{extra.name}</strong>
                        <span className="hx-dv-extra-precio">{money(extra.price)}</span>
                      </div>
                      {qty > 0 ? (
                        <div className="hx-dv-contador">
                          <button
                            type="button"
                            onClick={() => removeExtra(extra.id)}
                            aria-label={`Restar un ${extra.name}`}
                          >
                            <Minus size={18} aria-hidden="true" />
                          </button>
                          <span className="hx-dv-qty" key={qty} aria-live="polite">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => addExtra(extra.id)}
                            aria-label={`Sumar otro ${extra.name}`}
                          >
                            <Plus size={18} aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="hx-dv-sumar"
                          onClick={() => addExtra(extra.id)}
                          aria-label={`Sumar ${extra.name}`}
                        >
                          <Plus size={16} aria-hidden="true" /> Sumar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {(hiddenCount > 0 || showAll) && extras.length > VISIBLE_EXTRAS && (
                <button
                  type="button"
                  className="hx-btn2 hx-dv-mas"
                  onClick={() => setShowAll((v) => !v)}
                  aria-expanded={showAll}
                >
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    style={showAll ? { transform: "rotate(180deg)" } : undefined}
                  />
                  {showAll ? "Ver menos productos" : `Ver ${hiddenCount} productos más`}
                </button>
              )}
            </div>

            {/* Mini marcador del celu: acompaña mientras elegís. */}
            <a href="#resumen-partido" className="hx-dv-mini">
              <span className="hx-dv-mini-monto" key={perPerson}>
                {money(perPerson)}
                <small>c/u · {players} jug.</small>
              </span>
              <span className="hx-dv-mini-ir">
                Resumen <ArrowDown size={16} aria-hidden="true" />
              </span>
            </a>
          </div>

          {/* RESUMEN: marcador + ticket + compartir */}
          <aside id="resumen-partido" className="hx-dv-resumen" aria-label="Resumen del partido">
            <div className="hx-marcador hx-dv-marcador">
              <p className="hx-marcador-label">Cada uno paga</p>
              <strong className="hx-marcador-valor" key={perPerson}>
                {money(perPerson)}
              </strong>
              <p className="hx-marcador-sub">
                {players} jugadores · total {money(grandTotal)}
              </p>
              <ul className="hx-dv-pelotas" aria-hidden="true" key={players}>
                {Array.from({ length: players }, (_, i) => (
                  <li key={i} />
                ))}
              </ul>
              <Mascota
                pose="pizza-padel-mood"
                size="s"
                alt=""
                className="hx-dv-masc"
              />
            </div>

            <div className="hx-ticket">
              <div className="hx-ticket-fila">
                <span>
                  Cancha (90 min)
                  <span className="hx-ticket-nota">
                    {money(canchaPrice / 4)} por jugador si son cuatro
                  </span>
                </span>
                <strong>{money(canchaPrice)}</strong>
              </div>

              {Object.entries(selectedExtras).map(([id, qty]) => {
                const item = extras.find((e) => e.id === id);
                if (!item) return null;
                return (
                  <div key={id} className="hx-ticket-fila">
                    <span>
                      {qty}x {item.name}
                    </span>
                    <strong>{money(item.price * qty)}</strong>
                  </div>
                );
              })}

              <div className="hx-ticket-fila hx-ticket-total">
                <span>Total</span>
                <strong>{money(grandTotal)}</strong>
              </div>
            </div>

            <div>
              <label className="hx-etiqueta" htmlFor="split-alias">
                <CreditCard size={18} className="icono-marca" aria-hidden="true" />
                Tu alias o CBU para cobrar (opcional)
              </label>
              <input
                id="split-alias"
                type="text"
                className="hx-campo"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="Ej. lucas.padel.mp"
                autoComplete="off"
              />
            </div>

            <div className="hx-acciones">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hx-wa"
              >
                <WhatsAppLogo size={22} color="#ffffff" /> Mandar al grupo de WhatsApp
              </a>

              <button
                type="button"
                className={`hx-btn2${copied ? " is-ok" : ""}`}
                onClick={handleCopySummary}
              >
                {copied ? (
                  <><Check size={18} aria-hidden="true" /> Desglose copiado</>
                ) : (
                  <><Copy size={18} className="icono-marca" aria-hidden="true" /> Copiar texto del desglose</>
                )}
              </button>
            </div>

            <p className="hx-aviso">
              Para señar el turno avisá por WhatsApp al <strong>299 597-4176</strong>.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
