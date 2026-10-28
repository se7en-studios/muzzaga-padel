"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBooking } from "../app/actions";
import BookingPassModal from "./BookingPassModal";
import { MaybePortal } from "./Portal";
import ScrollRow from "./ScrollRow";
import { scrollBehavior } from "../lib/motion";
import useMediaQuery from "../lib/useMediaQuery";
import {
  COURTS,
  isoWeekday,
  nextDays,
  priceForSlot,
  todayInClub,
} from "../lib/booking";
import { PICK_SLOT_EVENT } from "../lib/pickSlot";
import { toWhatsappNumber } from "../lib/phone";
import { trackEvent } from "../lib/analytics";
import { X } from "lucide-react";

const DAY_COUNT = 14;
const CLUB_WHATSAPP = "5492995974176";

function buildWhatsappUrl(bookingCode, booking) {
  const msg =
    `Hola Muzzaga! Reservé un turno desde la web [#${bookingCode}]:\n\n` +
    `Fecha: ${booking.date}\n` +
    `Horario: ${booking.startTime} a ${booking.endTime} hs\n` +
    `Cancha: ${booking.courtName}\n` +
    `Jugadores: ${booking.players}${booking.fullCourt ? " (cancha completa)" : ""}\n` +
    `Total: $${booking.total.toLocaleString("es-AR")}\n` +
    `A nombre de: ${booking.name} (${booking.phone})\n\n` +
    `¿Me confirman el turno?`;
  return `https://wa.me/${CLUB_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

// serverToday: el "hoy" con el que se renderizó el HTML (la home es ISR). Se
// usa para el primer render así server y cliente coinciden; después del
// montaje se corrige si ya cambió el día (ej. HTML cacheado antes de medianoche).
export default function BookingCalendar({
  serverToday,
  mpEnabled = false,
  payment = null,
  // Horario y días bloqueados de Configuración: de ahí sale qué días se ven
  // cerrados en el selector (antes se asumía "domingo cerrado" fijo).
  schedule = null,
  blockedDates = [],
}) {
  const [days, setDays] = useState(() => nextDays(DAY_COUNT, serverToday));
  const [activeDate, setActiveDate] = useState(days[0].iso);
  // Turno pedido desde afuera (widget "turnos libres hoy"): se selecciona
  // cuando llega la disponibilidad de ese día.
  const [pendingPick, setPendingPick] = useState(null);
  const [courtFilter, setCourtFilter] = useState("all");
  const [slots, setSlots] = useState(null);
  const [slotsDate, setSlotsDate] = useState(null);
  // Canchas de Configuración (vienen con la disponibilidad); COURTS es el
  // default hasta que responde la API.
  const [courts, setCourts] = useState(COURTS);
  const [loadError, setLoadError] = useState(null);
  // Sube para volver a pedir la disponibilidad (botón "Reintentar").
  const [reloadKey, setReloadKey] = useState(0);
  // Filas del último día cargado: el esqueleto de carga mide lo mismo.
  const lastRowCount = useRef(7);
  // Contenedor estable de la grilla: al tocar "Reintentar" el botón se
  // desmonta, y el foco pasa acá en vez de caer en <body>.
  const gridAreaRef = useRef(null);
  const [selected, setSelected] = useState(null); // { courtId, start, end }
  // Hasta 768 el formulario es un drawer fijo sobre la página: va a <body> para
  // no quedar debajo del header y la barra inferior. En notebook va en línea.
  const isDrawer = useMediaQuery("(max-width: 768px)");
  const [form, setForm] = useState({
    playerName: "",
    playerPhone: "",
    playersCount: 4,
    fullCourt: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmed, setConfirmed] = useState(null); // { bookingCode, whatsappUrl }
  const [isRemembered, setIsRemembered] = useState(false);
  const formRef = useRef(null);

  // Autocompletar datos del jugador frecuente guardados localmente
  useEffect(() => {
    try {
      const saved = localStorage.getItem("muzzaga_player_profile");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.playerName || parsed?.playerPhone) {
          setForm((f) => ({
            ...f,
            playerName: parsed.playerName || f.playerName,
            playerPhone: parsed.playerPhone || f.playerPhone,
          }));
          setIsRemembered(true);
        }
      }
    } catch {
      // Ignorar restricciones de almacenamiento local
    }
  }, []);

  useEffect(() => {
    const today = todayInClub();
    if (today !== days[0].iso) {
      setDays(nextDays(DAY_COUNT, today));
      setActiveDate(today);
    }
    // Solo al montar: el día no cambia mientras se renderiza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onPick(e) {
      const { date, courtId, start } = e.detail || {};
      if (!date || !courtId || !start) return;
      userChoseDay.current = true;
      setAutoNotice(null);
      setCourtFilter("all");
      setConfirmed(null);
      setActiveDate(date);
      setPendingPick({ date, courtId, start });
    }
    window.addEventListener(PICK_SLOT_EVENT, onPick);
    return () => window.removeEventListener(PICK_SLOT_EVENT, onPick);
  }, []);

  function handleForgetProfile() {
    try {
      localStorage.removeItem("muzzaga_player_profile");
    } catch {}
    setIsRemembered(false);
    setForm((f) => ({ ...f, playerName: "", playerPhone: "" }));
  }

  // Antes el formulario aparecía al final de la lista de horarios, fuera de
  // pantalla: elegir un slot no daba ninguna señal de que había que
  // scrollear a mano para verlo.
  useEffect(() => {
    if (!selected || !formRef.current) return;
    formRef.current.scrollIntoView({
      behavior: scrollBehavior(),
      block: "center",
    });
    const firstInput = formRef.current.querySelector("input");
    firstInput?.focus({ preventScroll: true });
  }, [selected, isDrawer]);

  // En celu el formulario es un drawer fijo sobre la página: sin esto, la
  // landing de atrás se sigue moviendo al arrastrar sobre el fondo oscuro
  // (rubber-banding de iOS), como si el sitio se "bugueara" al elegir turno.
  useEffect(() => {
    if (!selected || !isDrawer) return;
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbar) root.style.paddingRight = `${scrollbar}px`;
    return () => {
      root.style.overflow = "";
      root.style.paddingRight = "";
    };
  }, [selected, isDrawer]);

  useEffect(() => {
    let cancelled = false;
    setSlots(null);
    setLoadError(null);
    fetch(`/api/availability?date=${activeDate}`)
      .then((res) => {
        if (!res.ok) throw new Error("request-failed");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots);
        setSlotsDate(activeDate);
        const rows = new Set((data.slots || []).map((sl) => sl.start)).size;
        if (rows) lastRowCount.current = rows;
        if (data.courts?.length) setCourts(data.courts);
      })
      .catch(() => {
        if (!cancelled)
          setLoadError(
            "No pudimos cargar la disponibilidad. Probá de nuevo en un momento.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [activeDate, reloadKey]);

  useEffect(() => {
    // slotsDate evita elegir sobre la grilla del día anterior mientras carga la nueva.
    if (!pendingPick || !slots || slotsDate !== pendingPick.date) return;
    const slot = slots.find(
      (s) =>
        s.courtId === pendingPick.courtId &&
        s.start === pendingPick.start &&
        s.available,
    );
    setPendingPick(null);
    if (slot) pickSlot(slot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPick, slots, slotsDate]);

  const daysView = useMemo(
    () =>
      days.map((d) => ({
        ...d,
        closed: schedule
          ? !schedule[isoWeekday(d.iso)]?.open || blockedDates.includes(d.iso)
          : d.closed,
      })),
    [days, schedule, blockedDates],
  );
  const activeDay = daysView.find((d) => d.iso === activeDate);

  // Si "hoy" ya no tiene turnos libres (de noche todos figuran "Finalizado",
  // o está cerrado/agotado) y la persona todavía no eligió un día, se salta
  // solo al próximo día con turnos, avisándole.
  const userChoseDay = useRef(false);
  const [autoNotice, setAutoNotice] = useState(null);
  useEffect(() => {
    if (userChoseDay.current || !slots || slotsDate !== activeDate) return undefined;
    if (activeDate !== daysView[0].iso) return undefined;
    if (slots.some((s) => s.available)) return undefined;
    let cancelled = false;
    (async () => {
      for (const day of daysView.slice(1, 8)) {
        if (day.closed) continue;
        try {
          const res = await fetch(`/api/availability?date=${day.iso}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (!data.slots?.some((s) => s.available)) continue;
          if (cancelled || userChoseDay.current) return;
          setActiveDate(day.iso);
          setAutoNotice(
            `Hoy ya no quedan turnos libres: te mostramos ${day.fullLabel}.`,
          );
          return;
        } catch {
          // Si falla una consulta se prueba con el día siguiente.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, slotsDate, activeDate]);

  const visibleSlots = useMemo(() => {
    if (!slots) return null;
    return courtFilter === "all"
      ? slots
      : slots.filter((s) => s.courtId === courtFilter);
  }, [slots, courtFilter]);

  const selectedPricing = useMemo(() => {
    if (!selected) return null;
    // El precio lo calcula el server según la franja (pico/valle).
    return selected.price || priceForSlot(activeDate, selected.start);
  }, [activeDate, selected]);

  // Normalización de teléfono argentino (mínimo 10 dígitos útiles)
  const normalizedPhone = toWhatsappNumber(form.playerPhone);
  const isFormValid =
    form.playerName.trim().length >= 2 && normalizedPhone.length >= 10;

  function pickSlot(slot) {
    setSelected(slot);
    setSubmitError(null);
    setConfirmed(null);
    trackEvent("slot_selected", {
      courtId: slot.courtId,
      start: slot.start,
      date: activeDate,
    });
  }

  function markSlotTaken(courtId, start) {
    setSlots((prev) =>
      prev
        ? prev.map((s) =>
            s.courtId === courtId && s.start === start
              ? { ...s, available: false }
              : s,
          )
        : prev,
    );
  }

  async function handleConfirm(e) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await createBooking({
      date: activeDate,
      courtId: selected.courtId,
      startTime: selected.start,
      endTime: selected.end,
      playerName: form.playerName,
      playerPhone: normalizedPhone,
      playersCount: form.playersCount,
      fullCourt: form.fullCourt,
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      if (result.error.includes("acaba de ocupar")) {
        markSlotTaken(selected.courtId, selected.start);
        setSelected(null);
      }
      return;
    }
    markSlotTaken(selected.courtId, selected.start);
    try {
      localStorage.setItem(
        "muzzaga_player_profile",
        JSON.stringify({
          playerName: form.playerName.trim(),
          playerPhone: form.playerPhone.trim(),
        }),
      );
      setIsRemembered(true);
      localStorage.setItem("muzzaga_has_booked", "1");
    } catch {}
    trackEvent("booking_submitted", {
      courtId: selected.courtId,
      start: selected.start,
      date: activeDate,
      bookingCode: result.bookingCode,
    });
    const whatsappUrl = buildWhatsappUrl(result.bookingCode, result.booking);
    setConfirmed({
      bookingCode: result.bookingCode,
      booking: result.booking,
      whatsappUrl,
    });
    window.open(whatsappUrl, "_blank", "noopener");
  }

  return (
    <div className="booking-calendar">
      <ScrollRow
        className="booking-dates"
        role="group"
        aria-label="Elegí el día"
      >
        {daysView.map((day) => (
          <button
            key={day.iso}
            type="button"
            className={`booking-date-btn${day.iso === activeDate ? " active" : ""}${day.closed ? " is-closed" : ""}`}
            onClick={() => {
              userChoseDay.current = true;
              setAutoNotice(null);
              setActiveDate(day.iso);
              setSelected(null);
              setConfirmed(null);
            }}
            aria-pressed={day.iso === activeDate}
          >
            <span className="booking-date-day">
              {day.dayName}
              {day.isWeekend && (
                <span className="booking-date-weekend-badge">Finde</span>
              )}
            </span>
            <span className="booking-date-num">{day.dayNumber}</span>
            <span className="booking-date-month">{day.monthName}</span>
            {day.closed && <span className="sr-only">, cerrado</span>}
          </button>
        ))}
      </ScrollRow>

      <ScrollRow className="booking-court-tabs">
        <button
          type="button"
          className={`booking-court-tab${courtFilter === "all" ? " active" : ""}`}
          onClick={() => setCourtFilter("all")}
          aria-pressed={courtFilter === "all"}
        >
          Todas las canchas
        </button>
        {courts.map((court) => (
          <button
            key={court.id}
            type="button"
            className={`booking-court-tab${courtFilter === court.id ? " active" : ""}`}
            onClick={() => setCourtFilter(court.id)}
            aria-pressed={courtFilter === court.id}
          >
            {court.name} ({court.type})
          </button>
        ))}
      </ScrollRow>

      <div ref={gridAreaRef} tabIndex={-1} className="booking-grid-area">
        {autoNotice && (
          <p className="booking-auto-notice" role="status">
            {autoNotice}
          </p>
        )}

        {activeDay?.closed && (
          <p className="booking-empty">
            El club está cerrado ese día. Elegí otro día.
          </p>
        )}

        {!activeDay?.closed && loadError && (
          <div className="booking-empty booking-error" role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                gridAreaRef.current?.focus({ preventScroll: true });
                setReloadKey((k) => k + 1);
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Mientras carga: la grilla vacía con el alto final (antes era un
            renglón de texto y la grilla aparecía de golpe, empujando todo). */}
        {!activeDay?.closed && !loadError && !visibleSlots && (
          <div
            className="booking-matrix-container is-loading"
            style={{
              "--court-columns": courtFilter === "all" ? courts.length : 1,
            }}
            role="status"
            aria-label="Cargando disponibilidad"
          >
            <div className="booking-matrix-header" aria-hidden="true">
              <div>Horario</div>
              {(courtFilter === "all"
                ? courts
                : courts.filter((c) => c.id === courtFilter)
              ).map((c) => (
                <div key={c.id}>
                  {c.name} ({c.type})
                </div>
              ))}
            </div>
            {Array.from({ length: lastRowCount.current }, (_, i) => (
              <div key={i} className="booking-matrix-row" aria-hidden="true">
                <div className="booking-matrix-time-col">
                  <span className="skeleton-bar" style={{ width: 44 }} />
                </div>
                {(courtFilter === "all"
                  ? courts
                  : courts.filter((c) => c.id === courtFilter)
                ).map((c) => (
                  <div key={c.id} className="booking-slot is-skeleton">
                    <span className="skeleton-bar" style={{ width: "46%" }} />
                    <span className="skeleton-bar" style={{ width: 72 }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {!activeDay?.closed && !loadError && visibleSlots && (
          <div
            className="booking-matrix-container"
            style={{
              "--court-columns": courtFilter === "all" ? courts.length : 1,
            }}
          >
            {/* Encabezado de columnas de canchas */}
            <div className="booking-matrix-header">
              <div>Horario</div>
              {(courtFilter === "all"
                ? courts
                : courts.filter((c) => c.id === courtFilter)
              ).map((c) => (
                <div key={c.id}>
                  {c.name} ({c.type})
                </div>
              ))}
            </div>

            {/* Filas de la matriz por horario */}
            {/* Sin .sort(): los horarios ya vienen en orden de la noche, y un
                00:30 (club abierto pasada la medianoche) iría primero. */}
            {[...new Set(visibleSlots.map((s) => s.start))].map((time) => {
              const rowCourts =
                courtFilter === "all"
                  ? courts
                  : courts.filter((c) => c.id === courtFilter);

              return (
                <div key={time} className="booking-matrix-row">
                  <div className="booking-matrix-time-col">
                    <strong>{time}</strong>
                    <span>hs</span>
                  </div>

                  {rowCourts.map((court) => {
                    const slot = visibleSlots.find(
                      (s) => s.courtId === court.id && s.start === time,
                    );
                    if (!slot) {
                      return (
                        <div
                          key={court.id}
                          className="booking-slot taken"
                          style={{
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--color-muted)",
                            }}
                          >
                            No disponible
                          </span>
                        </div>
                      );
                    }

                    const isSelected =
                      selected?.courtId === slot.courtId &&
                      selected?.start === slot.start;

                    // El nombre accesible empieza con el texto visible ("Cancha 1
                    // Disponible") y suma la hora.
                    return (
                      <button
                        key={`${slot.courtId}-${slot.start}`}
                        type="button"
                        className={`booking-slot${slot.available ? "" : " taken"}${slot.past ? " past" : ""}${isSelected ? " selected" : ""}`}
                        disabled={!slot.available}
                        onClick={() => pickSlot(slot)}
                        aria-label={`${court.name} ${isSelected ? "Tu selección" : slot.available ? "Disponible" : slot.past ? "Finalizado" : "Ocupado"}, ${slot.start} hs`}
                      >
                        <span className="slot-meta" style={{ fontWeight: 600 }}>
                          {court.name}
                        </span>{" "}
                        <span className="slot-badge">
                          {isSelected
                            ? "Tu selección ✓"
                            : slot.available
                              ? "Disponible"
                              : slot.past
                                ? "Finalizado"
                                : "Ocupado"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && selectedPricing && (
        <MaybePortal enabled={isDrawer}>
          <div
            className="booking-drawer-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelected(null);
            }}
          >
            <form
              className="booking-form"
              ref={formRef}
              onSubmit={handleConfirm}
              role={isDrawer ? "dialog" : undefined}
              aria-modal={isDrawer || undefined}
              aria-label="Confirmar reserva"
            >
              {isDrawer && <div className="booking-drawer-handle" aria-hidden="true" />}

              <div className="booking-form-header">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <span className="booking-badge-court">
                      <img src="/img/iconos/pelota.webp" alt="" width={18} height={18} className="icono-3d booking-badge-3d" aria-hidden="true" />{" "}
                      {courts.find((c) => c.id === selected.courtId)?.name || "Cancha de cristal"}
                    </span>
                    <h3 style={{ margin: "4px 0 0", fontSize: 19, fontWeight: 700 }}>Confirmar tu turno</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="booking-drawer-close-btn"
                    aria-label="Cerrar formulario"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                <div className="booking-slot-summary-card">
                  <div className="booking-summary-main">
                    <div className="booking-summary-time">
                      <span className="summary-label">Día y horario</span>
                      <strong>
                        {activeDay?.dayName} {activeDay?.dayNumber} {activeDay?.monthName} · {selected.start} hs ({selected.end} hs)
                      </strong>
                    </div>
                    <div className="booking-summary-price">
                      <span className="summary-label">Total del turno</span>
                      <strong className="summary-price-tag">${selectedPricing.total.toLocaleString("es-AR")}</strong>
                      <span className="summary-price-sub">${selectedPricing.perPlayer.toLocaleString("es-AR")} c/u (4p)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="booking-inputs-group">
                <label className="booking-input-label">
                  <span>Tu nombre y apellido</span>
                  <div className="booking-input-wrap">
                    <img src="/img/iconos/biblioteca/icono-jugador.webp" alt="" width={24} height={24} className="icono-3d booking-input-3d" aria-hidden="true" />
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      autoCapitalize="words"
                      required
                      placeholder="Ej. Lucas Rossi"
                      value={form.playerName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, playerName: e.target.value }))
                      }
                    />
                  </div>
                </label>

                <label className="booking-input-label">
                  <span>WhatsApp (para confirmar el turno)</span>
                  <div className="booking-input-wrap">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="#25D366" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    <input
                      type="tel"
                      name="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      required
                      placeholder="Ej. 299 597 4176"
                      value={form.playerPhone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, playerPhone: e.target.value }))
                      }
                    />
                  </div>
                </label>
              </div>

              {isRemembered && (
                <div className="booking-remembered-chip">
                  <span>✓ Datos listos para reservar en 1 toque</span>
                  <button
                    type="button"
                    onClick={handleForgetProfile}
                    className="booking-forget-btn"
                  >
                    Cambiar
                  </button>
                </div>
              )}

              {submitError && <p className="booking-error">{submitError}</p>}

              <button
                type="submit"
                className="booking-submit-btn"
                disabled={submitting || !isFormValid}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                <span>{submitting ? "Confirmando reserva…" : "Confirmar turno por WhatsApp"}</span>
                <span className="booking-btn-arrow" aria-hidden="true">→</span>
              </button>

              <div className="booking-guarantee-note">
                <span><img src="/img/iconos/biblioteca/icono-candado.webp" alt="" width={18} height={18} className="icono-3d booking-note-3d" aria-hidden="true" /> Confirmás con una seña por WhatsApp · Pago rápido</span>
              </div>
            </form>
          </div>
        </MaybePortal>
      )}

      {confirmed && (
        <>
          <div className="booking-confirm-form">
            <svg
              className="confirm-check-icon"
              viewBox="0 0 52 52"
              width="40"
              height="40"
              aria-hidden="true"
            >
              <circle
                className="confirm-check-circle"
                cx="26"
                cy="26"
                r="24"
                fill="none"
              />
              <path
                className="confirm-check-mark"
                fill="none"
                d="M14 27l7 7 16-16"
              />
            </svg>
            <p className="booking-confirm-summary">
              ¡Turno reservado! Código <strong>{confirmed.bookingCode}</strong>.
            </p>
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 10,
              }}
            >
              <a
                href={confirmed.whatsappUrl}
                target="_blank"
                rel="noopener"
                className="btn btn-whatsapp"
                style={{ flex: 1, justifyContent: "center", gap: 8 }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                Abrir WhatsApp →
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmed({ ...confirmed, showModal: true })}
              >
                Ver pase digital y seña
              </button>
            </div>
          </div>

          <BookingPassModal
            bookingCode={confirmed.bookingCode}
            booking={confirmed.booking}
            whatsappUrl={confirmed.whatsappUrl}
            onClose={() => {
              setConfirmed(null);
              // Le avisa al cartel "Instalar app" que ya hubo una reserva.
              window.dispatchEvent(new Event("muzzaga:booked"));
            }}
            mpEnabled={mpEnabled}
            payment={payment}
          />
        </>
      )}
    </div>
  );
}
