import test from "node:test";
import assert from "node:assert/strict";
import {
  checkTournamentSignup,
  openTournamentsForWeb,
  toPublicTournament,
  tournamentDateText,
  validateTournamentSignup,
} from "../lib/tournament.js";

const TODAY = "2026-11-04";
const torneo = (extra = {}) => ({
  name: "Noviembre 6ta",
  date: "2026-11-07",
  dateEnd: "2026-11-08",
  price: 90000,
  status: "abierto",
  categories: { c6: { name: "6ta", order: 0 }, c7: { name: "7ma", order: 1 } },
  players: {
    p1: { name: "Ana Pérez", partner: "Eva Gómez", phone: "299 555-1234", categoryId: "c6", paid: true },
  },
  ...extra,
});

test("toPublicTournament no expone jugadores ni teléfonos", () => {
  const t = toPublicTournament("t1", torneo());
  assert.deepEqual(t.categories, [
    { id: "c6", name: "6ta", pairs: 1 },
    { id: "c7", name: "7ma", pairs: 0 },
  ]);
  assert.equal(t.price, 90000);
  assert.ok(!JSON.stringify(t).includes("555"));
  assert.ok(!JSON.stringify(t).includes("Ana"));
});

test("openTournamentsForWeb: solo abiertos y no pasados, el más próximo primero", () => {
  const list = openTournamentsForWeb(
    {
      a: torneo({ date: "2026-12-05", dateEnd: "" }),
      b: torneo(),
      jugando: torneo({ status: "cerrado" }),
      fin: torneo({ status: "finalizado" }),
      viejo: torneo({ date: "2026-10-01", dateEnd: "2026-10-02" }),
      sinFecha: torneo({ date: "", dateEnd: "" }),
      // Torneo de varios días que ya empezó: sigue visible hasta que termina.
      enCurso: torneo({ date: "2026-11-03", dateEnd: "2026-11-05" }),
      "id/raro": torneo(),
    },
    TODAY,
  );
  assert.deepEqual(list.map((t) => t.id), ["enCurso", "b", "a", "sinFecha"]);
  assert.deepEqual(openTournamentsForWeb(null, TODAY), []);
});

test("torneo viejo de una sola categoría en texto", () => {
  const [t] = openTournamentsForWeb(
    { x: { name: "Viejo", date: "2026-11-20", category: "Libre", status: "abierto", players: { p: { name: "A" } } } },
    TODAY,
  );
  assert.deepEqual(t.categories, [{ id: "general", name: "Libre", pairs: 1 }]);
});

test("validateTournamentSignup pide los dos nombres y un WhatsApp", () => {
  const base = { tournamentId: "t1", categoryId: "c6", name: " Juan  Pérez ", partner: "Pedro Gómez", phone: "299 597 4176" };
  const ok = validateTournamentSignup(base);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.name, "Juan Pérez");
  assert.equal(validateTournamentSignup({ ...base, partner: "" }).ok, false);
  assert.equal(validateTournamentSignup({ ...base, phone: "123" }).ok, false);
  assert.equal(validateTournamentSignup({ ...base, phone: "llamame" }).ok, false);
  assert.equal(validateTournamentSignup({ ...base, categoryId: "../x" }).ok, false);
  assert.equal(validateTournamentSignup({ ...base, tournamentId: undefined }).ok, false);
});

test("checkTournamentSignup frena cerrados, categorías inválidas y repetidos", () => {
  const ok = { categoryId: "c7", phone: "2995551234" };
  assert.equal(checkTournamentSignup(torneo(), ok).ok, true);
  assert.equal(checkTournamentSignup(null, ok).ok, false);
  assert.equal(checkTournamentSignup(torneo({ status: "cerrado" }), ok).ok, false);
  assert.equal(checkTournamentSignup(torneo(), { ...ok, categoryId: "zz" }).ok, false);
  // Mismo WhatsApp (con +54 9 adelante) en la misma categoría.
  assert.equal(
    checkTournamentSignup(torneo(), { categoryId: "c6", phone: "+54 9 299 555 1234" }).ok,
    false,
  );
});

test("tournamentDateText", () => {
  assert.equal(tournamentDateText("2026-11-07", ""), "Sábado 7 de noviembre");
  assert.equal(tournamentDateText("2026-11-07", "2026-11-08"), "Sábado 7 y domingo 8 de noviembre");
  assert.equal(tournamentDateText("2026-11-06", "2026-11-08"), "Del viernes 6 al domingo 8 de noviembre");
  assert.equal(
    tournamentDateText("2026-10-30", "2026-11-01"),
    "Del viernes 30 de octubre al domingo 1 de noviembre",
  );
  assert.equal(tournamentDateText("", ""), "Fecha a confirmar");
});
