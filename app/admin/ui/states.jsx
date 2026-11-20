// Estados de carga y vacío compartidos por todas las vistas del admin.

/** Bloque gris animado del mismo tamaño que el contenido: sin layout shift. */
export function Skeleton({ width = "100%", height = 16, radius, style }) {
  return (
    <span
      className="admin-skeleton"
      aria-hidden
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/** Fila de cards de KPI en carga. */
export function SkeletonCards({ count = 4, height = 104 }) {
  return (
    <div className="admin-kpis-grid" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} radius={12} />
      ))}
    </div>
  );
}

/** Lista de filas en carga (tablas, listas de ventas). */
export function SkeletonRows({ count = 5, height = 44 }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
      aria-busy="true"
      aria-label="Cargando"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  );
}

/**
 * Estado vacío con ícono, texto útil y una acción opcional.
 * `mascot`: nombre de la pose de Muzzaguito (public/img/mascotas/muzzaguito-<pose>.webp).
 * @param {{ icon: import("react").ComponentType<any>, mascot?: string, title: string, text?: string, action?: { label: string, onClick: () => void } }} props
 */
export function EmptyState({ icon: Icon, mascot, title, text, action }) {
  return (
    <div className={`admin-empty${mascot ? " has-mascot" : ""}`}>
      {mascot ? (
        // Muzzaguito en vez del ícono suelto: el panel también es del club.
        <img
          className="admin-empty-mascot"
          src={`/img/mascotas/muzzaguito-${mascot}.webp`}
          alt=""
          width={112}
          height={112}
          loading="lazy"
          decoding="async"
        />
      ) : Icon && (
        <span className="admin-empty-icon">
          <Icon size={20} strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
