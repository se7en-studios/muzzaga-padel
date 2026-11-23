import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DELIVERY,
  MAX_ORDER_LINES,
  MAX_ORDER_QTY,
  buildOrderMessage,
  buildOrderWhatsAppUrl,
  deliveryFromParam,
  locationKey,
  makeOrderCode,
  orderCount,
  orderLines,
  orderTotal,
  parseStoredCart,
  validateOrder,
} from "../lib/cantinaOrder.js";

const MENU = [
  { id: "pizza_muzza", name: "Pizza muzza", price: 18000 },
  { id: "coca_500", name: "Coca-Cola 500ml", price: 4000 },
  { id: "alfajor", name: "Alfajor", price: 3000 },
];

test("orderLines toma nombre y precio de la carta, no del navegador", () => {
  const lines = orderLines(
    [
      { id: "pizza_muzza", qty: 2, price: 1, name: "Truchada" },
      { id: "no_existe", qty: 3 },
      { id: "coca_500", qty: 0 },
    ],
    MENU,
  );
  assert.deepEqual(lines, [{ id: "pizza_muzza", name: "Pizza muzza", price: 18000, qty: 2 }]);
});

test("orderLines acepta el carrito { id: cantidad }, redondea, suma repetidos y topea", () => {
  const lines = orderLines({ coca_500: 2.6, alfajor: 999 }, MENU);
  assert.deepEqual(
    lines.map((l) => [l.id, l.qty]),
    [
      ["coca_500", 3],
      ["alfajor", MAX_ORDER_QTY],
    ],
  );
  const repeated = orderLines(
    [
      { id: "alfajor", qty: 2 },
      { id: "alfajor", qty: 3 },
    ],
    MENU,
  );
  assert.equal(repeated[0].qty, 5);
});

test("orderLines corta en MAX_ORDER_LINES productos distintos", () => {
  const big = Array.from({ length: MAX_ORDER_LINES + 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, price: 100 }));
  const cart = Object.fromEntries(big.map((p) => [p.id, 1]));
  assert.equal(orderLines(cart, big).length, MAX_ORDER_LINES);
});

test("orderTotal y orderCount", () => {
  const lines = orderLines({ pizza_muzza: 2, coca_500: 3 }, MENU);
  assert.equal(orderTotal(lines), 48000);
  assert.equal(orderCount(lines), 5);
});

test("makeOrderCode: 4 caracteres sin 0, O, 1 ni I", () => {
  for (let i = 0; i < 500; i++) {
    const code = makeOrderCode();
    assert.match(code, /^[23456789A-HJ-NP-Z]{4}$/);
  }
  assert.equal(makeOrderCode(() => 0), "2222");
  assert.equal(makeOrderCode(() => 0.9999), "ZZZZ");
});

test("validateOrder limpia y rechaza lo que no sirve", () => {
  const good = validateOrder(
    { code: "K7Q2", items: [{ id: "pizza_muzza", qty: 1 }], name: "  Fede\n ", deliverTo: "", notes: " sin\tcebolla " },
    MENU,
  );
  assert.equal(good.ok, true);
  assert.deepEqual(good.order, {
    code: "K7Q2",
    items: [{ id: "pizza_muzza", name: "Pizza muzza", price: 18000, qty: 1 }],
    total: 18000,
    name: "Fede",
    deliverTo: DEFAULT_DELIVERY,
    payWith: "barra",
    notes: "sin cebolla",
  });
  const transfer = validateOrder({ code: "K7Q2", items: [{ id: "alfajor", qty: 1 }], name: "Fede", payWith: "transferencia" }, MENU);
  assert.equal(transfer.order.payWith, "transferencia");
  const weird = validateOrder({ code: "K7Q2", items: [{ id: "alfajor", qty: 1 }], name: "Fede", payWith: "bitcoin" }, MENU);
  assert.equal(weird.order.payWith, "barra");

  assert.equal(validateOrder({ code: "k7q2", items: [{ id: "alfajor", qty: 1 }], name: "Fede" }, MENU).ok, false);
  assert.equal(validateOrder({ code: "K7Q0", items: [{ id: "alfajor", qty: 1 }], name: "Fede" }, MENU).ok, false);
  assert.equal(validateOrder({ code: "K7Q2", items: [], name: "Fede" }, MENU).ok, false);
  assert.equal(validateOrder({ code: "K7Q2", items: [{ id: "alfajor", qty: 1 }], name: "F" }, MENU).ok, false);
  assert.equal(validateOrder(null, MENU).ok, false);
  const long = validateOrder({ code: "K7Q2", items: [{ id: "alfajor", qty: 1 }], name: "x".repeat(99), notes: "y".repeat(500) }, MENU);
  assert.equal(long.order.name.length, 40);
  assert.equal(long.order.notes.length, 140);
});

