"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Globe,
  History,
  RefreshCw,
  Search,
  Settings,
  Trophy,
  UserRound,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { adminGetAuditLog } from "../actions";
import { EmptyState } from "../ui/states";
import { ActividadSkeleton } from "./Esqueletos";
import {
  formatDate,
  formatTime,
  normalizeSearch,
  plural,
} from "../../../lib/format";
import { isoAddDays, todayInClub } from "../../../lib/booking";

/** Qué significa cada código del registro, en palabras del club. */
const ACTIONS = {
  CANCELAR_TURNO: { label: "Canceló un turno", area: "turnos", tone: "danger" },
  ELIMINAR_TURNO: { label: "Borró un turno", area: "turnos", tone: "danger" },
  CANCELAR_SERIE_FIJA: {
    label: "Canceló un turno fijo",
    area: "turnos",
    tone: "danger",
  },
  MARCAR_PRUEBA: { label: "Marcó un turno como prueba", area: "turnos" },
  DESMARCAR_PRUEBA: { label: "Desmarcó un turno de prueba", area: "turnos" },
  ELIMINAR_COBRO: { label: "Borró un cobro", area: "caja", tone: "danger" },
  ELIMINAR_EGRESO_CAJA: {
    label: "Borró un gasto de caja",
    area: "caja",
    tone: "danger",
  },
  CIERRE_CAJA: { label: "Cerró la caja", area: "caja", tone: "ok" },
  REABRIR_CAJA: { label: "Reabrió la caja", area: "caja", tone: "warn" },
  ANULAR_VENTA_CANTINA: {
    label: "Anuló una venta de cantina",
    area: "cantina",
    tone: "danger",
  },
  ELIMINAR_PEDIDO_CANTINA: {
    label: "Borró un pedido de cantina",
    area: "cantina",
    tone: "danger",
  },
  CANTINA_CARTA: { label: "Cambió la carta", area: "cantina" },
  ELIMINAR_CLIENTE: {
    label: "Borró un cliente",
    area: "clientes",
    tone: "danger",
  },
  ELIMINAR_TORNEO: {
    label: "Borró un torneo",
    area: "torneos",
    tone: "danger",
  },
  TORNEO_SORTEO: { label: "Sorteó zonas de un torneo", area: "torneos" },
  CONFIG_GUARDAR: {
    label: "Cambió los ajustes del club",
    area: "ajustes",
    tone: "warn",
  },
  EQUIPO_ALTA: { label: "Sumó a alguien al equipo", area: "ajustes" },
  EQUIPO_EDITAR: { label: "Editó a alguien del equipo", area: "ajustes" },
  EQUIPO_BAJA: {
    label: "Dio de baja a alguien del equipo",
    area: "ajustes",
    tone: "warn",
  },
  EQUIPO_REACTIVAR: { label: "Reactivó a alguien del equipo", area: "ajustes" },
  SITIO_FOTO: { label: "Cambió una foto del sitio", area: "sitio" },
  SITIO_FOTO_QUITAR: { label: "Quitó una foto del sitio", area: "sitio" },
  SITIO_TORNEO_NUEVO: { label: "Sumó un torneo a la galería", area: "sitio" },
  SITIO_TORNEO_BORRAR: {
    label: "Borró un torneo de la galería",
    area: "sitio",
    tone: "danger",
  },
  SITIO_UBICACION: { label: "Cambió la ubicación del sitio", area: "sitio" },
};

const AREAS = [
  { id: "all", label: "Todo", icon: History },
  { id: "turnos", label: "Turnos", icon: CalendarDays },
  { id: "caja", label: "Caja", icon: Wallet },
  { id: "cantina", label: "Cantina", icon: UtensilsCrossed },
  { id: "clientes", label: "Clientes", icon: UserRound },
  { id: "torneos", label: "Torneos", icon: Trophy },
  { id: "ajustes", label: "Ajustes y equipo", icon: Settings },
  { id: "sitio", label: "Sitio web", icon: Globe },
];
const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));

// Qué quiere decir cada color de la línea de tiempo (se muestra arriba).
const TONES = [
  { id: "danger", label: "Borró o canceló" },
  { id: "warn", label: "Cambio delicado" },
  { id: "ok", label: "Cierre de caja" },
];

/** Iniciales para el "dorsal" de cada persona. */
const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

