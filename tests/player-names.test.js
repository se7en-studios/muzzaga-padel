import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PLAYER_NAMES,
  PLAYER_NAME_MAX_LENGTH,
  normalizePlayerNames,
  readPlayerNames,
} from "../lib/playerNames.js";

test("normalizePlayerNames recorta espacios y saca los vacíos", () => {
  assert.deepEqual(
    normalizePlayerNames(["  Juan  Pérez ", "", "   ", "Ana"]),
    ["Juan Pérez", "Ana"],
  );
});

test("normalizePlayerNames deja como mucho 4 nombres", () => {
  const res = normalizePlayerNames(["A", "B", "C", "D", "E", "F"]);
  assert.equal(MAX_PLAYER_NAMES, 4);
  assert.deepEqual(res, ["A", "B", "C", "D"]);
});

test("normalizePlayerNames corta cada nombre a 40 caracteres", () => {
  const long = "x".repeat(60);
  const [name] = normalizePlayerNames([long]);
  assert.equal(PLAYER_NAME_MAX_LENGTH, 40);
  assert.equal(name.length, 40);
});

test("normalizePlayerNames ignora lo que no es texto y entradas raras", () => {
  assert.deepEqual(normalizePlayerNames(["Ana", 12, null, { a: 1 }, ["b"]]), ["Ana"]);
  assert.deepEqual(normalizePlayerNames(undefined), []);
  assert.deepEqual(normalizePlayerNames("Ana"), []);
  assert.deepEqual(normalizePlayerNames({ 0: "Ana" }), []);
});

test("los vacíos no ocupan lugar: 4 nombres reales aunque haya huecos", () => {
  assert.deepEqual(
    normalizePlayerNames(["", "A", " ", "B", "C", "", "D", "E"]),
    ["A", "B", "C", "D"],
  );
});

test("readPlayerNames no rompe con turnos viejos sin el campo", () => {
  assert.deepEqual(readPlayerNames({ playerName: "Juan" }), []);
  assert.deepEqual(readPlayerNames(null), []);
  assert.deepEqual(readPlayerNames({ playerNames: "texto suelto" }), []);
});

test("readPlayerNames lee el formato objeto de Firebase en orden", () => {
  assert.deepEqual(
    readPlayerNames({ playerNames: { 0: "Ana", 1: "Beto", 2: "  " } }),
    ["Ana", "Beto"],
  );
  assert.deepEqual(readPlayerNames({ playerNames: ["Ana", "Beto"] }), ["Ana", "Beto"]);
});
