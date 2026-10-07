"use client";

import { useEffect, useRef, useState } from "react";
import {
  createOpenMatch,
  getOpenMatches,
  joinOpenMatch,
} from "../app/open-matches/actions";
import { PRECIO_POR_JUGADOR } from "../data/pricing";
import { OPEN_MATCH_CATEGORIES } from "../lib/openMatches";
import Portal from "./Portal";
import useDialogFocus from "../lib/useDialogFocus";
import Mascota from "./Mascota";
import ScrollRow from "./ScrollRow";
import { X } from "lucide-react";

const WHATSAPP = "5492995974176";

const CATEGORY_TABS = [
  { id: "all", label: "Todas las categorías" },
  { id: "7ma", label: "7ma (Iniciación)" },
  { id: "6ta", label: "6ta (Intermedio)" },
  { id: "5ta", label: "5ta (Avanzado)" },
  { id: "Libre", label: "Libre / 4ta" },
  { id: "Damas", label: "Damas" },
];

export default function CommunityMatchesSection() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const cardsRef = useRef(null);
  const [selectedCat, setSelectedCat] = useState("all");

  // Join Modal State
  const [joinModal, setJoinModal] = useState(null); // { matchId, slotIndex, match }
  const [joinName, setJoinName] = useState("");
  const [joinPhone, setJoinPhone] = useState("");
  const [joinSubmitting, setJoinSubmitting] = useState(false);

  // Create Modal State
  const [createModal, setCreateModal] = useState(false);
  const joinDialogRef = useDialogFocus(Boolean(joinModal), () => setJoinModal(null));
  const createDialogRef = useDialogFocus(createModal, () => setCreateModal(false));
  const [createForm, setCreateForm] = useState({
    category: "6ta Categoría (3.0 - 3.9)",
    courtName: "Cancha 1 · Cristal",
    date: "",
    time: "20:00 hs",
    desc: "Partido parejo de 6ta para sumar puntos y ritmo.",
    creatorName: "",
    creatorPhone: "",
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    setLoading(true);
    setLoadFailed(false);
    let res;
    try {
      res = await getOpenMatches();
    } catch {
      res = { ok: false };
    }
    setLoading(false);
    if (res.ok) {
      setMatches(res.matches);
    } else {
      // Antes un error se mostraba como "no hay partidos".
      setLoadFailed(true);
    }
  }

  const filteredMatches = matches.filter((m) => {
    if (selectedCat === "all") return true;
    return m.category.toLowerCase().includes(selectedCat.toLowerCase());
  });

  async function handleJoinSubmit(e) {
    e.preventDefault();
    if (!joinModal) return;
    setJoinSubmitting(true);
    const res = await joinOpenMatch(
      joinModal.matchId,
      joinModal.slotIndex,
      joinName,
      joinPhone,
    );
    setJoinSubmitting(false);
    if (res.ok) {
      setJoinModal(null);
      setJoinName("");
      setJoinPhone("");
      loadMatches();
      // Abrir WhatsApp con mensaje de confirmación
      const msg = `¡Hola Muzzaga! Me sumé como jugador a la Cancha Abierta de ${joinModal.match.category} para el ${joinModal.match.date} a las ${joinModal.match.time} a nombre de ${joinName}.`;
      window.open(
        `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
    } else {
      alert(res.error || "Error al unirse");
    }
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setCreateSubmitting(true);
    const res = await createOpenMatch(createForm);
    setCreateSubmitting(false);
    if (res.ok) {
      setCreateModal(false);
      loadMatches();
      const msg = `¡Hola Muzzaga! Publiqué una nueva Cancha Abierta (${createForm.category}) para el ${createForm.date || "hoy"} a las ${createForm.time}. ¿Me ayudan a difundirla en el grupo del club?`;
      window.open(
        `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
    } else {
      alert(res.error || "Error al publicar");
    }
  }

  return (
    <section id="canchas-abiertas" className="section-community">
      <div className="container">
        <div className="section-header-row">
          <div>
            <span
              className="badge-linear badge-amber"
              style={{ marginBottom: 6 }}
            >
              Comunidad · Partidos abiertos
            </span>
            <h2 className="section-title">Canchas Abiertas en Catriel</h2>
            <p className="section-desc">
              Sumate a partidos con lugares libres o publicá tu propia
              convocatoria. Jugá con rivales de tu mismo nivel.
            </p>
          </div>
          <div className="header-aside">
            <div className="mascot-section-badge">
              <Mascota
                pose="pizza-good-vibes"
                alt="Muzzaguito compartiendo pizza con la comunidad"
                className="mascot-section-img"
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateModal(true)}
            >
              + Publicar partido
            </button>
          </div>
        </div>

        {/* CATEGORY FILTER PILLS */}
        <ScrollRow className="open-category-tabs">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`booking-court-tab${selectedCat === tab.id ? " active" : ""}`}
              onClick={() => setSelectedCat(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </ScrollRow>

        <div className="open-cards-grid" ref={cardsRef} tabIndex={-1}>
          {loading && matches.length === 0 ? (
            // Solo en la primera carga (al sumarse o publicar, las tarjetas
            // quedan mientras se actualizan). Mismo recuadro que el estado
            // vacío: antes, mientras cargaba, decía "No hay partidos".
            <div className="booking-empty open-empty is-loading" role="status">
              Buscando partidos…
            </div>
          ) : loadFailed ? (
            <div className="booking-empty open-empty" role="alert">
              <p className="open-empty-desc">No pudimos cargar los partidos.</p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  cardsRef.current?.focus({ preventScroll: true });
                  loadMatches();
                }}
              >
                Reintentar
              </button>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="booking-empty open-empty">
              <Mascota pose="pelota-padel-life" className="open-empty-mascot" />
              <div>
                <strong className="open-empty-title">
                  {selectedCat === "all"
                    ? "Todavía no hay partidos"
                    : `Todavía no hay partidos de ${CATEGORY_TABS.find((t) => t.id === selectedCat)?.label || selectedCat}`}
                </strong>
                <p className="open-empty-desc">Armá el tuyo y sumá gente de tu nivel.</p>
              </div>
              <button
                type="button"
                className="btn btn-linear-primary"
                onClick={() => setCreateModal(true)}
              >
                Publicar partido
              </button>
            </div>
          ) : (
            filteredMatches.map((match) => {
              const freeCount = match.players.filter((p) => !p.taken).length;
              const isFull = freeCount === 0;

              return (
                <div className="open-card" key={match.id}>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <span className={`badge-linear ${match.badgeColor}`}>
                        {match.category}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {match.time}
                      </span>
                    </div>

                    <h3
                      style={{
                        fontSize: 17,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        margin: "12px 0 4px",
                      }}
                    >
                      {match.courtName}
                    </h3>
                    <p
                      style={{
                        fontSize: 14,
                        color: "var(--text-secondary)",
                        minHeight: 44,
                      }}
                    >
                      {match.desc}
                    </p>

                    <div className="player-slots-layout">
                      {match.players.map((player, idx) =>
                        player.taken ? (
                          <div
                            key={idx}
                            className="player-slot-item taken"
                            title={player.name}
                          >
                            ✓ {player.name.split(" ")[0]}
                          </div>
                        ) : (
                          <button
                            key={idx}
                            type="button"
                            className="player-slot-item free-clickable"
                            onClick={() =>
                              setJoinModal({
                                matchId: match.id,
                                slotIndex: idx,
                                match,
                              })
                            }
                            title="Hacé clic para sumarte a este lugar"
                          >
                            +1 Sumarme
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderTop: "1px solid var(--border-subtle)",
                      paddingTop: 14,
                      marginTop: 16,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          display: "block",
                        }}
                      >
                        Tu plaza:
                      </span>
                      <strong
                        style={{ color: "var(--text-primary)", fontSize: 16 }}
                      >
                        ${match.pricePerPlayer.toLocaleString("es-AR")}
                      </strong>
                    </div>

                    {isFull ? (
                      <span
                        className="badge-linear badge-emerald"
                        style={{ fontSize: 12 }}
                      >
                        ✓ Partido completo
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-whatsapp"
                        style={{
                          height: 36,
                          padding: "6px 14px",
                          fontSize: 13,
                        }}
                        onClick={() => {
                          const firstFreeIdx = match.players.findIndex(
                            (p) => !p.taken,
                          );
                          setJoinModal({
                            matchId: match.id,
                            slotIndex: firstFreeIdx,
                            match,
                          });
                        }}
                      >
                        Sumarme ({freeCount} libre{freeCount > 1 ? "s" : ""}) →
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL PARA SUMARSE A UN SLOT */}
      {joinModal && (
        <Portal>
        <div
          className="admin-modal-backdrop"
          onClick={() => setJoinModal(null)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
            ref={joinDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Sumarme al partido abierto"
            tabIndex={-1}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 18,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Sumarme al partido
              </h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setJoinModal(null)}
                aria-label="Cerrar"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <p
              style={{
                fontSize: 13.5,
                color: "var(--text-secondary)",
                marginBottom: 16,
              }}
            >
              Partido: <strong>{joinModal.match.category}</strong> en{" "}
              {joinModal.match.courtName} ({joinModal.match.time}).
            </p>

            <form onSubmit={handleJoinSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label className="admin-field-label">
                  Tu nombre y apellido:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Lucas Gómez"
                  className="admin-input-field"
                  value={joinName}
                  maxLength={60}
                  onChange={(e) => setJoinName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label className="admin-field-label">
                  Tu teléfono (WhatsApp):
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ej. 299 597 4176"
                  className="admin-input-field"
                  value={joinPhone}
                  maxLength={25}
                  onChange={(e) => setJoinPhone(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-linear-primary"
                style={{ width: "100%", height: 44, justifyContent: "center" }}
                disabled={joinSubmitting}
              >
                {joinSubmitting
                  ? "Registrando plaza..."
                  : `Confirmar mi lugar ($${PRECIO_POR_JUGADOR.toLocaleString("es-AR")}) →`}
              </button>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* MODAL PARA CREAR CONVOCATORIA */}
      {createModal && (
        <Portal>
        <div
          className="admin-modal-backdrop"
          onClick={() => setCreateModal(false)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
            ref={createDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Publicar partido abierto"
            tabIndex={-1}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 18,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Publicar partido abierto
              </h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setCreateModal(false)}
                aria-label="Cerrar"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label className="admin-field-label">Categoría o nivel:</label>
                <select
                  className="admin-modal-select"
                  value={createForm.category}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, category: e.target.value })
                  }
                >
                  {OPEN_MATCH_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <label className="admin-field-label">Cancha:</label>
                  <select
                    className="admin-modal-select"
                    value={createForm.courtName}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        courtName: e.target.value,
                      })
                    }
                  >
                    <option value="Cancha 1 · Cristal">
                      Cancha 1 · Cristal
                    </option>
                    <option value="Cancha 2 · Cristal">
                      Cancha 2 · Cristal
                    </option>
                  </select>
                </div>

                <div>
                  <label className="admin-field-label">Horario:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 20:00 hs"
                    className="admin-input-field"
                    value={createForm.time}
                    maxLength={20}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, time: e.target.value })
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <label className="admin-field-label">
                    Tu nombre (organizador):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Tu nombre"
                    className="admin-input-field"
                    value={createForm.creatorName}
                    maxLength={60}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        creatorName: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="admin-field-label">Tu WhatsApp:</label>
                  <input
                    type="tel"
                    placeholder="Tu teléfono"
                    className="admin-input-field"
                    value={createForm.creatorPhone}
                    maxLength={25}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        creatorPhone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label className="admin-field-label">
                  Descripción del partido:
                </label>
                <input
                  type="text"
                  placeholder="Ej. Buscamos 2 jugadores con buen revés para partido parejo"
                  className="admin-input-field"
                  value={createForm.desc}
                  maxLength={200}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, desc: e.target.value })
                  }
                />
              </div>

              <button
                type="submit"
                className="btn btn-linear-primary"
                style={{ width: "100%", height: 44, justifyContent: "center" }}
                disabled={createSubmitting}
              >
                {createSubmitting ? "Publicando..." : "Publicar partido →"}
              </button>
            </form>
          </div>
        </div>
        </Portal>
      )}
    </section>
  );
}
