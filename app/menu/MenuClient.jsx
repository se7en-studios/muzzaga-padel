"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MENU_ITEMS, MENU_CATEGORIES } from "../../data/menu";
import { CLUB_INFO } from "../../data/club";
import ScrollRow from "../../components/ScrollRow";
import CantinaCart, { QtyStepper } from "../../components/CantinaCart";
import {
  MAX_ORDER_QTY,
  deliveryFromParam,
  orderCount,
  orderLines,
  orderTotal,
  parseStoredCart,
} from "../../lib/cantinaOrder";
import { MapPin, ShoppingCart, Pizza, CupSoda, Beer, Candy, ShoppingBag } from "lucide-react";

// El pedido queda en el navegador: si se recarga la página no se pierde.
const CART_KEY = "muzzaga-pedido";

// Íconos de las pestañas (antes eran emojis dentro del texto de data/menu.js).
const CATEGORY_ICONS = {
  buffet: Pizza,
  "bebidas-sin": CupSoda,
  "bebidas-con": Beer,
  kiosco: Candy,
  accesorios: ShoppingBag,
};

function CategoryIcon({ id }) {
  const Icon = CATEGORY_ICONS[id];
  return Icon ? <Icon size={20} className="icono-marca" aria-hidden="true" /> : null;
}

const LOCATION_NAMES = {
  "cancha-1": "Cancha 1 (cristal)",
  "cancha-2": "Cancha 2 (cristal)",
  "cancha1": "Cancha 1 (cristal)",
  "cancha2": "Cancha 2 (cristal)",
  "mesa-1": "Mesa 1 (Cantina)",
  "mesa-2": "Mesa 2 (Cantina)",
  "mesa-3": "Mesa 3 (Cantina)",
  "mesa-4": "Mesa 4 (Cantina)",
  "mesa-5": "Mesa 5 (Cantina)",
  "mesa-6": "Mesa 6 (Cantina)",
};

