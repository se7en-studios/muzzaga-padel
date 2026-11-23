// Pedidos a la cantina desde la carta (/menu): el carrito, el mensaje de
// WhatsApp y la validación que repite el servidor antes de guardarlo para el
// panel. Sin Next ni Firebase, así lo usan el navegador, el action y los tests.

import { formatARS } from "./format.js";

// La cocina arranca cuando el pedido está pagado: "nuevo" es esperando el
// pago, "preparando" ya está cobrado y en cocina.
export const ORDER_STATUSES = ["nuevo", "preparando", "entregado", "cancelado"];
export const ORDER_STATUS_LABELS = {
  nuevo: "Esperando pago",
  preparando: "Pagado · en cocina",
  entregado: "Entregado",
  cancelado: "Cancelado",
};
/** Los que la cantina todavía tiene que resolver. */
export const OPEN_ORDER_STATUSES = ["nuevo", "preparando"];

export const MAX_ORDER_LINES = 30;
export const MAX_ORDER_QTY = 20;
const NAME_MAX = 40;
const DELIVERY_MAX = 40;
const NOTES_MAX = 140;

// Sin 0/O ni 1/I: el código se dicta en el mostrador.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_RE = /^[23456789A-HJ-NP-Z]{4}$/;

// Cómo piensa pagar quien pide (se cobra antes de preparar). El alias de la
// transferencia lo pasa el club por WhatsApp o en el mostrador.
export const PAY_OPTIONS = [
  { id: "barra", label: "En la barra" },
  { id: "transferencia", label: "Transferencia" },
];
export const DEFAULT_PAY = "barra";
export const payLabel = (id) =>
  id === "transferencia" ? "por transferencia" : "en la barra";

export const DEFAULT_DELIVERY = "Retiro en la barra";
export const DELIVERY_OPTIONS = [
  { id: "barra", label: DEFAULT_DELIVERY },
  { id: "cancha-1", label: "Cancha 1" },
  { id: "cancha-2", label: "Cancha 2" },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ id: `mesa-${n}`, label: `Mesa ${n}` })),
];

const squash = (v) =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]/g, "");

/**
 * Lugar de entrega que viene del QR (?cancha=cancha-1, ?mesa=mesa3, ?mesa=3,
 * ?ubicacion=Cancha 2…). Uno conocido devuelve su etiqueta; una mesa o cancha
 * con número que no está en la lista, "Mesa 9"; otro, el texto tal cual
 * (recortado); sin nada, null.
 * @param {string | null | undefined} raw
 * @param {"mesa" | "cancha" | string | null} [kind] el parámetro del QR del
 *   que vino: con ?mesa=3 el "3" solo es la mesa 3.
 */
export function deliveryFromParam(raw, kind) {
  const key = locationKey(raw, kind);
  if (!key) return null;
  const known = DELIVERY_OPTIONS.find((o) => o.id === key || squash(o.label) === squash(key));
  if (known) return known.label;
  const m = /^(mesa|cancha)-(\d{1,3})$/.exec(key);
  if (m) return `${m[1] === "mesa" ? "Mesa" : "Cancha"} ${Number(m[2])}`;
  return cleanText(raw, DELIVERY_MAX) || null;
}

/**
 * Clave normalizada del lugar del QR: "mesa-3", "cancha-1"… Acepta
 * "mesa-3", "Mesa 3", "mesa3" y, si el parámetro fue ?mesa= o ?cancha=,
 * también el número solo ("3"). Otro texto vuelve aplanado ("quincho");
 * sin nada, null.
 * @param {string | null | undefined} raw
 * @param {string | null} [kind]
 */
export function locationKey(raw, kind) {
  const key = squash(raw);
  if (!key) return null;
  const place = kind === "mesa" || kind === "cancha" ? kind : null;
  if (place && /^\d{1,3}$/.test(key)) return `${place}-${Number(key)}`;
  const m = /^(mesa|cancha)(\d{1,3})$/.exec(key);
  if (m) return `${m[1]}-${Number(m[2])}`;
  return key;
}

