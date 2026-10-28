"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ExternalLink,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Search,
  Tv,
} from "lucide-react";
import {
  adminAddPayment,
  adminCancelBooking,
  adminCancelRecurringSeries,
  adminCreateManualBooking,
  adminCreateRecurringBookings,
  adminGetAlerts,
  adminGetClients,
  adminGetClubConfig,
  adminSetTestFlag,
  adminGetWeekStats,
  adminLogout,
  adminRemovePayment,
  checkAdminSession,
  getAdminDayData,
  verifyAdminPassword,
} from "./actions";
import { nowInClubTimezone, todayInClub } from "../../lib/booking";
import { normalizeConfig } from "../../lib/clubConfig";
import { getClubStatus } from "../../data/horarios";
import { formatARS, formatDate, formatPct, formatTime } from "../../lib/format";
import { IconAlert, IconPlus, isExpiredSessionError } from "./adminHelpers";
import AgendaView from "./views/AgendaView";
import ClientesView from "./views/ClientesView";
import CalendarioView from "./views/CalendarioView";
import ReportesView from "./views/ReportesView";
import CantinaView from "./views/CantinaView";
import TorneosView from "./views/TorneosView";
import CajaView from "./views/CajaView";
import ConfiguracionView from "./views/ConfiguracionView";
import CreateBookingModal from "./CreateBookingModal";
import BookingDetailModal from "./BookingDetailModal";
import StaffPinModal from "./ui/StaffPinModal";
import { usePinGate } from "./ui/usePinGate";
import { ICON_PROPS, NAV_GROUPS, NAV_ITEMS, findNavItem } from "./nav";
import { Toaster, useToasts } from "./ui/Toaster";
import CommandPalette from "./ui/CommandPalette";
import MobileNav from "./ui/MobileNav";

const CLUB_PILL_CLASS = {
  abierto: "is-open",
  "cierra-pronto": "is-closing",
  cerrado: "is-closed",
  bloqueado: "is-closed",
};

/** El foco está en un campo editable: los atajos de una letra no aplican. */
function isTypingTarget(el) {
  return Boolean(
    el &&
    (el.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)),
  );
}

