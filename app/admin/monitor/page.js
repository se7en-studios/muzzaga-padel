"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Info,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
} from "lucide-react";
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
import { formatARS, formatDate } from "../../../lib/format";
import { isExpiredSessionError } from "../adminHelpers";
import { courtSchedule, liveAndNext, toMinutes } from "./schedule";
import { isMonitorDemo, monitorDemoData } from "./demo";
import "./monitor.css";

// El dominio que se muestra en la tele para reservar (lo eligió el club).
const DOMINIO = "muzzagapadel.com";

const REFRESH_MS = 30000;
const MENU_REFRESH_MS = 10 * 60 * 1000;
// Los minutos restantes cambian de a uno: no hace falta redibujar la pantalla
// entera cada segundo (en un stick de TV se nota). El reloj va aparte.
const NOW_TICK_MS = 10000;
const STALE_AFTER_MIN = 2;
// Después de esta hora ya no queda nada de ayer en pista.
const LATE_NIGHT_UNTIL = JORNADA_CUTOFF;
const WARN_MIN = 5;
// Con Beelup al lado entran cuatro productos sin cortar los nombres.
const CANTINA_MAX = 4;
// Una cancha libre que arranca en menos de esto ya se anuncia como "próximo":
// la gente que llega mira la tele para saber si le toca.
const PROXIMO_MIN = 30;
// Un color por estado, el mismo en la tarjeta, el globo y el borde de la
// maqueta. Tiene que distinguirse a 4 metros: verde, rojo, naranja y blanco.
const ESTADOS = {
  juego: { label: "En juego", color: "#22c55e", ink: "#052e14" },
  termina: { label: "Termina ya", color: "#ef4444", ink: "#ffffff" },
  proximo: { label: "Próximo", color: "#e8722a", ink: "#1b1b19" },
  libre: { label: "Libre", color: "#f3f1e9", ink: "#1c42b8" },
};
// Así aparecen las canchas en Beelup (no siempre coincide con el panel).
const BEELUP_CANCHAS = "El Tano / La Vasca";
// La maqueta 3D del club (la del recorrido) con la cámara fija sobre las
// canchas. En modo monitor pinta el borde de cada cancha según su estado,
// avisa dónde cae cada una en pantalla y queda quieta después de armarse.
const SCENE_SRC =
  "/recorrido/index.html?embed=1&monitor=1&cam=212,40,52,2,-10&v=20261120";
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
/**
 * Avisos de a uno, cambiando cada 8 s con un fundido corto. Antes era una
 * cinta que se desplazaba sin parar: eso obligaba a la tele a redibujar la
 * pantalla entera (maqueta incluida) 60 veces por segundo y la trababa. Así
 * la pantalla queda quieta casi todo el tiempo.
 */
function TickerRotativo({ items }) {
  const list = items.length ? items : [""];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % list.length), 8000);
    return () => clearInterval(id);
  }, [list.length]);
  const item = list[i % list.length];
  return (
    <div className="mon-ticker-window" aria-live="off">
      <span key={item} className="mon-ticker-item mon-ticker-rot">
        <span className="mon-ticker-ball" aria-hidden="true" />
        {item}
      </span>
      {list.length > 1 && (
        <span className="mon-ticker-count" aria-hidden="true">
          {(i % list.length) + 1}/{list.length}
        </span>
      )}
    </div>
  );
}

function MonitorClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(getClubTimeString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const date = formatDate(todayInClub(), "long");
  return (
    <div className="mon-clock" aria-label="Hora del club">
      <span className="mon-clock-time">
        {(time || nowInClubTimezone().hhmm).replace(" hs", "")}
        <small>hs</small>
      </span>
      <span className="mon-clock-date">
        {date.charAt(0).toUpperCase() + date.slice(1)}
      </span>
    </div>
  );
}

