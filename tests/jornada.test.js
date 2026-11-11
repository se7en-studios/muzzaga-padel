import test from "node:test";
import assert from "node:assert/strict";
import { businessDayInClub, JORNADA_CUTOFF } from "../lib/booking.js";
import {
  hasSlotStarted,
  minutesIntoNight,
  normalizeConfig,
} from "../lib/clubConfig.js";

// Catriel es UTC-3 todo el año: 03:00 UTC = 00:00 en el club.
const at = (isoUtc) => new Date(isoUtc);

test("la jornada sigue siendo la de la noche anterior hasta las 06:00", () => {
  assert.equal(JORNADA_CUTOFF, "06:00");
  // Martes 10/11 a las 23:00 en Catriel
  assert.equal(businessDayInClub(at("2026-11-11T02:00:00Z")), "2026-11-10");
  // Miércoles 11/11 a las 00:30 y a las 02:30: todavía es la jornada del martes
  assert.equal(businessDayInClub(at("2026-11-11T03:30:00Z")), "2026-11-10");
  assert.equal(businessDayInClub(at("2026-11-11T05:30:00Z")), "2026-11-10");
  // 05:59 todavía; 06:00 ya es el miércoles
  assert.equal(businessDayInClub(at("2026-11-11T08:59:00Z")), "2026-11-10");
  assert.equal(businessDayInClub(at("2026-11-11T09:00:00Z")), "2026-11-11");
  // Cambio de mes
  assert.equal(businessDayInClub(at("2026-12-01T04:00:00Z")), "2026-11-30");
});

test("la madrugada cuenta como parte de la noche anterior", () => {
  assert.equal(
    minutesIntoNight("2026-11-10", { isoDate: "2026-11-10", hhmm: "23:00" }),
    23 * 60,
  );
  assert.equal(
    minutesIntoNight("2026-11-10", { isoDate: "2026-11-11", hhmm: "01:00" }),
    25 * 60,
  );
  assert.equal(
    minutesIntoNight("2026-11-10", { isoDate: "2026-11-11", hhmm: "07:00" }),
    null,
  );
  assert.equal(
    minutesIntoNight("2026-11-10", { isoDate: "2026-11-12", hhmm: "01:00" }),
    null,
  );
});

test("a la 01:00 el turno de las 00:30 ya empezó y el de las 01:30 todavía no", () => {
  const config = normalizeConfig({
    slotDurationMin: 60,
    schedule: Array.from({ length: 7 }, () => ({
      open: true,
      start: "14:00",
      end: "02:30",
    })),
  });
  const now = { isoDate: "2026-11-11", hhmm: "01:00" };
  assert.equal(hasSlotStarted(config, "2026-11-10", "23:30", now), true);
  assert.equal(hasSlotStarted(config, "2026-11-10", "00:30", now), true);
  assert.equal(hasSlotStarted(config, "2026-11-10", "01:30", now), false);
  // Días anteriores: ya pasaron todos
  assert.equal(hasSlotStarted(config, "2026-11-09", "01:30", now), true);
});
