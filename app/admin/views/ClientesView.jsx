"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Crown,
  Download,
  MoonStar,
  Repeat,
  Search,
  Send,
  Sprout,
  Users,
  X,
  Trash2,
} from "lucide-react";
import {
  formatARS,
  formatDate,
  formatRelativeDays,
  normalizeSearch,
  plural,
} from "../../../lib/format";
import { formatPhoneAR, toWhatsappNumber } from "../../../lib/phone";
import { todayInClub } from "../../../lib/booking";
import {
  INACTIVE_AFTER_DAYS,
  categorizeClient,
  generateClientsCsv,
  isInactiveClient,
} from "../../../lib/clientsExport";
import { EmptyState } from "../ui/states";
import { ClientesSkeleton } from "./Esqueletos";
import { WhatsAppMiniIcon } from "../adminHelpers";
import ClientDrawer, { avatarTone, initials } from "./clientes/ClientDrawer";
import StaffPinModal from "../ui/StaffPinModal";
import { adminDeleteClient } from "../actions";
import { zzClients } from "../zz-demo-data"; // ZZDEMO

const SEARCH_DEBOUNCE_MS = 250;
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true };
const DEFAULT_INVITE =
  "¡Hola {nombre}! Hace rato no te vemos por Muzzaga Pádel 🎾 Tenemos turnos libres esta semana, ¿te guardamos uno?";

const SEGMENTS = [
  { id: "all", label: "Todos", test: () => true },
  { id: "vip", label: "VIP", test: (c) => c.count >= 4 },
  {
    id: "frecuente",
    label: "Frecuentes",
    test: (c) => c.count >= 2 && c.count < 4,
  },
  { id: "nuevo", label: "Nuevos", test: (c) => c.count === 1 },
  {
    id: "inactivo",
    label: `Inactivos (+${INACTIVE_AFTER_DAYS} días)`,
    test: (c, today) => isInactiveClient(c, today),
  },
];

// Cómo se presenta cada segmento en el marcador de arriba (solo visual).
const SEGMENT_META = {
  all: { label: "Todos", hint: "en la base del club", icon: Users },
  vip: { label: "VIP", hint: "4 o más turnos", icon: Crown },
  frecuente: { label: "Frecuentes", hint: "2 a 3 turnos", icon: Repeat },
  nuevo: { label: "Nuevos", hint: "primer turno", icon: Sprout },
  inactivo: {
    label: "Inactivos",
    hint: `+${INACTIVE_AFTER_DAYS} días sin venir`,
    icon: MoonStar,
  },
};

// Hasta dos semanas desde el último turno cuenta como "viene seguido".
const FRESH_DAYS = 14;

