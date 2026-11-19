"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Maximize,
  Minimize,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import Mascota from "../../../components/Mascota";
import {
  adminGetClubConfig,
  adminGetCantinaMenu,
  checkAdminSession,
  getAdminDayData,
} from "../actions";
import {
  COURTS,
  isoAddDays,
  nowInClubTimezone,
  todayInClub,
  JORNADA_CUTOFF,
} from "../../../lib/booking";
import { getClubTimeString } from "../../../data/horarios";
import { featuredItems, normalizeMenu } from "../../../lib/cantinaMenu";
import { formatARS } from "../../../lib/format";
import { isExpiredSessionError } from "../adminHelpers";
import { courtSchedule, liveAndNext, toMinutes } from "./schedule";
import { isMonitorDemo, monitorDemoData } from "./demo";
import "./monitor.css";

const REFRESH_MS = 30000;
const MENU_REFRESH_MS = 10 * 60 * 1000;
// Los minutos restantes cambian de a uno: no hace falta redibujar la pantalla
// entera cada segundo (en un stick de TV se nota). El reloj va aparte.
const NOW_TICK_MS = 10000;
const STALE_AFTER_MIN = 2;
// Después de esta hora ya no queda nada de ayer en pista.
const LATE_NIGHT_UNTIL = JORNADA_CUTOFF;
const WARN_MIN = 5;
const LATER_MAX = 2;
const CANTINA_MAX = 6;
// Anillo de la cuenta regresiva (viewBox 0 0 120 120).
const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

function playTurnChime(freq = 587.33) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  } catch {
    // El navegador puede bloquear el audio sin interacción previa.
  }
}

function timerTone(remaining) {
  if (remaining <= 10) return "#ef4444";
  if (remaining <= 20) return "#f59e0b";
  return "#22c55e";
}

