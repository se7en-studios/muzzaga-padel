"use client";

import { useMemo, useRef, useState } from "react";
import {
  ClipboardPaste,
  Pencil,
  Star,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { formatARS, normalizeSearch, plural } from "../../../../lib/format";
import { toWhatsappNumber } from "../../../../lib/phone";
import { parsePairsList } from "../../../../lib/tournament";
import { WhatsAppMiniIcon } from "../../adminHelpers";
import { EmptyState } from "../../ui/states";
import {
  adminAddTournamentPairs,
  adminDeleteTournamentCategory,
  adminRemoveTournamentPlayer,
  adminSaveTournamentCategory,
  adminTogglePlayerPaid,
  adminUpdateTournamentPlayer,
} from "../../actions";

const EMPTY = { name: "", partner: "", phone: "" };

export default function PairsTab({
  tournament: t,
  category,
  onRun,
  onReload,
  onPatch,
  onToast,
  onGoToDraw,
  onCategoryRemoved,
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState(EMPTY);
  const [catEdit, setCatEdit] = useState(null);
  const nameRef = useRef(null);

  const pairs = useMemo(
    () => (t.players || []).filter((p) => p.categoryId === category.id),
    [t.players, category.id],
  );
  const fixture = t.fixtures?.[category.id];
  const inFixture = useMemo(() => {
    if (!fixture) return null;
    const ids = new Set(fixture.groups.flatMap((g) => g.pairIds));
    for (const m of Object.values(fixture.matches)) {
      if (m.a?.pair) ids.add(m.a.pair);
      if (m.b?.pair) ids.add(m.b.pair);
    }
    return ids;
  }, [fixture]);
  const notDrawn = inFixture ? pairs.filter((p) => !inFixture.has(p.id)) : [];
  const paid = pairs.filter((p) => p.paid).length;
  const price = Number(t.price) || 0;
  const parsed = useMemo(() => parsePairsList(bulkText), [bulkText]);

  /** Nombres que ya están anotados en el torneo (cualquier categoría). */
  const taken = useMemo(() => {
    const map = new Map();
    for (const p of t.players || []) {
      for (const n of [p.name, p.partner])
        if (n) map.set(normalizeSearch(n), p);
    }
    return map;
  }, [t.players]);
  const dupOf = (names) =>
    names.map((n) => n && taken.get(normalizeSearch(n))).find(Boolean);

  function localAdd(ids, list) {
    const now = Date.now();
    onPatch((x) => ({
      ...x,
      players: [
        ...x.players,
        ...list.map((p, i) => ({
          id: ids[i],
          ...p,
          categoryId: category.id,
          paid: false,
          createdAt: now + i,
        })),
      ],
    }));
  }

  async function addOne(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const dup = dupOf([form.name, form.partner]);
    if (
      dup &&
      !confirm(
        `Ya hay una pareja con ese nombre: ${dup.name}${dup.partner ? ` / ${dup.partner}` : ""}. ¿La anoto igual?`,
      )
    ) {
      return;
    }
    setSaving(true);
    const res = await onRun(
      adminAddTournamentPairs(t.id, category.id, [form]),
      "No se pudo anotar la pareja.",
    );
    setSaving(false);
    if (!res) return;
    localAdd(res.ids, [
      {
        name: form.name.trim(),
        partner: form.partner.trim(),
        phone: form.phone.trim(),
      },
    ]);
    onToast?.(
      `Anotada en ${category.name} · ${form.name.trim()}${form.partner.trim() ? ` / ${form.partner.trim()}` : ""}`,
    );
    setForm(EMPTY);
    nameRef.current?.focus();
  }

  async function addBulk() {
    if (!parsed.length) return;
    setSaving(true);
    const res = await onRun(
      adminAddTournamentPairs(t.id, category.id, parsed),
      "No se pudo anotar la lista.",
    );
    setSaving(false);
    if (!res) return;
    localAdd(res.ids, parsed);
    onToast?.(
      `${plural(parsed.length, "pareja anotada", "parejas anotadas")} en ${category.name}`,
    );
    setBulkText("");
    setBulkOpen(false);
  }

  async function update(pairId, patch, fallback = "No se pudo guardar.") {
    const res = await onRun(
      adminUpdateTournamentPlayer(t.id, pairId, patch),
      fallback,
    );
    if (!res) return false;
    onPatch((x) => ({
      ...x,
      players: x.players.map((p) => (p.id === pairId ? { ...p, ...patch } : p)),
    }));
    return true;
  }

  async function togglePaid(p) {
    const res = await onRun(
      adminTogglePlayerPaid(t.id, p.id, !p.paid),
      "No se pudo actualizar el pago.",
    );
    if (res)
      onPatch((x) => ({
        ...x,
        players: x.players.map((q) =>
          q.id === p.id ? { ...q, paid: !p.paid } : q,
        ),
      }));
  }

  async function remove(p) {
    const inDraw = inFixture?.has(p.id);
    const msg = inDraw
      ? `${p.name}${p.partner ? ` / ${p.partner}` : ""} ya está en el sorteo. Si la quitás vas a tener que volver a sortear. ¿Quitarla?`
      : `¿Quitar a ${p.name}${p.partner ? ` / ${p.partner}` : ""} del torneo?`;
    if (!confirm(msg)) return;
    const res = await onRun(
      adminRemoveTournamentPlayer(t.id, p.id),
      "No se pudo quitar la pareja.",
    );
    if (res)
      onPatch((x) => ({
        ...x,
        players: x.players.filter((q) => q.id !== p.id),
      }));
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (await update(editId, edit)) setEditId(null);
  }

  async function saveCategory(e) {
    e.preventDefault();
    const res = await onRun(
      adminSaveTournamentCategory(t.id, { id: category.id, name: catEdit }),
      "No se pudo renombrar.",
    );
    if (!res) return;
    setCatEdit(null);
    onReload();
  }

  async function removeCategory() {
    if (!confirm(`¿Sacar la categoría ${category.name} del torneo?`)) return;
    const res = await onRun(
      adminDeleteTournamentCategory(t.id, category.id),
      "No se pudo quitar la categoría.",
    );
    if (!res) return;
    onCategoryRemoved();
    onReload();
  }

  const nextSeed = Math.max(0, ...pairs.map((p) => Number(p.seed) || 0)) + 1;

  return (
    <div className="tn-stack">
      {notDrawn.length > 0 && (
        <div className="tn-banner" role="status">
          <span>
            {plural(
              notDrawn.length,
              "pareja nueva no está",
              "parejas nuevas no están",
            )}{" "}
            en el sorteo de {category.name}.
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onGoToDraw}
          >
            Volver a sortear
          </button>
        </div>
      )}

      {/* ANOTAR PAREJA: lo primero que se ve */}
      <form className="tn-card tn-quickadd tn-stack" onSubmit={addOne}>
        <div className="tn-row-between">
          <h3 className="tn-card-title" style={{ margin: 0 }}>
            Anotar pareja en {category.name}
          </h3>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setBulkOpen((v) => !v)}
            aria-expanded={bulkOpen}
          >
            <ClipboardPaste size={15} /> Pegar lista de WhatsApp
          </button>
        </div>

        {bulkOpen ? (
          <div className="tn-stack" style={{ gap: 10 }}>
            <p className="tn-muted" style={{ margin: 0 }}>
              Pegá la lista como te llegó: una pareja por renglón. Sirve{" "}
              <code>Juan Pérez / Pedro Gómez 299 555-1234</code>,{" "}
              <code>Juan y Pedro</code> o <code>1) Juan - Pedro</code>.
            </p>
            <textarea
              className="tn-textarea"
              autoFocus
              placeholder={
                "Juan Pérez / Pedro Gómez 2995551234\nAna López y María Díaz\n..."
              }
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            {parsed.length > 0 && (
              <>
                <strong>
                  Se van a anotar {plural(parsed.length, "pareja", "parejas")}{" "}
                  en {category.name}:
                </strong>
                <ol className="tn-parse-preview">
                  {parsed.map((p, i) => (
                    <li key={i}>
                      {i + 1}. <strong>{p.name}</strong>
                      {p.partner ? (
                        ` / ${p.partner}`
                      ) : (
                        <em className="tn-muted"> (sin compañero)</em>
                      )}
                      {p.phone && (
                        <span className="tn-muted"> · {p.phone}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}
            <div className="tn-row" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBulkOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-linear-primary"
                disabled={!parsed.length || saving}
                onClick={addBulk}
              >
                {saving
                  ? "Anotando..."
                  : `Anotar ${plural(parsed.length, "pareja", "parejas")}`}
              </button>
            </div>
          </div>
        ) : (
          <div className="tn-grid-form">
            <label className="tn-field">
              <span className="admin-field-label">Jugador 1 *</span>
              <input
                ref={nameRef}
                type="text"
                required
                autoFocus
                maxLength={60}
                autoComplete="off"
                placeholder="Nombre y apellido"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="tn-field">
              <span className="admin-field-label">Jugador 2</span>
              <input
                type="text"
                maxLength={60}
                autoComplete="off"
                placeholder="Nombre y apellido"
                value={form.partner}
                onChange={(e) => setForm({ ...form, partner: e.target.value })}
              />
            </label>
            <label className="tn-field">
              <span className="admin-field-label">WhatsApp</span>
              <input
                type="tel"
                maxLength={30}
                autoComplete="off"
                placeholder="299 555-1234"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <button
              type="submit"
              className="btn btn-linear-primary admin-btn-lg"
              disabled={saving || !form.name.trim()}
            >
              <UserPlus size={17} /> {saving ? "Anotando..." : "Anotar"}
            </button>
          </div>
        )}
      </form>

      {/* LISTA */}
      <div className="tn-card">
        <div className="tn-row-between" style={{ marginBottom: 8 }}>
          <div>
            {catEdit === null ? (
              <h3 className="tn-card-title" style={{ margin: 0 }}>
                {category.name} · {plural(pairs.length, "pareja", "parejas")}
              </h3>
            ) : (
              <form className="tn-row" onSubmit={saveCategory}>
                <input
                  type="text"
                  autoFocus
                  maxLength={40}
                  value={catEdit}
                  onChange={(e) => setCatEdit(e.target.value)}
                  style={{ width: 180 }}
                />
                <button
                  type="submit"
                  className="btn btn-linear-primary"
                  disabled={!catEdit.trim()}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCatEdit(null)}
                >
                  Cancelar
                </button>
                {t.categories.length > 1 && pairs.length === 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={removeCategory}
                  >
                    <Trash2 size={14} /> Sacar categoría
                  </button>
                )}
              </form>
            )}
            <span className="tn-muted">
              {paid} pagaron
              {price > 0 && pairs.length - paid > 0
                ? ` · faltan cobrar ${formatARS((pairs.length - paid) * price)}`
                : ""}
              {" · "}⭐ = cabeza de serie (va a una zona distinta en el sorteo)
            </span>
          </div>
          {catEdit === null && (
            <button
              type="button"
              className="tn-icon-btn"
              onClick={() => setCatEdit(category.name)}
              title="Renombrar o sacar la categoría"
            >
              <Pencil size={14} /> Categoría
            </button>
          )}
        </div>

        {pairs.length === 0 ? (
          <EmptyState
            icon={Users}
            title={`Sin parejas en ${category.name}`}
            text="Anotá la primera arriba, o pegá la lista que te mandaron por WhatsApp."
          />
        ) : (
          <table className="tn-pairs">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Pareja</th>
                <th>WhatsApp</th>
                <th>Pago</th>
                <th style={{ textAlign: "right" }}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p, i) =>
                editId === p.id ? (
                  <tr key={p.id}>
                    <td colSpan={5}>
                      <form className="tn-grid-form" onSubmit={saveEdit}>
                        <input
                          type="text"
                          required
                          maxLength={60}
                          value={edit.name}
                          onChange={(e) =>
                            setEdit({ ...edit, name: e.target.value })
                          }
                          aria-label="Jugador 1"
                        />
                        <input
                          type="text"
                          maxLength={60}
                          value={edit.partner}
                          onChange={(e) =>
                            setEdit({ ...edit, partner: e.target.value })
                          }
                          aria-label="Jugador 2"
                          placeholder="Jugador 2"
                        />
                        <input
                          type="tel"
                          maxLength={30}
                          value={edit.phone}
                          onChange={(e) =>
                            setEdit({ ...edit, phone: e.target.value })
                          }
                          aria-label="WhatsApp"
                          placeholder="WhatsApp"
                        />
                        <div className="tn-row">
                          <button
                            type="submit"
                            className="btn btn-linear-primary"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setEditId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td className="tn-col-num tn-muted">{i + 1}</td>
                    <td className="tn-pair-name">
                      <strong>
                        {p.seed ? `⭐${p.seed} ` : ""}
                        {p.name}
                      </strong>
                      <span className="tn-muted">
                        {p.partner || "Falta el compañero"}
                      </span>
                    </td>
                    <td>
                      {p.phone ? (
                        <a
                          href={`https://wa.me/${toWhatsappNumber(p.phone)}`}
                          target="_blank"
                          rel="noopener"
                          className="tn-icon-btn"
                          title={`Escribir a ${p.phone}`}
                        >
                          <WhatsAppMiniIcon />{" "}
                          <span className="tn-muted">{p.phone}</span>
                        </a>
                      ) : (
                        <span className="tn-muted">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`tn-pay${p.paid ? " is-paid" : ""}`}
                        onClick={() => togglePaid(p)}
                        title="Tocá para cambiar"
                      >
                        {p.paid ? "✓ Pagó" : "Debe"}
                      </button>
                    </td>
                    <td className="tn-col-actions">
                      <div
                        className="tn-row"
                        style={{ justifyContent: "flex-end", gap: 6 }}
                      >
                        <button
                          type="button"
                          className={`tn-icon-btn${p.seed ? " is-on" : ""}`}
                          onClick={() =>
                            update(p.id, { seed: p.seed ? 0 : nextSeed })
                          }
                          title={
                            p.seed
                              ? "Sacar cabeza de serie"
                              : "Marcar como cabeza de serie"
                          }
                          aria-label="Cabeza de serie"
                          aria-pressed={Boolean(p.seed)}
                        >
                          <Star
                            size={14}
                            fill={p.seed ? "currentColor" : "none"}
                          />
                        </button>
                        {t.categories.length > 1 && (
                          <select
                            className="admin-mini-select"
                            aria-label="Pasar a otra categoría"
                            title="Pasar a otra categoría"
                            value={p.categoryId}
                            onChange={(e) =>
                              update(
                                p.id,
                                { categoryId: e.target.value },
                                "No se pudo cambiar la categoría.",
                              )
                            }
                          >
                            {t.categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          className="tn-icon-btn"
                          onClick={() => {
                            setEditId(p.id);
                            setEdit({
                              name: p.name || "",
                              partner: p.partner || "",
                              phone: p.phone || "",
                            });
                          }}
                          aria-label="Editar pareja"
                          title="Corregir nombres o teléfono"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="tn-icon-btn is-danger"
                          onClick={() => remove(p)}
                          aria-label="Quitar pareja"
                          title="Quitar pareja"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>

      {pairs.length >= 3 && !fixture && (
        <div className="tn-banner is-ok">
          <span>
            ¿Ya están todas las parejas de {category.name}? Seguí con el sorteo
            de zonas.
          </span>
          <button
            type="button"
            className="btn btn-linear-primary"
            onClick={onGoToDraw}
          >
            Sortear zonas →
          </button>
        </div>
      )}
    </div>
  );
}
