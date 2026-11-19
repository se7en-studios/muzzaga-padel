"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Play } from "lucide-react";
import Mascota from "./Mascota";
import { beelupStreamInfo } from "../lib/beelup";

// Si no hay stream (o se cae), queda el loop de las canchas: el mismo video
// liviano del hero.
const LOOP_SRC = "/video/hero-cancha-liviana.mp4";
// Un stream que en este tiempo no arrancó se da por caído.
const STALL_MS = 15000;

/** Igual que HeroVideo: nada que se mueva solo con "reducir movimiento" o ahorro de datos. */
function useAutoplayAllowed() {
  const [allowed, setAllowed] = useState(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

function Chrome({ live, label }) {
  return (
    <>
      <span className="camaras-corner camaras-corner--tl" aria-hidden="true" />
      <span className="camaras-corner camaras-corner--tr" aria-hidden="true" />
      <span className="camaras-corner camaras-corner--bl" aria-hidden="true" />
      <span className="camaras-corner camaras-corner--br" aria-hidden="true" />
      <div className="camaras-frame-chrome" aria-hidden="true">
        <span className={`pulse-dot camaras-rec-dot${live ? " is-live" : ""}`} />
        {live ? "EN VIVO" : "LOOP"} · {label}
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
function StreamFrame({ name, url, autoplay, onFail }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const near = useNearViewport(wrapRef);
  const [wanted, setWanted] = useState(false);
  const [state, setState] = useState("idle"); // idle | loading | live | error
  const run = near && (autoplay || wanted);

  useEffect(() => {
    const video = videoRef.current;
    if (!run || !video || state === "error") return undefined;
    let cancelled = false;
    let hls = null;
    const fail = () => !cancelled && setState("error");
    const onPlaying = () => !cancelled && setState("live");
    const stall = setTimeout(() => {
      if (!cancelled && video.readyState < 3) fail();
    }, STALL_MS);
    setState((s) => (s === "live" ? s : "loading"));
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", fail);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play().catch(() => {});
    } else {
      import("hls.js/light")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) return fail();
          hls = new Hls({
            capLevelToPlayerSize: true,
            startLevel: 0,
            maxBufferLength: 8,
          });
          hls.on(Hls.Events.ERROR, (_, data) => data.fatal && fail());
          hls.loadSource(url);
          hls.attachMedia(video);
          video.play().catch(() => {});
        })
        .catch(fail);
    }

    return () => {
      cancelled = true;
      clearTimeout(stall);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", fail);
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

  if (state === "error") return <LoopFrame label={name} autoplay={autoplay} />;

  return (
    <div className={`camaras-frame${state === "live" ? " is-live" : ""}`} ref={wrapRef}>
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
 * Cámaras debajo de las reservas. Los links se cargan en el panel
 * (Configuración → Cámaras): el de cada cancha y el del club en Beelup. Una
 * cancha sin link, o con el link vencido, no se muestra; sin ninguno queda
 * el loop de las canchas.
 */
export default function CamarasSection({ courts = [], beelupUrl = "" }) {
  const autoplay = useAutoplayAllowed();
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
            <span className="badge-linear badge-indigo" style={{ marginBottom: 8 }}>
              {live ? "Cámaras en vivo" : "Muzzaga Play"}
            </span>
            <h2 className="section-title">
              {live ? "Mirá las canchas en vivo" : "Así se juega en Muzzaga"}
            </h2>
            <p className="section-desc">
              {live
                ? "Las cámaras de Beelup, en directo desde el club."
                : "Un loop de nuestras canchas de cristal templado."}{" "}
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

        <div className={`camaras-grid${streams.length > 1 ? " is-double" : ""}`}>
          {streams.length ? (
            streams.map((c) => (
              <StreamFrame
                key={c.id}
                name={c.name}
                url={c.streamUrl}
                autoplay={autoplay === true}
                onFail={() => setFailed((f) => ({ ...f, [c.id]: true }))}
              />
            ))
          ) : (
            <LoopFrame label="CANCHAS MUZZAGA" autoplay={autoplay === true} />
          )}
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
