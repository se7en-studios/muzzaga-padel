import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBracket,
  buildFixture,
  computeFixture,
  describePlan,
  drawGroups,
  fixtureWhatsappText,
  isByeMatch,
  nextPow2,
  normalizeFixture,
  pairsOfCategory,
  parsePairsList,
  parseScore,
  planGroups,
  roundRobin,
  sanitizeFixture,
  scheduleItems,
  scheduleMatches,
  seedPositions,
  sourceLabel,
  tournamentCategories,
} from "../lib/tournament.js";

const seeded =
  (seed = 1) =>
  () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
const makePairs = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Jugador ${i + 1}`,
    partner: `Compa ${i + 1}`,
  }));

test("planGroups: zonas de 3 y 4, nunca de 2", () => {
  assert.deepEqual(planGroups(6, 3), [3, 3]);
  assert.deepEqual(planGroups(10, 3), [4, 3, 3]);
  assert.deepEqual(planGroups(8, 4), [4, 4]);
  assert.deepEqual(planGroups(10, 4), [4, 3, 3]);
  assert.deepEqual(planGroups(5, 4), [5]);
  assert.deepEqual(planGroups(4, 3), [4]);
  assert.deepEqual(planGroups(1, 3), []);
  for (let n = 3; n <= 40; n += 1) {
    const sizes = planGroups(n, 3);
    assert.equal(
      sizes.reduce((a, b) => a + b, 0),
      n,
    );
    assert.ok(
      sizes.every((s) => s >= 3),
      `n=${n} ${sizes}`,
    );
  }
});

test("drawGroups: todas las parejas una sola vez y cabezas de serie separadas", () => {
  const pairs = makePairs(12).map((p, i) => ({
    ...p,
    seed: i < 4 ? i + 1 : 0,
  }));
  const groups = drawGroups(pairs, { size: 3, random: seeded(7) });
  assert.equal(groups.length, 4);
  const all = groups.flatMap((g) => g.pairIds);
  assert.equal(new Set(all).size, 12);
  for (const g of groups) {
    assert.equal(
      g.pairIds.filter((id) => ["p1", "p2", "p3", "p4"].includes(id)).length,
      1,
    );
  }
  assert.deepEqual(
    groups.map((g) => g.id),
    ["A", "B", "C", "D"],
  );
});

test("roundRobin: todos contra todos sin repetir", () => {
  for (const n of [3, 4, 5]) {
    const ids = Array.from({ length: n }, (_, i) => `x${i}`);
    const rr = roundRobin(ids);
    assert.equal(rr.length, (n * (n - 1)) / 2);
    const keys = new Set(rr.map((m) => [m.a, m.b].sort().join("-")));
    assert.equal(keys.size, rr.length);
    // nadie juega dos veces en la misma fecha
    const byRound = {};
    for (const m of rr) {
      byRound[m.round] ||= new Set();
      assert.ok(!byRound[m.round].has(m.a) && !byRound[m.round].has(m.b));
      byRound[m.round].add(m.a).add(m.b);
    }
  }
});

test("seedPositions: 1 y 2 solo en la final", () => {
  assert.deepEqual(seedPositions(4), [1, 4, 2, 3]);
  assert.deepEqual(seedPositions(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

test("buildBracket: 3 zonas con 2 clasificados → cuartos con 2 byes y sin cruces de la misma zona", () => {
  const entrants = [];
  for (const pos of [1, 2])
    for (const g of ["A", "B", "C"]) entrants.push({ group: g, pos });
  const matches = buildBracket(entrants);
  const first = matches.filter((m) => m.size === 8);
  assert.equal(first.length, 4);
  assert.equal(first.filter(isByeMatch).length, 2);
  for (const m of first) {
    if (m.a.group && m.b.group) assert.notEqual(m.a.group, m.b.group);
  }
  assert.equal(matches.filter((m) => m.size === 4).length, 2);
  assert.equal(matches.filter((m) => m.size === 2).length, 1);
});

test("buildBracket: 1° y 2° de la misma zona solo se pueden cruzar en la final", () => {
  for (const zones of [
    ["A", "B"],
    ["A", "B", "C", "D"],
    ["A", "B", "C", "D", "E", "F", "G", "H"],
  ]) {
    const entrants = [];
    for (const pos of [1, 2])
      for (const g of zones) entrants.push({ group: g, pos });
    const first = buildBracket(entrants).filter(
      (m) => m.size === nextPow2(entrants.length),
    );
    const slots = first.flatMap((m) => [m.a, m.b]);
    const half = slots.length / 2;
    for (const g of zones) {
      const i = slots.findIndex((s) => s.group === g && s.pos === 1);
      const j = slots.findIndex((s) => s.group === g && s.pos === 2);
      assert.notEqual(i < half, j < half, `zona ${g} en la misma mitad`);
    }
    // los 1° no se mueven de su lugar de siembra
    assert.deepEqual(first[0].a, { group: "A", pos: 1 });
  }
});

test("parseScore", () => {
  assert.deepEqual(parseScore("6-4 3-6 10-8"), {
    sets: [
      [6, 4],
      [3, 6],
      [10, 8],
    ],
    winner: "a",
  });
  assert.equal(parseScore("4/6, 2/6").winner, "b");
  assert.equal(parseScore("").winner, null);
  assert.equal(parseScore("WO").winner, null);
});

test("fixture completo: posiciones, clasificados y avance del cuadro", () => {
  const pairs = makePairs(6);
  const groups = [
    { id: "A", pairIds: ["p1", "p2", "p3"] },
    { id: "B", pairIds: ["p4", "p5", "p6"] },
  ];
  const fx = buildFixture({ format: "zonas", groups, qualify: 2 });
  const groupMatches = Object.values(fx.matches).filter(
    (m) => m.stage === "group",
  );
  assert.equal(groupMatches.length, 6);
  const semis = Object.values(fx.matches).filter((m) => m.size === 4);
  assert.equal(semis.length, 2);
  assert.equal(sourceLabel(semis[0].a, fx.matches), "1° Zona A");

  // Zona A: p1 gana todo, p2 segundo. Zona B: p6 gana todo, p4 segundo.
  const win = (m, id) => {
    m.winner = m.a.pair === id ? "a" : "b";
    m.score = m.winner === "a" ? "6-2 6-2" : "2-6 2-6";
  };
  for (const m of groupMatches) {
    const ids = [m.a.pair, m.b.pair];
    const order = ["p1", "p2", "p3", "p6", "p4", "p5"];
    win(m, ids.sort((x, y) => order.indexOf(x) - order.indexOf(y))[0]);
  }
  let calc = computeFixture(fx);
  assert.deepEqual(
    calc.standings.A.map((r) => r.pairId),
    ["p1", "p2", "p3"],
  );
  assert.deepEqual(
    calc.standings.B.map((r) => r.pairId),
    ["p6", "p4", "p5"],
  );
  assert.equal(calc.standings.A[0].won, 2);
  assert.equal(calc.standings.A[0].gamesFor, 24);
  const [s1, s2] = semis;
  assert.deepEqual(calc.sides(s1), { a: "p1", b: "p4" });
  assert.deepEqual(calc.sides(s2), { a: "p6", b: "p2" });

  s1.winner = "a";
  s2.winner = "b";
  calc = computeFixture(fx);
  const final = Object.values(fx.matches).find((m) => m.size === 2);
  assert.deepEqual(calc.sides(final), { a: "p1", b: "p2" });

  const text = fixtureWhatsappText({
    tournamentName: "Torneo Primavera",
    categoryName: "6ta",
    fixture: fx,
    pairsById: Object.fromEntries(pairs.map((p) => [p.id, p])),
  });
  assert.match(text, /ZONA A/);
  assert.match(text, /Semifinal/);
});

test("buildFixture directo: cuadro con byes que avanzan solos", () => {
  const pairs = makePairs(5);
  const fx = buildFixture({ format: "directo", pairs, random: seeded(3) });
  const first = Object.values(fx.matches).filter((m) => m.size === 8);
  assert.equal(first.filter(isByeMatch).length, 3);
  const calc = computeFixture(fx);
  const bye = first.find(isByeMatch);
  assert.ok(calc.winnerOf(bye));
});

test("scheduleMatches: sin parejas en dos canchas a la vez y cuadro después de la zona", () => {
  const groups = [
    { id: "A", pairIds: ["p1", "p2", "p3"] },
    { id: "B", pairIds: ["p4", "p5", "p6"] },
  ];
  const fx = buildFixture({ format: "zonas", groups, qualify: 2 });
  const fx2 = buildFixture({
    format: "zonas",
    groups: [{ id: "A", pairIds: ["q1", "q2", "q3", "q4"] }],
    qualify: 2,
  });
  const items = scheduleItems([
    { categoryId: "c6", fixture: fx },
    { categoryId: "c7", fixture: fx2 },
  ]);
  const { assigned, unscheduled } = scheduleMatches(items, {
    days: [
      { date: "2026-11-07", from: "10:00", to: "22:00" },
      { date: "2026-11-08", from: "10:00", to: "20:00" },
    ],
    duration: 60,
    courts: ["cancha-1", "cancha-2"],
  });
  assert.deepEqual(unscheduled, []);
  assert.equal(Object.keys(assigned).length, items.length);

  const at = (k) => `${assigned[k].date} ${assigned[k].time}`;
  // ningún turno con la misma cancha dos veces ni la misma pareja dos veces
  const bySlot = {};
  for (const it of items) {
    const s = at(it.key);
    bySlot[s] ||= { courts: new Set(), pairs: new Set() };
    assert.ok(!bySlot[s].courts.has(assigned[it.key].court));
    bySlot[s].courts.add(assigned[it.key].court);
    for (const p of it.pairs) {
      assert.ok(!bySlot[s].pairs.has(p), `pareja ${p} doble a las ${s}`);
      bySlot[s].pairs.add(p);
    }
  }
  // dependencias
  for (const it of items)
    for (const d of it.deps)
      assert.ok(at(d) < at(it.key), `${d} antes que ${it.key}`);
});

test("scheduleMatches: respeta turnos ocupados", () => {
  const items = [{ key: "x", pairs: ["a", "b"], deps: [] }];
  const { assigned } = scheduleMatches(items, {
    days: [{ date: "2026-11-07", from: "18:00", to: "20:00" }],
    duration: 60,
    courts: ["c1"],
    occupied: [{ date: "2026-11-07", time: "18:00", court: "c1" }],
  });
  assert.deepEqual(assigned.x, {
    date: "2026-11-07",
    time: "19:00",
    court: "c1",
  });
});

test("sanitizeFixture: acepta lo armado y rechaza parejas ajenas", () => {
  const groups = [
    { id: "A", pairIds: ["p1", "p2", "p3"] },
    { id: "B", pairIds: ["p4", "p5", "p6"] },
  ];
  const fx = buildFixture({ format: "zonas", groups, qualify: 2 });
  const payload = { ...fx, matches: Object.values(fx.matches) };
  const clean = sanitizeFixture(payload, ["p1", "p2", "p3", "p4", "p5", "p6"]);
  assert.ok(clean);
  assert.equal(
    Object.keys(clean.matches).length,
    Object.keys(fx.matches).length,
  );
  assert.equal(sanitizeFixture(payload, ["p1", "p2", "p3"]), null);
  assert.equal(
    sanitizeFixture({ format: "zonas", groups: [], matches: [] }, []),
    null,
  );
  // ida y vuelta por "Firebase"
  const back = normalizeFixture(JSON.parse(JSON.stringify(clean)));
  assert.deepEqual(back.groups, clean.groups);
});

test("parsePairsList: formatos típicos de WhatsApp", () => {
  const list = parsePairsList(`1) Juan Pérez / Pedro Gómez 299 555-1234
