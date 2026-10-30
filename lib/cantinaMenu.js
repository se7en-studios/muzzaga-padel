// La carta de la cantina como datos: productos y precios que se cambian desde
// el panel (Cantina → Carta y precios). Puro e isomórfico, igual que
// siteContent.js: lo usan el server (inicio, /menu, la API de pedidos, las
// actions) y el panel. La carta original sigue en data/menu.js, así un
// `cantinaMenu` vacío en la base se ve exactamente igual que antes.
import { MENU_CATEGORIES, MENU_ITEMS } from "../data/menu.js";

export { MENU_CATEGORIES };

/** Categorías en las que puede ir un producto (sin "Todo"). */
export const CATEGORY_IDS = MENU_CATEGORIES.filter((c) => c.id !== "all").map((c) => c.id);

export const ITEM_NAME_MAX = 50;
export const ITEM_TAG_MAX = 20;
export const ITEM_PRICE_MAX = 5_000_000;
export const MAX_MENU_ITEMS = 250;
/** Cuántos destacados entran en "Lo más pedido" del inicio. */
export const HOME_FEATURED_COUNT = 6;

const ITEM_ID = /^[a-z0-9_-]{1,40}$/i;

const clip = (v, n) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

/** RTDB guarda listas con claves 0..n como arrays, a veces como objetos. */
const asList = (v) =>
  Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];

/** Para comparar nombres: sin mayúsculas, tildes ni espacios. */
const nameKey = (name) =>
  String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]/g, "");

const toPrice = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};

/** Agrupa por categoría en el orden de la carta, respetando el orden de cada una. */
function byCategory(items) {
  return CATEGORY_IDS.flatMap((cat) => items.filter((it) => it.category === cat));
}

/**
 * Producto limpio, sin campos vacíos (RTDB no acepta `undefined`).
 * Devuelve null si le falta algo indispensable.
 */
function cleanItem(raw) {
  const id = String(raw?.id ?? "");
  const name = clip(raw?.name, ITEM_NAME_MAX);
  const price = toPrice(raw?.price);
  const category = String(raw?.category ?? "");
  if (!ITEM_ID.test(id) || !name || !CATEGORY_IDS.includes(category)) return null;
  if (price <= 0 || price > ITEM_PRICE_MAX) return null;
  const item = { id, category, name, price };
  const tag = clip(raw?.tag, ITEM_TAG_MAX);
  if (tag) item.tag = tag;
  if (raw?.featured === true) item.featured = true;
  return item;
}

/**
 * Carta guardada → la que se usa. `null` (nunca se tocó) es la carta
 * original; un producto roto se descarta en vez de romper la web.
 * @returns {{ items: object[], custom: boolean, updatedAt: number | null }}
 */
export function normalizeMenu(raw) {
  if (!raw || typeof raw !== "object") {
    return { items: MENU_ITEMS.map(cleanItem).filter(Boolean), custom: false, updatedAt: null };
  }
  const seen = new Set();
  const items = asList(raw.items)
    .map(cleanItem)
    .filter((it) => it && !seen.has(it.id) && seen.add(it.id));
  return { items: byCategory(items), custom: true, updatedAt: Number(raw.updatedAt) || null };
}

/**
 * Lo que se editó en el panel → lo que se guarda. Los errores vienen por id
 * de producto para marcar la fila.
 * @returns {{ items: object[] } | { error: string, errors: Record<string, string> }}
 */
export function menuFromInput(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return { error: "La carta tiene que tener al menos un producto.", errors: {} };
  }
  if (list.length > MAX_MENU_ITEMS) {
    return { error: `La carta admite hasta ${MAX_MENU_ITEMS} productos.`, errors: {} };
  }
  const errors = {};
  const ids = new Set();
  const names = new Map();
  const items = [];
  for (const raw of list) {
    const id = String(raw?.id ?? "");
    if (!ITEM_ID.test(id) || ids.has(id)) {
      return { error: "La carta tiene un producto inválido. Recargá la página.", errors: {} };
    }
    ids.add(id);
    const name = clip(raw?.name, ITEM_NAME_MAX);
    const price = toPrice(raw?.price);
    const key = nameKey(name);
    if (!name) errors[id] = "Poné el nombre del producto.";
    else if (names.has(key)) errors[id] = `Ya hay otro producto que se llama “${names.get(key)}”.`;
    else if (price <= 0) errors[id] = "Poné un precio mayor a $0.";
    else if (price > ITEM_PRICE_MAX) errors[id] = "Ese precio es demasiado alto.";
    else if (!CATEGORY_IDS.includes(raw?.category)) errors[id] = "Elegí una categoría.";
    if (name && !names.has(key)) names.set(key, name);
    if (!errors[id]) items.push(cleanItem({ ...raw, id, name, price }));
  }
  if (Object.keys(errors).length) {
    return { error: "Revisá los productos marcados en rojo.", errors };
  }
  return { items: byCategory(items) };
}

/**
 * Un paso de la transacción de RTDB que guarda la carta. `undefined` aborta:
 * otra pantalla guardó después de `baseUpdatedAt` y no se pisa su trabajo.
 * El primer intento llega con null aunque haya carta (ver
 * adminVoidCantinaSale): se propone null y la base lo reintenta con el valor
 * real.
 */
export function menuSaveStep(current, baseUpdatedAt, items, updatedAt) {
  if (current === null && baseUpdatedAt !== null) return null;
  if ((Number(current?.updatedAt) || null) !== baseUpdatedAt) return undefined;
  return { items, updatedAt };
}

/** Id para un producto nuevo, a partir del nombre ("Lomito completo" → "lomito_completo"). */
export function newItemId(name, takenIds) {
  const taken = new Set(takenIds);
  const base =
    String(name ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || "producto";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  return id;
}

/** Los que salen en "Lo más pedido" del inicio y en la calculadora de gastos. */
export const featuredItems = (items) => items.filter((it) => it.featured);

/** Qué cambió entre dos cartas, para el aviso de cambios y el historial. */
export function diffMenu(before, after) {
  const prev = new Map(before.map((it) => [it.id, it]));
  const next = new Set(after.map((it) => it.id));
  const added = after.filter((it) => !prev.has(it.id));
  const removed = before.filter((it) => !next.has(it.id));
  const changed = after.filter((it) => {
    const old = prev.get(it.id);
    return (
      old &&
      (old.name !== it.name ||
        old.price !== it.price ||
        old.category !== it.category ||
        (old.tag || "") !== (it.tag || "") ||
        Boolean(old.featured) !== Boolean(it.featured))
    );
  });
  return { added, removed, changed, count: added.length + removed.length + changed.length };
}

/** "2 cambiados · 1 agregado (Lomito) · 1 sacado (Turrón)". */
export function describeMenuDiff({ added, removed, changed }) {
  const names = (list) => list.map((it) => it.name).join(", ");
  return [
    changed.length && `${changed.length} ${changed.length === 1 ? "cambiado" : "cambiados"}`,
    added.length && `${added.length} ${added.length === 1 ? "agregado" : "agregados"} (${names(added)})`,
    removed.length && `${removed.length} ${removed.length === 1 ? "sacado" : "sacados"} (${names(removed)})`,
  ]
    .filter(Boolean)
    .join(" · ");
}