function daysSince(isoDate, todayIso) {
  if (!isoDate) return null;
  return Math.round(
    (Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${isoDate}T00:00:00Z`)) /
      86_400_000,
  );
}

const COLUMNS = [
  { id: "name", label: "Cliente", value: (c) => normalizeSearch(c.name) },
  { id: "count", label: "Turnos", value: (c) => c.count },
  { id: "totalSpent", label: "Total gastado", value: (c) => c.totalSpent || 0 },
  { id: "lastDate", label: "Último turno", value: (c) => c.lastDate || "" },
];

export default function ClientesView({
  clients = null,
  initialSearch = "",
  onToast,
  onReloadClients,
}) {
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [segment, setSegment] = useState("all");
  const [sort, setSort] = useState({ by: "count", dir: "desc" });
  const [openClient, setOpenClient] = useState(null);
  const [deletingClient, setDeletingClient] = useState(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteText, setInviteText] = useState(DEFAULT_INVITE);
  const [invited, setInvited] = useState(() => new Set());
  clients = zzClients(clients); // ZZDEMO
  const today = todayInClub();
  const list = clients || [];

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        SEGMENTS.map((s) => [
          s.id,
          list.filter((c) => s.test(c, today)).length,
        ]),
      ),
    [list, today],
  );

  const visible = useMemo(() => {
    const seg = SEGMENTS.find((s) => s.id === segment);
    const q = normalizeSearch(search);
    const col = COLUMNS.find((c) => c.id === sort.by);
    return list
      .filter((c) => seg.test(c, today))
      .filter(
        (c) => !q || normalizeSearch(`${c.name} ${c.phone || ""}`).includes(q),
      )
      .sort((a, b) => {
        const va = col.value(a);
        const vb = col.value(b);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sort.dir === "asc" ? cmp : -cmp;
      });
  }, [list, segment, search, sort, today]);

  const inactiveWithPhone = list.filter(
    (c) => isInactiveClient(c, today) && c.phone,
  );

  function toggleSort(by) {
    setSort((s) =>
      s.by === by
        ? { by, dir: s.dir === "asc" ? "desc" : "asc" }
        : { by, dir: by === "name" ? "asc" : "desc" },
    );
  }

  function exportCsv() {
    const blob = new Blob([generateClientsCsv(visible)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-muzzaga-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inviteLink = (c) =>
    `https://wa.me/${toWhatsappNumber(c.phone)}?text=${encodeURIComponent(
      inviteText.replaceAll("{nombre}", c.name.split(" ")[0]),
    )}`;

  if (!clients) {
    return <ClientesSkeleton />;
  }

  const maxCount = Math.max(1, ...list.map((c) => c.count || 0));
  // Solo para mostrar: cuánta plata quedó "en la calle" entre todos.
  const debtors = list.filter((c) => c.owed > 0);
  const debtTotal = debtors.reduce((sum, c) => sum + c.owed, 0);

  return (
    <div className="cc-clientes">
      {/* Marcador: cada segmento es una tarjeta con su número y sirve de
          filtro. Reemplaza a los 3 números + las pestañas, que repetían lo
          mismo dos veces. */}
      <div className="cc-board" role="group" aria-label="Segmento de clientes">
        {SEGMENTS.map((s) => {
          const meta = SEGMENT_META[s.id];
          const Icon = meta.icon;
          return (
            <button
              key={s.id}
              type="button"
              className="cc-board-tile"
              data-seg={s.id}
              aria-pressed={segment === s.id}
              onClick={() => setSegment(s.id)}
            >
              <span className="cc-board-top">
                <span className="cc-board-icon" aria-hidden>
                  <Icon size={16} strokeWidth={2} />
                </span>
                <span className="cc-board-label">{meta.label}</span>
              </span>
              <strong className="cc-board-num">{counts[s.id]}</strong>
              <span className="cc-board-hint">{meta.hint}</span>
              {/* Qué parte de la base es este segmento, de un vistazo. */}
              <span className="cc-board-share" aria-hidden>
                {counts[s.id] > 0 && (
                  <span
                    style={{
                      width: `${Math.round((counts[s.id] / list.length) * 100)}%`,
                    }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {segment === "inactivo" && inactiveWithPhone.length > 0 && (
        <div className="cc-invite">
          <span className="cc-invite-icon" aria-hidden>
            <MoonStar size={18} strokeWidth={2} />
          </span>
          <span className="cc-invite-text">
            <strong>
              {plural(
                inactiveWithPhone.length,
                "cliente no juega",
                "clientes no juegan",
              )}{" "}
              hace más de {INACTIVE_AFTER_DAYS} días.
            </strong>
            <small>Mandales un mensaje y recuperalos para la semana.</small>
          </span>
          <button
            type="button"
            className="cc-wa"
            onClick={() => setIsInviteOpen(true)}
          >
            <Send {...ICON} /> Invitar por WhatsApp
          </button>
        </div>
      )}

      <section className="cc-roster-card" aria-label="Listado de clientes">
        <div className="cc-roster-toolbar">
          <div className="cc-search">
            <Search size={17} strokeWidth={2} aria-hidden />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono…"
              aria-label="Buscar cliente"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className="cc-search-clear"
                onClick={() => setSearchInput("")}
                aria-label="Limpiar búsqueda"
              >
                <X size={15} aria-hidden />
              </button>
            )}
          </div>
          <span className="cc-roster-count" aria-live="polite">
            <strong>{visible.length}</strong> de {list.length}{" "}
            {list.length === 1 ? "jugador" : "jugadores"}
          </span>
          {debtTotal > 0 && (
            <span
              className="cc-debt-pill"
              title="Saldo de turnos sin cobrar, sumando a todos"
            >
              <span className="cc-debt-pill-dot" aria-hidden />
              {plural(debtors.length, "debe", "deben")}{" "}
              <strong>{formatARS(debtTotal)}</strong>
            </span>
          )}
          <button
            type="button"
            className="cc-csv"
            onClick={exportCsv}
            disabled={visible.length === 0}
            title="Exportar a CSV"
          >
            <Download size={15} aria-hidden />{" "}
            <span className="cc-csv-label">Exportar CSV</span>
          </button>
        </div>

        <div className="cc-roster-scroll">
          <table className="cc-roster">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.id}
                    data-col={col.id}
                    aria-sort={
                      sort.by === col.id
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="cc-sort"
                      aria-pressed={sort.by === col.id}
                      onClick={() => toggleSort(col.id)}
                    >
                      {col.label}
                      {sort.by === col.id &&
                        (sort.dir === "asc" ? (
                          <ArrowUp size={13} aria-hidden />
                        ) : (
                          <ArrowDown size={13} aria-hidden />
                        ))}
                    </button>
                  </th>
                ))}
                <th data-col="contact">
                  <span className="cc-th-label">Contacto</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.length > 0 ? (
                visible.map((c) => {
                  const cat = categorizeClient(c.count);
                  const tier = cat.category.toLowerCase();
                  const inactive = isInactiveClient(c, today);
                  const ago = daysSince(c.lastDate, today);
                  const fresh = inactive
                    ? "cold"
                    : ago != null && ago <= FRESH_DAYS
                      ? "fresh"
                      : "ok";
                  return (
                    <tr
                      key={c.key}
                      data-tier={tier}
                      data-inactive={inactive || undefined}
                      data-owes={c.owed > 0 || undefined}
                      onClick={() => setOpenClient(c)}
                    >
                      <td className="cc-col-player">
                        <button
                          type="button"
                          className="cc-player"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenClient(c);
                          }}
                        >
                          <span
                            className="cc-avatar"
                            data-tone={avatarTone(c.name)}
                            data-tier={tier}
                            data-inactive={inactive || undefined}
                            aria-hidden
                          >
                            {initials(c.name)}
                          </span>
                          <span className="cc-player-text">
                            <span className="cc-player-name">
                              <strong>{c.name}</strong>
                              <span className="cc-chip" data-tier={tier}>
                                {cat.category}
                              </span>
                              {/* Al lado del nombre para verlo sin abrir la
                                  ficha; mismo criterio que el aviso de la ficha. */}
                              {c.owed > 0 && (
                                <span
                                  className="cc-chip cc-owe"
                                  title={plural(c.owedCount, "turno con saldo", "turnos con saldo")}
                                >
                                  Debe {formatARS(c.owed)}
                                </span>
                              )}
                            </span>
                            <span className="cc-player-phone">
                              {c.phone ? formatPhoneAR(c.phone) : "Sin teléfono"}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="cc-col-count" data-label="Turnos">
                        <span className="cc-count">
                          <strong>{c.count}</strong>
                          <span>{c.count === 1 ? "turno" : "turnos"}</span>
                        </span>
                        <span className="cc-count-bar" aria-hidden>
                          <span
                            style={{
                              width: `${Math.max(6, (c.count / maxCount) * 100)}%`,
                            }}
                          />
                        </span>
                      </td>
                      <td className="cc-col-money" data-label="Gastado">
                        <span className="cc-money">
                          {formatARS(c.totalSpent || 0)}
                        </span>
                        {c.count > 1 && c.totalSpent > 0 && (
                          <small className="cc-sub">
                            {formatARS(Math.round(c.totalSpent / c.count))} por
                            turno
                          </small>
                        )}
                      </td>
                      <td className="cc-col-last" data-label="Último turno">
                        <span className="cc-last" data-fresh={fresh}>
                          <span className="cc-last-dot" aria-hidden />
                          {formatRelativeDays(c.lastDate, today)}
                        </span>
                        {inactive && (
                          <span className="cc-chip" data-tier="inactivo">
                            Inactivo
                          </span>
                        )}
                        {c.lastDate && (
                          <small className="cc-sub">
                            el {formatDate(c.lastDate)}
                          </small>
                        )}
                      </td>
                      <td
                        className="cc-col-contact"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="cc-contact">
                          {c.phone ? (
                            <a
                              href={`https://wa.me/${toWhatsappNumber(c.phone)}`}
                              target="_blank"
                              rel="noopener"
                              className="cc-wa cc-wa-sm"
                              aria-label={`WhatsApp a ${c.name}`}
                            >
                              <WhatsAppMiniIcon size={16} />
                              <span>WhatsApp</span>
                            </a>
                          ) : (
                            <span className="cc-no-phone">Sin teléfono</span>
                          )}
                          <button
                            type="button"
                            className="cc-trash"
                            onClick={() => setDeletingClient(c)}
                            aria-label={`Eliminar cliente ${c.name}`}
                            title={`Eliminar cliente ${c.name}`}
                          >
                            <Trash2 size={15} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="cc-roster-empty">
                  <td colSpan="5">
                    {search ? (
                      <EmptyState
                        icon={Users}
                        title={`Nadie coincide con “${search}”`}
                        text="Probá con otra parte del nombre o del teléfono."
                        action={{
                          label: "Limpiar búsqueda",
                          onClick: () => setSearchInput(""),
                        }}
                      />
                    ) : list.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        mascot="mochila-pulgar"
                        title="Todavía no hay clientes"
                        text="Se arman solos con cada reserva: nombre y teléfono del organizador."
                      />
                    ) : (
                      <EmptyState
                        icon={Users}
                        title="No hay clientes en este segmento"
                        action={{
                          label: "Ver todos",
                          onClick: () => setSegment("all"),
                        }}
                      />
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {openClient && (
        <ClientDrawer
          client={openClient}
          onClose={() => setOpenClient(null)}
          onToast={onToast}
          onDeleted={() => {
            setOpenClient(null);
            onReloadClients?.();
          }}
        />
      )}

      {deletingClient && (
        <StaffPinModal
          isOpen={Boolean(deletingClient)}
          title="Eliminar Cliente"
          description={`¿Confirmás que querés eliminar al cliente ${deletingClient.name}? Esta acción requiere autorización por PIN y removerá al cliente del CRM.`}
          targetName={`${deletingClient.name} (${deletingClient.phone || "Sin teléfono"})`}
          confirmButtonText="Eliminar Cliente"
          confirmButtonTone="danger"
          onClose={() => setDeletingClient(null)}
          onConfirm={async ({ pin, reason }) => {
            const res = await adminDeleteClient({
              key: deletingClient.key,
              pin,
              reason,
            });
            if (res.ok) {
              setDeletingClient(null);
              onToast?.(`Cliente eliminado por ${res.staff}`);
              onReloadClients?.();
            } else {
              throw new Error(res.error || "No se pudo eliminar el cliente.");
            }
          }}
        />
      )}

      {isInviteOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setIsInviteOpen(false)}
        >
          <div
            className="admin-modal-card admin-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h3 id="invite-title">
                Invitar a{" "}
                {plural(
                  inactiveWithPhone.length,
                  "cliente inactivo",
                  "clientes inactivos",
                )}
              </h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setIsInviteOpen(false)}
                aria-label="Cerrar"
              >
                <X size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <div className="admin-field">
              <label className="admin-field-label" htmlFor="invite-text">
                Mensaje ({"{nombre}"} se reemplaza por el nombre)
              </label>
              <textarea
                id="invite-text"
                rows={3}
                value={inviteText}
                onChange={(e) => setInviteText(e.target.value)}
              />
            </div>
            <p className="admin-field-hint">
              WhatsApp no permite enviar en masa desde la web: tocá cada
              contacto y se abre el chat con el mensaje listo. Se marcan a
              medida que los abrís.
            </p>
            <ul className="admin-invite-list cc-invite-list">
              {inactiveWithPhone.map((c) => (
                <li
                  key={c.key}
                  className={invited.has(c.key) ? "is-done" : undefined}
                >
                  <span
                    className="cc-avatar"
                    data-tone={avatarTone(c.name)}
                    data-inactive
                    aria-hidden
                  >
                    {initials(c.name)}
                  </span>
                  <span className="cc-invite-who">
                    <strong>{c.name}</strong>
                    <span className="admin-cell-sub">
                      Último turno {formatRelativeDays(c.lastDate, today)}
                    </span>
                  </span>
                  <a
                    className="cc-wa cc-wa-sm"
                    href={inviteLink(c)}
                    target="_blank"
                    rel="noopener"
                    onClick={() =>
                      setInvited((prev) => new Set(prev).add(c.key))
                    }
                  >
                    <WhatsAppMiniIcon />{" "}
                    {invited.has(c.key) ? "Abierto" : "Abrir chat"}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
