// Card de KPI única para todas las vistas: reemplaza el markup
// admin-kravio-kpi-* que estaba copiado en cada vista con colores inline.

/**
 * @param {{
 *   title: string,
 *   value: import("react").ReactNode,
 *   sub?: import("react").ReactNode,
 *   icon?: import("react").ComponentType<any>,
 *   tone?: "default" | "success" | "brand" | "danger" | "warning" | "info" | "dark",
 *   delta?: { value: number | null, label?: string, invert?: boolean } | null,
 *   onClick?: () => void,
 *   children?: import("react").ReactNode,
 * }} props `delta.invert` cuando subir es malo (ej. egresos, deuda).
 */
export default function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  tone = "default",
  delta,
  onClick,
  children,
}) {
  const Tag = onClick ? "button" : "div";
  const hasDelta = delta && delta.value != null && delta.value !== 0;
  const isGood = hasDelta && delta.value > 0 !== Boolean(delta.invert);
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`admin-kravio-kpi-card admin-kpi-tone-${tone}${onClick ? " is-clickable" : ""}`}
    >
      <div className="admin-kravio-kpi-header">
        <span className="admin-kravio-kpi-title">{title}</span>
        {/* El ícono en una fichita del color de la tarjeta: se reconoce
            qué número es antes de leer el título. */}
        {Icon && (
          <span className="admin-kpi-icon-chip" aria-hidden>
            <Icon
              size={18}
              strokeWidth={1.75}
              className="admin-kpi-icon"
              aria-hidden
            />
          </span>
        )}
      </div>
      <div className="admin-kravio-kpi-content">
        <div className="admin-kravio-kpi-left">
          <div className="admin-kravio-kpi-number">{value}</div>
          {hasDelta && (
            <span
              className={`admin-kravio-kpi-delta ${isGood ? "is-positive" : "is-negative"}`}
            >
              {delta.value > 0 ? "▲" : "▼"} {Math.abs(delta.value)}%
              {delta.label && <span>{delta.label}</span>}
            </span>
          )}
          {sub && <span className="admin-kpi-sub-text">{sub}</span>}
        </div>
        {children}
      </div>
    </Tag>
  );
}

/** Grilla responsive de KPIs (se acomoda sola de 1 a 4 columnas). */
export function KpiGrid({ children, min = 210 }) {
  return (
    <div className="admin-kpi-grid" style={{ "--kpi-min": `${min}px` }}>
      {children}
    </div>
  );
}
