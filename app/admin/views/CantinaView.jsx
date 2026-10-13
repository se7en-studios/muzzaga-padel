"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  ClipboardList,
  Coins,
  Minus,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { EmptyState, SkeletonRows } from "../ui/states";
import {
  formatARS,
  formatTime,
  normalizeSearch,
  plural,
} from "../../../lib/format";
import {
  adminAddCantinaSale,
  adminGetCantinaSales,
  adminGetTopProducts,
  adminSetTestFlag,
  adminSettleCantinaSale,
  adminVoidCantinaSale,
  adminDeleteCantinaSale,
  adminGetCantinaOrders,
  adminSetCantinaOrderStatus,
  getAdminDayData,
} from "../actions";
import {
  OPEN_ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  payLabel,
} from "../../../lib/cantinaOrder";
import { MENU_CATEGORIES, MENU_ITEMS } from "../../../data/menu";
import StaffPinModal from "../ui/StaffPinModal";
import { usePinGate } from "../ui/usePinGate";
import { todayInClub } from "../../../lib/booking";
import {
  computeDailyCash,
  isCountableBooking,
  onAccountTotal,
} from "../../../lib/metrics";
import { PAYMENT_METHODS, WhatsAppMiniIcon } from "../adminHelpers";

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true };
const METHODS = [...PAYMENT_METHODS, { value: "cuenta", label: "A cuenta" }];
const methodLabel = (m) => METHODS.find((x) => x.value === m)?.label || m;
const QUICK_FAVORITE_IDS = ["agua_500", "gatorade_500", "corona_330", "tubo_pelotas"];
// Cada cuánto se buscan pedidos nuevos de la carta mientras la vista está abierta.
const ORDERS_POLL_MS = 20000;
// Las categorías del menú público traen emoji adelante; en el admin, texto solo.
const plainLabel = (label) => String(label || "").replace(/^[^\p{L}\p{N}]+/u, "");
const categoryLabel = (id) =>
  plainLabel(MENU_CATEGORIES.find((c) => c.id === id)?.label);

function isTypingTarget(el) {
  return Boolean(
    el &&
    (el.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)),
  );
}

