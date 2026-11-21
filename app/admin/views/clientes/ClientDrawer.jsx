"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Phone,
  TriangleAlert,
  UtensilsCrossed,
  X,
  Trash2,
} from "lucide-react";
import {
  adminGetClientDetail,
  adminSaveClientNote,
  adminDeleteClient,
} from "../../actions";
import {
  formatARS,
  formatDate,
  formatRelativeDays,
  plural,
} from "../../../../lib/format";
import { formatPhoneAR, toWhatsappNumber } from "../../../../lib/phone";
import { todayInClub } from "../../../../lib/booking";
import {
  categorizeClient,
  isInactiveClient,
} from "../../../../lib/clientsExport";
import { EmptyState, SkeletonRows } from "../../ui/states";
import { WhatsAppMiniIcon } from "../../adminHelpers";
import StaffPinModal from "../../ui/StaffPinModal";
import { PADEL_LEVELS } from "../../../../data/levels";
import { demoDetail } from "./__demoData"; // DEMO-TEMP

const STATUS_LABEL = {
  confirmado: "Confirmado",
  señado: "Señado",
  pagado: "Pagado",
  cancelado: "Cancelado",
  bloqueado: "Bloqueado",
};

export function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

// Paleta de avatares: 8 tonos con texto blanco legible (AA). Cada jugador
// cae siempre en el mismo color, así se lo reconoce de un vistazo.
const AVATAR_TONES = 8;
// Etiquetas rápidas: todas las categorías (8va a 1era, salen de la misma
// lista que usa la web, así no falta ninguna) más la posición de juego.
const QUICK_TAGS = [...PADEL_LEVELS.map((l) => l.shortName), "Drive", "Revés"];
const MONTH_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function avatarTone(name) {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % AVATAR_TONES;
}