test("buildOrderMessage arma el pedido completo para WhatsApp", () => {
  const { order } = validateOrder(
    { code: "K7Q2", items: [{ id: "pizza_muzza", qty: 2 }, { id: "coca_500", qty: 1 }], name: "Fede", deliverTo: "Cancha 1", notes: "sin cebolla" },
    MENU,
  );
  const msg = buildOrderMessage(order);
  assert.match(msg, /^¡Hola Muzzaga! Quiero hacer este pedido a la cantina\./);
  assert.match(msg, /\*Pedido #K7Q2\*/);
  assert.match(msg, /A nombre de: Fede/);
  assert.match(msg, /Entrega: Cancha 1/);
  assert.match(msg, /Pago: en la barra/);
  assert.match(buildOrderMessage({ ...order, payWith: "transferencia" }), /Pago: por transferencia, ¿me pasan el alias\?/);
  assert.match(msg, /• 2 × Pizza muzza · \$36\.000/);
  assert.match(msg, /• 1 × Coca-Cola 500ml · \$4\.000/);
  assert.match(msg, /\*Total: \$40\.000\*/);
  assert.match(msg, /Aclaraciones: sin cebolla$/);
  assert.doesNotMatch(buildOrderMessage({ ...order, notes: "" }), /Aclaraciones/);

  const url = buildOrderWhatsAppUrl("5492995974176", order);
  assert.ok(url.startsWith("https://wa.me/5492995974176?text="));
  assert.equal(decodeURIComponent(url.split("?text=")[1]), msg);
});

test("deliveryFromParam entiende los QR de canchas y mesas", () => {
  assert.equal(deliveryFromParam("cancha-1"), "Cancha 1");
  assert.equal(deliveryFromParam("cancha2"), "Cancha 2");
  assert.equal(deliveryFromParam("MESA-3"), "Mesa 3");
  assert.equal(deliveryFromParam("Mesa 6"), "Mesa 6");
  assert.equal(deliveryFromParam("quincho"), "quincho");
  assert.equal(deliveryFromParam(""), null);
  assert.equal(deliveryFromParam(null), null);
});

test("deliveryFromParam entiende el número solo de ?mesa=3 y ?cancha=1", () => {
  assert.equal(deliveryFromParam("3", "mesa"), "Mesa 3");
  assert.equal(deliveryFromParam(" 03 ", "mesa"), "Mesa 3");
  assert.equal(deliveryFromParam("1", "cancha"), "Cancha 1");
  assert.equal(deliveryFromParam("mesa-3", "mesa"), "Mesa 3");
  assert.equal(deliveryFromParam("cancha-2", "cancha"), "Cancha 2");
  // Una mesa que no está en la lista igual sale con nombre, no "9".
  assert.equal(deliveryFromParam("9", "mesa"), "Mesa 9");
  assert.equal(deliveryFromParam("mesa-9"), "Mesa 9");
  // Sin saber de qué parámetro vino, un número solo queda tal cual.
  assert.equal(deliveryFromParam("3"), "3");
  assert.equal(deliveryFromParam("3", "ubicacion"), "3");
  assert.equal(deliveryFromParam("quincho", "mesa"), "quincho");
});

test("locationKey normaliza las formas del QR", () => {
  assert.equal(locationKey("3", "mesa"), "mesa-3");
  assert.equal(locationKey("Mesa 3"), "mesa-3");
  assert.equal(locationKey("mesa3", "cancha"), "mesa-3");
  assert.equal(locationKey("CANCHA-1"), "cancha-1");
  assert.equal(locationKey("1", "cancha"), "cancha-1");
  assert.equal(locationKey("quincho"), "quincho");
  assert.equal(locationKey("", "mesa"), null);
});

test("parseStoredCart descarta basura y productos que ya no están", () => {
  assert.deepEqual(parseStoredCart('{"alfajor":2,"no_existe":1,"coca_500":-1}', MENU), { alfajor: 2 });
  assert.deepEqual(parseStoredCart("no es json", MENU), {});
  assert.deepEqual(parseStoredCart("[1,2]", MENU), {});
  assert.deepEqual(parseStoredCart(null, MENU), {});
});