/** Un color fijo por persona (de una paleta legible sobre blanco). */
const PERSON_HUES = [222, 18, 152, 268, 340, 196, 38];
const hueFor = (name) => {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSON_HUES[h % PERSON_HUES.length];
};

const describe = (code) =>
  ACTIONS[code] || {
    label: String(code || "Acción")
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase()),
    area: "otros",
  };

/** "YYYY-MM-DD" del registro en hora de Catriel. */
function isoDayOf(ts) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

const TONE_CLASS = { danger: "is-danger", warn: "is-warn", ok: "is-ok" };

export default function ActividadView({ onExpiredSession }) {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [area, setArea] = useState("all");
  const [person, setPerson] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(150);

  async function load(nextLimit = limit) {
    setLoading(true);
    setError("");
    const res = await adminGetAuditLog(nextLimit);
    setLoading(false);
    if (res?.ok) setLogs(res.logs || []);
    else if (!onExpiredSession?.(res)) {
      setError(res?.error || "No se pudo cargar el registro.");
      setLogs((prev) => prev || []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const people = useMemo(() => {
    const names = new Set((logs || []).map((l) => l.staffName).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    return (logs || []).filter((l) => {
      const info = describe(l.action);
      if (area !== "all" && info.area !== area) return false;
      if (person !== "all" && l.staffName !== person) return false;
      if (
        q &&
        !normalizeSearch(
          `${info.label} ${l.target || ""} ${l.details || ""} ${l.staffName || ""}`,
        ).includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [logs, area, person, search]);

  // Conteo por sección para los filtros (sobre lo que deja la persona y la búsqueda).
  const areaCounts = useMemo(() => {
    const q = normalizeSearch(search);
    const counts = { all: 0 };
    for (const l of logs || []) {
      const info = describe(l.action);
      if (person !== "all" && l.staffName !== person) continue;
      if (
        q &&
        !normalizeSearch(
          `${info.label} ${l.target || ""} ${l.details || ""} ${l.staffName || ""}`,
        ).includes(q)
      ) {
        continue;
      }
      counts.all += 1;
      counts[info.area] = (counts[info.area] || 0) + 1;
    }
    return counts;
  }, [logs, person, search]);

  const stats = useMemo(() => {
    const names = new Set(filtered.map((l) => l.staffName).filter(Boolean));
    return {
      total: filtered.length,
      delicate: filtered.filter((l) => describe(l.action).tone === "danger").length,
      people: names.size,
      last: filtered[0],
    };
  }, [filtered]);

  const today = todayInClub();
  const yesterday = isoAddDays(today, -1);

  const byDay = useMemo(() => {
    const days = [];
    for (const l of filtered) {
      const day = l.timestamp ? isoDayOf(l.timestamp) : "";
      const last = days[days.length - 1];
      if (last && last.day === day) last.items.push(l);
      else days.push({ day, items: [l] });
    }
    return days;
  }, [filtered]);

  return (
    <div className="admin-activity admin-act">
      <p className="admin-field-hint admin-act-intro">
        Cada vez que alguien del equipo borra, cancela, cierra la caja o cambia
        algo importante, queda anotado acá con su nombre (lo identifica su PIN).
      </p>

      {/* Marcador: el resumen de lo que se está viendo, como el tablero de la cancha. */}
      {logs && logs.length > 0 && (
        <dl className="admin-act-score" aria-label="Resumen de lo que se ve">
          <div>
            <dt>Movimientos</dt>
            <dd>{stats.total}</dd>
          </div>
          <div className={stats.delicate ? "is-danger" : ""}>
            <dt>Borró o canceló</dt>
            <dd>{stats.delicate}</dd>
          </div>
          <div>
            <dt>Personas</dt>
            <dd>{stats.people}</dd>
          </div>
          <div className="admin-act-score-last">
            <dt>Último</dt>
            <dd>
              {stats.last ? (
                <>
                  <strong>
                    {stats.last.timestamp ? formatTime(stats.last.timestamp) : "—"}
                  </strong>
                  <span>
                    {stats.last.staffName || "Alguien"} ·{" "}
                    {describe(stats.last.action).label.toLowerCase()}
                  </span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      )}

      <div className="admin-view-toolbar admin-act-toolbar">
        <div
          className="admin-kravio-search-field"
          style={{ minWidth: "min(260px, 100%)" }}
        >
          <Search size={14} aria-hidden />
          <input
            type="search"
            aria-label="Buscar en el registro"
            placeholder="Buscar cliente, turno, motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-view-toolbar-actions">
          <select
            className="admin-mini-select"
            aria-label="Filtrar por persona"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          >
            <option value="all">Todo el equipo</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw size={15} aria-hidden />{" "}
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      <div
        className="admin-chips admin-act-chips"
        role="group"
        aria-label="Filtrar por sección"
      >
        {AREAS.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={area === a.id}
            onClick={() => setArea(a.id)}
          >
            <a.icon size={15} strokeWidth={1.9} aria-hidden />
            {a.label}
            {logs && (
              <span className="admin-act-chip-count">{areaCounts[a.id] || 0}</span>
            )}
          </button>
        ))}
      </div>

      <ul className="admin-act-legend" aria-label="Qué significa cada color">
        {TONES.map((t) => (
          <li key={t.id} className={`is-${t.id}`}>
            <i aria-hidden /> {t.label}
          </li>
        ))}
        <li>
          <i aria-hidden /> Otros cambios
        </li>
      </ul>

      {error && (
        <div className="admin-activity-error" role="alert">
          {error}
        </div>
      )}

      {!logs ? (
        <ActividadSkeleton />
      ) : filtered.length === 0 ? (
        <div className="admin-settings-card admin-act-empty">
          <EmptyState
            icon={History}
            mascot="descanso-mate"
            title={
              logs.length ? "Nada con ese filtro" : "Todavía no hay movimientos"
            }
            text={
              logs.length
                ? "Probá con otra persona o sección."
                : "Cuando alguien del equipo cancele un turno, borre un cobro o cierre la caja con su PIN, lo vas a ver acá."
            }
          />
        </div>
      ) : (
        <div className="admin-activity-days admin-act-days">
          {byDay.map(({ day, items }) => (
            <section
              key={day || "sin-fecha"}
              className="admin-act-day"
              aria-label={day ? formatDate(day, "long") : "Sin fecha"}
            >
              {/* Cada día es un "set": encabezado pegado arriba mientras se lee. */}
              <h2 className="admin-activity-day-title admin-act-day-title">
                {day === today && <span className="admin-act-day-badge">Hoy</span>}
                {day === yesterday && (
                  <span className="admin-act-day-badge is-soft">Ayer</span>
                )}
                <span>{day ? formatDate(day, "long") : "Sin fecha"}</span>
                <small>{plural(items.length, "movimiento", "movimientos")}</small>
              </h2>
              <ol className="admin-activity-list admin-act-list">
                {items.map((l) => {
                  const info = describe(l.action);
                  const areaInfo = AREA_BY_ID[info.area];
                  const AreaIcon = areaInfo?.icon || History;
                  return (
                    <li
                      key={l.id}
                      className={`admin-activity-item admin-act-item ${TONE_CLASS[info.tone] || ""}`}
                    >
                      <time className="admin-activity-time admin-act-time">
                        {l.timestamp ? formatTime(l.timestamp) : "—"}
                      </time>
                      <span className="admin-act-dot" aria-hidden>
                        <AreaIcon size={13} strokeWidth={2.2} />
                      </span>
                      <div className="admin-activity-body admin-act-card">
                        <span
                          className="admin-act-avatar"
                          style={{ "--person-hue": hueFor(l.staffName) }}
                          aria-hidden
                        >
                          {initials(l.staffName || "Alguien")}
                        </span>
                        <div className="admin-act-main">
                          <p className="admin-act-line">
                            <strong>{l.staffName || "Alguien"}</strong>
                            <span className="admin-activity-what">
                              {" "}
                              {info.label.toLowerCase()}
                            </span>
                          </p>
                          {l.target && (
                            <div className="admin-activity-target">
                              {l.target}
                            </div>
                          )}
                          {l.details && (
                            <div className="admin-cell-sub admin-act-details">
                              {l.details}
                            </div>
                          )}
                          <div className="admin-act-meta">
                            {l.staffRole && (
                              <span className="admin-activity-role">
                                {l.staffRole}
                              </span>
                            )}
                            <span className="admin-act-area">
                              <AreaIcon size={13} strokeWidth={2} aria-hidden />
                              {areaInfo?.label || "Otros"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {logs.length >= limit && limit < 500 && (
            <button
              type="button"
              className="btn btn-secondary admin-act-more"
              onClick={() => {
                const next = Math.min(500, limit + 150);
                setLimit(next);
                load(next);
              }}
              disabled={loading}
            >
              Ver movimientos más viejos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
