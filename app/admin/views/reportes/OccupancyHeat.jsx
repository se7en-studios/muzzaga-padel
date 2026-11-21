"use client";

const WEEKDAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const LEVELS = [
  { level: 0, label: "Vacío" },
  { level: 1, label: "Poco" },
  { level: 2, label: "La mitad" },
  { level: 3, label: "Bastante" },
  { level: 4, label: "Lleno" },
];

function levelFor(pct) {
  if (pct === 0) return 0;
  if (pct < 25) return 1;
  if (pct < 50) return 2;
  if (pct < 75) return 3;
  return 4;
}

/**
 * Ocupación por día de la semana × horario: cuanto más lleno, más cancha.
 * La franja más llena lleva la pelotita.
 */
export default function OccupancyHeat({ heat }) {
  let top = null;
  heat.weekdays.forEach((wd) =>
    heat.starts.forEach((s) => {
      const c = heat.cells[`${wd}|${s}`];
      if (!c?.available || c.booked === 0) return;
      const pct = c.booked / c.available;
      if (!top || pct > top.pct) top = { key: `${wd}|${s}`, pct };
    }),
  );

  return (
    <div className="rp-heat">
      <div className="rp-heat-legend" aria-hidden>
        {LEVELS.map(({ level, label }) => (
          <span key={level}>
            <i data-heat={level} />
            {label}
          </span>
        ))}
        <span className="is-top">
          <i className="rp-heat-ball" />
          El más lleno
        </span>
      </div>
      <div className="admin-heat-table-wrap rp-heat-scroll">
        <table className="admin-heat-table rp-heat-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Día</span>
              </th>
              {heat.starts.map((s) => (
                <th key={s} scope="col">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heat.weekdays.map((wd) => (
              <tr key={wd}>
                <th scope="row">
                  <span className="rp-wd-long">{WEEKDAY_NAMES[wd]}</span>
                  <span className="rp-wd-short" aria-hidden>
                    {WEEKDAY_SHORT[wd]}
                  </span>
                </th>
                {heat.starts.map((s) => {
                  const k = `${wd}|${s}`;
                  const c = heat.cells[k];
                  if (!c?.available)
                    return (
                      <td key={s} data-heat="closed" title={`${WEEKDAY_NAMES[wd]} ${s}: cerrado`}>
                        <span className="sr-only">Cerrado</span>
                      </td>
                    );
                  const pct = Math.round((c.booked / c.available) * 100);
                  return (
                    <td
                      key={s}
                      data-heat={levelFor(pct)}
                      className={top?.key === k ? "is-top" : undefined}
                      title={`${WEEKDAY_NAMES[wd]} ${s}: ${c.booked} de ${c.available} cupos (${pct}%)`}
                    >
                      {pct}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