/** Panel lateral con historial, consumo en cantina, notas y WhatsApp. */
export default function ClientDrawer({ client, onClose, onToast, onDeleted }) {
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const today = todayInClub();

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    (window.location.search.includes("demo") ? Promise.resolve(demoDetail(client)) : adminGetClientDetail(client.key)).then( // DEMO-TEMP
(res) => {
      if (cancelled) return;
      if (res.ok) {
        setDetail(res);
        setNote(res.note);
        setSavedNote(res.note);
      } else {
        onToast?.(res.error || "No se pudo cargar el cliente.", {
          tone: "error",
        });
      }
    });
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
    };
  }, [client.key]);

  async function saveNote() {
    setSaving(true);
    const res = await adminSaveClientNote(client.key, note);
    setSaving(false);
    if (res.ok) {
      setSavedNote(note.trim());
      onToast?.("Nota guardada");
    } else {
      onToast?.(res.error || "No se pudo guardar la nota.", { tone: "error" });
    }
  }

  const cat = categorizeClient(client.count);
  const tier = cat.category.toLowerCase();
  const inactive = isInactiveClient(client, today);
  const cantinaTotal = detail?.cantina.reduce((s, c) => s + c.total, 0) || 0;
  // Solo para mostrar: lo que quedó sin cobrar en turnos no cancelados.
  const owed = (detail?.bookings || []).filter(
    (b) => b.status !== "cancelado" && b.total > b.paid,
  );
  const owedTotal = owed.reduce((s, b) => s + (b.total - b.paid), 0);

  return (
    <div className="admin-drawer-backdrop cc-drawer-backdrop" onClick={onClose}>
      <aside
        className="admin-drawer cc-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ficha del jugador: la cancha azul de fondo, como en la agenda. */}
        <header className="cc-drawer-hero" data-tier={tier}>
          <button
            type="button"
            className="cc-drawer-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
          <span
            className="cc-avatar cc-avatar-xl"
            data-tone={avatarTone(client.name)}
            data-tier={tier}
            data-inactive={inactive || undefined}
            aria-hidden
          >
            {initials(client.name)}
          </span>
          <div className="cc-drawer-id">
            <span className="cc-drawer-chips">
              <span className="cc-chip" data-tier={tier}>
                {cat.category}
              </span>
              {inactive && (
                <span className="cc-chip" data-tier="inactivo">
                  Inactivo
                </span>
              )}
            </span>
            <h3 id="client-drawer-title">{client.name}</h3>
            <span className="cc-drawer-phone">
              {client.phone ? formatPhoneAR(client.phone) : "Sin teléfono"}
            </span>
          </div>
        </header>

        {client.phone && (
          <div className="cc-drawer-actions">
            <a
              className="cc-wa cc-wa-lg"
              href={`https://wa.me/${toWhatsappNumber(client.phone)}?text=${encodeURIComponent(`Hola ${client.name.split(" ")[0]}! Te escribimos de Muzzaga Pádel 🎾`)}`}
              target="_blank"
              rel="noopener"
            >
              <WhatsAppMiniIcon size={18} /> Escribir por WhatsApp
            </a>
            <a
              className="cc-call"
              href={`tel:${client.phone}`}
              aria-label={`Llamar a ${client.name}`}
              title="Llamar"
            >
              <Phone size={18} strokeWidth={1.9} aria-hidden />
            </a>
          </div>
        )}

        {owedTotal > 0 && (
          <div className="cc-debt" role="status">
            <TriangleAlert size={18} strokeWidth={2} aria-hidden />
            <span>
              <strong>Debe {formatARS(owedTotal)}</strong>
              <small>
                {plural(owed.length, "turno con saldo", "turnos con saldo")}
              </small>
            </span>
          </div>
        )}

        <dl className="cc-drawer-stats">
          <div>
            <dt>Turnos</dt>
            <dd className="is-big">{client.count}</dd>
          </div>
          <div>
            <dt>Total en turnos</dt>
            <dd>{formatARS(client.totalSpent)}</dd>
          </div>
          <div data-inactive={inactive || undefined}>
            <dt>Último turno</dt>
            <dd>{formatRelativeDays(client.lastDate, today)}</dd>
          </div>
          <div>
            <dt>Cliente desde</dt>
            <dd>{client.firstDate ? formatDate(client.firstDate) : "—"}</dd>
          </div>
        </dl>

        <section className="cc-drawer-section">
          <div className="cc-drawer-section-head">
            <label htmlFor="client-note">Notas y etiquetas</label>
            <span>Solo las ve el staff</span>
          </div>
          <div className="cc-tags" role="group" aria-label="Agregar etiqueta">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className="cc-tag"
                aria-pressed={note.includes(tag)}
                onClick={() => {
                  if (!note.includes(tag)) {
                    setNote((prev) => (prev.trim() ? `${prev.trim()} · ${tag}` : tag));
                  }
                }}
              >
                {note.includes(tag) ? tag : `+ ${tag}`}
              </button>
            ))}
          </div>
          <textarea
            id="client-note"
            className="cc-note"
            rows={3}
            maxLength={1000}
            placeholder="Nivel, preferencias, posición de juego, si debe algo…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {note.trim() !== savedNote && (
            <button
              type="button"
              className="btn btn-secondary cc-note-save"
              onClick={saveNote}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar nota"}
            </button>
          )}
        </section>

        <section className="cc-drawer-section">
          <h4 className="cc-drawer-title">
            <CalendarDays size={16} strokeWidth={1.9} aria-hidden /> Historial
            de reservas
            {detail && detail.bookings.length > 0 && (
              <span className="cc-drawer-count">{detail.bookings.length}</span>
            )}
          </h4>
          {!detail ? (
            <SkeletonRows count={4} height={40} />
          ) : detail.bookings.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Sin reservas registradas" />
          ) : (
            <ul className="cc-history">
              {detail.bookings.map((b) => (
                <li
                  key={b.id}
                  className={b.status === "cancelado" ? "is-voided" : undefined}
                >
                  <span className="cc-date-tile" aria-hidden>
                    <strong>{Number(b.date.slice(8, 10))}</strong>
                    <small>{MONTH_ABBR[Number(b.date.slice(5, 7)) - 1]}</small>
                  </span>
                  <span className="cc-history-main">
                    <strong>
                      {b.startTime} · {b.courtName}
                    </strong>
                    <small>{formatDate(b.date, "long")}</small>
                  </span>
                  <span className="cc-history-end">
                    <span className="cc-status" data-status={b.status}>
                      {STATUS_LABEL[b.status] || b.status}
                    </span>
                    <span className="cc-history-amount">
                      {formatARS(b.total)}
                    </span>
                    {b.total > b.paid && b.status !== "cancelado" && (
                      <small className="cc-history-owed">
                        Debe {formatARS(b.total - b.paid)}
                      </small>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cc-drawer-section">
          <h4 className="cc-drawer-title">
            <UtensilsCrossed size={16} strokeWidth={1.9} aria-hidden /> Consumo
            en cantina
            {cantinaTotal > 0 && (
              <span className="cc-drawer-count is-money">
                {formatARS(cantinaTotal)}
              </span>
            )}
          </h4>
          {!detail ? (
            <SkeletonRows count={2} height={40} />
          ) : detail.cantina.length === 0 ? (
            <p className="cc-drawer-hint">
              Sin consumos cargados a sus turnos. Las ventas al paso no quedan
              asociadas a un cliente.
            </p>
          ) : (
            <ul className="cc-history">
              {detail.cantina.map((c) => (
                <li key={c.id}>
                  <span className="cc-date-tile is-soft" aria-hidden>
                    <strong>{Number(c.date.slice(8, 10))}</strong>
                    <small>{MONTH_ABBR[Number(c.date.slice(5, 7)) - 1]}</small>
                  </span>
                  <span className="cc-history-main">
                    <strong>
                      {c.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}
                    </strong>
                    <small>{formatDate(c.date, "long")}</small>
                  </span>
                  <span className="cc-history-end">
                    <span
                      className="cc-status"
                      data-status={c.settled ? "pagado" : "a-cuenta"}
                    >
                      {c.settled ? "Cobrado" : "A cuenta"}
                    </span>
                    <span className="cc-history-amount">
                      {formatARS(c.total)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {detail && (
            <p className="cc-drawer-hint">
              {plural(detail.cantina.length, "consumo", "consumos")}
            </p>
          )}
        </section>

        {/* Zona de peligro: abajo de todo y separada, para no tocarla sin querer. */}
        <section className="cc-drawer-danger">
          <button
            type="button"
            className="cc-danger-btn"
            onClick={() => setIsPinModalOpen(true)}
          >
            <Trash2 size={15} aria-hidden /> Eliminar cliente del sistema
          </button>
        </section>
      </aside>

      {isPinModalOpen && (
        <StaffPinModal
          isOpen={isPinModalOpen}
          title="Eliminar Cliente"
          description={`¿Confirmás que querés eliminar al cliente ${client.name}? Esta acción requiere autorización por PIN y removerá al cliente del CRM.`}
          targetName={`${client.name} (${client.phone || "Sin teléfono"})`}
          confirmButtonText="Eliminar Cliente"
          confirmButtonTone="danger"
          onClose={() => setIsPinModalOpen(false)}
          onConfirm={async ({ pin, reason }) => {
            const res = await adminDeleteClient({ key: client.key, pin, reason });
            if (res.ok) {
              setIsPinModalOpen(false);
              onToast?.(`Cliente eliminado por ${res.staff}`);
              onDeleted?.(client.key);
              onClose();
            } else {
              throw new Error(res.error || "No se pudo eliminar el cliente.");
            }
          }}
        />
      )}
    </div>
  );
}
