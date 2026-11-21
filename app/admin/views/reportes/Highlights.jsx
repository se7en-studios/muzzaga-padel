"use client";

import { CalendarDays, Flame, Moon, Trophy } from "lucide-react";
import { formatARS } from "../../../../lib/format";

const WD_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WD_PLURAL = [
  "Domingos",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábados",
];

const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const dayTotal = (d) => d.cobradoTurnos + d.cantina;

/**
 * Lo que salta a la vista del período, sacado de los mismos datos que ya
 * trae el reporte (días y mapa de ocupación): no se pide nada nuevo.
 */
export function deriveHighlights(days, heat, today) {
  const past = days.filter((d) => d.date <= today);

  const best = past.reduce(
    (b, d) => (dayTotal(d) > 0 && (!b || dayTotal(d) > dayTotal(b)) ? d : b),
    null,
  );

  // Promedio de lo cobrado por día de la semana (solo días con movimiento o
  // abiertos). Con un solo día de la semana no hay nada que comparar.
  const byWd = new Map();
  past
    .filter((d) => d.totalSlots > 0 || dayTotal(d) > 0)
    .forEach((d) => {
      const wd = weekday(d.date);
      const row = byWd.get(wd) || { sum: 0, n: 0 };
      row.sum += dayTotal(d);
      row.n += 1;
      byWd.set(wd, row);
    });
  let strongDay = null;
  if (byWd.size >= 2) {
    byWd.forEach(({ sum, n }, wd) => {
      const avg = sum / n;
      if (avg > 0 && (!strongDay || avg > strongDay.avg)) strongDay = { wd, avg };
    });
  }

  // Horarios: lo reservado sobre lo disponible, sumando todos los días.
  const hours = heat.starts
    .map((start) => {
      let booked = 0;
      let available = 0;
      heat.weekdays.forEach((wd) => {
        const c = heat.cells[`${wd}|${start}`];
        if (c?.available) {
          booked += c.booked;
          available += c.available;
        }
      });
      return { start, booked, pct: available ? Math.round((booked / available) * 100) : null };
    })
    .filter((h) => h.pct != null);
  const anyBooked = hours.some((h) => h.booked > 0);
  const busiest = anyBooked
    ? hours.reduce((b, h) => (!b || h.pct > b.pct ? h : b), null)
    : null;
  const quietest = anyBooked
    ? hours.reduce((b, h) => (!b || h.pct < b.pct ? h : b), null)
    : null;

  return {
    best,
    strongDay,
    busiest,
    quietest: quietest && busiest && quietest.pct < busiest.pct ? quietest : null,
  };
}

export default function Highlights({ days, heat, today }) {
  const { best, strongDay, busiest, quietest } = deriveHighlights(days, heat, today);
  const items = [];
  if (best) {
    const [, m, d] = best.date.split("-");
    items.push({
      key: "best",
      icon: Trophy,
      tone: "is-gold",
      title: "Mejor día",
      value: `${WD_SHORT[weekday(best.date)]} ${Number(d)}/${Number(m)}`,
      sub: `Entraron ${formatARS(dayTotal(best))}`,
    });
  }
  if (strongDay) {
    items.push({
      key: "wd",
      icon: CalendarDays,
      tone: "is-money",
      title: "Día más fuerte",
      value: WD_PLURAL[strongDay.wd],
      sub: `${formatARS(Math.round(strongDay.avg))} por día, en promedio`,
    });
  }
  if (busiest) {
    items.push({
      key: "busy",
      icon: Flame,
      tone: "is-hot",
      title: "Horario más pedido",
      value: `${busiest.start} h`,
      sub: `${busiest.pct}% de las canchas ocupadas`,
    });
  }
  if (quietest) {
    items.push({
      key: "quiet",
      icon: Moon,
      tone: "is-court",
      title: "Horario más flojo",
      value: `${quietest.start} h`,
      sub: `${quietest.pct}% ocupado: ideal para una promo`,
    });
  }
  if (items.length === 0) return null;

  return (
    <section className="rp-highlights" aria-label="Lo que se destaca">
      {items.map(({ key, icon: Icon, tone, title, value, sub }) => (
        <article key={key} className={`rp-highlight ${tone}`}>
          <span className="rp-highlight-icon" aria-hidden>
            <Icon size={18} strokeWidth={2} />
          </span>
          <div>
            <span className="rp-highlight-title">{title}</span>
            <strong className="rp-highlight-value">{value}</strong>
            <span className="rp-highlight-sub">{sub}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
