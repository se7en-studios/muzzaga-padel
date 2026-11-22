"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import Mascota from "./Mascota";
import BeelupTutorial, { Tipeo } from "./BeelupTutorial";
import { beelupStreamInfo, youtubeEmbedUrl } from "../lib/beelup";
import { useVista } from "../lib/useVista";

// Si no hay stream (o se cae), queda el loop de las canchas: el mismo video
// liviano del hero.
const LOOP_SRC = "/video/hero-cancha-liviana.mp4";
// Un stream que en este tiempo no arrancó se da por caído.
const STALL_MS = 15000;

/** Igual que HeroVideo: nada que se mueva solo con "reducir movimiento" o ahorro de datos. */
function useAutoplayAllowed() {
  const [allowed, setAllowed] = useState(null);
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const saveData = navigator.connection?.saveData === true;
    setAllowed(!reduce && !saveData);
  }, []);
  return allowed;
}

/** Solo mientras el cuadro está cerca de la pantalla: dos streams en vivo comen datos. */
function useNearViewport(ref) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), {
      rootMargin: "200px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return near;
}

/**
 * Lo que va encima del video, como en una transmisión deportiva: la placa
 * "EN VIVO" + cancha arriba a la izquierda y el sello del club a la derecha.
 * Todo decorativo y sin clics (pointer-events en el CSS), para no tapar los
 * controles de YouTube.
 */
function Chrome({ live, label }) {
  return (
    <>
      <span className="camaras-corner camaras-corner--bl" aria-hidden="true" />
      <span className="camaras-corner camaras-corner--br" aria-hidden="true" />
      <div className="camaras-bug" aria-hidden="true">
        <span className={`camaras-bug-estado${live ? " is-live" : ""}`}>
          <span
            className={`pulse-dot camaras-rec-dot${live ? " is-live" : ""}`}
          />
          {live ? "En vivo" : "Loop"}
        </span>
        <span className="camaras-bug-cancha">{label}</span>
      </div>
      <div className="camaras-sello" aria-hidden="true">
        <span className="camaras-sello-pelota" />
        Muzzaga <b>Play</b>
      </div>
    </>
  );
}

/** El loop decorativo de las canchas. */
function LoopFrame({ label, autoplay }) {
  const ref = useRef(null);
  const near = useNearViewport(ref);
  return (
    <div className="camaras-frame" ref={ref}>
      {autoplay && near && (
        <video
          className="camaras-frame-video"
          src={LOOP_SRC}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          tabIndex={-1}
        />
      )}
      <Chrome live={false} label={label} />
    </div>
  );
}

/**
 * Stream en vivo de una cámara (HLS). Safari/iPhone lo reproducen solos; en
 * el resto se carga hls.js (versión liviana) recién acá. Si no arranca, se
 * cae o el link venció, queda el loop.
 */
