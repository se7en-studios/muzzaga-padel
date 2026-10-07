import test from "node:test";
import assert from "node:assert/strict";
import {
  checkJoinable,
  claimSlot,
  toPublicMatch,
  validateCreate,
  validateJoin,
} from "../lib/openMatches.js";

const TODAY = "2026-10-07";
const stored = {
  category: "6ta Categoría (3.0 - 3.9)",
  date: TODAY,
  players: [
    { name: "Juan Pérez (Org.)", phone: "2995551234", taken: true },
    { name: "Ana Gómez", phone: "2995559999", taken: true, joinedAt: 1 },
    { name: "", phone: "", taken: false },
    { name: "", phone: "", taken: false },
  ],
};

test("public listing never includes phones or surnames", () => {
  const pub = toPublicMatch("abc", stored);
  assert.doesNotMatch(JSON.stringify(pub), /299555|phone|Pérez|Gómez/);
  assert.deepEqual(pub.players[0], { name: "Juan (Org.)", taken: true });
  assert.deepEqual(pub.players[1], { name: "Ana", taken: true });
  assert.equal(pub.players[2].taken, false);
});

test("join validation rejects bad ids, slots, names and phones", () => {
  const ok = {
    matchId: "-Nabc_12",
    slotIndex: 2,
    playerName: "Lucas",
    playerPhone: "299 597 4176",
  };
  assert.equal(validateJoin(ok).ok, true);
  assert.equal(validateJoin({ ...ok, matchId: "../bookings" }).ok, false);
  assert.equal(validateJoin({ ...ok, matchId: 5 }).ok, false);
  assert.equal(validateJoin({ ...ok, slotIndex: 4 }).ok, false);
  assert.equal(validateJoin({ ...ok, slotIndex: "1" }).ok, false);
  assert.equal(validateJoin({ ...ok, playerName: "x".repeat(61) }).ok, false);
  assert.equal(validateJoin({ ...ok, playerPhone: "abc" }).ok, false);
  assert.equal(validateJoin({ ...ok, playerPhone: undefined }).ok, false);
});

test("join is rejected when slot taken, match full or past", () => {
  assert.equal(checkJoinable(stored, 2, TODAY).ok, true);
  assert.equal(checkJoinable(stored, 1, TODAY).ok, false);
  assert.equal(checkJoinable(stored, 2, "2026-10-08").ok, false);
  const full = {
    ...stored,
    players: stored.players.map((p) => ({ ...p, taken: true })),
  };
  assert.match(checkJoinable(full, 2, TODAY).error, /completo/);
  // La transacción aborta si otro tomó el lugar entre lectura y escritura.
  const me = { name: "Lucas", phone: "1", taken: true };
  assert.equal(claimSlot({ name: "Otro", taken: true }, me), undefined);
  assert.equal(claimSlot({ name: "", taken: false }, me), me);
  assert.equal(claimSlot(null, me), me);
});

test("create validation: required category, lengths, no past dates", () => {
  const base = { category: "Torneo Damas A/B", creatorName: "Sofi", date: "" };
  const res = validateCreate(base, TODAY);
  assert.equal(res.ok, true);
  assert.equal(res.value.date, TODAY);
  assert.equal(
    validateCreate({ ...base, category: undefined }, TODAY).ok,
    false,
  );
  assert.equal(validateCreate(undefined, TODAY).ok, false);
  assert.equal(
    validateCreate({ ...base, date: "2026-10-06" }, TODAY).ok,
    false,
  );
  assert.equal(validateCreate({ ...base, date: "mañana" }, TODAY).ok, false);
  assert.equal(
    validateCreate({ ...base, desc: "x".repeat(201) }, TODAY).ok,
    false,
  );
});
