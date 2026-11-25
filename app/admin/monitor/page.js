"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
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
  adminGetMonitorData,
  checkAdminSession,
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
import { claveFoto, fotoVencida, guardarFoto, leerFoto } from "./fotoMaqueta";
import "./monitor.css";

// El dominio que se muestra en la tele para reservar (lo eligió el club).
const DOMINIO = "muzzagapadel.com";

const REFRESH_MS = 30000;
const MENU_REFRESH_MS = 10 * 60 * 1000;
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
  "/recorrido/index.html?embed=1&monitor=1&cam=212,40,52,2,-10&v=20261125c";
// Si la maqueta no avisa que quedó quieta, a los 30 s de mostrarse se da por
// quieta igual (para el fundido desde la foto y para medir la tele).
const SETTLE_FALLBACK_MS = 30000;
// Lo que tarda el fundido de la foto a la maqueta (ver .mon-scene.has-foto).
const FOTO_FADE_MS = 450;
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

/**
 * Llama a `fn` justo cuando cambia el minuto (y no cada segundo): todo lo que
 * muestra la tele va de a minuto. Un setTimeout alineado al próximo minuto
 * despierta al navegador una vez por minuto en vez de 60 o 6 veces.
 */
function useEveryMinute(fn) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let id;
    const schedule = () => {
      // +80 ms de margen para no caer un pelito antes del cambio de minuto.
      id = setTimeout(tick, 60000 - (Date.now() % 60000) + 80);
    };
    const tick = () => {
      fnRef.current();
      schedule();
    };
    schedule();
    // Al volver a mostrarse (o si la tele suspendió los timers) se pone al día.
    const onVisible = () => {
      if (document.hidden) return;
      clearTimeout(id);
      tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}

// Si la tele tarda más que esto por cuadro (menos de ~35 cuadros por segundo)
// con la pantalla quieta, no da para los adornos.
const LITE_FRAME_MS = 28;

/**
 * Modo liviano: apaga las animaciones de adorno (el "salto" del cartel, el
 * titileo, el fundido de los avisos, el anillo que se desliza). Lo que se
 * muestra es lo mismo. Se prende con ?lite=1, o solo: unos segundos después
 * de que la maqueta queda quieta se miden 3 s de cuadros y, si la tele no
 * llega, se activa hasta que se recargue la página. ?lite=0 no mide nunca.
 */
function useLiteMode(sceneReady) {
  const [lite, setLite] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("lite");
    if (q === "1" || q === "0") decided.current = true;
    if (q === "1") setLite(true);
  }, []);

  useEffect(() => {
    if (!sceneReady || decided.current) return undefined;
    let raf = 0;
    let wait = 0;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      if (document.hidden) {
        wait = setTimeout(measure, 5000);
        return;
      }
      const gaps = [];
      let last = 0;
      const step = (t) => {
        if (cancelled) return;
        if (last) gaps.push(t - last);
        last = t;
        const total = gaps.reduce((a, b) => a + b, 0);
        if (total < 3000) {
          raf = requestAnimationFrame(step);
          return;
        }
        // Medición terminada: no queda ningún requestAnimationFrame andando.
        decided.current = true;
        const avg = total / gaps.length;
        const slow = gaps.filter((g) => g > 50).length / gaps.length;
        if (avg > LITE_FRAME_MS || slow > 0.25) setLite(true);
      };
      raf = requestAnimationFrame(step);
    };
    // La maqueta anima unos 7 s al armarse y después queda quieta: se mide ahí.
    wait = setTimeout(measure, 9000);
    return () => {
      cancelled = true;
      clearTimeout(wait);
      cancelAnimationFrame(raf);
    };
  }, [sceneReady]);

  return lite;
}

/** Minutos desde las 00:00 en la hora del club; cambia una vez por minuto. */
function useClubMinutes() {
  const [minutes, setMinutes] = useState(() => toMinutes(nowInClubTimezone().hhmm));
  // Mismo valor → React no vuelve a dibujar.
  useEveryMinute(() => setMinutes(toMinutes(nowInClubTimezone().hhmm)));
  return minutes;
}