export default function MenuClient() {
  const searchParams = useSearchParams();
  const [selectedCat, setSelectedCat] = useState("all");
  const [search, setSearch] = useState("");

  const rawLocation =
    searchParams.get("ubicacion") ||
    searchParams.get("cancha") ||
    searchParams.get("mesa");

  const [activeLocation, setActiveLocation] = useState(
    rawLocation ? LOCATION_NAMES[rawLocation.toLowerCase()] || rawLocation : null
  );
  // Con el QR de una cancha o mesa, el pedido ya sale con esa entrega.
  const initialDelivery = activeLocation ? deliveryFromParam(rawLocation) : null;

  const [cart, setCart] = useState({}); // { id: cantidad }
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      setCart(parseStoredCart(localStorage.getItem(CART_KEY), MENU_ITEMS));
    } catch {}
    setCartLoaded(true);
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart, cartLoaded]);

  const setQty = (id, qty) =>
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(MAX_ORDER_QTY, qty);
      return next;
    });

  const lines = useMemo(() => orderLines(cart, MENU_ITEMS), [cart]);
  const cartCount = orderCount(lines);

  // Al sacar un producto con el tacho de su tarjeta, el control vuelve a ser
  // "Agregar": el foco pasa a ese botón en vez de perderse.
  const addRefs = useRef({});
  const [refocusAdd, setRefocusAdd] = useState(null);
  useEffect(() => {
    if (!refocusAdd) return;
    addRefs.current[refocusAdd]?.focus();
    setRefocusAdd(null);
  }, [refocusAdd]);

  const filteredItems = useMemo(() => {
    return MENU_ITEMS.filter((item) => {
      const matchCat = selectedCat === "all" || item.category === selectedCat;
      const matchSearch =
        !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.tag && item.tag.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [selectedCat, search]);

  const handleGeneralOrder = () => {
    const locationPrefix = activeLocation
      ? `*CONSULTA DESDE ${activeLocation.toUpperCase()}*\n\n`
      : "";
    const msg = `${locationPrefix}¡Hola Muzzaga! Tengo una consulta para la cantina.`;
    window.open(
      `https://wa.me/${CLUB_INFO.phoneRaw}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  };

  return (
    <div className="container" style={{ paddingBottom: 60 }}>
      {/* BANNER DE ENTREGA EN CANCHA / MESA SI VIENE POR QR */}
      {activeLocation && (
        <div
          style={{
            background: "linear-gradient(90deg, rgba(232, 114, 42, 0.15) 0%, rgba(232, 114, 42, 0.05) 100%)",
            border: "1px solid var(--color-accent-orange-border, #f2cbb4)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "12px 18px",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MapPin size={20} className="icono-marca" aria-hidden="true" />
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--color-accent-orange-text)" }}>
                Entrega directa activada
              </div>
              <strong style={{ fontSize: 15, color: "var(--color-ink)" }}>
                {activeLocation}
              </strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveLocation(null)}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-muted)",
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
              minHeight: 44,
              padding: "0 12px",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Quitar ubicación
          </button>
        </div>
      )}

      {/* HEADER DE LA CARTA */}
      <div className="section-header-row" style={{ marginBottom: 24 }}>
        <div>
          <span className="badge-linear badge-amber" style={{ marginBottom: 8 }}>
            Carta de la cantina · Tercer tiempo
          </span>
          <h1 className="section-title">Menú de la cantina</h1>
          <p className="section-desc">
            Pizzas a la piedra, tostados, sándwiches abundantes, cervezas heladas
            y kiosco con vista directa a las canchas. Sumá lo que quieras con el
            carrito y encargalo: la cocina lo empieza cuando está pagado.
          </p>
        </div>
        <div className="menu-header-actions">
          {/* En celu el pedido vive en una hoja: este botón la abre siempre,
              también vacía. En compu el pedido ya está a la vista al costado. */}
          <button
            type="button"
            className="btn btn-linear-primary menu-cart-open"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart size={18} aria-hidden="true" />
            Ver mi pedido
            {cartCount > 0 && <span className="menu-cart-open-count">{cartCount}</span>}
          </button>
          <button
            type="button"
            onClick={handleGeneralOrder}
            className="btn btn-secondary-whatsapp"
            style={{ gap: 8, height: 42, cursor: "pointer" }}
          >
            Consultas por WhatsApp →
          </button>
        </div>
      </div>

      <div className="menu-layout">
      <div className="menu-main">

      {/* BUSCADOR Y FILTROS */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginBottom: 28,
        }}
      >
        <div style={{ maxWidth: 440 }}>
          <input
            type="search"
            placeholder="Buscar: pizza, Corona, sin TACC…"
            aria-label="Buscar en la carta"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-hairline-strong)",
              borderRadius: "var(--radius-pill)",
              color: "var(--color-ink)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        {/* CHIPS DE CATEGORÍA */}
        <ScrollRow className="menu-category-tabs" role="group" aria-label="Categorías de la carta">
          {MENU_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`booking-court-tab${selectedCat === cat.id ? " active" : ""}`}
              onClick={() => setSelectedCat(cat.id)}
              style={{ whiteSpace: "nowrap" }}
            >
              <CategoryIcon id={cat.id} />
              {cat.label}
            </button>
          ))}
        </ScrollRow>
      </div>

      {/* LISTA DE PRODUCTOS */}
      {filteredItems.length === 0 ? (
        <div
          className="booking-empty"
          style={{ padding: "40px 20px", textAlign: "center" }}
        >
          No encontramos productos que coincidan con tu búsqueda. Probá con otro término o categoría.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(300px, 100%), 1fr))",
            gap: 12,
          }}
        >
          {filteredItems.map((item) => {
            const qty = cart[item.id] || 0;
            return (
            <div key={item.id} className="carta-item">
              <div className="carta-item-info">
                <strong className="carta-item-name">{item.name}</strong>
                {item.tag && (
                  <span
                    className={`badge-linear ${
                      item.tag.includes("Sin TACC")
                        ? "badge-emerald"
                        : item.tag.includes("Vegana")
                        ? "badge-indigo"
                        : "badge-amber"
                    }`}
                    style={{ fontSize: 10.5, padding: "2px 8px" }}
                  >
                    {item.tag}
                  </span>
                )}
              </div>

              <span className="carta-item-price">
                ${item.price.toLocaleString("es-AR")}
              </span>
              {/* Ancho fijo: al agregar, el "+" pasa a "− 1 +" sin correr el
                  precio ni hacer crecer la tarjeta. */}
              <span className="menu-item-control">
                {qty > 0 ? (
                  <QtyStepper
                    name={item.name}
                    qty={qty}
                    onChange={(q) => {
                      setQty(item.id, q);
                      if (q <= 0) setRefocusAdd(item.id);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="menu-add-btn"
                    ref={(el) => {
                      addRefs.current[item.id] = el;
                    }}
                    onClick={() => setQty(item.id, 1)}
                    aria-label={`Agregar ${item.name} al pedido`}
                    title="Agregar al pedido"
                  >
                    <ShoppingCart size={20} aria-hidden="true" />
                  </button>
                )}
              </span>
            </div>
            );
          })}
        </div>
      )}
      </div>

      <CantinaCart
        lines={lines}
        count={cartCount}
        total={orderTotal(lines)}
        onQty={setQty}
        onClear={() => setCart({})}
        initialDelivery={initialDelivery}
        open={cartOpen}
        onOpen={() => setCartOpen(true)}
        onClose={() => setCartOpen(false)}
      />
      </div>

      {/* FOOTER CALL TO ACTION */}
      <div
        style={{
          marginTop: 48,
          padding: "28px 24px",
          background: "var(--color-surface-card)",
          border: "1px solid var(--color-hairline-strong)",
          borderRadius: "var(--radius-xl)",
          textAlign: "center",
          maxWidth: 640,
          margin: "48px auto 0",
        }}
      >
        <h3 style={{ fontSize: 18, color: "var(--color-ink)", marginBottom: 8 }}>
          ¿Venís a jugar?
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 18 }}>
          Reservá tu turno de 90 minutos y asegurate el mejor tercer tiempo en Catriel.
        </p>
        <Link href="/#turnos" className="btn btn-linear-primary" style={{ padding: "10px 24px" }}>
          Reservar cancha →
        </Link>
      </div>
    </div>
  );
}
