import test from "node:test";
import assert from "node:assert/strict";
import {
  describeMenuDiff,
  diffMenu,
  featuredItems,
  menuFromInput,
  menuSaveStep,
  newItemId,
  normalizeMenu,
} from "../lib/cantinaMenu.js";
import { MENU_ITEMS } from "../data/menu.js";
import { orderLines, validateOrder } from "../lib/cantinaOrder.js";

const pizza = { id: "pizza_muzza", category: "buffet", name: "Pizza muzza", price: 18000, featured: true };
const agua = { id: "agua_500", category: "bebidas-sin", name: "Agua 500ml", price: 2000 };

test("sin carta guardada se usa la original, con los mismos productos y precios", () => {
  const menu = normalizeMenu(null);
  assert.equal(menu.custom, false);
  assert.equal(menu.updatedAt, null);
  assert.equal(menu.items.length, MENU_ITEMS.length);
  assert.deepEqual(
    menu.items.find((it) => it.id === "heineken_litro"),
    { id: "heineken_litro", category: "bebidas-con", name: "Heineken litro", price: 10000, featured: true },
  );
});

test("la carta guardada reemplaza a la original y descarta productos rotos", () => {
  const menu = normalizeMenu({
    updatedAt: 1730000000000,
    items: {
      0: agua,
      1: { ...pizza, price: 21000 },
      2: { id: "roto", category: "buffet", name: "", price: 100 },
      3: { id: "sin_precio", category: "kiosco", name: "Chicle", price: 0 },
      4: { id: "otra_cat", category: "inventada", name: "Algo", price: 100 },
      5: { ...agua, name: "Duplicado" },
    },
  });
  assert.equal(menu.custom, true);
  assert.equal(menu.updatedAt, 1730000000000);
  // Agrupada por categoría en el orden de la carta: Cocina antes que Bebidas.
  assert.deepEqual(
    menu.items.map((it) => [it.id, it.price]),
    [
      ["pizza_muzza", 21000],
      ["agua_500", 2000],
    ],
  );
});

test("guardar valida nombre, precio, categoría y nombres repetidos por fila", () => {
  const res = menuFromInput([
    { ...pizza, name: "  " },
    { ...agua, price: 0 },
    { id: "coca", category: "bebidas-sin", name: "Coca", price: 4000 },
    { id: "coca_2", category: "bebidas-sin", name: "COCA ", price: 4000 },
    { id: "rara", category: "nada", name: "Rara", price: 1 },
  ]);
  assert.equal(res.error, "Revisá los productos marcados en rojo.");
  assert.equal(res.errors.pizza_muzza, "Poné el nombre del producto.");
  assert.equal(res.errors.agua_500, "Poné un precio mayor a $0.");
  assert.match(res.errors.coca_2, /Ya hay otro producto que se llama “Coca”/);
  assert.equal(res.errors.rara, "Elegí una categoría.");
  assert.equal(res.errors.coca, undefined);
});

test("guardar limpia los productos y no deja campos vacíos para la base", () => {
  const res = menuFromInput([
    { id: "agua_500", category: "bebidas-sin", name: " Agua   500ml ", price: "2500", tag: "  ", featured: false },
    { id: "lomito", category: "buffet", name: "Lomito", price: 25000.4, tag: "Nuevo", featured: true },
  ]);
  assert.deepEqual(res.items, [
    { id: "lomito", category: "buffet", name: "Lomito", price: 25000, tag: "Nuevo", featured: true },
    { id: "agua_500", category: "bebidas-sin", name: "Agua 500ml", price: 2500 },
  ]);
});

test("una carta vacía, gigante o con ids raros no se guarda", () => {
  assert.match(menuFromInput([]).error, /al menos un producto/);
  assert.match(menuFromInput(null).error, /al menos un producto/);
  const many = Array.from({ length: 251 }, (_, i) => ({ ...agua, id: `a${i}`, name: `Agua ${i}` }));
  assert.match(menuFromInput(many).error, /hasta 250/);
  assert.match(menuFromInput([{ ...agua, id: "a/b" }]).error, /inválido/);
  assert.match(menuFromInput([agua, { ...agua, name: "Otra" }]).error, /inválido/);
});

test("el id de un producto nuevo sale del nombre y no pisa otro", () => {
  assert.equal(newItemId("Lomito completo", []), "lomito_completo");
  assert.equal(newItemId("Café con leche", ["cafe_con_leche"]), "cafe_con_leche_2");
  assert.equal(newItemId("¡¡!!", []), "producto");
});

test("los destacados y el resumen de cambios", () => {
  const before = [pizza, agua];
  const after = [{ ...pizza, price: 20000 }, { id: "lomito", category: "buffet", name: "Lomito", price: 25000 }];
  assert.deepEqual(featuredItems(after).map((it) => it.id), ["pizza_muzza"]);
  const diff = diffMenu(before, after);
  assert.equal(diff.count, 3);
  assert.equal(describeMenuDiff(diff), "1 cambiado · 1 agregado (Lomito) · 1 sacado (Agua 500ml)");
  // Una etiqueta vacía o un destacado en false no cuentan como cambio.
  assert.equal(diffMenu([agua], [{ ...agua, tag: "", featured: false }]).count, 0);
});

test("los pedidos de la web se cobran con el precio de la carta guardada", () => {
  const { items } = normalizeMenu({ updatedAt: 1, items: [{ ...pizza, price: 21000 }] });
  assert.deepEqual(orderLines({ pizza_muzza: 2, agua_500: 1 }, items), [
    { id: "pizza_muzza", name: "Pizza muzza", price: 21000, qty: 2 },
  ]);
  const checked = validateOrder({ code: "K7Q2", name: "Fede", items: { pizza_muzza: 1 } }, items);
  assert.equal(checked.ok, true);
  assert.equal(checked.order.total, 21000);
});

/**
 * Como corre una transacción de RTDB sin caché local: el primer intento llega
 * con null y la base solo acepta lo propuesto si se calculó sobre el valor que
 * tiene guardado; si no, reintenta con ese valor.
 */
function runTransaction(stored, update) {
  let current = null;
  for (let i = 0; i < 5; i++) {
    const next = update(current);
    if (next === undefined) return { committed: false, value: stored };
    if (JSON.stringify(current) === JSON.stringify(stored)) return { committed: true, value: next };
    current = stored;
  }
  throw new Error("la transacción no terminó");
}

test("guardar la carta no pisa lo que guardó otra pantalla en el medio", () => {
  const items = [agua];
  const save = (stored, base) =>
    runTransaction(stored, (current) => menuSaveStep(current, base, items, 999));

  // Primera vez (carta original) y sobre la versión que se editó: se guarda.
  assert.deepEqual(save(null, null), { committed: true, value: { items, updatedAt: 999 } });
  assert.deepEqual(save({ items: [pizza], updatedAt: 100 }, 100), {
    committed: true,
    value: { items, updatedAt: 999 },
  });
  // Otra pantalla guardó después de abrir la carta: aborta.
  assert.equal(save({ items: [pizza], updatedAt: 200 }, 100).committed, false);
  // Se editó la original pero alguien ya había guardado una carta: aborta.
  assert.equal(save({ items: [pizza], updatedAt: 100 }, null).committed, false);
  // La carta desapareció de la base: no se escribe nada (el action lo toma como desactualizada).
  assert.deepEqual(save(null, 100), { committed: true, value: null });
});
