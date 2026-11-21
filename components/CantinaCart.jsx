"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ChefHat,
  ChevronRight,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBasket,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import Portal from "./Portal";
import Mascota from "./Mascota";
import useDialogFocus from "../lib/useDialogFocus";
import { CLUB_INFO } from "../data/club";
import { formatARS, plural } from "../lib/format";
import { trackEvent } from "../lib/analytics";
import {
  DEFAULT_DELIVERY,
  DEFAULT_PAY,
  DELIVERY_OPTIONS,
  MAX_ORDER_QTY,
  PAY_OPTIONS,
  buildOrderWhatsAppUrl,
  makeOrderCode,
} from "../lib/cantinaOrder";

const NAME_KEY = "muzzaga-pedido-nombre";
const BROWSER_KEY = "muzzaga-navegador";
const NOT_SAVED = "No pudimos anotar el pedido en el sistema del club.";

/** Id al azar de este navegador: el freno de pedidos cuenta por navegador. */
function browserId() {
  try {
    let id = localStorage.getItem(BROWSER_KEY);
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(BROWSER_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/** − cantidad + ; en 1, el "−" es un tacho y saca el producto. */
export function QtyStepper({ name, qty, onChange }) {
  return (
    <span className="qty-stepper" role="group" aria-label={`Cantidad de ${name}`}>
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        aria-label={qty === 1 ? `Sacar ${name} del pedido` : `Uno menos de ${name}`}
      >
        {qty === 1 ? <Trash2 size={18} aria-hidden="true" /> : <Minus size={18} aria-hidden="true" />}
      </button>
      <output className="qty-stepper-value" aria-live="polite">
        {qty}
      </output>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        disabled={qty >= MAX_ORDER_QTY}
        aria-label={`Uno más de ${name}`}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </span>
  );
}

/** El pedido se paga antes de que la cocina lo empiece: siempre a la vista. */
function PayNotice({ payWith, code }) {
  const how =
    payWith === "transferencia"
      ? "pagalo por transferencia: consultá el alias por WhatsApp o en el mostrador."
      : payWith === "barra"
        ? `pagalo en la barra${code ? ` con el código #${code}` : ""}.`
        : "se paga en la barra o por transferencia.";
  return (
    <p className="menu-cart-pay-notice">
      <Wallet size={20} aria-hidden="true" />
      <span>
        <strong>Primero se paga.</strong> La cocina empieza tu pedido cuando
        está pagado: {how}
      </span>
    </p>
  );
}

/**
 * El pedido de la cantina: panel fijo al costado de la carta en compu y, en
 * celu, la barra "Ver mi pedido" que abre el mismo panel desde abajo.
 *
 * - "Encargar a la cantina" lo manda al panel del club (POST
 *   /api/cantina-orders) y espera la confirmación.
 * - "Enviar por WhatsApp" abre el chat del club con el pedido armado y, en el
 *   mismo toque, lo manda al panel con keepalive (así llega aunque el celu
 *   deje la página en segundo plano). Si el panel no lo pudo anotar, el
 *   WhatsApp sale igual y se avisa.
 */
export default function CantinaCart({ lines, count, total, onQty, onClear, initialDelivery, open, onOpen, onClose }) {
  const uid = useId();
  const [name, setName] = useState("");
  const [deliverTo, setDeliverTo] = useState(initialDelivery || DEFAULT_DELIVERY);
  const [payWith, setPayWith] = useState(DEFAULT_PAY);
  const [notes, setNotes] = useState("");
  const [nameError, setNameError] = useState("");
  const [sendError, setSendError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null); // { code, url, items, total, payWith, via, status, error }
  const nameRefs = useRef({});
  const headingRefs = useRef({});

  // Después de vaciar, sacar la última línea o enviar, el botón que tenía el
  // foco desaparece: el foco va al título del panel en vez de caer en <body>.
  const focusHeading = (variant) =>
    requestAnimationFrame(() => headingRefs.current[variant]?.focus({ preventScroll: true }));

  const close = () => {
    setSent(null);
    onClose();
    // Si el botón que abrió el panel ya no está (se envió o se vació el
    // pedido), el foco vuelve a "Ver mi pedido" de arriba.
    requestAnimationFrame(() => {
      if (!document.activeElement || document.activeElement === document.body) {
        document.querySelector(".menu-cart-open")?.focus({ preventScroll: true });
      }
    });
  };
  const dialogRef = useDialogFocus(open, close);

  // Con la hoja abierta la carta de atrás no se mueve. Va en <html>: el
  // sitio le pone overflow al html, así que en el body no alcanzaba.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbar) root.style.paddingRight = `${scrollbar}px`;
    return () => {
      root.style.overflow = "";
      root.style.paddingRight = "";
    };
  }, [open]);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) || "");
    } catch {}
  }, []);

  useEffect(() => {
    setDeliverTo(initialDelivery || DEFAULT_DELIVERY);
  }, [initialDelivery]);

  // En compu el panel queda a la vista: si después de enviar se suman
  // productos, arranca un pedido nuevo en vez de seguir en la confirmación.
  useEffect(() => {
    if (count > 0) setSent((s) => (s && s.status !== "sending" ? null : s));
  }, [count]);

  // Con la barra a la vista, el final de la página sube para que no tape el
  // footer (la barra solo existe en celu y tablet; ver CSS). Sigue montada
  // con el panel abierto (queda detrás del velo) para que el foco vuelva a
  // ella al cerrar.
  const barVisible = count > 0;
  useEffect(() => {
    document.body.classList.toggle("has-cart-bar", barVisible);
    return () => document.body.classList.remove("has-cart-bar");
  }, [barVisible]);

  const deliveryOptions = DELIVERY_OPTIONS.some((o) => o.label === deliverTo)
    ? DELIVERY_OPTIONS
    : [...DELIVERY_OPTIONS, { id: "qr", label: deliverTo }];

  function checkName(variant) {
    if (name.trim().length >= 2) return true;
    setNameError("Poné tu nombre para que sepamos de quién es el pedido.");
    nameRefs.current[variant]?.focus();
    return false;
  }

  function buildOrder() {
    return {
      code: makeOrderCode(),
      items: lines,
      total,
      name: name.trim(),
      deliverTo,
      payWith,
      notes: notes.trim(),
    };
  }

  function postOrder(order, keepalive) {
    return fetch("/api/cantina-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: order.code,
        items: order.items.map(({ id, qty }) => ({ id, qty })),
        name: order.name,
        deliverTo: order.deliverTo,
        payWith: order.payWith,
        notes: order.notes,
        browserId: browserId(),
      }),
      keepalive,
    }).then((res) => res.json().catch(() => ({ ok: false })));
  }

  function finish(order, via, status, variant) {
    trackEvent("cantina_pedido", { via, productos: count, total });
    try {
      localStorage.setItem(NAME_KEY, order.name);
    } catch {}
    setSent({
      code: order.code,
      url: buildOrderWhatsAppUrl(CLUB_INFO.phoneRaw, order),
      items: order.items,
      total: order.total,
      payWith: order.payWith,
      via,
      status,
    });
    setNotes("");
    setSendError("");
    onClear();
    // La confirmación arranca arriba (código y mascota a la vista), aunque
    // el panel estuviera scrolleado hasta el nombre.
    requestAnimationFrame(() =>
      headingRefs.current[variant]?.closest(".menu-cart-panel")?.scrollTo({ top: 0 }),
    );
    focusHeading(variant);
  }

  async function sendToPanel(variant) {
    if (busy || !checkName(variant)) return;
    const order = buildOrder();
    setBusy(true);
    setSendError("");
    try {
      const res = await postOrder(order, false);
      if (res.ok) finish(order, "panel", "ok", variant);
      else setSendError(`${res.error || NOT_SAVED} Probá de nuevo o mandalo por WhatsApp.`);
    } catch {
      setSendError(`${NOT_SAVED} Revisá la conexión, probá de nuevo o mandalo por WhatsApp.`);
    } finally {
      setBusy(false);
    }
  }

  function sendByWhatsApp(variant) {
    if (busy || !checkName(variant)) return;
    const order = buildOrder();
    // Primero sale el pedido al panel y después se abre WhatsApp, los dos en
    // este mismo toque (ver app/api/cantina-orders/route.js).
    const request = postOrder(order, true);
    window.open(buildOrderWhatsAppUrl(CLUB_INFO.phoneRaw, order), "_blank", "noopener");
    finish(order, "whatsapp", "sending", variant);
    const settle = (status, error) =>
      setSent((s) => (s && s.code === order.code ? { ...s, status, error } : s));
    request
      .then((res) => settle(res.ok ? "ok" : "error", res.error))
      .catch(() => settle("error"));
  }

  // Función y no componente: el panel se dibuja en dos lugares (costado en
  // compu, hoja en celu) con el mismo estado, sin remontarse en cada tecla.
  const renderPanel = (variant) => {
    const ids = {
      title: `${uid}-${variant}-titulo`,
      nameError: `${uid}-${variant}-error-nombre`,
      pay: `${uid}-${variant}-pago`,
    };
    const title = sent
      ? sent.via === "panel"
        ? "¡Pedido encargado!"
        : "¡Pedido enviado!"
      : "Tu pedido";
    const head = (
      <div className="menu-cart-head">
        <h2
          id={ids.title}
          tabIndex={-1}
          ref={(el) => {
            headingRefs.current[variant] = el;
          }}
        >
          <span className="carta-pelota" aria-hidden="true" />
          {title}
          {!sent && count > 0 && <span className="menu-cart-head-count">{plural(count, "producto", "productos")}</span>}
        </h2>
        {variant === "sheet" && (
          <button type="button" className="menu-cart-close" onClick={close} aria-label="Cerrar">
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>
    );

    if (sent) {
      const statusText =
        sent.via === "panel"
          ? "La cantina ya lo tiene en su panel."
          : sent.status === "sending"
            ? "Anotando el pedido en la cantina…"
            : sent.status === "ok"
              ? "Tocá enviar en WhatsApp y listo: la cantina también lo tiene en su panel."
              : `${sent.error || NOT_SAVED} El mensaje de WhatsApp sale igual: tocá enviar ahí.`;
      return (
        <>
          {head}
          <div className="menu-cart-body menu-cart-sent">
            <Mascota pose="pizza-cerveza" size="s" className="pass-festejo" />
            <p className="menu-cart-sent-code">
              Pedido <strong>#{sent.code}</strong> · {formatARS(sent.total)}
            </p>
            <p className="menu-cart-sent-text" role="status">
              {statusText}
            </p>
            <PayNotice payWith={sent.payWith} code={sent.code} />
            <ul className="menu-cart-sent-lines">
              {sent.items.map((it) => (
                <li key={it.id}>
                  {it.qty} × {it.name}
                </li>
              ))}
            </ul>
            <a className="menu-cart-reopen" href={sent.url} target="_blank" rel="noopener">
              <MessageCircle size={18} aria-hidden="true" />
              {sent.via === "panel" ? "Avisar también por WhatsApp" : "¿No se abrió WhatsApp? Abrilo acá"}
            </a>
          </div>
          <div className="menu-cart-foot">
            <button
              type="button"
              className="btn btn-linear-primary menu-cart-send"
              onClick={
                variant === "sheet"
                  ? close
                  : () => {
                      setSent(null);
                      focusHeading(variant);
                    }
              }
            >
              {variant === "sheet" ? "Listo" : "Hacer otro pedido"}
            </button>
          </div>
        </>
      );
    }

    if (lines.length === 0) {
      return (
        <>
          {head}
          <div className="menu-cart-body menu-cart-empty">
            <ShoppingBasket size={32} className="icono-marca" aria-hidden="true" />
            <p>
              Todavía no sumaste nada. Tocá «Agregar» en cada producto para
              sumarlo al pedido.
            </p>
            <PayNotice />
            {variant === "sheet" && (
              <button type="button" className="btn btn-secondary" onClick={close}>
                Seguir mirando la carta
              </button>
            )}
          </div>
        </>
      );
    }

    return (
      <>
        {head}
        <div className="menu-cart-body">
          <ul className="menu-cart-lines">
            {lines.map((line) => (
              <li key={line.id}>
                <span className="menu-cart-line-name">
                  {line.name}
                  <small>{formatARS(line.price)} c/u</small>
                </span>
                <QtyStepper
                  name={line.name}
                  qty={line.qty}
                  onChange={(q) => {
                    onQty(line.id, q);
                    if (q <= 0) focusHeading(variant);
                  }}
                />
                <strong className="menu-cart-line-total">{formatARS(line.price * line.qty)}</strong>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="menu-cart-clear"
            onClick={() => {
              onClear();
              focusHeading(variant);
            }}
          >
            Vaciar pedido
          </button>

          <div className="menu-cart-fields">
            <label className="menu-cart-field">
              <span>Tu nombre</span>
              <input
                ref={(el) => {
                  nameRefs.current[variant] = el;
                }}
                type="text"
                value={name}
                maxLength={40}
                autoComplete="given-name"
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? ids.nameError : undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError("");
                }}
              />
            </label>
            {nameError && (
              <p id={ids.nameError} className="menu-cart-error" role="alert">
                {nameError}
              </p>
            )}
            <label className="menu-cart-field">
              <span>Entrega</span>
              <select value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)}>
                {deliveryOptions.map((o) => (
                  <option key={o.id} value={o.label}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="menu-cart-field menu-cart-pay">
              <legend>¿Cómo lo pagás?</legend>
              <div className="menu-cart-pay-options">
                {PAY_OPTIONS.map((o) => (
                  <label key={o.id} className={`menu-cart-pay-option${payWith === o.id ? " is-on" : ""}`}>
                    <input
                      type="radio"
                      name={ids.pay}
                      value={o.id}
                      checked={payWith === o.id}
                      onChange={() => setPayWith(o.id)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="menu-cart-field">
              <span>
                Aclaraciones <em>(opcional)</em>
              </span>
              <input
                type="text"
                value={notes}
                maxLength={140}
                placeholder="Ej.: sin cebolla, bien fría"
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="menu-cart-foot">
          <div className="menu-cart-total">
            <span>Total</span>
            <strong>{formatARS(total)}</strong>
          </div>
          <PayNotice payWith={payWith} />
          {sendError && (
            <p className="menu-cart-error" role="alert">
              {sendError}
            </p>
          )}
          <div className="menu-cart-actions">
            <button
              type="button"
              className="btn btn-linear-primary menu-cart-send"
              disabled={busy}
              onClick={() => sendToPanel(variant)}
            >
              <ChefHat size={20} aria-hidden="true" />
              {busy ? "Encargando…" : "Encargar a la cantina"}
            </button>
            <button
              type="button"
              className="btn btn-secondary-whatsapp menu-cart-send"
              disabled={busy}
              onClick={() => sendByWhatsApp(variant)}
            >
              <MessageCircle size={20} aria-hidden="true" />
              Enviar por WhatsApp
            </button>
          </div>
          <p className="menu-cart-hint">
            Las dos opciones le llegan a la cantina. Por WhatsApp, además, te
            respondemos por ahí.
          </p>
        </div>
      </>
    );
  };

  return (
    <>
      <aside className="menu-cart-aside" aria-labelledby={`${uid}-aside-titulo`}>
        <div className="menu-cart-panel">{renderPanel("aside")}</div>
      </aside>

      {/* En un Portal: dentro del .container (z-index propio) el footer, que
          viene después, se pintaba encima de la barra y no se podía tocar. */}
      {barVisible && (
        <Portal>
        <button type="button" className="menu-cart-bar" onClick={onOpen} aria-haspopup="dialog">
          <span className="menu-cart-bar-icon" aria-hidden="true">
            <ShoppingCart size={22} />
            <strong key={count} className="menu-cart-bar-badge">
              {count}
            </strong>
          </span>
          {/* Debajo del título, cuántos son y adónde va: con el QR de la mesa
              se confirma de un vistazo que sale para ahí. */}
          <span className="menu-cart-bar-label">
            Ver mi pedido
            <small className="menu-cart-bar-sub">
              {plural(count, "producto", "productos")} · {deliverTo}
            </small>
          </span>
          <strong className="menu-cart-bar-total">{formatARS(total)}</strong>
          <span className="menu-cart-bar-arrow" aria-hidden="true">
            <ChevronRight size={22} strokeWidth={2.5} />
          </span>
        </button>
        </Portal>
      )}

      {open && (
        <Portal>
          <div className="menu-cart-backdrop" onClick={close}>
            <div
              className="menu-cart-panel menu-cart-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${uid}-sheet-titulo`}
              ref={dialogRef}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              {renderPanel("sheet")}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