/** Texto de una línea, sin caracteres de control ni espacios de más. */
export function cleanText(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Código corto del pedido ("K7Q2"). @param {() => number} [random] */
export function makeOrderCode(random = Math.random) {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Carrito { id: cantidad } → líneas con nombre y precio de la carta. Los
 * precios salen siempre de `menu`, nunca de lo que mande el navegador; lo
 * que no está en la carta se descarta.
 * @param {Record<string, number> | Array<{id: string, qty: number}>} cart
 * @param {Array<{id: string, name: string, price: number}>} menu
 */
export function orderLines(cart, menu) {
  const byId = new Map(menu.map((item) => [item.id, item]));
  const entries = Array.isArray(cart)
    ? cart.map((l) => [l?.id, l?.qty])
    : Object.entries(cart || {});
  const qtyById = new Map();
  for (const [id, qty] of entries) {
    if (!byId.has(id)) continue;
    const n = Math.round(Number(qty) || 0);
    if (n <= 0) continue;
    qtyById.set(id, Math.min(MAX_ORDER_QTY, (qtyById.get(id) || 0) + n));
  }
  return [...qtyById]
    .slice(0, MAX_ORDER_LINES)
    .map(([id, qty]) => {
      const { name, price } = byId.get(id);
      return { id, name, price, qty };
    });
}

export const orderTotal = (lines) =>
  lines.reduce((sum, line) => sum + line.price * line.qty, 0);

export const orderCount = (lines) =>
  lines.reduce((sum, line) => sum + line.qty, 0);

/**
 * Valida un pedido tal como llega del navegador.
 * @returns {{ ok: true, order: object } | { ok: false, error: string }}
 */
export function validateOrder(input, menu) {
  const code = String(input?.code || "");
  if (!CODE_RE.test(code)) return { ok: false, error: "Pedido inválido. Probá de nuevo." };
  const items = orderLines(input?.items, menu);
  if (items.length === 0) return { ok: false, error: "Agregá al menos un producto." };
  const name = cleanText(input?.name, NAME_MAX);
  if (name.length < 2) return { ok: false, error: "Ingresá tu nombre." };
  const deliverTo = cleanText(input?.deliverTo, DELIVERY_MAX) || DEFAULT_DELIVERY;
  const notes = cleanText(input?.notes, NOTES_MAX);
  const payWith = PAY_OPTIONS.some((o) => o.id === input?.payWith) ? input.payWith : DEFAULT_PAY;
  return {
    ok: true,
    order: { code, items, total: orderTotal(items), name, deliverTo, payWith, notes },
  };
}

/** Mensaje de WhatsApp del pedido. */
export function buildOrderMessage({ code, items, total, name, deliverTo, payWith, notes }) {
  const lines = [
    "¡Hola Muzzaga! Quiero hacer este pedido a la cantina.",
    "",
    `*Pedido #${code}*`,
    `A nombre de: ${name}`,
    `Entrega: ${deliverTo || DEFAULT_DELIVERY}`,
    payWith === "transferencia"
      ? "Pago: por transferencia, ¿me pasan el alias?"
      : "Pago: en la barra",
    "",
    ...items.map((it) => `• ${it.qty} × ${it.name} · ${formatARS(it.price * it.qty)}`),
    "",
    `*Total: ${formatARS(total)}*`,
  ];
  if (notes) lines.push(`Aclaraciones: ${notes}`);
  return lines.join("\n");
}

/** @param {string} phoneRaw número sin "+" (CLUB_INFO.phoneRaw) */
export function buildOrderWhatsAppUrl(phoneRaw, order) {
  return `https://wa.me/${phoneRaw}?text=${encodeURIComponent(buildOrderMessage(order))}`;
}

/**
 * Carrito guardado en el navegador → { id: cantidad } solo con productos
 * que siguen en la carta. Cualquier cosa rara vuelve como carrito vacío.
 */
export function parseStoredCart(json, menu) {
  try {
    const data = JSON.parse(json || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(orderLines(data, menu).map((l) => [l.id, l.qty]));
  } catch {
    return {};
  }
}
