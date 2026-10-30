"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Search, Star, Trash2, X } from "lucide-react";
import { adminSaveCantinaMenu } from "../actions";
import {
  CATEGORY_IDS,
  HOME_FEATURED_COUNT,
  ITEM_NAME_MAX,
  ITEM_PRICE_MAX,
  ITEM_TAG_MAX,
  MENU_CATEGORIES,
  describeMenuDiff,
  diffMenu,
  menuFromInput,
  newItemId,
} from "../../../lib/cantinaMenu";
import { formatARS, formatTime, normalizeSearch, plural } from "../../../lib/format";
import { EmptyState, SkeletonRows } from "../ui/states";
import { usePinGate } from "../ui/usePinGate";

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true };
const categoryLabel = (id) => MENU_CATEGORIES.find((c) => c.id === id)?.label || id;
/** Solo números, hasta 7 cifras: el precio se escribe sin puntos ni signo. */
const toPrice = (text) => Number(String(text).replace(/\D/g, "").slice(0, 7)) || 0;
const EMPTY_NEW = { name: "", price: 0, category: "buffet", tag: "", featured: false };

function savedAtLabel(ts) {
  const day = new Date(ts).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  return `${day} a las ${formatTime(new Date(ts))}`;
}

/** Una fila editable de la carta. Afuera del editor para no perder el foco al tipear. */
function MenuRow({ item, original, error, flash, onChange, onRemove }) {
  const label = item.name.trim() || "el producto";
  const priceChanged = original && original.price !== item.price;
  // El error de la fila es del precio solo si el nombre está bien (se valida
  // primero el nombre); si no, es del nombre (vacío o repetido).
  const priceBad =
    Boolean(error) && Boolean(item.name.trim()) && (item.price <= 0 || item.price > ITEM_PRICE_MAX);
  const nameBad = Boolean(error) && !priceBad;
  return (
    <li
      id={`carta-${item.id}`}
      className={[
        "admin-carta-row",
        error && "has-error",
        !original && "is-new",
        flash && "is-flash",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="admin-carta-name">
        <input
          type="text"
          aria-label="Nombre del producto"
          maxLength={ITEM_NAME_MAX}
          value={item.name}
          aria-invalid={nameBad ? "true" : undefined}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {!original && <span className="admin-tag admin-carta-badge">Nuevo</span>}
      </div>
      <label className="admin-carta-price">
        <span aria-hidden="true">$</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label={`Precio de ${label}`}
          value={item.price ? String(item.price) : ""}
          placeholder="0"
          aria-invalid={priceBad ? "true" : undefined}
          onChange={(e) => onChange({ price: toPrice(e.target.value) })}
        />
      </label>
      <select
        className="admin-carta-cat"
        aria-label={`Categoría de ${label}`}
        value={item.category}
        onChange={(e) => onChange({ category: e.target.value })}
      >
        {CATEGORY_IDS.map((id) => (
          <option key={id} value={id}>
            {categoryLabel(id)}
          </option>
        ))}
      </select>
      <input
        type="text"
        className="admin-carta-tag"
        aria-label={`Etiqueta de ${label} (opcional)`}
        placeholder="Etiqueta (ej. Sin TACC)"
        maxLength={ITEM_TAG_MAX}
        value={item.tag || ""}
        onChange={(e) => onChange({ tag: e.target.value })}
      />
      <button
        type="button"
        className={`admin-carta-star${item.featured ? " is-on" : ""}`}
        aria-pressed={Boolean(item.featured)}
        aria-label={`Destacar ${label}`}
        title="Destacado: sale en el inicio y en la calculadora"
        onClick={() => onChange({ featured: !item.featured })}
      >
        <Star {...ICON} fill={item.featured ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        className="admin-table-action-btn delete admin-carta-remove"
        aria-label={`Sacar ${label} de la carta`}
        title="Sacar de la carta"
        onClick={onRemove}
      >
        <Trash2 {...ICON} />
      </button>
      {(priceChanged || error) && (
        <p className={error ? "admin-field-error admin-carta-note" : "admin-carta-note"} role={error ? "alert" : undefined}>
          {error || `Antes ${formatARS(original.price)}`}
        </p>
      )}
    </li>
  );
}

/**
 * Cantina → Carta y precios. Se edita toda la carta y se guarda junta (con
 * PIN de gestión): recién ahí cambia en la web y en la caja.
 */
export default function CartaEditor({
  menu,
  onSaved,
  onReload,
  onDirtyChange,
  onExpiredSession,
  onToast,
}) {
  const [draft, setDraft] = useState(menu?.items || []);
  const [errors, setErrors] = useState({});
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [adding, setAdding] = useState(null); // producto nuevo a medio cargar
  const [addError, setAddError] = useState("");
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [flashId, setFlashId] = useState(null);
  const { ask: askPin, pinModal } = usePinGate();

  useEffect(() => {
    setDraft(menu?.items || []);
    setErrors({});
    setStale(false);
  }, [menu]);

  const saved = menu?.items || [];
  const originals = useMemo(() => new Map(saved.map((it) => [it.id, it])), [menu]);
  const diff = useMemo(() => diffMenu(saved, draft), [menu, draft]);
  const dirty = diff.count > 0;
  useEffect(() => onDirtyChange?.(dirty), [dirty]);

  // El producto recién agregado se muestra y se marca un momento.
  useEffect(() => {
    if (!flashId) return;
    document
      .getElementById(`carta-${flashId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    const id = setTimeout(() => setFlashId(null), 2200);
    return () => clearTimeout(id);
  }, [flashId]);

  if (!menu) {
    return (
      <section className="admin-settings-card admin-carta">
        <SkeletonRows count={6} />
      </section>
    );
  }

  const q = normalizeSearch(query);
  const visible = draft.filter(
    (it) =>
      (cat === "all" || it.category === cat) &&
      (!q || normalizeSearch(it.name).includes(q)),
  );
  const groups = CATEGORY_IDS.map((id) => ({
    id,
    items: visible.filter((it) => it.category === id),
  })).filter((g) => g.items.length > 0);
  const countIn = (id) =>
    id === "all" ? draft.length : draft.filter((it) => it.category === id).length;
  const featuredCount = draft.filter((it) => it.featured).length;

  function update(id, patch) {
    setDraft((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    if (errors[id]) {
      setErrors(({ [id]: _, ...rest }) => rest);
    }
  }

  function remove(item) {
    const index = draft.findIndex((it) => it.id === item.id);
    setDraft((prev) => prev.filter((it) => it.id !== item.id));
    onToast?.(`“${item.name.trim() || "Producto"}” sale de la carta cuando guardes`, {
      action: {
        label: "Deshacer",
        onClick: () =>
          setDraft((prev) =>
            prev.some((it) => it.id === item.id)
              ? prev
              : [...prev.slice(0, index), item, ...prev.slice(index)],
          ),
      },
    });
  }

  function openAdd() {
    setAdding({ ...EMPTY_NEW, category: cat === "all" ? EMPTY_NEW.category : cat });
    setAddError("");
  }

  function submitAdd(e) {
    e.preventDefault();
    const id = newItemId(adding.name, draft.map((it) => it.id));
    const item = {
      id,
      name: adding.name.trim(),
      price: adding.price,
      category: adding.category,
      ...(adding.tag.trim() ? { tag: adding.tag.trim() } : {}),
      ...(adding.featured ? { featured: true } : {}),
    };
    // Misma validación que al guardar: nombre, precio y que no se repita.
    const problem = menuFromInput([...draft, item]).errors?.[id];
    if (problem) {
      setAddError(problem);
      return;
    }
    // Va al final de su categoría, que es donde se va a ver en la carta.
    setDraft((prev) => {
      const last = prev.map((it) => it.category).lastIndexOf(item.category);
      const at = last === -1 ? prev.length : last + 1;
      return [...prev.slice(0, at), item, ...prev.slice(at)];
    });
    setAdding(null);
    setQuery("");
    setCat(item.category);
    setFlashId(id);
    onToast?.(`“${item.name}” agregado. Guardá la carta para publicarlo.`);
  }

  async function save() {
    const checked = menuFromInput(draft);
    if (checked.error) {
      setErrors(checked.errors);
      // Que se vean todas las filas marcadas.
      setQuery("");
      setCat("all");
      onToast?.(checked.error, { tone: "error" });
      return;
    }
    const res = await askPin(
      {
        title: "Guardar la carta",
        description: `${describeMenuDiff(diff)}. Los precios de la cantina mueven plata: lo autoriza un Administrador o Encargado con su PIN.`,
        confirmButtonText: "Guardar y publicar",
      },
      async ({ pin }) => {
        setSaving(true);
        const r = await adminSaveCantinaMenu(
          { items: draft, baseUpdatedAt: menu.updatedAt },
          pin,
        );
        setSaving(false);
        if (!r.ok) {
          onExpiredSession?.(r);
          if (r.fieldErrors) setErrors(r.fieldErrors);
          if (r.stale) setStale(true);
        }
        return r;
      },
    );
    if (res?.ok) {
      onSaved?.(res.menu);
      onToast?.("Carta guardada: ya se ve en la web y en la caja");
    }
  }

  return (
    <>
      <section className={`admin-settings-card admin-carta${dirty ? " is-dirty" : ""}`}>
        <div className="admin-carta-head">
          <div>
            <h2 className="admin-section-title">
              <BookOpen {...ICON} /> Carta y precios
            </h2>
            <p className="admin-field-hint">
              Lo que guardes acá cambia al toque en la carta de la web, en “Lo más
              pedido” del inicio y en la caja de la cantina. Los pedidos y las ventas
              que ya entraron quedan con su precio.
            </p>
            <p className="admin-field-hint admin-carta-saved">
              {menu.custom && menu.updatedAt
                ? `Guardada por última vez el ${savedAtLabel(menu.updatedAt)}.`
                : "Es la carta original: todavía no se guardaron cambios desde el panel."}
            </p>
          </div>
          {!adding && (
            <button type="button" className="btn btn-linear-primary" onClick={openAdd}>
              <Plus {...ICON} /> Agregar producto
            </button>
          )}
        </div>

        {stale && (
          <div className="admin-carta-stale" role="alert">
            <span>
              Otra pantalla guardó la carta mientras editabas. Recargala para ver
              esos cambios (los de acá se pierden) y volvé a hacer los tuyos.
            </span>
            <button type="button" className="btn btn-secondary" onClick={onReload}>
              Recargar la carta
            </button>
          </div>
        )}

        {adding && (
          <form className="admin-carta-add" onSubmit={submitAdd} noValidate>
            <div className="admin-carta-add-head">
              <strong>Producto nuevo</strong>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setAdding(null)}
                aria-label="Cancelar producto nuevo"
              >
                <X {...ICON} />
              </button>
            </div>
            <div className="admin-field-row">
              <div className="admin-field">
                <label className="admin-field-label" htmlFor="carta-new-name">
                  Nombre
                </label>
                <input
                  id="carta-new-name"
                  type="text"
                  maxLength={ITEM_NAME_MAX}
                  placeholder="ej. Lomito completo"
                  value={adding.name}
                  onChange={(e) => setAdding({ ...adding, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="admin-field">
                <label className="admin-field-label" htmlFor="carta-new-price">
                  Precio
                </label>
                <div className="admin-carta-price">
                  <span aria-hidden="true">$</span>
                  <input
                    id="carta-new-price"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={adding.price ? String(adding.price) : ""}
                    onChange={(e) => setAdding({ ...adding, price: toPrice(e.target.value) })}
                  />
                </div>
              </div>
              <div className="admin-field">
                <label className="admin-field-label" htmlFor="carta-new-cat">
                  Categoría
                </label>
                <select
                  id="carta-new-cat"
                  value={adding.category}
                  onChange={(e) => setAdding({ ...adding, category: e.target.value })}
                >
                  {CATEGORY_IDS.map((id) => (
                    <option key={id} value={id}>
                      {categoryLabel(id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-field">
                <label className="admin-field-label" htmlFor="carta-new-tag">
                  Etiqueta (opcional)
                </label>
                <input
                  id="carta-new-tag"
                  type="text"
                  maxLength={ITEM_TAG_MAX}
                  placeholder="ej. Sin TACC"
                  value={adding.tag}
                  onChange={(e) => setAdding({ ...adding, tag: e.target.value })}
                />
              </div>
            </div>
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={adding.featured}
                onChange={(e) => setAdding({ ...adding, featured: e.target.checked })}
              />
              Destacado (sale en el inicio y en la calculadora)
            </label>
            {addError && (
              <p className="admin-field-error" role="alert">
                {addError}
              </p>
            )}
            <div className="admin-carta-add-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setAdding(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-linear-primary">
                Agregar a la carta
              </button>
            </div>
          </form>
        )}

        <div className="admin-view-toolbar">
          <div className="admin-search-wrap admin-pos-search">
            <Search {...ICON} />
            <input
              type="search"
              className="admin-search-input"
              placeholder="Buscar en la carta"
              aria-label="Buscar en la carta"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
        </div>

        <div className="admin-chips" role="group" aria-label="Categorías">
          {MENU_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
            >
              {c.label} ({countIn(c.id)})
            </button>
          ))}
        </div>

        <p className="admin-field-hint admin-carta-legend">
          <Star {...ICON} fill="currentColor" className="admin-carta-legend-star" />
          Destacados: {featuredCount}. Salen en la calculadora para dividir gastos y,
          los primeros {HOME_FEATURED_COUNT}, en “Lo más pedido” del inicio.
        </p>

        {groups.length === 0 ? (
          <EmptyState
            icon={Search}
            title={q ? `No hay productos con “${query}”` : "No hay productos en esta categoría"}
            action={
              q
                ? { label: "Limpiar búsqueda", onClick: () => setQuery("") }
                : { label: "Agregar producto", onClick: openAdd }
            }
          />
        ) : (
          groups.map((g) => (
            <section key={g.id} className="admin-carta-group" aria-label={categoryLabel(g.id)}>
              <h3 className="admin-pos-group-title">
                {categoryLabel(g.id)} · {plural(g.items.length, "producto", "productos")}
              </h3>
              <ul className="admin-carta-list">
                {g.items.map((item) => (
                  <MenuRow
                    key={item.id}
                    item={item}
                    original={originals.get(item.id)}
                    error={errors[item.id]}
                    flash={flashId === item.id}
                    onChange={(patch) => update(item.id, patch)}
                    onRemove={() => remove(item)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </section>

      {dirty && (
        <div className="admin-unsaved-bar" role="region" aria-label="Cambios sin guardar en la carta">
          <span className="admin-carta-unsaved">
            {plural(diff.count, "cambio", "cambios")} sin guardar
            <small>{describeMenuDiff(diff)}</small>
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDraft(saved);
                setErrors({});
              }}
              disabled={saving}
            >
              <Trash2 {...ICON} /> Descartar
            </button>
            <button
              type="button"
              className="btn btn-linear-primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar carta"}
            </button>
          </div>
        </div>
      )}

      {pinModal}
    </>
  );
}
