"use client";

import { useEffect, useMemo, useState } from "react";
import { History, RefreshCw, Search } from "lucide-react";
import { adminGetAuditLog } from "../actions";
import { EmptyState, SkeletonRows } from "../ui/states";
import { formatDate, formatTime, normalizeSearch } from "../../../lib/format";

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
  { id: "all", label: "Todo" },
  { id: "turnos", label: "Turnos" },
  { id: "caja", label: "Caja" },
  { id: "cantina", label: "Cantina" },
  { id: "clientes", label: "Clientes" },
  { id: "torneos", label: "Torneos" },
  { id: "ajustes", label: "Ajustes y equipo" },
  { id: "sitio", label: "Sitio web" },
];

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
    <div className="admin-activity">
      <p className="admin-field-hint" style={{ marginTop: 0 }}>
        Cada vez que alguien del equipo borra, cancela, cierra la caja o cambia
        algo importante, queda anotado acá con su nombre (lo identifica su PIN).
      </p>

      <div className="admin-view-toolbar">
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
        className="admin-chips"
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
            {a.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="admin-activity-error" role="alert">
          {error}
        </div>
      )}

      {!logs ? (
        <SkeletonRows count={6} height={56} />
      ) : filtered.length === 0 ? (
        <div className="admin-settings-card">
          <EmptyState
            icon={History}
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
        <div className="admin-activity-days">
          {byDay.map(({ day, items }) => (
            <section
              key={day || "sin-fecha"}
              className="admin-settings-card admin-activity-day"
            >
              <h2 className="admin-activity-day-title">
                {day ? formatDate(day, "long") : "Sin fecha"}
              </h2>
              <ul className="admin-activity-list">
                {items.map((l) => {
                  const info = describe(l.action);
                  return (
                    <li
                      key={l.id}
                      className={`admin-activity-item ${TONE_CLASS[info.tone] || ""}`}
                    >
                      <span className="admin-activity-time">
                        {l.timestamp ? formatTime(l.timestamp) : "—"}
                      </span>
                      <div className="admin-activity-body">
                        <div>
                          <strong>{l.staffName || "Alguien"}</strong>
                          {l.staffRole && (
                            <span className="admin-activity-role">
                              {" "}
                              · {l.staffRole}
                            </span>
                          )}
                          <span className="admin-activity-what">
                            {" "}
                            {info.label.toLowerCase()}
                          </span>
                        </div>
                        {l.target && (
                          <div className="admin-activity-target">
                            {l.target}
                          </div>
                        )}
                        {l.details && (
                          <div className="admin-cell-sub">{l.details}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {logs.length >= limit && limit < 500 && (
            <button
              type="button"
              className="btn btn-secondary"
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
