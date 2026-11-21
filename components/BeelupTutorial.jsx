"use client";

import { useEffect, useRef, useState } from "react";

// Tutorial "Cómo ver tu partido en Beelup", paso a paso.
// Los pasos copian la pantalla real de Beelup: Club → Cancha → Día →
// Horario → VER VIDEO. Cada paso tiene una pantallita de ejemplo con el
// campo que hay que tocar resaltado.

const ICON = "/img/marcas/beelup-icono.svg";

const CAMPOS = [
  { key: "club", label: "Club", valor: "MUZZAGA PADEL" },
  { key: "cancha", label: "Cancha", valor: "EL TANO" },
  { key: "dia", label: "Día", valor: "HOY" },
  { key: "horario", label: "Horario", valor: "14:00 a 15:40" },
];

const PASOS = [
  {
    titulo: "Abrí Beelup",
    texto: "Tocá el botón amarillo “Ver mi partido” acá en la web. Se abre Beelup en otra pestaña.",
    foco: "abrir",
  },
  {
    titulo: "Elegí el club",
    texto: "En “Club” buscá y elegí Muzzaga Padel.",
    foco: "club",
  },
  {
    titulo: "Elegí la cancha",
    texto: "La cancha donde jugaste: El Tano o La Vasca.",
    foco: "cancha",
  },
  {
    titulo: "Elegí el día",
    texto: "“Hoy” si jugaste hoy, o la fecha de tu partido.",
    foco: "dia",
  },
  {
    titulo: "Elegí el horario",
    texto: "El horario en el que jugaste tu turno.",
    foco: "horario",
  },
  {
    titulo: "Tocá “Ver video”",
    texto: "Y listo: mirá tu partido, adelantá hasta tus mejores puntos y pasale el link a tus amigos.",
    foco: "ver",
  },
];

function Pantallita({ foco, paso }) {
  if (foco === "abrir") {
    return (
      <div className="bt-mock bt-mock-web" aria-hidden="true">
        <span className="bt-web-tit">Reviví tu <em>partido</em></span>
        <span className="bt-web-btn">
          Ver mi partido
          <span className="bt-dedo">👆</span>
        </span>
        <span className="bt-web-nota">Se abre beelup.com</span>
      </div>
    );
  }
  const idxFoco = CAMPOS.findIndex((c) => c.key === foco);
  const llenos = foco === "ver" ? CAMPOS.length : idxFoco;
  return (
    <div className="bt-mock" aria-hidden="true">
      <span className="bt-mock-bar">
        <img src={ICON} alt="" width={14} height={15} />
        beelup
      </span>
      <span className="bt-mock-campos">
        {CAMPOS.map((c, i) => {
          const activo = c.key === foco;
          const lleno = i < llenos || activo;
          return (
            <span
              key={c.key}
              className={`bt-campo${activo ? " is-foco" : ""}${lleno ? "" : " is-vacio"}`}
            >
              <small>{c.label}</small>
              <b>{lleno ? c.valor : "Elegí…"}</b>
              {activo ? <span className="bt-dedo">👆</span> : null}
            </span>
          );
        })}
        <span className={`bt-ver${foco === "ver" ? " is-foco" : ""}`}>
          VER VIDEO
          {foco === "ver" ? <span className="bt-dedo">👆</span> : null}
        </span>
      </span>
      <span className="bt-mock-paso">{paso}/6</span>
    </div>
  );
}

export default function BeelupTutorial({ href }) {
  const dialogRef = useRef(null);
  const trackRef = useRef(null);
  const [actual, setActual] = useState(0);

  // Qué paso se ve: cuando el carrusel termina de deslizarse (con el dedo
  // o con los botones), se toma el slide que quedó a la vista.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    let t = 0;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const w = track.clientWidth || 1;
        setActual(Math.min(PASOS.length - 1, Math.max(0, Math.round(track.scrollLeft / w))));
      }, 120);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      track.removeEventListener("scroll", onScroll);
    };
  }, []);

  const irA = (i) => {
    const track = trackRef.current;
    if (!track || i < 0 || i >= PASOS.length) return;
    setActual(i);
    const slide = track.children[i];
    // Salto directo (el desplazamiento suave se traba en algunos celus);
    // la entrada del paso la anima el CSS.
    track.scrollTo({ left: slide.offsetLeft - track.firstElementChild.offsetLeft, behavior: "auto" });
  };

  const abrir = () => {
    const d = dialogRef.current;
    if (!d) return;
    d.showModal();
    requestAnimationFrame(() => {
      if (trackRef.current) trackRef.current.scrollLeft = 0;
      setActual(0);
    });
  };

  const cerrar = () => dialogRef.current?.close();

  const ultimo = actual === PASOS.length - 1;

  return (
    <>
      <button type="button" className="bt-abrir" onClick={abrir}>
        <span className="bt-abrir-ico" aria-hidden="true">?</span>
        ¿Cómo encuentro mi partido? <b>Tutorial paso a paso</b>
      </button>

      <dialog
        ref={dialogRef}
        className="bt-dialog"
        aria-labelledby="bt-titulo"
        onClick={(e) => {
          // Tocar afuera de la hoja la cierra.
          if (e.target === e.currentTarget) cerrar();
        }}
      >
        <div className="bt-hoja">
          <header className="bt-head">
            <span className="bt-head-logo" aria-hidden="true">
              <img src={ICON} alt="" width={22} height={24} />
            </span>
            <span>
              <small>Tutorial · Beelup</small>
              <strong id="bt-titulo">Cómo ver tu partido</strong>
            </span>
            <button type="button" className="bt-cerrar" onClick={cerrar} aria-label="Cerrar tutorial">
              ✕
            </button>
          </header>

          <div className="bt-progreso" aria-hidden="true">
            {PASOS.map((p, i) => (
              <span key={p.titulo} className={i <= actual ? "is-on" : ""} />
            ))}
          </div>

          <ol className="bt-track" ref={trackRef}>
            {PASOS.map((p, i) => (
              <li key={p.titulo} className={`bt-slide${i === actual ? " is-act" : ""}`} data-i={i} aria-label={`Paso ${i + 1} de ${PASOS.length}`}>
                <Pantallita foco={p.foco} paso={i + 1} />
                <span className="bt-num">Paso {i + 1}</span>
                <h3 className="bt-tit">{p.titulo}</h3>
                <p className="bt-txt">{p.texto}</p>
              </li>
            ))}
          </ol>

          <p className="bt-tip">
            <b>¿No te acordás la cancha o el horario?</b> Están en el pase
            digital que te quedó al reservar el turno.
          </p>

          <footer className="bt-nav">
            <button
              type="button"
              className="bt-nav-btn bt-nav-atras"
              onClick={() => irA(actual - 1)}
              disabled={actual === 0}
            >
              ← Atrás
            </button>
            {ultimo ? (
              <a className="bt-nav-btn bt-nav-ir" href={href} target="_blank" rel="noopener noreferrer">
                Abrir Beelup ↗
              </a>
            ) : (
              <button type="button" className="bt-nav-btn bt-nav-sig" onClick={() => irA(actual + 1)}>
                Siguiente →
              </button>
            )}
          </footer>
        </div>
      </dialog>
    </>
  );
}
