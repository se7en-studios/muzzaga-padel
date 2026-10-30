"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize, Minimize, Users, Volume2, VolumeX } from "lucide-react";
import {
  adminGetClubConfig,
  checkAdminSession,
  getAdminDayData,
} from "../actions";
import {
  COURTS,
  isoAddDays,
  nowInClubTimezone,
  todayInClub,
} from "../../../lib/booking";
import { getClubTimeString } from "../../../data/horarios";
import { isExpiredSessionError } from "../adminHelpers";
import { courtSchedule, liveAndNext, toMinutes } from "./schedule";
import { isMonitorDemo, monitorDemoData } from "./demo";
import "./monitor.css";

const REFRESH_MS = 30000;
const STALE_AFTER_MIN = 2;
// Después de esta hora ya no queda nada de ayer en pista.
const LATE_NIGHT_UNTIL = "06:00";
const WARN_MIN = 5;
const UPCOMING_MAX = 3;

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

export default function MonitorPage() {
  const [authorized, setAuthorized] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [dayData, setDayData] = useState(null);
  const [yesterdayBookings, setYesterdayBookings] = useState([]);
  const [slotDuration, setSlotDuration] = useState(null);
  const [loadError, setLoadError] = useState(null); // null | "expired" | "offline"
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentTime, setCurrentTime] = useState("");
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
    const tick = () => setCurrentTime(getClubTimeString());
    tick();
    const id = setInterval(tick, 1000);
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
      setLastUpdated(Date.now());
      return;
    }
    adminGetClubConfig().then((res) => {
      if (res.ok) setSlotDuration(res.config.slotDurationMin);
    });
    loadData();
    const id = setInterval(loadData, REFRESH_MS);
    return () => clearInterval(id);
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
    const upcoming = schedule
      .filter((x) => x.start > currentMinutes)
      .slice(0, UPCOMING_MAX);
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
    "Cantina abierta: pizzas, empanadas y bebidas frías",
    "Preguntá en recepción por los próximos torneos",
    "Reservá tu turno online en muzzagapadel.com",
  ];

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

          <div className="mon-clock" aria-label="Hora del club">
            {(currentTime || now.hhmm).replace(" hs", "")}
            <small>hs</small>
          </div>

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
          const elapsed = live ? Math.max(0, currentMinutes - live.start) : 0;
          const total = live ? Math.max(1, live.end - live.start) : 1;
          const progress = Math.min(100, Math.round((elapsed / total) * 100));
          const ending = match && remaining <= WARN_MIN;
          const nextUp = upcoming[0];

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

                <div className="mon-pista-centro">
                  {match ? (
                    <>
                      <div className="mon-player">{match.playerName}</div>
                      <div className="mon-count">
                        <strong>{remaining}</strong>
                        <span>
                          {remaining === 1 ? "minuto" : "minutos"}
                          <br />
                          {remaining === 1 ? "restante" : "restantes"}
                        </span>
                      </div>
                      <div className="mon-slot">
                        {match.startTime} a {match.endTime} hs
                        <span aria-hidden="true">·</span>
                        <Users size={16} aria-hidden="true" />
                        {match.playersCount || 4} jugadores
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mon-free">Libre</div>
                      <div className="mon-slot">
                        {nextUp
                          ? `Próximo turno ${nextUp.booking.startTime} hs · ${inLabel(nextUp.start - currentMinutes)}`
                          : "Sin más reservas hoy"}
                      </div>
                    </>
                  )}
                </div>

                {match && (
                  <div className="mon-progress">
                    <div className="mon-progress-meta">
                      <span>
                        {elapsed} de {total} min jugados
                      </span>
                      <strong>{progress}%</strong>
                    </div>
                    <div className="mon-progress-track">
                      <div
                        className="mon-progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mon-next">
                <span className="mon-next-label">A continuación</span>
                {upcoming.length ? (
                  <ol>
                    {upcoming.map(({ booking, start }) => (
                      <li key={`${booking.id}-${booking.date}`}>
                        <span className="mon-next-time">{booking.startTime}</span>
                        <span className="mon-next-name">{booking.playerName}</span>
                        <span className="mon-next-in">
                          {inLabel(start - currentMinutes)}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mon-next-empty">Sin más reservas hoy</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

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
