"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MENU_CATEGORIES } from "../../data/menu";
import { CLUB_INFO } from "../../data/club";
import { productIcon } from "../../lib/productIcon";
import ScrollRow from "../../components/ScrollRow";
import Mascota from "../../components/Mascota";
import CantinaCart, { QtyStepper } from "../../components/CantinaCart";
import {
  MAX_ORDER_QTY,
  deliveryFromParam,
  orderCount,
  orderLines,
  orderTotal,
  parseStoredCart,
} from "../../lib/cantinaOrder";
import {
  MapPin,
  MessageCircle,
  Plus,
  Search,
  ShoppingCart,
  Pizza,
  CupSoda,
  Beer,
  Candy,
  ShoppingBag,
} from "lucide-react";

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

export default function MenuClient({ items }) {
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
      setCart(parseStoredCart(localStorage.getItem(CART_KEY), items));
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

  const lines = useMemo(() => orderLines(cart, items), [cart, items]);
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
    return items.filter((item) => {
      const matchCat = selectedCat === "all" || item.category === selectedCat;
      const matchSearch =
        !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.tag && item.tag.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [items, selectedCat, search]);

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

  // Cuántos productos hay en cada categoría: el número va en su pestaña.
  const catCounts = useMemo(() => {
    const counts = { all: items.length };
    for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
  }, [items]);

  // La lista va agrupada por categoría (en el orden de las pestañas), con un
  // título de pizarra en cada grupo: se recorre la carta como en el bar.
  const groups = useMemo(() => {
    const cats = MENU_CATEGORIES.filter((c) => c.id !== "all");
    const known = new Set(cats.map((c) => c.id));
    const out = cats.map((c) => ({ ...c, items: filteredItems.filter((i) => i.category === c.id) }));
    const rest = filteredItems.filter((i) => !known.has(i.category));
    if (rest.length) out.push({ id: "otros", label: "Otros", items: rest });
    return out.filter((g) => g.items.length > 0);
  }, [filteredItems]);

  // Las pestañas quedan pegadas arriba: si se cambia de categoría con la
  // carta ya scrolleada, la lista vuelve a arrancar justo debajo de ellas.
  const filtrosRef = useRef(null);
  const listaRef = useRef(null);
  const pickCat = (id) => {
    setSelectedCat(id);
    requestAnimationFrame(() => {
      const bar = filtrosRef.current?.getBoundingClientRect();
      const list = listaRef.current?.getBoundingClientRect();
      if (bar && list && list.top < bar.bottom) {
        window.scrollBy({ top: list.top - bar.bottom - 8 });
      }
    });
  };

  const renderItem = (item) => {
    const qty = cart[item.id] || 0;
    return (
      <li key={item.id} className={`carta-item${qty > 0 ? " is-en-pedido" : ""}`}>
        <span className="carta-item-icon" aria-hidden="true">
          {productIcon(item.name, item.category)}
        </span>
        <div className="carta-item-info">
          <strong className="carta-item-name">{item.name}</strong>
          {item.tag && (
            <span
              className={`carta-item-tag ${
                item.tag.includes("Sin TACC")
                  ? "is-sintacc"
                  : item.tag.includes("Vegana")
                  ? "is-vegana"
                  : ""
              }`}
            >
              {item.tag}
            </span>
          )}
        </div>

        <span className="carta-item-price">
          ${item.price.toLocaleString("es-AR")}
        </span>
        {/* Ancho fijo: al agregar, "Agregar" pasa a "− 1 +" sin correr el
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
            >
              <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
              <span className="menu-add-btn-text">Agregar</span>
            </button>
          )}
        </span>
      </li>
    );
  };

  return (
    <div className="container carta">
      {/* PIZARRA DE ENTRADA: la carta arranca como el pizarrón del bar. */}
      <header className="carta-pizarra">
        <div className="carta-pizarra-texto">
          <p className="carta-pizarra-kicker">
            <span className="carta-pelota" aria-hidden="true" />
            Cantina · Tercer tiempo
          </p>
          <h1 className="carta-titulo">Menú de la cantina</h1>
          <p className="carta-pizarra-desc">
            Pizzas a la piedra, tostados, birra helada y kiosco con vista a las
            canchas. La cocina arranca tu pedido cuando está pagado.
          </p>
          <ol className="carta-pasos" aria-label="Cómo pedir">
            <li><b>1</b> Elegí</li>
            <li><b>2</b> Agregá</li>
            <li><b>3</b> Mandá el pedido</li>
          </ol>
        </div>
        <Mascota pose="pizza-cerveza" className="carta-pizarra-mascota" priority />

        {/* Si llegó por el QR de una mesa o cancha: un papelito pinchado en
            la pizarra con dónde se entrega. */}
        {activeLocation && (
          <div className="carta-ubicacion">
            <MapPin size={20} aria-hidden="true" />
            <div className="carta-ubicacion-texto">
              <span>Te lo llevamos a</span>
              <strong>{activeLocation}</strong>
            </div>
            <button
              type="button"
              className="carta-ubicacion-quitar"
              onClick={() => setActiveLocation(null)}
            >
              Quitar ubicación
            </button>
          </div>
        )}
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
            className="btn btn-secondary-whatsapp carta-consulta"
          >
            <MessageCircle size={18} aria-hidden="true" />
            Consultas<span className="carta-consulta-extra">&nbsp;por WhatsApp</span>
          </button>
        </div>
      </header>

      <div className="menu-layout">
        <div className="menu-main">
          {/* BUSCADOR */}
          <label className="carta-buscar">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar: pizza, Corona, sin TACC…"
              aria-label="Buscar en la carta"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          {/* PESTAÑAS DE CATEGORÍA: pegadas arriba para saltar sin volver. */}
          <div className="carta-filtros" ref={filtrosRef}>
            <ScrollRow className="menu-category-tabs" role="group" aria-label="Categorías de la carta">
              {MENU_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`carta-cat${selectedCat === cat.id ? " active" : ""}`}
                  aria-pressed={selectedCat === cat.id}
                  onClick={() => pickCat(cat.id)}
                >
                  {cat.id === "all" ? (
                    <span className="carta-pelota" aria-hidden="true" />
                  ) : (
                    <CategoryIcon id={cat.id} />
                  )}
                  {cat.label}
                  <span className="carta-cat-n" aria-hidden="true">
                    {catCounts[cat.id] || 0}
                  </span>
                </button>
              ))}
            </ScrollRow>
          </div>

          {/* LISTA DE PRODUCTOS */}
          <div ref={listaRef}>
            {filteredItems.length === 0 ? (
              <div className="carta-vacia">
                <p>
                  No encontramos productos que coincidan con tu búsqueda. Probá
                  con otro término o categoría.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearch("");
                    setSelectedCat("all");
                  }}
                >
                  Ver toda la carta
                </button>
              </div>
            ) : (
              groups.map((group) => (
                <section
                  key={group.id}
                  className="carta-grupo"
                  aria-labelledby={selectedCat === "all" ? `carta-grupo-${group.id}` : undefined}
                  aria-label={selectedCat === "all" ? undefined : group.label}
                >
                  {selectedCat === "all" && (
                    <h2 id={`carta-grupo-${group.id}`} className="carta-grupo-titulo">
                      <CategoryIcon id={group.id} />
                      {group.label}
                      <span className="carta-grupo-n">{group.items.length}</span>
                    </h2>
                  )}
                  <ul className="carta-lista">{group.items.map(renderItem)}</ul>
                </section>
              ))
            )}
          </div>
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

      {/* CIERRE: invitación a jugar, en la cancha azul. */}
      <div className="carta-cierre">
        <h2>¿Venís a jugar?</h2>
        <p>Reservá tu turno de 90 minutos y asegurate el mejor tercer tiempo en Catriel.</p>
        <Link href="/#turnos" className="btn carta-cierre-btn">
          Reservar cancha →
        </Link>
      </div>
    </div>
  );
}