/** "en 40 min", "en 2 h", "en 1 h 15". */
function inLabel(minutes) {
  if (minutes < 60) return `en ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `en ${h} h ${String(m).padStart(2, "0")}` : `en ${h} h`;
}

/** El único pedazo de la pantalla que cambia cada segundo. */
function MonitorClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(getClubTimeString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mon-clock" aria-label="Hora del club">
      {(time || nowInClubTimezone().hhmm).replace(" hs", "")}
      <small>hs</small>
    </div>
  );
}

export default function MonitorPage() {
  const [authorized, setAuthorized] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [dayData, setDayData] = useState(null);
  const [yesterdayBookings, setYesterdayBookings] = useState([]);
  const [slotDuration, setSlotDuration] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loadError, setLoadError] = useState(null); // null | "expired" | "offline"
  const [lastUpdated, setLastUpdated] = useState(null);
  const [, setNowTick] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [demo, setDemo] = useState(false);
  const firedChimes = useRef(new Set());

  useEffect(() => {
    if (isMonitorDemo()) {
      setDemo(true);
      setAuthorized(true);
      setSessionChecked(true);
      return;
    }
    checkAdminSession().then((res) => {
      setAuthorized(res.ok);
      setSessionChecked(true);
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!authorized) return;
    if (demo) {
      setSlotDuration(90);
      setDayData(monitorDemoData());
      setMenuItems(normalizeMenu(null).items);
      setLastUpdated(Date.now());
      return;
    }
    adminGetClubConfig().then((res) => {
      if (res.ok) setSlotDuration(res.config.slotDurationMin);
    });
    const loadMenu = () =>
      adminGetCantinaMenu()
        .then((res) => {
          if (res.ok) setMenuItems(res.menu.items);
        })
        .catch(() => {});
    loadMenu();
    loadData();
    const id = setInterval(loadData, REFRESH_MS);
    const menuId = setInterval(loadMenu, MENU_REFRESH_MS);
    return () => {
      clearInterval(id);
      clearInterval(menuId);
    };
  }, [authorized, demo]);

  async function loadData() {
    const today = todayInClub();
    const isLateNight = nowInClubTimezone().hhmm < LATE_NIGHT_UNTIL;
    try {
      const [res, prev] = await Promise.all([
        getAdminDayData(today),
        isLateNight ? getAdminDayData(isoAddDays(today, -1)) : null,
      ]);
      if (!res.ok) {
        setLoadError(isExpiredSessionError(res) ? "expired" : "offline");
        return;
      }
      setDayData(res);
      setYesterdayBookings(prev?.ok ? prev.bookings : []);
      setLoadError(null);
      setLastUpdated(Date.now());
    } catch {
      setLoadError("offline");
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  const now = nowInClubTimezone();
  const currentMinutes = toMinutes(now.hhmm);
  const courts = dayData?.courts || COURTS;
  const schedules = courts.map((court) => {
    const schedule = courtSchedule(
      court.id,
      dayData?.bookings,
      yesterdayBookings,
    );
    const upcoming = schedule.filter((x) => x.start > currentMinutes);
    return {
      court,
      schedule,
      upcoming,
      ...liveAndNext(schedule, currentMinutes),
    };
  });

  // Aviso sonoro a 5 min del final y al terminar, una vez por turno. Se
  // marcan aunque el sonido esté apagado para que al prenderlo no suenen
  // avisos viejos de golpe.
  useEffect(() => {
    schedules.forEach(({ schedule }) =>
      schedule.forEach(({ booking, end }) => {
        const remaining = end - currentMinutes;
        const key = `${booking.id}-${booking.date}`;
        if (
          remaining > 0 &&
          remaining <= WARN_MIN &&
          !firedChimes.current.has(`${key}-warn`)
        ) {
          firedChimes.current.add(`${key}-warn`);
          if (soundEnabled) playTurnChime(587.33);
        }
        if (
          remaining <= 0 &&
          remaining > -2 &&
          !firedChimes.current.has(`${key}-end`)
        ) {
          firedChimes.current.add(`${key}-end`);
          if (soundEnabled) {
            playTurnChime(880);
            setTimeout(() => playTurnChime(659.25), 350);
          }
        }
      }),
    );
  }, [currentMinutes, dayData, yesterdayBookings, soundEnabled]);

  if (!sessionChecked) {
    return (
      <div className="mon-center">
        <img src="/img/logo_badge.png" alt="" className="mon-center-logo" />
        <p>Verificando sesión…</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="mon-center">
        <img src="/img/logo_badge.png" alt="" className="mon-center-logo" />
        <h2>Acceso restringido</h2>
        <p>
          Iniciá sesión en el panel de administración antes de abrir el monitor
          de recepción.
        </p>
        <Link href="/admin" className="mon-cta">
          Ir al login del admin →
        </Link>
      </div>
    );
  }

  const minutesSinceUpdate = lastUpdated
    ? Math.floor((Date.now() - lastUpdated) / 60000)
    : null;
  const isStale =
    minutesSinceUpdate != null && minutesSinceUpdate >= STALE_AFTER_MIN;
  const tickerItems = [
    slotDuration
      ? `Cada turno dura ${slotDuration} minutos: terminá a horario para que el siguiente arranque puntual`
      : "Terminá a horario para que el turno siguiente arranque puntual",
    "Preguntá en recepción por los próximos torneos",
    "Hacé el test de nivel y sumate a partidos parejos de tu categoría",
    "Reservá tu turno online en muzzagapadel.com",
  ];
  const destacados = featuredItems(menuItems);
  const cantina = (destacados.length ? destacados : menuItems).slice(
    0,
    CANTINA_MAX,
  );

  return (
    <div className="mon-root">
      {loadError === "expired" && (
        <div className="mon-overlay" role="alert">
          <h2>Sesión vencida</h2>
          <p>Los datos de esta pantalla dejaron de actualizarse.</p>
          <p>Volvé a ingresar al panel para reactivar el monitor.</p>
          <Link href="/admin" className="mon-cta">
            Ir al panel →
          </Link>
        </div>
      )}

      <header className="mon-header">
        <div className="mon-brand">
          <img src="/img/logo_badge.png" alt="Muzzaga" />
          <div>
            <span className="mon-kicker">Muzzaga Pádel · Recepción</span>
            <h1>Monitor de pistas</h1>
          </div>
        </div>

        <div className="mon-tools">
          {loadError === "offline" ? (
            <span className="mon-status is-error" role="status">
              Sin conexión · reintentando
              {minutesSinceUpdate != null &&
                ` · datos de hace ${minutesSinceUpdate} min`}
            </span>
          ) : (
            lastUpdated && (
              <span
                className={`mon-status${isStale ? " is-stale" : ""}`}
                role="status"
              >
                <span className="mon-status-dot" aria-hidden="true" />
                {demo
                  ? "Demo"
                  : minutesSinceUpdate === 0
                    ? "En vivo"
                    : `Actualizado hace ${minutesSinceUpdate} min`}
              </span>
            )
          )}

          <MonitorClock />

          <div className="mon-btns">
            <button
              type="button"
              className={`mon-btn${soundEnabled ? " is-on" : ""}`}
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playTurnChime(659.25);
              }}
              aria-pressed={soundEnabled}
              title="Aviso sonoro cuando faltan 5 min y al terminar cada turno"
            >
              {soundEnabled ? (
                <Volume2 size={18} aria-hidden="true" />
              ) : (
                <VolumeX size={18} aria-hidden="true" />
              )}
              {soundEnabled ? "Sonido" : "Sin sonido"}
            </button>

            <button
              type="button"
              className="mon-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? (
                <Minimize size={18} aria-hidden="true" />
              ) : (
                <Maximize size={18} aria-hidden="true" />
              )}
              {isFullscreen ? "Salir" : "Pantalla completa"}
            </button>

            <Link href="/admin" className="mon-btn mon-back">
              <ArrowLeft size={18} aria-hidden="true" />
              Admin
            </Link>
          </div>
        </div>
      </header>

      <div className="mon-grid">
        {schedules.map(({ court, live, upcoming }) => {
          const match = live?.booking;
          const remaining = live ? Math.max(0, live.end - currentMinutes) : 0;
          const total = live ? Math.max(1, live.end - live.start) : 1;
          const left = Math.min(1, remaining / total);
          const ending = match && remaining <= WARN_MIN;
          const nextUp = upcoming[0];
          const later = upcoming.slice(1, 1 + LATER_MAX);
          const players = Math.min(8, Math.max(1, Number(match?.playersCount) || 4));

          return (
            <section
              key={court.id}
              className={`mon-court${match ? " is-live" : ""}${ending ? " is-ending" : ""}`}
              style={match ? { "--tone": timerTone(remaining) } : undefined}
            >
              <div className="mon-court-head">
                <div>
                  <h2>{court.name}</h2>
                  {court.type && <span>Pista de {court.type.toLowerCase()}</span>}
                </div>
                <div className={`mon-pill${match ? " is-live" : ""}`}>
                  {!match ? "Libre" : ending ? "Termina ya" : "En juego"}
                </div>
              </div>

              {/* La cancha vista desde arriba, como en Instalaciones. */}
              <div className="mon-pista">
                <div className="mon-pista-piso" aria-hidden="true">
                  <div className="mon-pista-lineas" />
                </div>

                {/* Rincón: quién entra después a esta cancha. */}
                <aside className="mon-corner" aria-label="Próximo turno">
                  <span className="mon-corner-label">Próximo turno</span>
                  {nextUp ? (
                    <>
                      <span className="mon-corner-time">
                        {nextUp.booking.startTime}
                        <small>{inLabel(nextUp.start - currentMinutes)}</small>
                      </span>
                      <span className="mon-corner-name">
                        {nextUp.booking.playerName}
                      </span>
                    </>
                  ) : (
                    <span className="mon-corner-name is-empty">
                      Sin más reservas hoy
                    </span>
                  )}
                </aside>

                <div className="mon-pista-centro">
                  {match ? (
                    <>
                      <div className="mon-who">
                        <span className="mon-who-label">Reservó</span>
                        <div className="mon-player">{match.playerName}</div>
                        <div
                          className="mon-players"
                          aria-label={`${players} jugadores`}
                        >
                          {Array.from({ length: players }, (_, i) => (
                            <User key={i} size={22} aria-hidden="true" />
                          ))}
                          <span>{players} jugando</span>
                        </div>
                        <div className="mon-slot">
                          <Clock3 size={18} aria-hidden="true" />
                          {match.startTime} a {match.endTime} hs
                        </div>
                      </div>

                      <div className="mon-ring">
                        <svg viewBox="0 0 120 120" aria-hidden="true">
                          <circle className="mon-ring-track" cx="60" cy="60" r={RING_R} />
                          <circle
                            className="mon-ring-fill"
                            cx="60"
                            cy="60"
                            r={RING_R}
                            strokeDasharray={RING_C}
                            strokeDashoffset={RING_C * (1 - left)}
                          />
                        </svg>
                        <div className="mon-ring-num">
                          <strong>{remaining}</strong>
                          <span>{remaining === 1 ? "min restante" : "min restantes"}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mon-free">Libre</div>
                      <div className="mon-slot">
                        {nextUp
                          ? `Disponible hasta las ${nextUp.booking.startTime} hs`
                          : "Disponible el resto del día"}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mon-later">
                <span className="mon-later-label">Más tarde</span>
                {later.length ? (
                  later.map(({ booking }) => (
                    <span key={`${booking.id}-${booking.date}`} className="mon-later-item">
                      <strong>{booking.startTime}</strong>
                      {booking.playerName}
                    </span>
                  ))
                ) : (
                  <span className="mon-later-item is-empty">Nada más por hoy</span>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {cantina.length > 0 && (
        <section className="mon-cantina" aria-label="Cantina">
          <div className="mon-cantina-head">
            <Mascota pose="pizza-cerveza" size="s" alt="" className="mon-cantina-mascota" />
            <div>
              <span className="mon-kicker">Tercer tiempo</span>
              <h2>En la cantina</h2>
              <p>Pedí en la barra</p>
            </div>
          </div>
          <ul className="mon-cantina-items">
            {cantina.map((item) => (
              <li key={item.id}>
                <span className="mon-cantina-name">{item.name}</span>
                <strong className="mon-cantina-price">{formatARS(item.price)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tira de la marca, como la de la home: mensajes con pelotas entre medio. */}
      <div className="mon-ticker">
        <div className="mon-ticker-tag">Muzzaga TV</div>
        <div className="mon-ticker-window">
          <div className="mon-ticker-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="mon-ticker-group" aria-hidden={copy === 1}>
                {tickerItems.map((item) => (
                  <span key={item} className="mon-ticker-item">
                    <span className="mon-ticker-ball" aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