/** "Cancha 1" sola si el nombre es genérico; si tiene apodo, también el apodo. */
function courtTitle(court, index) {
  const generic = /^cancha\s*\d+$/i.test(String(court.name || "").trim());
  return { kicker: generic ? null : `Cancha ${index + 1}`, name: court.name || `Cancha ${index + 1}` };
}

function Ring({ remaining, left, tone }) {
  return (
    <div className="mon-ring" style={{ "--tone": tone }}>
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
        <span>min</span>
      </div>
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
  const [sceneReady, setSceneReady] = useState(false);
  const [courtPts, setCourtPts] = useState(null);
  const firedChimes = useRef(new Set());
  const frameRef = useRef(null);

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

  // La maqueta avisa cuando terminó de armarse y dónde quedó cada cancha.
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || !e.data) return;
      if (e.data.muzzaga === "ready") {
        setSceneReady(true);
        // Con ?cam= fijo, el primer "tour" deja la cámara en su lugar.
        frameRef.current?.contentWindow?.postMessage(
          { muzzaga: "tour", p: 0 },
          window.location.origin,
        );
      }
      if (e.data.muzzaga === "courtPts" && Array.isArray(e.data.pts)) {
        setCourtPts(e.data.pts);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
  const views = courts.map((court, index) => {
    const schedule = courtSchedule(
      court.id,
      dayData?.bookings,
      yesterdayBookings,
    );
    const { live } = liveAndNext(schedule, currentMinutes);
    const upcoming = schedule.filter((x) => x.start > currentMinutes);
    const remaining = live ? Math.max(0, live.end - currentMinutes) : 0;
    const total = live ? Math.max(1, live.end - live.start) : 1;
    const nextUp = upcoming[0] || null;
    const startsIn = nextUp ? nextUp.start - currentMinutes : null;
    const ending = Boolean(live) && remaining <= WARN_MIN;
    const state = live
      ? ending
        ? "termina"
        : "juego"
      : startsIn != null && startsIn <= PROXIMO_MIN
        ? "proximo"
        : "libre";
    return {
      court,
      index,
      schedule,
      title: courtTitle(court, index),
      match: live?.booking || null,
      remaining,
      left: Math.min(1, remaining / total),
      state,
      tone: live ? timerTone(remaining) : null,
      players: Math.min(8, Math.max(1, Number(live?.booking?.playersCount) || 4)),
      nextUp,
      startsIn,
      // En "próximo" el turno que viene ya está en el cuerpo: el pie muestra el siguiente.
      footer: state === "proximo" ? upcoming[1] || null : nextUp,
    };
  });

  // Borde de neón de cada cancha en la maqueta: el color del estado, o
  // apagado si está libre (así se distingue también en la maqueta).
  const neonKey = views.map((v) => v.state).join("|");
  useEffect(() => {
    if (!sceneReady) return;
    frameRef.current?.contentWindow?.postMessage(
      {
        muzzaga: "courts",
        s: views.map((v) =>
          v.state === "libre" ? null : { color: ESTADOS[v.state].color },
        ),
      },
      window.location.origin,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, neonKey]);

  // Aviso sonoro a 5 min del final y al terminar, una vez por turno. Se
  // marcan aunque el sonido esté apagado para que al prenderlo no suenen
  // avisos viejos de golpe.
  useEffect(() => {
    views.forEach(({ schedule }) =>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    slotDuration ? `El turno dura ${slotDuration} minutos` : null,
    "Terminá a horario para que el siguiente arranque puntual",
    "Preguntá en recepción por los próximos torneos",
    "Hacé el test de nivel y sumate a partidos parejos de tu categoría",
    `Reservá tu turno online en ${DOMINIO}`,
    "Reviví tu partido en video en beelup.com",
  ].filter(Boolean);
  const destacados = featuredItems(menuItems);
  const cantina = (destacados.length ? destacados : menuItems).slice(
    0,
    CANTINA_MAX,
  );
  // Las tarjetas van en el orden de la configuración de canchas (1, 2…).
  // Antes se ordenaban por la altura de cada cancha en la maqueta (la de
  // atrás arriba) y quedaba "Cancha 2" sobre "Cancha 1": confundía.
  const cards = views;
  // Variables de color del estado, para tarjeta y globo.
  const stateVars = (v) => ({
    "--state": ESTADOS[v.state].color,
    "--state-ink": ESTADOS[v.state].ink,
  });

  return (
    <div className="mon-root">
      <div className="mon-scene" aria-hidden="true">
        <iframe
          ref={frameRef}
          className={`mon-scene-frame${sceneReady ? " is-ready" : ""}`}
          src={
            // ?animado=1: los jugadores se mueven (para una compu con buena placa de video)
            new URLSearchParams(window.location.search).has("animado")
              ? `${SCENE_SRC}&anim=1`
              : SCENE_SRC
          }
          title="Maqueta 3D del club"
          tabIndex={-1}
        />
      </div>
      <div className="mon-shade" aria-hidden="true" />

      {/* Globos sobre cada cancha, donde la maqueta dice que cae. */}
      {sceneReady &&
        courtPts &&
        views.map((v) => {
          const pt = courtPts[v.index];
          if (!pt) return null;
          return (
            <div
              key={v.court.id}
              // Si la cancha cae cerca de las tarjetas, el globo se abre hacia
              // la derecha: centrado quedaba medio tapado por la columna.
              className={`mon-callout is-${v.state}${pt[0] < 0.5 ? " is-der" : ""}`}
              // La x va como variable: el CSS la corre a la derecha de la
              // columna de tarjetas si la cancha cae debajo de ellas.
              style={{
                "--x": `${pt[0] * 100}%`,
                top: `${pt[1] * 100}%`,
                ...stateVars(v),
              }}
              aria-hidden="true"
            >
              <div className="mon-callout-bubble">
                <strong>
                  {v.title.kicker ? `${v.title.kicker} · ${v.title.name}` : v.title.name}
                </strong>
                {/* key: al cambiar de estado se vuelve a montar y hace el "pop". */}
                <span key={v.state} className="mon-callout-state">
                  {ESTADOS[v.state].label}
                </span>
              </div>
              <span className="mon-callout-stem" />
              <span className="mon-callout-dot" />
            </div>
          );
        })}

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
          <img src="/img/logo_badge.png" alt="" />
          <div>
            <h1>Muzzaga Pádel</h1>
            <p>Canchas en vivo</p>
          </div>
        </div>

        {/* Para los que miran la tele y quieren jugar: dónde se reserva. */}
        <div className="mon-reserva" aria-label="Reservá tu turno online">
          <span>Reservá online</span>
          <strong>{DOMINIO}</strong>
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
              aria-label="Aviso sonoro"
              title="Aviso sonoro cuando faltan 5 min y al terminar cada turno"
            >
              {soundEnabled ? (
                <Volume2 size={18} aria-hidden="true" />
              ) : (
                <VolumeX size={18} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="mon-btn"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? (
                <Minimize size={18} aria-hidden="true" />
              ) : (
                <Maximize size={18} aria-hidden="true" />
              )}
            </button>
            <Link
              href="/admin"
              className="mon-btn"
              aria-label="Volver al admin"
              title="Volver al admin"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mon-side" aria-label="Estado de las canchas">
        {cards.map((v) => (
          <article
            key={v.court.id}
            className={`mon-card is-${v.state}`}
            style={stateVars(v)}
          >
            {/* Cabecera de césped azul con las líneas: se lee "cancha" de lejos. */}
            <header className="mon-card-head">
              <div className="mon-card-name">
                {v.title.kicker && <span>{v.title.kicker}</span>}
                <h2>{v.title.name}</h2>
              </div>
              <div key={v.state} className="mon-state">
                {ESTADOS[v.state].label}
              </div>
            </header>

            <div className="mon-card-body">
              {v.match ? (
                <>
                  <div className="mon-card-info">
                    <span className="mon-card-kicker">Juega</span>
                    <strong className="mon-card-who">{v.match.playerName}</strong>
                    <span className="mon-card-meta">
                      {v.players} jugadores · {v.match.startTime} a {v.match.endTime} hs
                    </span>
                  </div>
                  <Ring remaining={v.remaining} left={v.left} tone={v.tone} />
                </>
              ) : v.state === "proximo" ? (
                <>
                  <div className="mon-card-info">
                    <span className="mon-card-kicker">Turno de</span>
                    <strong className="mon-card-who">{v.nextUp.booking.playerName}</strong>
                    <span className="mon-card-meta">
                      {v.nextUp.booking.startTime} a {v.nextUp.booking.endTime} hs
                    </span>
                  </div>
                  {/* El anillo se vacía a medida que se acerca la hora de arrancar. */}
                  <Ring
                    remaining={v.startsIn}
                    left={Math.min(1, v.startsIn / PROXIMO_MIN)}
                    tone={ESTADOS.proximo.color}
                  />
                </>
              ) : (
                <>
                  {/* Libre: en grande hasta cuándo se puede jugar y dónde
                      reservar (antes había una pelota que no decía nada). */}
                  <div className="mon-card-info mon-card-libre">
                    <span className="mon-card-kicker">
                      {v.nextUp ? "Libre hasta las" : "Libre"}
                    </span>
                    <strong className="mon-card-libre-big">
                      {v.nextUp ? (
                        <>
                          {v.nextUp.booking.startTime}
                          <small>hs</small>
                        </>
                      ) : (
                        "Todo el día"
                      )}
                    </strong>
                    <span className="mon-card-reserva">
                      Reservá en <strong>{DOMINIO}</strong>
                    </span>
                  </div>
                </>
              )}
            </div>

            <footer className="mon-card-next">
              <span className="mon-card-next-label">
                {v.state === "proximo" ? "Después" : "Próximo"}
              </span>
              {v.footer ? (
                <span className="mon-card-next-value">
                  <strong>{v.footer.booking.startTime}</strong>
                  <span className="mon-card-next-name">{v.footer.booking.playerName}</span>
                  <em>{inLabel(v.footer.start - currentMinutes)}</em>
                </span>
              ) : (
                <span className="mon-card-next-value is-empty">Sin más reservas hoy</span>
              )}
            </footer>
          </article>
        ))}
      </main>

      <div className="mon-bottom">
        {cantina.length > 0 && (
          <section className="mon-cantina" aria-label="Cantina">
            <div className="mon-cantina-head">
              {/* Archivo directo, como el logo: sin pasar por el optimizador de imágenes,
                  que en producción la dejaba rota. */}
              <img
                src="/img/mascotas/muzzaguito-pizza-cerveza.webp"
                alt=""
                width={720}
                height={677}
                className="mon-cantina-mascota"
              />
              <div>
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

        {/* Beelup filma las canchas: los jugadores buscan ahí el video de su partido. */}
        <section className="mon-beelup" aria-label="Beelup: reviví tu partido">
          <div className="mon-beelup-brand">
            <img src="/img/marcas/beelup-icono.svg" alt="" width={160} height={170} />
            <span>beelup</span>
          </div>
          <div className="mon-beelup-body">
            <div className="mon-beelup-top">
              <h2>
                Reviví tu partido <span>en Beelup</span>
              </h2>
              <strong className="mon-beelup-url">beelup.com</strong>
            </div>
            <ol className="mon-beelup-steps">
              <li>Muzzaga Pádel</li>
              <li>{BEELUP_CANCHAS}</li>
              <li>Día y hora</li>
            </ol>
          </div>
        </section>
      </div>

      <div className="mon-ticker">
        <div className="mon-ticker-tag">
          <Info size={20} aria-hidden="true" />
          Avisos
        </div>
        <TickerRotativo items={tickerItems} />
      </div>
    </div>
  );
}
