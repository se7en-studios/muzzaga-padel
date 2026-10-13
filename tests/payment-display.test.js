import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, publicPayment } from "../lib/clubConfig.js";

test("el alias por defecto no se muestra al público (no es una cuenta confirmada)", () => {
  const p = publicPayment({ ...DEFAULT_CONFIG });
  assert.equal(p.alias, null);
  assert.equal(p.cbu, null);
  assert.equal(p.titular, "Muzzaga Pádel");
});

test("un alias propio cargado en el admin sí se muestra", () => {
  const p = publicPayment({
    ...DEFAULT_CONFIG,
    paymentAlias: "  muzzaga.club  ",
    paymentCbu: "0000003100012345678901",
    paymentTitular: "Club Muzzaga SRL",
  });
  assert.equal(p.alias, "muzzaga.club");
  assert.equal(p.cbu, "0000003100012345678901");
  assert.equal(p.titular, "Club Muzzaga SRL");
});

test("alias vacío o config faltante no rompe", () => {
  assert.equal(publicPayment({ paymentAlias: "" }).alias, null);
  assert.equal(publicPayment(undefined).alias, null);
  assert.equal(publicPayment(null).titular, "Muzzaga Pádel");
});