/**
 * Avisos de a uno, cambiando cada 8 s con un fundido corto. Antes era una
 * cinta que se desplazaba sin parar: eso obligaba a la tele a redibujar la
 * pantalla entera (maqueta incluida) 60 veces por segundo y la trababa. Así
 * la pantalla queda quieta casi todo el tiempo.
 */
const TickerRotativo = memo(function TickerRotativo({ items }) {
  const list = items.length ? items : [""];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return undefined;
    // Con la pestaña oculta no se avanza: nadie lo ve y la tele descansa.
    const id = setInterval(() => {
      if (!document.hidden) setI((n) => n + 1);
    }, 8000);
    return () => clearInterval(id);
  }, [list.length]);
  const item = list[i % list.length];
  return (
    <div className="mon-ticker-window" aria-live="off">
      <span className="mon-ticker-item mon-ticker-rot">
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
});

/**
 * El reloj va en su propio componente: al cambiar el minuto se redibuja solo
 * él. Antes preguntaba la hora cada segundo; ahora se despierta justo en el
 * cambio de minuto (la pantalla no muestra segundos).
 */
const MonitorClock = memo(function MonitorClock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState(() => todayInClub());
  useEffect(() => setTime(getClubTimeString()), []);
  useEveryMinute(() => {
    setTime(getClubTimeString());
    setDate(todayInClub());
  });
  const dateLabel = formatDate(date, "long");
  return (
    <div className="mon-clock" aria-label="Hora del club">
      <span className="mon-clock-time">
        {(time || nowInClubTimezone().hhmm).replace(" hs", "")}
        <small>hs</small>
      </span>
      <span className="mon-clock-date">
        {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
      </span>
    </div>
  );
});

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
  // La hora de la última lectura buena va en un ref: guardarla en el estado
  // redibujaba la pantalla cada 30 s aunque no hubiera cambiado nada. El
  // cartel "En vivo / hace N min" se recalcula en el redibujo de cada minuto.
  const lastUpdatedRef = useRef(null);
  const [hasData, setHasData] = useState(false);
  const currentMinutes = useClubMinutes();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  // En la tele nadie toca nada: los botones y el puntero se esconden a los
  // 4 s sin mover el mouse ni tocar una tecla, y vuelven al moverlo.
  const [quieto, setQuieto] = useState(false);
  useEffect(() => {
    let id = null;
    const despertar = () => {
      setQuieto(false);
      window.clearTimeout(id);
      id = window.setTimeout(() => setQuieto(true), 4000);
    };
    despertar();
    const evs = ["mousemove", "pointerdown", "keydown", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, despertar, { passive: true }));
    return () => {
      window.clearTimeout(id);
      evs.forEach((e) => window.removeEventListener(e, despertar));
    };
  }, []);
  const [demo, setDemo] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  // La maqueta quedó quieta y completa (luces, cámara, personajes 3D).
  const [sceneSettled, setSceneSettled] = useState(false);
  const [courtPts, setCourtPts] = useState(null);
  // Foto de la maqueta de la vez anterior ({ url, pts }), mientras se arma la
  // de verdad (ver fotoMaqueta.js). url queda en null después del fundido.
  const [foto, setFoto] = useState(null);
  const fotoGuardada = useRef(null);
  const pedirFoto = useRef(null);
  const sceneReadyRef = useRef(false);
  // Modo liviano: sin las animaciones de adorno (ver useLiteMode). Se mide con
  // la maqueta ya quieta: mientras se arma (y cargan los personajes) la tele
  // va lenta igual.
  const lite = useLiteMode(sceneSettled);
  // Con foto, la maqueta aparece recién cuando quedó igual a la foto; sin
  // foto, apenas está armada (como siempre).
  const sceneShown = foto ? sceneSettled : sceneReady;
  const globoPts = foto?.pts && !sceneShown ? foto.pts : courtPts || foto?.pts;
  const firedChimes = useRef(new Set());
  const frameRef = useRef(null);
  const dataKeyRef = useRef("");
  const loadingRef = useRef(false);
  // ?animado=1: los jugadores se mueven (para una compu con buena placa de video).
  // Se calcula una sola vez y no en cada redibujo.
  const sceneSrc = useMemo(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("animado")
        ? `${SCENE_SRC}&anim=1`
        : SCENE_SRC,
    [],
  );

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
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // La maqueta avisa cuando terminó de armarse y dónde quedó cada cancha.
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || !e.data) return;
      if (e.data.muzzaga === "ready") {
        sceneReadyRef.current = true;
        setSceneReady(true);
        // Si no hay foto (o es vieja o de otra pantalla), se le pide una.
        pedirFoto.current?.then((pedir) => {
          if (pedir) {
            frameRef.current?.contentWindow?.postMessage(
              { muzzaga: "snap" },
              window.location.origin,
            );
          }
        });
        // Con ?cam= fijo, el primer "tour" deja la cámara en su lugar.
        frameRef.current?.contentWindow?.postMessage(
          { muzzaga: "tour", p: 0 },
          window.location.origin,
        );
      }
      if (e.data.muzzaga === "settled") setSceneSettled(true);
      if (e.data.muzzaga === "snapshot" && e.data.blob instanceof Blob) {
        const rect = frameRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0) {
          guardarFoto({
            key: claveFoto(rect, frameRef.current.getAttribute("src")),
            at: Date.now(),
            pts: Array.isArray(e.data.pts) ? e.data.pts : null,
            w: e.data.w,
            h: e.data.h,
            blob: e.data.blob,
          });
        }
      }
      if (e.data.muzzaga === "courtPts" && Array.isArray(e.data.pts)) {
        // Solo si cambiaron de verdad: cada aviso igual redibujaba todo.
        const pts = e.data.pts;
        setCourtPts((prev) =>
          prev && JSON.stringify(prev) === JSON.stringify(pts) ? prev : pts,
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // La foto guardada se empieza a leer apenas abre la página (mientras se
  // verifica la sesión), así está lista cuando aparece la maqueta.
  useEffect(() => {
    fotoGuardada.current = leerFoto();
  }, []);

  // Con la maqueta ya en la página: si la foto es de esta misma pantalla, se
  // muestra hasta que la maqueta termine de armarse.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || pedirFoto.current) return undefined;
    let url = null;
    let cancelled = false;
    const rect = frame.getBoundingClientRect();
    const key = claveFoto(rect, frame.getAttribute("src"));
    const leida = fotoGuardada.current || leerFoto();
    pedirFoto.current = leida.then((guardada) => {
      const pedir = rect.width > 0 && fotoVencida(guardada, key);
      if (!cancelled && guardada?.blob && guardada.key === key && !sceneReadyRef.current) {
        url = URL.createObjectURL(guardada.blob);
        setFoto({ url, pts: guardada.pts });
      }
      return pedir;
    });
    return () => {
      cancelled = true;
      pedirFoto.current = null;
      if (url) URL.revokeObjectURL(url);
    };
  }, [authorized, sessionChecked]);

  // Si la maqueta nunca avisa que quedó quieta, se da por quieta igual.
  useEffect(() => {
    if (!sceneReady || sceneSettled) return undefined;
    const id = setTimeout(() => setSceneSettled(true), SETTLE_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [sceneReady, sceneSettled]);

  // Terminado el fundido, la foto se saca de la página (libera la memoria).
  // Los globos siguen con los puntos que manda la maqueta.
  const fotoUrl = foto?.url;
  useEffect(() => {
    if (!fotoUrl || !sceneShown) return undefined;
    const id = setTimeout(() => {
      URL.revokeObjectURL(fotoUrl);
      setFoto((f) => (f ? { ...f, url: null } : f));
    }, FOTO_FADE_MS + 300);
    return () => clearTimeout(id);
  }, [fotoUrl, sceneShown]);

  useEffect(() => {
    if (!authorized) return;
    if (demo) {
      setSlotDuration(90);
      setDayData(monitorDemoData());
      setMenuItems(normalizeMenu(null).items);
      lastUpdatedRef.current = Date.now();
      setHasData(true);
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
    // Con la pestaña oculta no se pide nada; al volver se actualiza en el acto.
    const id = setInterval(() => {
      if (!document.hidden) loadData();
    }, REFRESH_MS);
    const menuId = setInterval(() => {
      if (!document.hidden) loadMenu();
    }, MENU_REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) loadData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      clearInterval(menuId);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, demo]);

  async function loadData() {
    // Con internet lento un pedido puede tardar más de 30 s: no se apilan.
    if (loadingRef.current) return;
    loadingRef.current = true;
    const today = todayInClub();
    const isLateNight = nowInClubTimezone().hhmm < LATE_NIGHT_UNTIL;
    try {
      const [res, prev] = await Promise.all([
        adminGetMonitorData(today),
        isLateNight ? adminGetMonitorData(isoAddDays(today, -1)) : null,
      ]);
      if (!res.ok) {
        setLoadError(isExpiredSessionError(res) ? "expired" : "offline");
        return;
      }
      lastUpdatedRef.current = Date.now();
      setLoadError(null);
      setHasData(true);
      // Si los turnos no cambiaron (lo más común) no se toca el estado y la
      // pantalla no se redibuja.
      const prevBookings = prev?.ok ? prev.bookings : [];
      const key = JSON.stringify([res.courts, res.bookings, prevBookings]);
      if (key === dataKeyRef.current) return;
      dataKeyRef.current = key;
      setDayData(res);
      setYesterdayBookings(prevBookings);
    } catch {
      setLoadError("offline");
    } finally {
      loadingRef.current = false;
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // Las tarjetas solo se recalculan si cambió el minuto o llegaron turnos
  // nuevos; no al prender el sonido, al moverse un globo, etc.
  const views = useMemo(() => {
    const courts = dayData?.courts || COURTS;
    return courts.map((court, index) => {
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
  }, [dayData, yesterdayBookings, currentMinutes]);

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

  // Misma lista mientras no cambie la duración del turno: así la tira de
  // avisos no se redibuja con el resto de la pantalla.
  const tickerItems = useMemo(
    () =>
      [
        slotDuration ? `El turno dura ${slotDuration} minutos` : null,
        "Terminá a horario para que el siguiente arranque puntual",
        "Preguntá en recepción por los próximos torneos",
        "Hacé el test de nivel y sumate a partidos parejos de tu categoría",
        `Reservá tu turno online en ${DOMINIO}`,
        "Reviví tu partido en video en beelup.com",
      ].filter(Boolean),
    [slotDuration],
  );

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

  const lastUpdated = lastUpdatedRef.current;
  const minutesSinceUpdate = lastUpdated
    ? Math.floor((Date.now() - lastUpdated) / 60000)
    : null;
  const isStale =
    minutesSinceUpdate != null && minutesSinceUpdate >= STALE_AFTER_MIN;
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
    <div className={`mon-root${lite ? " is-lite" : ""}${quieto ? " is-quieto" : ""}`}>
      <div className={`mon-scene${foto ? " has-foto" : ""}`} aria-hidden="true">
        {/* La foto va exactamente donde va a estar la maqueta (mismo tamaño y
            estirada igual que su lienzo): el fundido no se nota. */}
        {foto?.url && <img className="mon-scene-foto" src={foto.url} alt="" />}
        <iframe
          ref={frameRef}
          className={`mon-scene-frame${sceneShown ? " is-ready" : ""}`}
          src={sceneSrc}
          title="Maqueta 3D del club"
          tabIndex={-1}
        />
      </div>
      <div className="mon-shade" aria-hidden="true" />

      {/* Globos sobre cada cancha, donde la maqueta dice que cae (o donde
          caía en la foto, mientras se arma: ahí la cámara todavía no está en
          su lugar y los puntos que manda no sirven). */}
      {(sceneReady || foto) &&
        globoPts &&
        views.map((v) => {
          const pt = globoPts[v.index];
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
            hasData &&
            (demo || isStale || minutesSinceUpdate !== 0) && (
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
