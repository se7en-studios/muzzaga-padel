import test from "node:test";
import assert from "node:assert/strict";
import { PADEL_LEVELS, getCategoryForRating } from "../data/levels.js";

test("PADEL_LEVELS covers the full 8va a 1era range without gaps", () => {
  assert.equal(PADEL_LEVELS.length, 8);
  assert.equal(PADEL_LEVELS[0].id, "8va");
  assert.equal(PADEL_LEVELS.at(-1).id, "1era");
  assert.equal(PADEL_LEVELS[0].minRating, 1.0);
  assert.equal(PADEL_LEVELS.at(-1).maxRating, 7.0);

  for (let i = 1; i < PADEL_LEVELS.length; i++) {
    const prevMax = PADEL_LEVELS[i - 1].maxRating;
    const curMin = PADEL_LEVELS[i].minRating;
    // Sin huecos ni superposición entre categorías consecutivas.
    assert.ok(
      curMin > prevMax && curMin - prevMax <= 0.2,
      `gap/overlap between ${PADEL_LEVELS[i - 1].id} and ${PADEL_LEVELS[i].id}`,
    );
  }
});

test("getCategoryForRating maps ratings to the right category across the whole scale", () => {
  assert.equal(getCategoryForRating(1.0).id, "8va");
  assert.equal(getCategoryForRating(1.7).id, "8va");
  assert.equal(getCategoryForRating(1.8).id, "7ma");
  assert.equal(getCategoryForRating(2.4).id, "7ma");
  assert.equal(getCategoryForRating(2.5).id, "6ta");
  assert.equal(getCategoryForRating(3.2).id, "6ta");
  assert.equal(getCategoryForRating(3.3).id, "5ta");
  assert.equal(getCategoryForRating(3.9).id, "5ta");
  assert.equal(getCategoryForRating(4.0).id, "4ta");
  assert.equal(getCategoryForRating(4.6).id, "4ta");
  assert.equal(getCategoryForRating(4.7).id, "3era");
  assert.equal(getCategoryForRating(5.4).id, "3era");
  assert.equal(getCategoryForRating(5.5).id, "2da");
  assert.equal(getCategoryForRating(6.1).id, "2da");
  assert.equal(getCategoryForRating(6.2).id, "1era");
  assert.equal(getCategoryForRating(7.0).id, "1era");
});

test("getCategoryForRating clamps out-of-range values to the extremes", () => {
  assert.equal(getCategoryForRating(0).id, "8va");
  assert.equal(getCategoryForRating(99).id, "1era");
});
