import test from "node:test";
import assert from "node:assert/strict";
import { hitRateLimit, hashIp, PUBLIC_LIMITS } from "../lib/rateLimit.js";

// RTDB falso: transaction aplica el updater sobre un Map, como la real.
function fakeDb() {
  const store = new Map();
  return {
    store,
    ref: (path) => ({
      transaction: async (update) => {
        const next = update(store.get(path) ?? null);
        if (next === undefined) return { committed: false };
        store.set(path, next);
        return { committed: true };
      },
    }),
  };
}

test("allows under the limit and blocks over it", async () => {
  const db = fakeDb();
  const { max } = PUBLIC_LIMITS.createOpenMatch;
  for (let i = 0; i < max; i++) {
    assert.equal(
      (await hitRateLimit(db, "createOpenMatch", "k", { now: 1000 })).allowed,
      true,
    );
  }
  assert.equal(
    (await hitRateLimit(db, "createOpenMatch", "k", { now: 1000 })).allowed,
    false,
  );
  // Otra IP no comparte el contador.
  assert.equal(
    (await hitRateLimit(db, "createOpenMatch", "otra", { now: 1000 })).allowed,
    true,
  );
});

test("window resets after windowMs", async () => {
  const db = fakeDb();
  const { max, windowMs } = PUBLIC_LIMITS.createBooking;
  for (let i = 0; i <= max; i++)
    await hitRateLimit(db, "createBooking", "k", { now: 0 });
  assert.equal(
    (await hitRateLimit(db, "createBooking", "k", { now: windowMs - 1 }))
      .allowed,
    false,
  );
  assert.equal(
    (await hitRateLimit(db, "createBooking", "k", { now: windowMs })).allowed,
    true,
  );
});

test("fails open when the database errors or hangs", async () => {
  const broken = {
    ref: () => ({
      transaction: async () => {
        throw new Error("offline");
      },
    }),
  };
  assert.equal(
    (await hitRateLimit(broken, "joinOpenMatch", "k")).allowed,
    true,
  );
  const hung = { ref: () => ({ transaction: () => new Promise(() => {}) }) };
  assert.equal(
    (await hitRateLimit(hung, "joinOpenMatch", "k", { timeoutMs: 10 })).allowed,
    true,
  );
});

test("ip hash is stable and does not contain the raw ip", () => {
  assert.equal(hashIp("1.2.3.4"), hashIp("1.2.3.4"));
  assert.notEqual(hashIp("1.2.3.4"), hashIp("1.2.3.5"));
  assert.doesNotMatch(hashIp("1.2.3.4"), /1\.2\.3\.4/);
});