- Ana López y María Díaz
Carlos Ruiz - Diego Sosa, 2995556677

Luis Toledo`);
  assert.equal(list.length, 4);
  assert.deepEqual(list[0], {
    name: "Juan Pérez",
    partner: "Pedro Gómez",
    phone: "299 555-1234",
  });
  assert.deepEqual(list[1], {
    name: "Ana López",
    partner: "María Díaz",
    phone: "",
  });
  assert.deepEqual(list[2], {
    name: "Carlos Ruiz",
    partner: "Diego Sosa",
    phone: "2995556677",
  });
  assert.deepEqual(list[3], { name: "Luis Toledo", partner: "", phone: "" });
});

test("categorías: torneos viejos tienen una sola", () => {
  const legacy = { category: "6ta Libre", players: [{ id: "a", name: "X" }] };
  assert.deepEqual(tournamentCategories(legacy), [
    { id: "general", name: "6ta Libre" },
  ]);
  assert.equal(pairsOfCategory(legacy, "general").length, 1);
  const multi = {
    categories: {
      c7: { name: "7ma", order: 1 },
      c6: { name: "6ta", order: 0 },
    },
    players: [{ id: "a", categoryId: "c7" }, { id: "b" }],
  };
  assert.deepEqual(
    tournamentCategories(multi).map((c) => c.id),
    ["c6", "c7"],
  );
  assert.deepEqual(
    pairsOfCategory(multi, "c6").map((p) => p.id),
    ["b"],
  );
});

test("describePlan", () => {
  assert.match(
    describePlan(10, { groupSize: 3, qualify: 2 }),
    /1 zona de 4 y 2 zonas de 3/,
  );
  assert.match(
    describePlan(10, { groupSize: 3, qualify: 2 }),
    /cuartos de final/,
  );
  assert.match(
    describePlan(6, { format: "directo" }),
    /2 parejas pasan directo/,
  );
});
