import test from "node:test";
import assert from "node:assert/strict";
import { productIcon } from "../lib/productIcon.js";
import { MENU_ITEMS } from "../data/menu.js";

test("productIcon reconoce los productos por el nombre", () => {
  assert.equal(productIcon("Pizza muzza", "buffet"), "🍕");
  assert.equal(productIcon("Docena de empanadas", "buffet"), "🥟");
  assert.equal(productIcon("Sándwich de mila", "buffet"), "🥪");
  assert.equal(productIcon("Agua 500ml", "bebidas-sin"), "💧");
  assert.equal(productIcon("Stella Artois 0% 330ml", "bebidas-con"), "🍺");
  assert.equal(productIcon("Fernet y Coca", "bebidas-con"), "🥃");
  assert.equal(productIcon("Pelotas de pádel (tubo)", "accesorios"), "🎾");
});

test("productIcon no confunde nombres parecidos", () => {
  // "Levité" termina en "té" pero no es un té; "Tostex" no es un tostado.
  assert.equal(productIcon("Levité 1.5L", "bebidas-sin"), "🥤");
  assert.equal(productIcon("Tostex proteicas", "kiosco"), "🍫");
});

test("productIcon cae en el ícono de la categoría, y si no en uno genérico", () => {
  assert.equal(productIcon("Cubre grip liso", "accesorios"), "🎾");
  assert.equal(productIcon("Coca-Cola 500ml", "bebidas-sin"), "🥤");
  assert.equal(productIcon("Algo nuevo", "otra"), "🍽️");
  assert.equal(productIcon(undefined, undefined), "🍽️");
});

test("todos los productos de la carta tienen ícono", () => {
  for (const item of MENU_ITEMS) {
    assert.ok(productIcon(item.name, item.category), item.name);
  }
});
