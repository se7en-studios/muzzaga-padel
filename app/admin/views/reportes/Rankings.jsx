"use client";

import { formatARS, formatPct } from "../../../../lib/format";
import { PAYMENT_METHODS } from "../../adminHelpers";

const methodLabel = (m) => PAYMENT_METHODS.find((x) => x.value === m)?.label || m;

function Card({ title, children }) {
  return (
    <section className="rp-panel">
      <h3 className="rp-panel-title">{title}</h3>
      {children}
    </section>
  );
}

/** Cómo te pagaron: barra repartida y la lista con monto y %. */
export function PaymentMix({ mix }) {
  const total = mix.reduce((s, m) => s + m.amount, 0);
  return (
    <Card title="Cómo te pagaron">
      {total === 0 ? (
        <p className="rp-panel-empty">Sin cobros en el período.</p>
      ) : (
        <>
          <div className="rp-mix-bar" role="img" aria-label="Distribución de cobros por método">
            {mix.map((m) => (
              <span key={m.method} data-method={m.method} style={{ width: `${m.pct}%` }} />
            ))}
          </div>
          <ul className="rp-mix-list">
            {mix.map((m) => (
              <li key={m.method} data-method={m.method}>
                <span className="rp-mix-name">{methodLabel(m.method)}</span>
                <strong>{formatARS(m.amount)}</strong>
                <span className="rp-mix-pct">{formatPct(m.pct)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/**
 * Ranking con el puesto (el primero con la pelotita), el nombre, una barra
 * relativa al primero y el número que importa a la derecha.
 */
function RankList({ rows, empty, tone }) {
  if (rows.length === 0) return <p className="rp-panel-empty">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.measure)) || 1;
  return (
    <ol className={`rp-rank ${tone}`}>
      {rows.map((r, i) => (
        <li key={r.key}>
          <span className="rp-rank-pos" aria-hidden>
            {i + 1}
          </span>
          <span className="rp-rank-name">
            <strong>{r.name}</strong>
            <span className="rp-rank-bar" aria-hidden>
              <span style={{ width: `${(r.measure / max) * 100}%` }} />
            </span>
          </span>
          <span className="rp-rank-value">
            <strong>{r.value}</strong>
            <small>{r.sub}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function TopProducts({ rows }) {
  return (
    <Card title="Lo más vendido en la cantina">
      <RankList
        tone="is-money"
        empty="Sin ventas en el período."
        rows={rows.map((r) => ({
          key: r.name,
          name: r.name,
          measure: r.revenue,
          value: formatARS(r.revenue),
          sub: `${r.qty} un.`,
        }))}
      />
    </Card>
  );
}

export function TopClients({ rows }) {
  return (
    <Card title="Los que más juegan">
      <RankList
        tone="is-court"
        empty="Sin turnos en el período."
        rows={rows.map((r) => ({
          key: r.key,
          name: r.name,
          measure: r.turnos,
          value: `${r.turnos} ${r.turnos === 1 ? "turno" : "turnos"}`,
          sub: formatARS(r.facturado),
        }))}
      />
    </Card>
  );
}
