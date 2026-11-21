// TEMPORAL: datos de muestra para mirar Números del mes en local. BORRAR.
import { DEFAULT_CONFIG, slotTimesFor } from "../../../../lib/clubConfig";
import { isoWeekday, todayInClub } from "../../../../lib/booking";
import {
  buildDailySummaries,
  dayOccupancy,
  periodOccupancy,
  sumSummaries,
} from "../../../../lib/metrics";
import {
  datesBetween,
  occupancyHeatmap,
  paymentMix,
  previousPeriod,
  topClients,
  topProducts,
} from "../../../../lib/reports";

const NAMES = ["Juan Pérez", "Mati Gómez", "Lucas Rossi", "Fede Díaz", "Nico Paz", "Sofi Ruiz", "Caro Sosa", "Tomi Vera", "Agus Luna", "Pato Ríos"];
const PRODUCTS = [["Gatorade", 3500], ["Agua", 1800], ["Cerveza", 4500], ["Tubo de pelotas", 12000], ["Sánguche", 6500], ["Café", 2200]];

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function fake(dates, seed, scale = 1) {
  const r = rng(seed);
  const bookings = [];
  const sales = [];
  const today = todayInClub();
  dates.forEach((date) => {
    if (date > today) return;
    const wd = isoWeekday(date);
    slotTimesFor(DEFAULT_CONFIG, date).forEach(({ start }) => {
      const h = Number(start.slice(0, 2)) || 24;
      const base = h >= 19 || h < 2 ? 0.75 : h >= 17 ? 0.5 : 0.2;
      const p = Math.min(0.97, base * (wd === 5 || wd === 6 ? 1.2 : 1) * scale);
      DEFAULT_CONFIG.courts.forEach((c) => {
        if (r() > p) return;
        const paid = r() > 0.08;
        const method = ["efectivo", "transferencia", "mercadopago"][Math.floor(r() * 3)];
        bookings.push({
          date,
          startTime: start,
          courtId: c.id,
          status: paid ? "pagado" : "pendiente",
          total: 60000,
          playerName: NAMES[Math.floor(r() * NAMES.length)],
          playerPhone: "",
          payments: paid ? { a: { method, amount: 60000 } } : {},
        });
      });
    });
    const nSales = Math.floor(r() * 10 * scale) + 2;
    for (let i = 0; i < nSales; i += 1) {
      const [name, price] = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
      const qty = 1 + Math.floor(r() * 3);
      sales.push({ date, items: [{ name, price, qty }], total: price * qty, method: ["efectivo", "transferencia", "mercadopago"][Math.floor(r() * 3)] });
    }
  });
  return { bookings, sales };
}

export function demoReport(from, to) {
  const config = DEFAULT_CONFIG;
  const prev = previousPeriod(from, to);
  const dates = datesBetween(from, to);
  const prevDates = datesBetween(prev.from, prev.to);
  const cur = fake(dates, 7, 1);
  const old = fake(prevDates, 11, 0.85);
  const today = todayInClub();
  const withSlots = (list) =>
    list.map((d) => {
      const day = { ...d, totalSlots: slotTimesFor(config, d.date).length * config.courts.length };
      return { ...day, ocupacionPct: dayOccupancy(day) };
    });
  const days = withSlots(buildDailySummaries(dates, cur.bookings, cur.sales));
  const prevDays = withSlots(buildDailySummaries(prevDates, old.bookings, old.sales));
  return {
    ok: true,
    from,
    to,
    previous: prev,
    days,
    totals: { ...sumSummaries(days), ocupacionPct: periodOccupancy(days, today) },
    previousTotals: { ...sumSummaries(prevDays), ocupacionPct: periodOccupancy(prevDays, today) },
    heatmap: occupancyHeatmap(config, dates.filter((d) => d <= today), cur.bookings),
    paymentMix: paymentMix(cur.bookings, cur.sales),
    topProducts: topProducts(cur.sales),
    topClients: topClients(cur.bookings),
  };
}