function greetingWord() {
  const h = Number(nowInClubTimezone().hhmm.slice(0, 2));
  if (h < 6) return "Buenas noches";
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

// Pasado este tiempo sin respuesta se ofrece reintentar (la verificación
// normal tarda menos de medio segundo).
const SESSION_SLOW_MS = 8000;

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  // "slow" | "error" cuando la verificación no vuelve: sin esto la pantalla
  // quedaba en "Verificando sesión…" para siempre ante un corte de red.
  const [sessionProblem, setSessionProblem] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const { ask: askPin, pinModal } = usePinGate();
  const [cancelSeriesTarget, setCancelSeriesTarget] = useState(null);

  // Vista activa del sidebar
  const [view, setView] = useState("agenda");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Dashboard Data State (Agenda)
  const [activeDate, setActiveDate] = useState(todayInClub);
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modal de creación de turno
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    courtId: "cancha-1",
    startTime: "18:30",
    playerName: "",
    playerPhone: "",
    playersCount: 4,
    fullCourt: true,
    status: "confirmado",
    notes: "",
    isRecurring: false,
    recurringWeeks: 8,
  });
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Clientes (derivados de reservas), compartido con el autocompletar del
  // modal de creación.
  const [clients, setClients] = useState([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  // Tendencia de los últimos 7 días (KPIs con flecha hoy-vs-ayer + gráfico)
  const [weekStats, setWeekStats] = useState(null);
  const [nowLabel, setNowLabel] = useState("");

  // Configuración del club (canchas, horarios, precios, seña, días
  // bloqueados). Arranca con los defaults hasta que responde el server.
  const [clubConfig, setClubConfig] = useState(() => normalizeConfig({}));
  const [isOnline, setIsOnline] = useState(true);

  // Detalle de turno: cobros parciales, saldo pendiente, cancelar
  const [detailBooking, setDetailBooking] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    method: "efectivo",
    amount: "",
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const { toasts, show: showToast, dismiss: dismissToast } = useToasts();
  // Alertas de la campana (pedidos de la carta esperando pago, caja sin
  // cerrar, saldos…): se piden cada 30 s mientras el panel está abierto.
  const [alerts, setAlerts] = useState([]);
  const webOrdersSeen = useRef(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  // Búsqueda que llega desde el command palette a Clientes. La key fuerza a
  // la vista a arrancar con esa búsqueda aunque ya estuviera montada.
  const [clientesSearch, setClientesSearch] = useState({ query: "", key: 0 });

  // La sesión vive en una cookie httpOnly firmada: el cliente no puede leerla
  // ni falsearla, así que le preguntamos al servidor si sigue vigente.
  useEffect(() => {
    let cancelled = false;
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSessionProblem((p) => p || "slow");
    }, SESSION_SLOW_MS);
    checkAdminSession()
      .then((res) => {
        if (cancelled) return;
        setIsAuthenticated(res.ok);
        setSessionChecked(true);
      })
      .catch(() => {
        if (!cancelled) setSessionProblem("error");
      })
      .finally(() => clearTimeout(slowTimer));
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    async function refreshAlerts() {
      const res = await adminGetAlerts();
      if (cancelled || !res?.ok) return;
      setAlerts(res.alerts);
      // Pedido nuevo de la carta: aviso aunque se esté en otra vista.
      const count = res.alerts.find((a) => a.id === "web-orders")?.count || 0;
      if (webOrdersSeen.current !== null && count > webOrdersSeen.current) {
        showToast(
          "Entró un pedido de la carta: se cobra antes de pasar a la cocina.",
          {
            duration: 10000,
            action: { label: "Ver", onClick: () => navigate("cantina") },
          },
        );
      }
      webOrdersSeen.current = count;
    }
    refreshAlerts();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshAlerts();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadDayData(activeDate);
  }, [isAuthenticated, activeDate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadClients();
    loadWeekStats();
    adminGetClubConfig().then((res) => {
      if (res.ok) setClubConfig(res.config);
    });
  }, [isAuthenticated]);

  // Solo se avisa cuando se PIERDE la conexión: si todo anda, no hay badge.
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Reloj del saludo del header: se actualiza solo, no hace falta refrescar
  // la página para que dejen de mostrar la hora con la que se logueó el admin.
  useEffect(() => {
    if (!isAuthenticated) return;
    const update = () => setNowLabel(formatTime());
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  // Atajos: Ctrl/⌘+K abre el buscador, N abre "Nueva reserva".
  useEffect(() => {
    if (!isAuthenticated) return;
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsPaletteOpen((open) => !open);
        return;
      }
      if (e.key === "Escape" && !isPaletteOpen) {
        if (detailBooking) setDetailBooking(null);
        else if (isModalOpen) setIsModalOpen(false);
        return;
      }
      const isBusy = isModalOpen || isPaletteOpen || detailBooking;
      if (
        e.key.toLowerCase() === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isBusy &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        openCreateModal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAuthenticated, isModalOpen, isPaletteOpen, detailBooking]);

  // Si el modal de detalle está abierto y llega dayData nuevo (por ej. tras
  // registrar un cobro), lo refrescamos para que el saldo no quede viejo.
  useEffect(() => {
    if (!detailBooking || !dayData) return;
    const fresh = dayData.bookings.find((b) => b.id === detailBooking.id);
    if (fresh) setDetailBooking(fresh);
  }, [dayData]);

  /**
   * Si la cookie venció mientras el panel estaba abierto, los actions
   * devuelven el error de sesión: en ese caso volvemos al login en vez de
   * dejar la pantalla con datos viejos y botones que no hacen nada. Se pasa
   * como prop a las vistas independientes (Calendario/Reportes/Cantina/
   * Torneos) para que también puedan reaccionar a una sesión caída.
   * @returns {boolean} true si la sesión se cayó y ya se manejó.
   */
  function handleExpiredSession(res) {
    if (res?.ok || !isExpiredSessionError(res)) return false;
    setIsAuthenticated(false);
    setDayData(null);
    setAuthError(res.error);
    return true;
  }

  async function loadDayData(date) {
    setLoading(true);
    const res = await getAdminDayData(date);
    setLoading(false);
    if (res.ok) {
      setDayData(res);
    } else if (!handleExpiredSession(res)) {
      showToast(res.error || "No se pudieron cargar los datos del día.", {
        tone: "error",
      });
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    const res = await verifyAdminPassword(pinInput);
    setAuthLoading(false);
    if (res.ok) {
      // La cookie de sesión ya vino en la respuesta del server action.
      setIsAuthenticated(true);
      setPinInput("");
    } else {
      setAuthError(res.error || "Contraseña incorrecta");
    }
  }

  async function handleLogout() {
    await adminLogout();
    setIsAuthenticated(false);
    setDayData(null);
    setPinInput("");
  }

  function showError(res, fallback) {
    if (!handleExpiredSession(res)) {
      showToast(res?.error || fallback, { tone: "error" });
    }
  }

  function refreshMoney() {
    loadDayData(activeDate);
    loadWeekStats();
  }

  function handleCancel(bookingId, courtId, startTime) {
    setCancelTarget({ bookingId, courtId, startTime });
  }

  function handleCancelSeries(recurringId, playerName) {
    setCancelSeriesTarget({ recurringId, playerName });
  }

  async function loadClients() {
    const res = await adminGetClients();
    if (res.ok) {
      setClients(res.clients || []);
      setClientsLoaded(true);
    }
  }

  async function loadWeekStats() {
    const res = await adminGetWeekStats();
    if (res.ok) setWeekStats(res.days);
  }

  async function handleToggleTest(booking) {
    const res = await askPin(
      {
        title: booking.isTest ? "Volver a contar el turno" : "Marcar como prueba",
        description:
          "Marcar un turno como prueba lo saca de los totales. Lo autoriza un Administrador o Encargado.",
      },
      ({ pin }) => adminSetTestFlag("bookings", booking.id, !booking.isTest, pin),
    );
    if (!res) return;
    refreshMoney();
    loadClients();
    showToast(
      booking.isTest
        ? "El turno vuelve a contar como real"
        : "Marcado como dato de prueba · ya no suma en totales",
    );
  }

  function openDetail(booking) {
    setPaymentForm({ method: "efectivo", amount: "" });
    setDetailBooking(booking);
  }

  /**
   * Registra un cobro. Sin `direct` usa el formulario ("otro monto"); con
   * `direct` es el cobro de un toque del detalle ({ method, amount }).
   */
  async function handleAddPayment(e, direct) {
    e?.preventDefault();
    if (!detailBooking) return;
    const method = direct?.method ?? paymentForm.method;
    const amount = direct?.amount ?? paymentForm.amount;
    setPaymentSubmitting(true);
    const res = await adminAddPayment(detailBooking.id, method, amount);
    setPaymentSubmitting(false);
    if (!res.ok) return showError(res, "No se pudo registrar el cobro.");
    const bookingId = detailBooking.id;
    setPaymentForm({ method, amount: "" });
    refreshMoney();
    showToast(`Cobro registrado · ${formatARS(amount)}`, {
      action: {
        label: "Deshacer",
        onClick: async () => {
          const undo = await adminRemovePayment(bookingId, res.paymentId);
          if (!undo.ok) return showError(undo, "No se pudo deshacer el cobro.");
          refreshMoney();
          showToast("Cobro deshecho");
        },
      },
    });
  }

  async function handleRemovePayment(paymentId) {
    if (!detailBooking) return;
    const bookingId = detailBooking.id;
    const res = await askPin(
      {
        title: "Eliminar cobro",
        description: "Ingresá tu PIN para eliminar este cobro. Queda registrado a tu nombre.",
        confirmButtonText: "Eliminar cobro",
        confirmButtonTone: "danger",
      },
      ({ pin }) => adminRemovePayment(bookingId, paymentId, pin),
    );
    if (!res) return;
    refreshMoney();
    showToast("Cobro eliminado");
  }

  function openCreateModal(courtId, startTime) {
    // Sin horario elegido, se propone el primer turno libre del día.
    const firstFree = dayData?.slots?.find((s) => !s.isTaken);
    setModalForm({
      courtId: courtId || firstFree?.courtId || clubConfig.courts[0]?.id,
      startTime: startTime || firstFree?.start || "",
      playerName: "",
      playerPhone: "",
      playersCount: 4,
      fullCourt: true,
      status: "confirmado",
      notes: "",
      isRecurring: false,
      recurringWeeks: 8,
    });
    setIsModalOpen(true);
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setModalSubmitting(true);
    const { isRecurring, recurringWeeks, ...bookingFields } = modalForm;
    // El fin del turno lo calcula el server según la duración configurada.
    const res = isRecurring
      ? await adminCreateRecurringBookings({
          date: activeDate,
          weeks: recurringWeeks,
          ...bookingFields,
        })
      : await adminCreateManualBooking({ date: activeDate, ...bookingFields });
    setModalSubmitting(false);
    if (!res.ok) return showError(res, "No se pudo crear la reserva.");
    setIsModalOpen(false);
    refreshMoney();
    loadClients();
    if (isRecurring) {
      const n = res.skipped?.length || 0;
      showToast(
        `Turno fijo creado · ${res.created.length} semana${res.created.length === 1 ? "" : "s"} · ${modalForm.playerName.trim() || "Reserva manual"}` +
          (n
            ? ` · ${n} salteada${n === 1 ? "" : "s"} (día cerrado u ocupado)`
            : ""),
      );
    } else {
      showToast(
        `Reserva creada · ${modalForm.playerName.trim() || "Reserva manual"} · ${modalForm.startTime}`,
      );
    }
  }

  /** Autocompletar teléfono si el nombre tipeado coincide con un cliente ya cargado. */
  function handlePlayerNameBlur() {
    const typed = modalForm.playerName.trim().toLowerCase();
    if (!typed || modalForm.playerPhone) return;
    const match = clients.find((c) => c.name.toLowerCase() === typed);
    if (match?.phone) {
      setModalForm((f) => ({ ...f, playerPhone: match.phone }));
    }
  }

  function copyDaySchedule() {
    if (!dayData) return;
    let text = `📋 *PLANILLA DE TURNOS - MUZZAGA PÁDEL*\n`;
    text += `📅 *Fecha:* ${dayData.date}\n`;
    text += `🎾 *Ocupación:* ${dayData.stats.takenSlots}/${dayData.stats.totalSlots} turnos (${formatPct(dayData.stats.ocupacionPct)})\n\n`;

    dayData.courts.forEach((court) => {
      text += `🏟️ *${court.name.toUpperCase()} (${court.type}):*\n`;
      const courtSlots = dayData.slots.filter((s) => s.courtId === court.id);
      courtSlots.forEach((slot) => {
        if (slot.isTaken && slot.booking) {
          const b = slot.booking;
          const statusIcon =
            b.status === "pagado" ? "🟢" : b.status === "señado" ? "🟡" : "🔵";
          text += `  ${slot.start} hs: ${statusIcon} ${b.playerName} (${b.playersCount}p) - Tel: ${b.playerPhone || "N/D"}\n`;
        } else {
          text += `  ${slot.start} hs: ⚪ LIBRE\n`;
        }
      });
      text += `\n`;
    });

    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Planilla del día copiada para WhatsApp"))
      .catch(() =>
        showToast("No se pudo copiar la planilla.", { tone: "error" }),
      );
  }

  function navigate(id) {
    setView(id);
    window.scrollTo({ top: 0 });
  }

  function openClientFromPalette(client) {
    setClientesSearch((prev) => ({ query: client.name, key: prev.key + 1 }));
    navigate("clientes");
  }

  function handleSelectCalendarDate(date) {
    setActiveDate(date);
    setView("agenda");
  }

  const clubStatus = getClubStatus(new Date(), {
    blockedDates: clubConfig.blockedDates,
    schedule: clubConfig.schedule,
  });

  // Mientras el servidor confirma la cookie no mostramos nada: si no, al
  // admin ya logueado le parpadea el formulario en cada recarga.
  if (!sessionChecked) {
    return (
      <div className="admin-login-wrapper">
        {/* Con un problema va en la tarjeta del login: suelto, el texto gris
            casi no se lee sobre la foto de fondo. */}
        <div
          role="status"
          className={sessionProblem ? "admin-login-card" : undefined}
          style={{ textAlign: "center" }}
        >
          <p style={{ color: "var(--color-muted)", fontSize: 15.5 }}>
            {sessionProblem === "error"
              ? "No se pudo verificar la sesión."
              : "Verificando sesión…"}
          </p>
          {sessionProblem && (
            <>
              <p
                style={{
                  color: "var(--color-muted)",
                  fontSize: 14,
                  margin: "6px 0 14px",
                }}
              >
                {sessionProblem === "error"
                  ? "Revisá la conexión a internet y probá de nuevo."
                  : "Está tardando más de lo normal."}
              </p>
              {/* Recarga en vez de volver a llamar al action: Next corre los
                  server actions de a uno, y uno colgado deja en cola al resto. */}
              <button
                type="button"
                className="btn btn-linear-primary"
                onClick={() => window.location.reload()}
              >
                Reintentar
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  // Pensado como la "ficha del club" apoyada sobre la cancha: tira de grip
  // en la esquina, sticker de la marca y Muzzaguito asomándose. El fondo
  // (la cancha con paleta, pelotas y una porción de muzza) va en brand.css.
  if (!isAuthenticated) {
    return (
      <div className="admin-login-wrapper admin-login-marca">
        <div className="admin-login-col">
          <div className="admin-login-card">
            <span className="admin-login-grip" aria-hidden="true" />
            <span className="admin-login-sticker" aria-hidden="true">
              Más que
              <br />
              pádel
            </span>
            <img
              src="/img/mascotas/muzzaguito-lentes-paleta.webp"
              alt=""
              width={120}
              height={120}
              className="admin-login-peek"
            />

            <div className="admin-login-header">
              <img
                src="/img/logo_full_dark.png"
                alt="Muzzaga · más que pádel"
                width={1024}
                height={895}
                className="admin-login-logo"
              />
              <span className="admin-login-kicker">
                Solo para el equipo del club
              </span>
              <h1 className="admin-login-title">Panel del club</h1>
              <p className="admin-login-sub">
                Ingresá con la contraseña del club para continuar.
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <label htmlFor="admin-pin" className="admin-login-label">
                Contraseña
              </label>
              <input
                id="admin-pin"
                type="password"
                className="admin-input-field admin-login-input"
                placeholder="Escribí la contraseña del club"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
              />

              {authError && <div className="admin-error-text">{authError}</div>}

              <button
                type="submit"
                className="btn btn-linear-primary admin-login-submit"
                disabled={authLoading}
              >
                {authLoading ? "Entrando…" : "Entrar"}
                {!authLoading && <span aria-hidden="true">→</span>}
              </button>
            </form>
          </div>

          <Link href="/" className="admin-login-back">
            ← Volver a la web del club
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-layout">
      <div className="admin-shell">
        {/* SIDEBAR ESTILO KRAVIO */}
        <aside
          className={`admin-sidebar${sidebarCollapsed ? " collapsed" : ""}`}
        >
          <div className="admin-sidebar-brand">
            <Link href="/admin" className="admin-sidebar-brand-inner">
              {sidebarCollapsed ? (
                <img
                  src="/img/logo_badge.png"
                  alt="Muzzaga Pádel"
                  width={36}
                  height={36}
                  className="admin-sidebar-badge"
                />
              ) : (
                <img
                  src="/img/logo_full.png"
                  alt="Muzzaga · más que pádel"
                  width={1024}
                  height={895}
                  className="admin-sidebar-logo"
                />
              )}
            </Link>
            <button
              type="button"
              className="admin-sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={
                sidebarCollapsed
                  ? "Expandir barra lateral"
                  : "Colapsar barra lateral"
              }
              aria-label={
                sidebarCollapsed
                  ? "Expandir barra lateral"
                  : "Colapsar barra lateral"
              }
            >
              {sidebarCollapsed ? (
                <PanelLeft size={16} />
              ) : (
                <PanelLeftClose size={16} />
              )}
            </button>
          </div>

          {!sidebarCollapsed && (
            <button
              type="button"
              className="admin-sidebar-search-btn"
              onClick={() => setIsPaletteOpen(true)}
              aria-label="Buscar en el panel (Ctrl + K)"
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Search size={14} />
                <span>Buscar cliente o sección</span>
              </span>

            </button>
          )}

          <nav className="admin-sidebar-nav">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="admin-sidebar-group">
                {!sidebarCollapsed && (
                  <p className="admin-sidebar-group-title">{group.title}</p>
                )}
                {group.items.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`admin-sidebar-link${view === id ? " active" : ""}`}
                    aria-current={view === id ? "page" : undefined}
                    onClick={() => navigate(id)}
                    title={sidebarCollapsed ? label : undefined}
                  >
                    <Icon {...ICON_PROPS} />
                    {!sidebarCollapsed && <span>{label}</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <Link
              href="/admin/monitor"
              target="_blank"
              className="admin-sidebar-link"
              title={sidebarCollapsed ? "Monitor TV Pistas" : undefined}
            >
              <Tv {...ICON_PROPS} />
              {!sidebarCollapsed && <span>Pantalla de la TV</span>}
            </Link>
            <Link
              href="/"
              target="_blank"
              className="admin-sidebar-link"
              title={sidebarCollapsed ? "Ver Web Pública" : undefined}
            >
              <ExternalLink {...ICON_PROPS} />
              {!sidebarCollapsed && <span>Ver la web del club</span>}
            </Link>

            <button
              type="button"
              className="admin-sidebar-link admin-sidebar-logout"
              onClick={handleLogout}
              title={sidebarCollapsed ? "Cerrar sesión" : undefined}
            >
              <LogOut {...ICON_PROPS} />
              {!sidebarCollapsed && <span>Cerrar sesión</span>}
            </button>
          </div>
        </aside>

        {/* CONTENIDO */}
        <main className="admin-main">
          <div className="admin-main-inner">
            {/* Kravio Top Breadcrumbs Bar */}
            <div className="admin-kravio-topbar">
              {/* En desktop la marca está en el sidebar; en mobile va acá. */}
              <div className="admin-topbar-brand">
                <img
                  src="/img/logo_badge.png"
                  alt=""
                  width={34}
                  height={34}
                />
                <span>
                  <strong>Muzzaga</strong>
                  <small>Panel del club</small>
                </span>
              </div>
              <div className="admin-kravio-top-tools">
                <button
                  type="button"
                  className="admin-top-icon-btn admin-top-alerts"
                  title="Avisos"
                  onClick={() => {
                    if (alerts.length === 0) {
                      showToast("No hay avisos. Todo en orden.");
                      return;
                    }
                    alerts.forEach((a) =>
                      showToast(`${a.title} · ${a.detail}`, {
                        tone: a.tone === "danger" ? "error" : "success",
                        duration: 8000,
                        action: a.view
                          ? { label: "Ver", onClick: () => navigate(a.view) }
                          : undefined,
                      }),
                    );
                  }}
                  aria-label={
                    alerts.length
                      ? `Avisos: ${alerts.length} pendiente${alerts.length === 1 ? "" : "s"}`
                      : "Avisos"
                  }
                >
                  <Bell size={18} />
                  <span>Avisos</span>
                  {alerts.length > 0 && (
                    <span className="admin-bell-badge" aria-hidden="true">
                      {alerts.length}
                    </span>
                  )}
                </button>
                <Link
                  href="/admin/monitor"
                  target="_blank"
                  className="admin-top-icon-btn admin-top-tv"
                  title="Abrir la pantalla de la TV del club"
                  aria-label="Pantalla de la TV"
                >
                  <Tv size={18} />
                </Link>
              </div>
            </div>

            <header className="admin-main-header">
              <div>
                {/* El saludo solo en Agenda; el resto muestra el título de la sección. */}
                <h1 className="admin-page-title">
                  {view === "agenda" ? (
                    <>
                      {greetingWord()}{" "}
                      <span className="admin-wave-hand" aria-hidden="true">
                        👋
                      </span>
                    </>
                  ) : (
                    findNavItem(view).label
                  )}
                </h1>
                <div className="admin-greeting-sub">
                  <span>
                    {formatDate(todayInClub(), "long")} · {nowLabel}
                  </span>
                  <span
                    className={`admin-live-pill ${CLUB_PILL_CLASS[clubStatus.state]}`}
                  >
                    {clubStatus.statusText}
                  </span>
                  {!isOnline ? (
                    <span className="admin-live-pill is-offline" role="status">
                      <IconAlert size={12} /> Sin conexión — lo que cargues
                      ahora no se va a guardar
                    </span>
                  ) : (
                    dayData?.firebaseOk === false && (
                      <span
                        className="admin-live-pill is-offline"
                        role="status"
                      >
                        <IconAlert size={12} /> No se pudo leer la base — los
                        datos pueden no estar actualizados
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className="admin-quick-actions">
                <button
                  type="button"
                  className="btn btn-secondary admin-palette-trigger"
                  onClick={() => setIsPaletteOpen(true)}
                  aria-label="Buscar (Ctrl + K)"
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Search {...ICON_PROPS} />
                    <span className="admin-palette-label">Buscar</span>
                  </span>
                  <kbd className="admin-kbd">Ctrl K</kbd>
                </button>
                {view === "agenda" && (
                  <button
                    type="button"
                    onClick={copyDaySchedule}
                    className="btn btn-secondary"
                    title="Copia la lista de turnos del día para pegarla en WhatsApp"
                  >
                    Copiar turnos del día
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openCreateModal()}
                  className="btn btn-linear-primary admin-cta-new"
                  title="Nueva reserva (N)"
                >
                  <IconPlus /> Nueva reserva
                </button>
              </div>
            </header>

            {view === "agenda" && (
              <AgendaView
                activeDate={activeDate}
                setActiveDate={setActiveDate}
                dayData={dayData}
                loading={loading}
                clubConfig={clubConfig}
                onRefresh={() => loadDayData(activeDate)}
                onOpenCreate={openCreateModal}
                onOpenDetail={openDetail}
              />
            )}
            {view === "calendario" && (
              <CalendarioView
                onSelectDate={handleSelectCalendarDate}
                onExpiredSession={handleExpiredSession}
              />
            )}
            {view === "clientes" && (
              <ClientesView
                key={clientesSearch.key}
                clients={clientsLoaded ? clients : null}
                initialSearch={clientesSearch.query}
                onToast={showToast}
                onReloadClients={loadClients}
              />
            )}
            {view === "caja" && (
              <CajaView
                initialDate={activeDate}
                onExpiredSession={handleExpiredSession}
                onToast={showToast}
              />
            )}
            {view === "cantina" && (
              <CantinaView
                onExpiredSession={handleExpiredSession}
                onToast={showToast}
              />
            )}
            {view === "torneos" && (
              <TorneosView
                onExpiredSession={handleExpiredSession}
                onToast={showToast}
              />
            )}
            {view === "reportes" && (
              <ReportesView onExpiredSession={handleExpiredSession} />
            )}
            {view === "configuracion" && (
              <ConfiguracionView
                onExpiredSession={handleExpiredSession}
                onToast={showToast}
                onSaved={(config) => {
                  setClubConfig(config);
                  loadDayData(activeDate);
                }}
              />
            )}
          </div>
        </main>
      </div>

      <MobileNav
        view={view}
        onNavigate={navigate}
        onNewBooking={() => openCreateModal()}
        onLogout={handleLogout}
      />

      {isPaletteOpen && (
        <CommandPalette
          clients={clients}
          onClose={() => setIsPaletteOpen(false)}
          onNavigate={navigate}
          onNewBooking={() => openCreateModal()}
          onOpenClient={openClientFromPalette}
        />
      )}

      <Toaster toasts={toasts} onDismiss={dismissToast} />

      {/* MODAL PARA CREAR RESERVA MANUAL O BLOQUEO */}
      {isModalOpen && (
        <CreateBookingModal
          activeDate={activeDate}
          clubConfig={clubConfig}
          modalForm={modalForm}
          setModalForm={setModalForm}
          modalSubmitting={modalSubmitting}
          clients={clients}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateSubmit}
          onPlayerNameBlur={handlePlayerNameBlur}
        />
      )}

      {/* MODAL DE DETALLE: cobros parciales, saldo pendiente, cancelar */}
      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          clubConfig={clubConfig}
          clients={clients}
          paymentForm={paymentForm}
          setPaymentForm={setPaymentForm}
          paymentSubmitting={paymentSubmitting}
          onClose={() => setDetailBooking(null)}
          onAddPayment={handleAddPayment}
          onRemovePayment={handleRemovePayment}
          onCancel={handleCancel}
          onCancelSeries={handleCancelSeries}
          onToggleTest={handleToggleTest}
          sales={dayData?.sales || []}
          onSalesChanged={refreshMoney}
          onToast={showToast}
          onDeletedBooking={() => {
            loadDayData(activeDate);
            loadClients();
            refreshMoney();
            setDetailBooking(null);
          }}
          onMoved={() => {
            loadDayData(activeDate);
            setDetailBooking(null);
          }}
        />
      )}

      {pinModal}

      {/* PIN de staff para cancelar un turno (libera el horario) */}
      {cancelTarget && (
        <StaffPinModal
          isOpen={Boolean(cancelTarget)}
          title="Cancelar Turno"
          description={`¿Confirmás que querés cancelar este turno de las ${cancelTarget.startTime} hs y liberar la cancha?`}
          confirmButtonText="Cancelar Turno"
          confirmButtonTone="danger"
          onClose={() => setCancelTarget(null)}
          onConfirm={async ({ pin, reason }) => {
            const res = await adminCancelBooking({
              bookingId: cancelTarget.bookingId,
              pin,
              reason,
            });
            if (res.ok) {
              const { startTime } = cancelTarget;
              setCancelTarget(null);
              refreshMoney();
              showToast(
                `Turno de las ${startTime} cancelado · horario liberado`,
              );
            } else {
              throw new Error(res.error || "No se pudo cancelar el turno.");
            }
          }}
        />
      )}

      {/* PIN de staff para cancelar toda la serie de un turno fijo */}
      {cancelSeriesTarget && (
        <StaffPinModal
          isOpen={Boolean(cancelSeriesTarget)}
          title="Cancelar Turno Fijo"
          description={`¿Confirmás cancelar todas las semanas futuras del turno fijo de ${cancelSeriesTarget.playerName}? Se liberan todos esos horarios.`}
          confirmButtonText="Cancelar Serie"
          confirmButtonTone="danger"
          onClose={() => setCancelSeriesTarget(null)}
          onConfirm={async ({ pin, reason }) => {
            const res = await adminCancelRecurringSeries({
              recurringId: cancelSeriesTarget.recurringId,
              pin,
              reason,
            });
            if (res.ok) {
              setCancelSeriesTarget(null);
              refreshMoney();
              setDetailBooking(null);
              const blockedNote = res.blocked?.length
                ? ` · ${res.blocked.length} con la caja ya cerrada, sin tocar`
                : "";
              showToast(
                `Turno fijo cancelado · ${res.cancelled} semana${res.cancelled === 1 ? "" : "s"}${blockedNote}`,
              );
            } else {
              throw new Error(res.error || "No se pudo cancelar la serie.");
            }
          }}
        />
      )}
    </div>
  );
}
