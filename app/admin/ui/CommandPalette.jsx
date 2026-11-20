"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, ShoppingCart, Tv, User } from "lucide-react";
import { NAV_ITEMS } from "../nav";
import { normalizeSearch } from "../../../lib/format";

const MAX_CLIENT_RESULTS = 6;
const ICON = { size: 18, strokeWidth: 1.75, "aria-hidden": true };

/**
 * Ctrl/⌘ + K: ir a una sección, nueva reserva, registrar venta o buscar
 * un cliente. Navegable con flechas + Enter.
 */
export default function CommandPalette({
  clients,
  onClose,
  onNavigate,
  onNewBooking,
  onOpenClient,
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo(() => {
    const q = normalizeSearch(query);
    const matches = (text) => !q || normalizeSearch(text).includes(q);

    const actions = [
      {
        id: "new",
        group: "Acciones",
        label: "Nueva reserva",
        hint: "N",
        icon: Plus,
        run: onNewBooking,
      },
      {
        id: "sale",
        group: "Acciones",
        label: "Registrar venta en cantina",
        icon: ShoppingCart,
        run: () => onNavigate("cantina"),
      },
      {
        id: "monitor",
        group: "Acciones",
        label: "Abrir Monitor TV",
        icon: Tv,
        run: () => window.open("/admin/monitor", "_blank", "noopener"),
      },
    ].filter((a) => matches(a.label));

    const sections = NAV_ITEMS.filter((n) => matches(`ir a ${n.label}`)).map(
      (n) => ({
        id: `nav-${n.id}`,
        group: "Ir a",
        label: n.label,
        icon: n.icon,
        run: () => onNavigate(n.id),
      }),
    );

    const clientResults = q
      ? clients
          .filter((c) => matches(`${c.name} ${c.phone || ""}`))
          .slice(0, MAX_CLIENT_RESULTS)
          .map((c) => ({
            id: `client-${c.phone || c.name}`,
            group: "Clientes",
            label: c.name,
            hint: c.phone,
            icon: User,
            run: () => onOpenClient(c),
          }))
      : [];

    return [...actions, ...sections, ...clientResults];
  }, [query, clients, onNavigate, onNewBooking, onOpenClient]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  function runItem(item) {
    onClose();
    item.run();
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[selected]) {
      e.preventDefault();
      runItem(items[selected]);
    }
  }

  return (
    <div className="admin-palette-backdrop" onClick={onClose}>
      <div
        className="admin-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar o ir a"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-palette-input">
          <Search {...ICON} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscá un cliente, una sección o una acción…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-palette-list"
            aria-activedescendant={
              items[selected] ? `palette-${items[selected].id}` : undefined
            }
          />
          <kbd className="admin-kbd">Esc</kbd>
        </div>

        {items.length === 0 ? (
          <div className="admin-palette-empty">
            Nada coincide con “{query}”.
          </div>
        ) : (
          <ul
            id="admin-palette-list"
            className="admin-palette-list"
            role="listbox"
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              const showGroup = i === 0 || items[i - 1].group !== item.group;
              return (
                <li key={item.id} role="presentation">
                  {showGroup && (
                    <div className="admin-palette-group">{item.group}</div>
                  )}
                  <button
                    type="button"
                    id={`palette-${item.id}`}
                    role="option"
                    aria-selected={i === selected}
                    className="admin-palette-item"
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => runItem(item)}
                  >
                    <Icon {...ICON} />
                    {item.label}
                    {item.hint && <small>{item.hint}</small>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Ayuda de teclado: en el mostrador se usa sin mouse. En el celu
            no aplica y se oculta por CSS. */}
        <div className="admin-palette-foot" aria-hidden="true">
          <span>
            <kbd className="admin-kbd">↑</kbd>
            <kbd className="admin-kbd">↓</kbd> moverse
          </span>
          <span>
            <kbd className="admin-kbd">Enter</kbd> abrir
          </span>
          <span>
            <kbd className="admin-kbd">Esc</kbd> cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