function StreamFrame({ name, url, autoplay, onFail, debug }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const near = useNearViewport(wrapRef);
  const [wanted, setWanted] = useState(false);
  const [state, setState] = useState("idle"); // idle | loading | live | error
  const [reason, setReason] = useState("");
  const run = near && (autoplay || wanted);

  useEffect(() => {
    const video = videoRef.current;
    if (!run || !video || state === "error") return undefined;
    let cancelled = false;
    let hls = null;
    // El motivo se ve en pantalla con ?camaras=debug (para revisar desde el club).
    const fail = (why) => {
      if (cancelled) return;
      setReason(typeof why === "string" ? why : "error del reproductor");
      setState("error");
    };
    const onVideoError = () =>
      fail(`Reproductor del navegador: error de video ${video.error?.code ?? "?"} ${video.error?.message || ""}`.trim());
    const onPlaying = () => !cancelled && setState("live");
    const stall = setTimeout(() => {
      if (!cancelled && video.readyState < 3) fail(`No arrancó en ${STALL_MS / 1000} s (readyState ${video.readyState})`);
    }, STALL_MS);
    setState((s) => (s === "live" ? s : "loading"));
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onVideoError);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play().catch(() => {});
    } else {
      import("hls.js/light")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) return fail("hls.js: el navegador no soporta MediaSource");
          hls = new Hls({
            capLevelToPlayerSize: true,
            startLevel: 0,
            maxBufferLength: 8,
          });
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (!data.fatal) return;
            const code = data.response?.code;
            fail(
              `hls.js: ${data.type} / ${data.details}` +
                (code !== undefined ? ` (HTTP ${code}${code === 0 ? ": bloqueado por el navegador, probablemente CORS" : ""})` : ""),
            );
          });
          hls.loadSource(url);
          hls.attachMedia(video);
          video.play().catch(() => {});
        })
        .catch(() => fail("No se pudo cargar hls.js"));
    }

    return () => {
      cancelled = true;
      clearTimeout(stall);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onVideoError);
      if (hls) hls.destroy();
      else {
        video.removeAttribute("src");
        video.load();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, url]);

  useEffect(() => {
    if (state === "error") onFail?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (state === "error") {
    return (
      <div>
        <LoopFrame label={name} autoplay={autoplay} />
        {debug && (
          <p className="camaras-debug" role="status">
            {name}: {reason} ·{" "}
            {typeof document !== "undefined" &&
            document.createElement("video").canPlayType("application/vnd.apple.mpegurl")
              ? "reproductor del navegador"
              : "hls.js"}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`camaras-frame${state === "live" ? " is-live" : ""}`}
      ref={wrapRef}
    >
      <video
        ref={videoRef}
        className="camaras-frame-video"
        muted
        playsInline
        autoPlay
        aria-label={`Cámara en vivo de ${name}`}
      />
      {!run && (
        <button
          type="button"
          className="camaras-play"
          onClick={() => setWanted(true)}
        >
          <Play size={22} aria-hidden="true" /> Ver {name} en vivo
        </button>
      )}
      {run && state === "loading" && (
        <span className="camaras-loading" role="status">
          Conectando la cámara…
        </span>
      )}
      <Chrome live label={name} />
    </div>
  );
}

/**
 * Transmisión de YouTube (lo que ofrece Beelup para ver en vivo). YouTube se
 * encarga de reproducirla en cualquier navegador; acá solo se monta cuando el
 * cuadro está cerca de la pantalla.
 */
function YouTubeFrame({ name, embed, autoplay }) {
  const wrapRef = useRef(null);
  const near = useNearViewport(wrapRef);
  const [wanted, setWanted] = useState(false);
  const run = near && (autoplay || wanted);
  return (
    <div className="camaras-frame is-live" ref={wrapRef}>
      {run ? (
        <iframe
          className="camaras-frame-video"
          src={embed}
          title={`Cámara en vivo de ${name}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          className="camaras-play"
          onClick={() => setWanted(true)}
        >
          <Play size={22} aria-hidden="true" /> Ver {name} en vivo
        </button>
      )}
      <Chrome live label={name} />
    </div>
  );
}

// Ícono de Beelup (redibujado en SVG a partir del logo que pasó el club).
const BEELUP_ICON = "/img/marcas/beelup-icono.svg";

// Muzzaga ya está en Beelup: si en el panel no se cargó el link del club, se
// usa el de Beelup (ahí se elige Muzzaga Pádel, la cancha y el horario).
export const BEELUP_DEFAULT_URL = "https://beelup.com/";

// Las canchas como se llaman en Beelup (así figuran en su buscador).
const BEELUP_CANCHAS = ["El Tano", "La Vasca"];

// El buscador "se completa solo" al verse: cada campo se tipea letra por
// letra (ms por letra y pausa entre campos). Las letras van en spans para
// que el texto ocupe su lugar desde el principio (sin saltos de diseño).
const TIPEO_MS = 45;
const TIPEO_PAUSA = 260;
const BUSQUEDA = [
  { label: "Club", valor: "Muzzaga Pádel" },
  { label: "Cancha", valor: BEELUP_CANCHAS.join(" · ") },
  { label: "Cuándo", valor: "Día y horario" },
];

/**
 * Tarjeta de Beelup debajo de la tele: el buscador de Beelup dibujado con
 * los pasos ya completos (club, cancha, día) para que se entienda cómo
 * encontrar el video del partido, y el botón para ir. Antes era un cartel
 * encima del video que en el celu lo tapaba entero.
 */
function BeelupCartel({ href }) {
  const phoneRef = useRef(null);
  const searchRef = useRef(null);
  useVista(phoneRef, 0.5);
  useVista(searchRef, 0.6);
  let t = 200;
  const pasos = BUSQUEDA.map((c) => {
    const dur = [...c.valor].length * TIPEO_MS;
    const paso = { ...c, d: t, dur };
    t += dur + TIPEO_PAUSA;
    return paso;
  });
  return (
    <div className="bl-card">
      {/* El celular con la repetición: lo que el jugador va a encontrar. Al
          verse, la "repetición" corre: la pelota cruza, pica en el punto
          marcado y sale la burbuja. */}
      <div className="bl-phone-wrap" aria-hidden="true" ref={phoneRef}>
        <div className="bl-phone">
          <div className="bl-screen">
            <div className="bl-scr-top">
              <span className="bl-scr-brand">
                <img src={BEELUP_ICON} alt="" width={14} height={15} />
                beelup
              </span>
              <span className="bl-scr-tag">EL TANO · 20:00</span>
            </div>
            <span className="bl-scr-jugada">
              <span className="bl-scr-pelota">
                <i />
              </span>
              <span className="bl-scr-pique" />
            </span>
            <span className="bl-scr-play">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M7 4.5v15l13-7.5z" />
              </svg>
            </span>
            <div className="bl-scr-bar">
              <span className="bl-scr-moment">★ Punto del partido · 41:12</span>
              <span className="bl-scr-track">
                <span className="bl-scr-fill" />
                <span className="bl-scr-mark" style={{ left: "22%" }} />
                <span className="bl-scr-mark bl-scr-mark--punto" style={{ left: "48%" }} />
                <span className="bl-scr-mark" style={{ left: "71%" }} />
                <span className="bl-scr-cabezal">
                  <i />
                </span>
              </span>
              <span className="bl-scr-times">
                <span>41:12</span>
                <span>1:30:00</span>
              </span>
            </div>
          </div>
        </div>
        <span className="bl-bubble">¡Mirá este punto! 🎾</span>
      </div>

      <div className="bl-copy" style={{ "--fin": `${t}ms` }}>
        <div className="bl-head">
          <span className="bl-logo">
            <img src={BEELUP_ICON} alt="" width={34} height={36} />
            <span>beelup</span>
          </span>
          <span className="bl-chip">
            <span className="bl-rec" aria-hidden="true" />
            Cámaras en las 2 canchas
          </span>
        </div>
        <p className="bl-title">
          Reviví tu <em>partido</em>
        </p>
        <p className="bl-sub">
          Cada partido en Muzzaga queda grabado. Buscá tu turno, encontrá tus
          mejores jugadas y compartilas con tus amigos.
        </p>
        <ul className="bl-perks">
          <li>🎥 Tu partido completo</li>
          <li>⭐ Tus mejores puntos</li>
          <li>📲 Para compartir</li>
        </ul>
        <ol
          className="bl-search"
          aria-label="Cómo encontrar tu video en Beelup"
          ref={searchRef}
        >
          {pasos.map((p) => (
            <li
              key={p.label}
              style={{ "--d": `${p.d}ms`, "--t": `${p.dur + 200}ms` }}
            >
              <small>{p.label}</small>
              <b>
                <Tipeo texto={p.valor} />
              </b>
            </li>
          ))}
        </ol>
        <a
          className="bl-btn"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver mi partido
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M10 8.5v7l6-3.5z" fill="currentColor" />
          </svg>
        </a>
        <p className="bl-url">Se abre beelup.com · elegí Muzzaga Pádel, tu cancha y el horario</p>
        <BeelupTutorial href={href} />
      </div>
    </div>
  );
}

/**
 * Cámaras debajo de las reservas. Los links se cargan en el panel
 * (Configuración → Cámaras): el de cada cancha y el del club en Beelup. Una
 * cancha sin link, o con el link vencido, no se muestra; sin ninguno queda
 * el loop de las canchas.
 */
export default function CamarasSection({ courts = [], beelupUrl: beelupUrlConfig = "" }) {
  // Solo para pausar los loops (punto rojo, repetición) fuera de pantalla.
  const sectionRef = useRef(null);
  useVista(sectionRef, 0);
  const beelupUrl = beelupUrlConfig || BEELUP_DEFAULT_URL;
  const autoplay = useAutoplayAllowed();
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("camaras") === "debug");
  }, []);
  const [now, setNow] = useState(null);
  const [failed, setFailed] = useState({});
  useEffect(() => setNow(Date.now()), []);

  // El vencimiento se mira en el navegador: la página puede estar cacheada.
  const streams =
    now == null
      ? []
      : courts.filter(
          (c) => c.streamUrl && !beelupStreamInfo(c.streamUrl, now).expired,
        );
  const live = streams.some((c) => !failed[c.id]);

  const mascot = (
    <Mascota
      pose="guino-paleta-pulgar"
      alt={
        beelupUrl
          ? "Muzzaguito invitándote a ver tus jugadas en Beelup"
          : "Muzzaguito mirando las canchas"
      }
      className="mascot-section-img"
    />
  );

  return (
    <section id="camaras" className="section-turnos" ref={sectionRef}>
      <div className="container">
        <div className="section-header-row">
          <div>
            <span
              className="badge-linear badge-indigo"
              style={{ marginBottom: 8 }}
            >
              {live ? "Cámaras en vivo" : "Muzzaga Play"}
            </span>
            <h2 className="section-title">
              {live ? "Mirá las canchas en vivo" : "Así se juega en Muzzaga"}
            </h2>
            <p className="section-desc">
              {live
                ? "Las cámaras de Beelup, en directo desde el club."
                : "Cada partido queda grabado: reviví tus jugadas y compartilas con Beelup."}{" "}
              {beelupUrl &&
                "Tocá a Muzzaguito y conseguí el video de tu propio partido en Beelup."}
            </p>
          </div>
          <div className="mascot-section-badge">
            {beelupUrl ? (
              <a
                href={beelupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="camaras-mascot-link"
                aria-label="Ver Muzzaga Pádel en Beelup"
              >
                {mascot}
              </a>
            ) : (
              mascot
            )}
          </div>
        </div>

        {/* La "tele": marco oscuro con el zócalo abajo, como una transmisión. */}
        <div className="camaras-tv">
          <div
            className={`camaras-grid${streams.length > 1 ? " is-double" : ""}`}
          >
            {streams.length ? (
              streams.map((c) =>
                youtubeEmbedUrl(c.streamUrl) ? (
                  <YouTubeFrame
                    key={c.id}
                    name={c.name}
                    embed={youtubeEmbedUrl(c.streamUrl)}
                    autoplay={autoplay === true}
                  />
                ) : (
                  <StreamFrame
                    key={c.id}
                    name={c.name}
                    url={c.streamUrl}
                    autoplay={autoplay === true}
                    onFail={() => setFailed((f) => ({ ...f, [c.id]: true }))}
                    debug={debug}
                  />
                ),
              )
            ) : (
              <LoopFrame label="CANCHAS MUZZAGA" autoplay={autoplay === true} />
            )}
          </div>
          {/* Zócalo de TV: repite lo que dice el encabezado, por eso va oculto
              para lectores de pantalla. */}
          <div className="camaras-zocalo" aria-hidden="true">
            <span className="camaras-zocalo-marca">
              <span className="camaras-sello-pelota" />
              Muzzaga Play
            </span>
            <span className="camaras-zocalo-texto">
              {live
                ? "Cámaras Beelup · en directo"
                : "Cámaras Beelup · reviví tu partido"}
            </span>
            <span className="camaras-zocalo-lugar">Catriel · Río Negro</span>
          </div>
        </div>

        <BeelupCartel href={beelupUrl} />
      </div>
    </section>
  );
}