export default function CantinaView({ onExpiredSession, onToast }) {
  const [date, setDate] = useState(todayInClub);
  const [query, setQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const [cart, setCart] = useState([]); // [{ name, price, qty }]
  const [method, setMethod] = useState("efectivo");
  const [chargeTo, setChargeTo] = useState("");
  const [dayBookings, setDayBookings] = useState([]);
  const [sales, setSales] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false); // bottom sheet en mobile
  const [voiding, setVoiding] = useState(null); // venta a anular
  const [voidReason, setVoidReason] = useState("");
  const [deletingSale, setDeletingSale] = useState(null);
  const { ask: askPin, pinModal } = usePinGate();
  const [orders, setOrders] = useState(null); // pedidos de la carta del día
  const [pendingOrder, setPendingOrder] = useState(null); // el que se está cobrando
  const [confirmCancel, setConfirmCancel] = useState(null);
  const seenOrderIds = useRef(null);
  const searchRef = useRef(null);

  async function loadOrders() {
    const res = await adminGetCantinaOrders(date);
    if (!res.ok) {
      onExpiredSession?.(res);
      return;
    }
    // Aviso de los que entraron desde la última vez (no en la primera carga).
    const fresh = seenOrderIds.current
      ? res.orders.filter((o) => o.status === "nuevo" && !seenOrderIds.current.has(o.id))
      : [];
    seenOrderIds.current = new Set(res.orders.map((o) => o.id));
    fresh.forEach((o) =>
      onToast?.(`Nuevo pedido de la carta · #${o.code} · ${o.name} · ${formatARS(o.total)}`),
    );
    setOrders(res.orders);
  }

  useEffect(() => {
    seenOrderIds.current = null;
    setOrders(null);
    loadOrders();
    if (date !== todayInClub()) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadOrders();
    }, ORDERS_POLL_MS);
    return () => clearInterval(id);
  }, [date]);

  async function setOrderStatus(order, status, { saleId, undo } = {}) {
    const res = await adminSetCantinaOrderStatus(order.id, status, saleId);
    setConfirmCancel(null);
    if (!res.ok) {
      if (res.orderChanged) loadOrders();
      if (!onExpiredSession?.(res)) {
        onToast?.(res.error || "No se pudo actualizar el pedido.", { tone: "error" });
      }
      return false;
    }
    if (pendingOrder?.id === order.id && status === "cancelado") {
      setPendingOrder(null);
      setCart([]);
    }
    loadOrders();
    const from = order.status;
    onToast?.(
      `Pedido #${order.code} · ${ORDER_STATUS_LABELS[status].toLowerCase()}`,
      undo
        ? {
            action: {
              label: "Deshacer",
              onClick: () => setOrderStatus({ ...order, status }, from),
            },
          }
        : undefined,
    );
    return true;
  }

  /** Pasa el pedido a la venta actual para cobrarlo con el método que sea. */
  function chargeOrder(order) {
    // Si había otra venta a medio armar, se reemplaza: que quede dicho.
    const replaced = cart.length > 0 && pendingOrder?.id !== order.id;
    setCart(
      (order.items || []).map((it) => ({ name: it.name, price: it.price, qty: it.qty })),
    );
    setPendingOrder({ id: order.id, code: order.code, name: order.name });
    setIsCartOpen(true);
    onToast?.(
      `Pedido #${order.code} en la venta: elegí cómo lo pagan.${replaced ? " La venta que estaba armada se descartó." : ""}`,
    );
  }

  // Si la venta queda vacía (tacho o "−"), el pedido de la carta se suelta:
  // si no, la próxima venta cualquiera lo daba por cobrado.
  useEffect(() => {
    if (cart.length === 0) setPendingOrder(null);
  }, [cart.length]);

  useEffect(() => {
    loadSales();
    getAdminDayData(date).then((res) => {
      if (res.ok) setDayBookings(res.bookings.filter(isCountableBooking));
    });
  }, [date]);

  useEffect(() => {
    searchRef.current?.focus();
    adminGetTopProducts(8).then(
      (res) => res.ok && setTopProducts(res.products),
    );
    // "/" enfoca el buscador desde cualquier lado de la vista.
    function onKey(e) {
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function loadSales() {
    const res = await adminGetCantinaSales(date);
    if (res.ok) setSales(res.sales || []);
    else onExpiredSession?.(res);
  }

  const itemsByName = useMemo(
    () => new Map(MENU_ITEMS.map((i) => [i.name, i])),
    [],
  );
  const filteredItems = useMemo(() => {
    const q = normalizeSearch(query);
    return MENU_ITEMS.filter(
      (item) =>
        (selectedCat === "all" || item.category === selectedCat) &&
        (!q || normalizeSearch(item.name).includes(q)),
    );
  }, [query, selectedCat]);
  const bestSellers = topProducts
    .map((p) => itemsByName.get(p.name))
    .filter(Boolean);

  const qtyInCart = (name) => cart.find((it) => it.name === name)?.qty || 0;
  const cartTotal = cart.reduce((sum, it) => sum + it.price * it.qty, 0);
  const cartCount = cart.reduce((sum, it) => sum + it.qty, 0);

  function addToCart(item) {
    setCart((prev) =>
      prev.some((it) => it.name === item.name)
        ? prev.map((it) =>
            it.name === item.name ? { ...it, qty: it.qty + 1 } : it,
          )
        : [...prev, { name: item.name, price: item.price, qty: 1 }],
    );
  }

  function updateQty(name, delta) {
    setCart((prev) =>
      prev
        .map((it) => (it.name === name ? { ...it, qty: it.qty + delta } : it))
        .filter((it) => it.qty > 0),
    );
  }

  async function handleSubmitSale() {
    if (cart.length === 0) return;
    if (method === "cuenta" && !chargeTo) {
      onToast?.("Elegí a qué turno cargar la cuenta.", { tone: "error" });
      return;
    }
    setSubmitting(true);
    // Con un pedido de la carta, la misma venta lo cobra y lo pasa a cocina
    // (se prepara recién pago); si ya lo cobró otra pantalla, no se registra.
    const chargedOrder = pendingOrder;
    const res = await adminAddCantinaSale({
      date,
      items: cart,
      method,
      chargeTo: method === "cuenta" ? chargeTo : undefined,
      orderId: chargedOrder?.id,
    });
    setSubmitting(false);
    if (!res.ok) {
      if (res.orderChanged) {
        setPendingOrder(null);
        setCart([]);
        loadOrders();
      }
      if (!onExpiredSession?.(res)) {
        onToast?.(res.error || "No se pudo registrar la venta.", {
          tone: "error",
        });
      }
      return;
    }
    setCart([]);
    setIsCartOpen(false);
    loadSales();
    if (chargedOrder) {
      setPendingOrder(null);
      loadOrders();
    }
    const account = dayBookings.find((b) => b.id === chargeTo);
    onToast?.(
      chargedOrder
        ? `Pedido #${chargedOrder.code} cobrado · ${formatARS(res.total)}: ya puede ir a la cocina`
        : method === "cuenta"
          ? `Cargado a la cuenta de ${account?.playerName || "el turno"} · ${formatARS(res.total)}`
          : `Venta registrada · ${formatARS(res.total)}`,
      {
        action: {
          label: "Deshacer",
          onClick: async () => {
            const undo = await adminVoidCantinaSale({
              saleId: res.saleId,
              reason: "Deshecha al registrar",
            });
            if (!undo.ok) {
              onToast?.(undo.error || "No se pudo deshacer la venta.", {
                tone: "error",
              });
              return;
            }
            loadSales();
            // El pedido que se cobró con esa venta vuelve a esperar el pago.
            if (chargedOrder) {
              await setOrderStatus({ ...chargedOrder, status: "preparando" }, "nuevo", {
                saleId: res.saleId,
              });
            }
            onToast?.("Venta deshecha");
          },
        },
      },
    );
    searchRef.current?.focus();
  }

  async function confirmVoid() {
    const sale = voiding;
    const res = await askPin(
      {
        title: "Anular venta",
        description: "Ingresá tu PIN para anular esta venta. Queda registrado a tu nombre.",
        confirmButtonText: "Anular venta",
        confirmButtonTone: "danger",
      },
      ({ pin }) =>
        adminVoidCantinaSale({ saleId: sale.id, reason: voidReason, pin }),
    );
    if (res?.ok) {
      setVoiding(null);
      setVoidReason("");
      loadSales();
      onToast?.("Venta anulada");
    } else if (res && !onExpiredSession?.(res)) {
      onToast?.(res.error || "No se pudo anular la venta.", { tone: "error" });
    }
  }

  async function settle(sale, how) {
    const res = await adminSettleCantinaSale(sale.id, how);
    if (res.ok) {
      loadSales();
      onToast?.(
        `Consumo cobrado · ${formatARS(sale.total)} · ${methodLabel(how)}`,
      );
    } else if (!onExpiredSession?.(res)) {
      onToast?.(res.error || "No se pudo cobrar el consumo.", {
        tone: "error",
      });
    }
  }

  async function toggleTest(sale) {
    const res = await askPin(
      {
        title: sale.isTest ? "Volver a contar la venta" : "Marcar como prueba",
        description:
          "Marcar una venta como prueba la saca de los totales. Lo autoriza un Administrador o Encargado.",
      },
      ({ pin }) => adminSetTestFlag("cantinaSales", sale.id, !sale.isTest, pin),
    );
    if (res?.ok) loadSales();
  }

  const quickFavoriteItems = useMemo(
    () => MENU_ITEMS.filter((i) => QUICK_FAVORITE_IDS.includes(i.id)),
    [],
  );

  function shareTicketWhatsApp(sale) {
    const itemsText = (sale.items || [])
      .map((it) => `• ${it.qty}x ${it.name} (${formatARS(it.price * it.qty)})`)
      .join("\n");
    const msg = [
      `🎾 *MUZZAGA PÁDEL · CANTINA*`,
      `🧾 *Comprobante de Consumo*`,
      `📅 Fecha: ${date} ${sale.createdAt ? formatTime(sale.createdAt) : ""}`,
      "",
      itemsText,
      "",
      `💰 *Total: ${formatARS(sale.total)}* (${methodLabel(sale.method)})`,
      "",
      `¡Muchas gracias por elegirnos! 🙌`,
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }

  const orderList = orders || [];
  const openOrders = orderList.filter((o) => OPEN_ORDER_STATUSES.includes(o.status));
  const closedOrders = orderList.filter((o) => !OPEN_ORDER_STATUSES.includes(o.status));

  const salesList = sales || [];
  const dayTotal = computeDailyCash({ sales: salesList }).cobradoCantina;
  const onAccount = onAccountTotal(salesList);
  const activeSalesCount = salesList.filter(
    (s) => !s.voided && !s.isTest,
  ).length;
  const bookingLabel = (id) => {
    const b = dayBookings.find((x) => x.id === id);
    return b ? `${b.startTime} · ${b.playerName}` : "turno";
  };

  // Función y no componente: así las cards no se remontan en cada toque
  // (con un componente definido acá adentro se perdía el foco).
  const renderProduct = (item, key) => {
    const qty = qtyInCart(item.name);
    return (
      <button
        key={key}
        type="button"
        className={`admin-product${qty ? " is-in-cart" : ""}`}
        data-category={item.category}
        onClick={() => addToCart(item)}
        aria-label={`${item.name}, ${formatARS(item.price)}${qty ? `, ${qty} en la venta` : ""}. Agregar uno`}
      >
        <span className="admin-product-name">{item.name}</span>
        <span className="admin-product-price">{formatARS(item.price)}</span>
        {qty > 0 && <span className="admin-product-qty">{qty}</span>}
      </button>
    );
  };

  const cartPanel = (
    <div className="admin-pos-cart-inner">
      <div className="admin-pos-cart-head">
        <h3 className="admin-section-title" style={{ margin: 0 }}>
          Venta actual
        </h3>
        {cart.length > 0 && (
          <button
            type="button"
            className="admin-link-btn"
            onClick={() => {
              setCart([]);
              setPendingOrder(null);
            }}
          >
            Vaciar
          </button>
        )}
        <button
          type="button"
          className="admin-modal-close admin-pos-sheet-close"
          onClick={() => setIsCartOpen(false)}
          aria-label="Cerrar venta"
        >
          <X {...ICON} />
        </button>
      </div>

      {pendingOrder && (
        <p className="admin-order-charging">
          Cobrando el pedido de la carta <strong>#{pendingOrder.code}</strong> ·{" "}
          {pendingOrder.name}
        </p>
      )}

      {cart.length === 0 ? (
        <p className="admin-field-hint">
          Tocá un producto para sumarlo. Cada toque suma uno.
        </p>
      ) : (
        <ul className="admin-pos-lines">
          {cart.map((it) => (
            <li key={it.name}>
              <span className="admin-pos-line-name">
                {it.name}
                <small>{formatARS(it.price)} c/u</small>
              </span>
              <span className="admin-pos-qty">
                <button
                  type="button"
                  onClick={() => updateQty(it.name, -1)}
                  aria-label={`Uno menos de ${it.name}`}
                >
                  <Minus {...ICON} />
                </button>
                <strong aria-live="polite">{it.qty}</strong>
                <button
                  type="button"
                  onClick={() => updateQty(it.name, 1)}
                  aria-label={`Uno más de ${it.name}`}
                >
                  <Plus {...ICON} />
                </button>
              </span>
              <strong className="admin-pos-line-total">
                {formatARS(it.price * it.qty)}
              </strong>
              <button
                type="button"
                className="admin-pos-remove"
                onClick={() => updateQty(it.name, -it.qty)}
                aria-label={`Sacar ${it.name}`}
              >
                <Trash2 {...ICON} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="admin-pos-total">
        <span>Total</span>
        <strong>{formatARS(cartTotal)}</strong>
      </div>

      <div
        className="admin-segmented admin-segmented-full"
        role="group"
        aria-label="Método de pago"
      >
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={method === m.value}
            onClick={() => setMethod(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {method === "cuenta" && (
        <div className="admin-field" style={{ marginTop: 10 }}>
          <label className="admin-field-label" htmlFor="pos-charge-to">
            Cargar a la cuenta de
          </label>
          <select
            id="pos-charge-to"
            value={chargeTo}
            onChange={(e) => setChargeTo(e.target.value)}
          >
            <option value="">Elegí un turno de hoy</option>
            {dayBookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.startTime} · {b.courtName} · {b.playerName}
              </option>
            ))}
          </select>
          {dayBookings.length === 0 && (
            <p className="admin-field-hint">No hay turnos activos este día.</p>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn btn-linear-primary admin-btn-block admin-btn-lg"
        disabled={
          cart.length === 0 || submitting || (method === "cuenta" && !chargeTo)
        }
        onClick={handleSubmitSale}
      >
        {submitting
          ? "Guardando…"
          : method === "cuenta"
            ? `Cargar ${formatARS(cartTotal)} a la cuenta`
            : `Cobrar ${formatARS(cartTotal)}`}
      </button>
    </div>
  );

  return (
    <div>
      {/* 3 KPI Cards de Cantina Estilo Kravio */}
      <div className="admin-kpis-3" style={{ marginBottom: 20 }}>
        <div className="admin-kravio-kpi-card">
          <div className="admin-kravio-kpi-header">
            <span className="admin-kravio-kpi-title">Recaudado Cantina</span>
            <Coins size={17} style={{ color: "#15803d" }} />
          </div>
          <div className="admin-kravio-kpi-content">
            <div className="admin-kravio-kpi-left">
              <div className="admin-kravio-kpi-number" style={{ color: "#15803d" }}>
                {formatARS(dayTotal)}
              </div>
              <span className="admin-cell-sub">Cobrado hoy en el bar</span>
            </div>
          </div>
        </div>

        <div className="admin-kravio-kpi-card">
          <div className="admin-kravio-kpi-header">
            <span className="admin-kravio-kpi-title">A Cuenta / Turnos</span>
            <Receipt size={17} style={{ color: onAccount > 0 ? "#ea580c" : "#5f5b52" }} />
          </div>
          <div className="admin-kravio-kpi-content">
            <div className="admin-kravio-kpi-left">
              <div className="admin-kravio-kpi-number" style={{ color: onAccount > 0 ? "#ea580c" : "#141412" }}>
                {formatARS(onAccount)}
              </div>
              <span className="admin-cell-sub">Cargado a cuentas de turnos</span>
            </div>
          </div>
        </div>

        <div className="admin-kravio-kpi-card">
          <div className="admin-kravio-kpi-header">
            <span className="admin-kravio-kpi-title">Tickets del Día</span>
            <ShoppingCart size={17} style={{ color: "#2563eb" }} />
          </div>
          <div className="admin-kravio-kpi-content">
            <div className="admin-kravio-kpi-left">
              <div className="admin-kravio-kpi-number" style={{ color: "#141412" }}>
                {activeSalesCount}
              </div>
              <span className="admin-cell-sub">Ventas activas registradas</span>
            </div>
          </div>
        </div>
      </div>

      {/* PEDIDOS DE LA CARTA (web) */}
      <section className="admin-web-orders" aria-labelledby="web-orders-title">
        <h2 className="admin-section-title" id="web-orders-title">
          <ClipboardList {...ICON} /> Pedidos de la carta
          {openOrders.length > 0 && (
            <span className="admin-tag admin-order-count">
              {plural(openOrders.length, "abierto", "abiertos")}
            </span>
          )}
        </h2>
        {!orders ? (
          <SkeletonRows count={2} />
        ) : openOrders.length === 0 ? (
          <p className="admin-field-hint">
            {closedOrders.length
              ? "No hay pedidos abiertos. Los que entren por la carta aparecen acá solos."
              : "Todavía no entró ningún pedido por la carta este día. Aparecen acá solos, sin recargar."}
          </p>
        ) : (
          <ul className="admin-order-list">
            {openOrders.map((o) => (
              <li
                key={o.id}
                className={`admin-order is-${o.status}${pendingOrder?.id === o.id ? " is-charging" : ""}`}
              >
                <div className="admin-order-head">
                  <strong className="admin-order-code">#{o.code}</strong>
                  <span className="admin-order-time">
                    {o.createdAt ? formatTime(o.createdAt) : "—"}
                  </span>
                  <span className="admin-tag" data-order-status={o.status}>
                    {ORDER_STATUS_LABELS[o.status] || o.status}
                  </span>
                  <strong className="admin-order-total">{formatARS(o.total)}</strong>
                </div>
                <p className="admin-order-who">
                  {o.name} · {o.deliverTo}
                </p>
                <p className={`admin-order-pay${o.status === "nuevo" ? " is-pending" : ""}`}>
                  {o.status === "nuevo"
                    ? `Sin pagar · paga ${payLabel(o.payWith)}. Cobralo para que la cocina lo empiece.`
                    : `Pagado${o.paidAt ? ` a las ${formatTime(o.paidAt)}` : ""} · en cocina`}
                </p>
                <ul className="admin-order-items">
                  {(o.items || []).map((it) => (
                    <li key={it.id || it.name}>
                      {it.qty}× {it.name}
                    </li>
                  ))}
                </ul>
                {o.notes && <p className="admin-order-notes">“{o.notes}”</p>}
                <div className="admin-order-actions">
                  {confirmCancel === o.id ? (
                    <>
                      <span className="admin-field-hint">¿Cancelar el pedido?</span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setConfirmCancel(null)}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary admin-order-danger"
                        onClick={() => setOrderStatus(o, "cancelado")}
                      >
                        Sí, cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Se cobra antes de preparar: sin pagar solo se
                          puede cobrar (o cancelar); pagado, entregar. */}
                      {o.status === "nuevo" ? (
                        <button
                          type="button"
                          className="btn btn-linear-primary"
                          onClick={() => chargeOrder(o)}
                        >
                          Cobrar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-linear-primary"
                          onClick={() => setOrderStatus(o, "entregado", { undo: true })}
                        >
                          Entregado
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-link-btn"
                        onClick={() => setConfirmCancel(o.id)}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {closedOrders.length > 0 && (
          <details className="admin-order-history">
            <summary>
              Entregados y cancelados ({closedOrders.length})
            </summary>
            <ul>
              {closedOrders.map((o) => (
                <li key={o.id} className={`is-${o.status}`}>
                  <span>
                    #{o.code} · {o.createdAt ? formatTime(o.createdAt) : "—"} · {o.name}
                  </span>
                  <span className="admin-tag" data-order-status={o.status}>
                    {ORDER_STATUS_LABELS[o.status] || o.status}
                  </span>
                  <strong>{formatARS(o.total)}</strong>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <div className="admin-pos">
        <div className="admin-pos-catalog">
          <div className="admin-view-toolbar">
          <div className="admin-search-wrap admin-pos-search">
            <Search {...ICON} />
            <input
              ref={searchRef}
              type="search"
              className="admin-search-input"
              placeholder="Buscar producto (tecla /)"
              aria-label="Buscar producto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter con un solo resultado lo suma directo.
                if (e.key === "Enter" && filteredItems.length === 1)
                  addToCart(filteredItems[0]);
              }}
            />
            {query && (
              <button
                type="button"
                className="admin-search-clear"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} strokeWidth={1.75} aria-hidden />
              </button>
            )}
          </div>
          <input
            type="date"
            aria-label="Fecha de las ventas"
            value={date}
            max={todayInClub()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>

        {/* Barra de favoritos rápidos 1-click */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 12,
            padding: "8px 12px",
            background: "rgba(234, 88, 12, 0.05)",
            borderRadius: 10,
            border: "1px solid rgba(234, 88, 12, 0.15)",
          }}
        >
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: "#ea580c",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Zap size={14} /> Rápidos:
          </span>
          {quickFavoriteItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="btn btn-secondary"
              style={{
                padding: "3px 10px",
                height: 28,
                fontSize: 13.5,
                borderRadius: 20,
                background: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              onClick={() => addToCart(item)}
            >
              <Plus size={12} strokeWidth={2.5} style={{ color: "#ea580c" }} />
              <span>{item.name}</span>
              <strong style={{ color: "#15803d", fontSize: 13 }}>
                {formatARS(item.price)}
              </strong>
            </button>
          ))}
        </div>

        <div className="admin-chips" role="group" aria-label="Categorías">
          {MENU_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              aria-pressed={selectedCat === cat.id}
              onClick={() => setSelectedCat(cat.id)}
            >
              {plainLabel(cat.label)}
            </button>
          ))}
        </div>

        {!query && selectedCat === "all" && bestSellers.length > 0 && (
          <section aria-label="Más vendidos">
            <h3 className="admin-pos-group-title">
              Más vendidos (últimos 30 días)
            </h3>
            <div className="admin-product-grid">
              {bestSellers.map((item) => (
                renderProduct(item, `top-${item.id}`)
              ))}
            </div>
          </section>
        )}

        <section aria-label="Productos">
          {(query || selectedCat !== "all" || bestSellers.length > 0) && (
            <h3 className="admin-pos-group-title">
              {query
                ? plural(filteredItems.length, "resultado", "resultados")
                : selectedCat === "all"
                  ? "Todos"
                  : categoryLabel(selectedCat)}
            </h3>
          )}
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Search}
              title={`No hay productos con “${query}”`}
              action={{
                label: "Limpiar búsqueda",
                onClick: () => setQuery(""),
              }}
            />
          ) : (
            <div className="admin-product-grid">
              {filteredItems.map((item) => (
                renderProduct(item, item.id)
              ))}
            </div>
          )}
        </section>

        {/* VENTAS DEL DÍA */}
        <section style={{ marginTop: 28 }}>
          <h2 className="admin-section-title">
            Ventas del día · {plural(activeSalesCount, "venta", "ventas")} ·{" "}
            {formatARS(dayTotal)}
            {onAccount > 0 && (
              <span className="admin-tag">A cuenta {formatARS(onAccount)}</span>
            )}
          </h2>
          {!sales ? (
            <SkeletonRows count={3} />
          ) : salesList.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Todavía no hay ventas este día"
              text="Tocá productos para armar la venta y cobrala con el método de pago."
            />
          ) : (
            <ul className="admin-sales-list">
              {salesList.map((s) => (
                <li key={s.id} className={s.voided ? "is-voided" : undefined}>
                  <span className="admin-sale-time">
                    {s.createdAt ? formatTime(s.createdAt) : "—"}
                  </span>
                  <span className="admin-sale-items">
                    {(s.items || [])
                      .map((it) => `${it.qty}× ${it.name}`)
                      .join(", ")}
                    {s.voided && <small>Anulada: {s.voidReason}</small>}
                    {s.method === "cuenta" && !s.voided && (
                      <small>A cuenta de {bookingLabel(s.chargeTo)}</small>
                    )}
                  </span>
                  <strong className="admin-sale-total">
                    {formatARS(s.total)}
                  </strong>
                  <span className="admin-tag" data-method={s.method}>
                    {methodLabel(s.method)}
                  </span>
                  <span className="admin-sale-actions">
                    {s.method === "cuenta" && !s.voided && (
                      <select
                        aria-label="Cobrar consumo con"
                        value=""
                        onChange={(e) =>
                          e.target.value && settle(s, e.target.value)
                        }
                      >
                        <option value="">Cobrar…</option>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {!s.voided && (
                      <>
                        <button
                          type="button"
                          className={`admin-tag-btn${s.isTest ? " is-on" : ""}`}
                          onClick={() => toggleTest(s)}
                          title="Los datos de prueba no suman en caja ni reportes"
                        >
                          {s.isTest ? "Prueba" : "¿Prueba?"}
                        </button>
                        <button
                          type="button"
                          className="admin-table-action-btn"
                          onClick={() => shareTicketWhatsApp(s)}
                          aria-label="Compartir ticket por WhatsApp"
                          title="Compartir ticket por WhatsApp"
                        >
                          <WhatsAppMiniIcon size={14} />
                        </button>
                        <button
                          type="button"
                          className="admin-table-action-btn"
                          onClick={() => setVoiding(s)}
                          aria-label="Anular venta"
                          title="Anular venta (queda en historial)"
                        >
                          <Ban {...ICON} />
                        </button>
                        <button
                          type="button"
                          className="admin-table-action-btn delete"
                          onClick={() => setDeletingSale(s)}
                          aria-label="Eliminar venta definitivamente"
                          title="Eliminar definitivamente con PIN"
                          style={{ color: "#dc2626" }}
                        >
                          <Trash2 {...ICON} />
                        </button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Carrito: panel sticky en desktop, bottom sheet en mobile */}
      <aside
        className={`admin-pos-cart${isCartOpen ? " is-open" : ""}`}
        aria-label="Venta actual"
      >
        {cartPanel}
      </aside>
      <button
        type="button"
        className="admin-pos-cartbar"
        onClick={() => setIsCartOpen(true)}
        aria-label={`Ver venta actual: ${plural(cartCount, "producto", "productos")}, ${formatARS(cartTotal)}`}
      >
        <ShoppingCart {...ICON} />
        <span>{plural(cartCount, "producto", "productos")}</span>
        <strong>{formatARS(cartTotal)}</strong>
      </button>

      {voiding && (
        <div className="admin-modal-backdrop" onClick={() => setVoiding(null)}>
          <div
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="void-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h3 id="void-title">
                Anular venta de {formatARS(voiding.total)}
              </h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setVoiding(null)}
                aria-label="Cerrar"
              >
                <X {...ICON} />
              </button>
            </div>
            <p className="admin-field-hint">
              {(voiding.items || [])
                .map((it) => `${it.qty}× ${it.name}`)
                .join(", ")}
              . La venta queda en el historial pero deja de sumar en caja.
            </p>
            <div className="admin-field">
              <label className="admin-field-label" htmlFor="void-reason">
                Motivo
              </label>
              <input
                id="void-reason"
                type="text"
                maxLength={120}
                placeholder="ej. Se cargó dos veces"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setVoiding(null)}
              >
                Volver
              </button>
              <button
                type="button"
                className="btn btn-linear-primary"
                onClick={confirmVoid}
                disabled={!voidReason.trim()}
              >
                Anular venta
              </button>
            </div>
          </div>
        </div>
      )}

      {pinModal}

      {deletingSale && (
        <StaffPinModal
          isOpen={Boolean(deletingSale)}
          title="Eliminar Pedido de Cantina"
          description="¿Confirmás que querés eliminar definitivamente esta venta? Se borrará el registro de la base de datos."
          targetName={`Ticket #${deletingSale.id.slice(-6)} · ${formatARS(deletingSale.total)} (${deletingSale.items?.map((it) => `${it.qty}× ${it.name}`).join(", ")})`}
          confirmButtonText="Eliminar Pedido"
          confirmButtonTone="danger"
          onClose={() => setDeletingSale(null)}
          onConfirm={async ({ pin, reason }) => {
            const res = await adminDeleteCantinaSale({
              saleId: deletingSale.id,
              pin,
              reason,
            });
            if (res.ok) {
              setDeletingSale(null);
              loadSales();
              onToast?.(`Pedido eliminado por ${res.staff}`);
            } else {
              throw new Error(res.error || "No se pudo eliminar el pedido.");
            }
          }}
        />
      )}
      </div>
    </div>
  );
}
