// Estados de carga y vacío compartidos por todas las vistas del admin.
import {
  CalendarDays,
  CloudOff,
  Coffee,
  Inbox,
  ShoppingCart,
  Trophy,
  UtensilsCrossed,
  Users,
} from "lucide-react";

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

// Vacíos que todavía pasan `mascot` sin ícono: un ícono lineal sobrio según
// lo que quería decir cada pose.
const MASCOT_FALLBACK_ICON = {
  "descanso-mate": Coffee,
  "enredado-grip": CloudOff,
  "enredado-paleta": CloudOff,
  "pelota-padel-life": CalendarDays,
  "pizza-cerveza": ShoppingCart,
  "pizza-good-vibes": UtensilsCrossed,
  "mochila-pulgar": Users,
  "trofeo-paleta": Trophy,
};

/**
 * Estado vacío con ícono, texto útil y una acción opcional.
 * Muzzaguito queda solo para la bienvenida (`welcome`: el panel recién
 * estrenado, sin nada cargado todavía). En el resto de los vacíos va un
 * ícono lineal: verlo en cada lista vacía cansaba y restaba seriedad.
 * `mascot`: nombre de la pose (public/img/mascotas/muzzaguito-<pose>.webp).
 * @param {{ icon?: import("react").ComponentType<any>, mascot?: string, welcome?: boolean, title: string, text?: string, action?: { label: string, onClick: () => void } }} props
 */
export function EmptyState({ icon, mascot, welcome = false, title, text, action }) {
  const showMascot = Boolean(mascot && welcome);
  const Icon = icon || (mascot && MASCOT_FALLBACK_ICON[mascot]) || Inbox;
  return (
    <div className={`admin-empty${showMascot ? " has-mascot" : ""}`}>
      {showMascot ? (
        <img
          className="admin-empty-mascot"
          src={`/img/mascotas/muzzaguito-${mascot}.webp`}
          alt=""
          width={112}
          height={112}
          loading="lazy"
          decoding="async"
        />
      ) : (
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
