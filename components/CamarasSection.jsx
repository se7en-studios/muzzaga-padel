"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Play } from "lucide-react";
import Mascota from "./Mascota";
import { beelupStreamInfo, youtubeEmbedUrl } from "../lib/beelup";

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

/**
 * Mientras no haya cámaras cargadas en el panel: cartel "Próximamente" con
 * Beelup encima del loop de las canchas.
 */
function BeelupProximamente() {
  return (
    <div className="camaras-proximamente">
      <span className="camaras-proximamente-chip">Próximamente</span>
      <p className="camaras-proximamente-titulo">
        Partidos en vivo con
        <span className="camaras-beelup-marca">
          <img
            src={BEELUP_ICON}
            alt=""
            className="camaras-beelup-logo"
            width={30}
            height={32}
          />
          <span className="camaras-beelup-nombre">beelup</span>
        </span>
      </p>
      <p className="camaras-proximamente-sub">
        Mirá las canchas en directo y llevate el video de tus mejores puntos.
      </p>
    </div>
  );
}

/**
 * Cámaras debajo de las reservas. Los links se cargan en el panel
 * (Configuración → Cámaras): el de cada cancha y el del club en Beelup. Una
 * cancha sin link, o con el link vencido, no se muestra; sin ninguno queda
 * el loop de las canchas.
 */
export default function CamarasSection({ courts = [], beelupUrl = "" }) {
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
    <section id="camaras" className="section-turnos">
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
                : "Muy pronto vas a ver las canchas en vivo y bajar el video de tu partido con Beelup."}{" "}
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
          {!streams.length && <BeelupProximamente />}
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
                : "Cámaras Beelup · próximamente"}
            </span>
            <span className="camaras-zocalo-lugar">Catriel · Río Negro</span>
          </div>
        </div>

        {beelupUrl && (
          <div className="camaras-cta">
            <a
              href={beelupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <Camera size={18} className="icono-marca" aria-hidden="true" />
              Ver tus jugadas en Beelup
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
