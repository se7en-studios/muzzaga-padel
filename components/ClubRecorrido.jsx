"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildWhatsAppLink } from "../data/club";
import { WhatsAppLogo } from "./BrandLogos";

// Una sola fuente para la tarjeta y la tira de zonas: cada parada del
// recorrido tiene su tarjeta y (si es un lugar del club) su chip, con la
// posición `p` (0..1) a la que viaja la cámara al tocarlo. Antes la tarjeta y
// el chip salían de dos cálculos distintos y se desfasaban (chip "Canchas" con
// la tarjeta de la entrada; "Mesas" y "Baños" con la misma tarjeta; al final,
// "Ahora, a jugar" con el chip de los baños).
// Las posiciones son las de los cuadros clave de la ruta de cámara de
// public/recorrido/index.html (modo ?embed=1): 8 cuadros → i / 7.
const STOPS = [
  {
    kick: "El club · Catriel",
    title: "Así es Muzzaga",
    text: "Toda la sede en una maqueta. Scrolleá y recorrela.",
    zona: "Vista general",
    p: 0,
  },
  {
    kick: "Pistas",
    title: "Dos canchas de cristal",
    text: "El Tano y La Vasca: cristal templado, cubiertas y sin viento.",
    zona: "Canchas",
    p: 2 / 7,
  },
  {
    kick: "Cantina",
    title: "Barra y cantina",
    text: "Pizzas al horno, empanadas, tostados y cerveza fría. Con opciones sin TACC.",
    zona: "Barra y cantina",
    p: 4 / 7,
  },
  {
    kick: "Tercer tiempo",
    title: "Mesas con vista",
    text: "Mesas mirando a las canchas para comentar el partido después de jugar.",
    zona: "Mesas",
    p: 5 / 7,
  },
  {
    kick: "Vestuarios",
    title: "Baños y duchas",
    text: "Baños de hombres y de mujeres, con duchas para cambiarte antes y después de jugar.",
    zona: "Baños y duchas",
    p: 6 / 7,
  },
  {
    kick: "Te esperamos",
    title: "Ahora, a jugar",
    text: "Elegí tu día y horario y reservá tu cancha.",
  },
];

// Parada (índice de STOPS) de cada cuadro clave de la ruta. La de cada chip
// sale de su `p` con la misma cuenta (ver stopAt), así que coinciden siempre.
const SHOTS = [0, 0, 1, 1, 2, 3, 4, 5];
const stopAt = (p) => SHOTS[Math.round(p * (SHOTS.length - 1))];

// Los chips: las paradas que son un lugar del club (la última no).
const ZONAS = STOPS.flatMap((s, i) => (s.zona ? [{ label: s.zona, p: s.p, stop: i }] : []));

const WHATSAPP_HREF = buildWhatsAppLink("Hola! Quiero reservar una cancha");

/**
 * Celulares humildes (un Samsung J7 tiene 2-3 GB y GPU de gama baja): la
 * maqueta va en modo liviano, sin los personajes 3D (8 MB), sin sombras ni
 * bloom y dibujando solo cuando la cámara se mueve. ?lite3d=1 lo fuerza.
 */
function wantsLite3d() {
  const nav = window.navigator;
  if (/[?&]lite3d=1/.test(window.location.search)) return true;
  return (
    nav.connection?.saveData === true ||
    (nav.deviceMemory > 0 && nav.deviceMemory <= 4) ||
    (nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4)
  );
}
/**
 * El resto de los celulares (y tablets): la maqueta completa pero más barata
 * de dibujar (sin antialias ni bloom, sombras simples, sin los personajes de
 * 8 MB, ~40 cuadros por segundo). Con la calidad de compu se trababa al
 * scrollear el recorrido en celus comunes.
 */
function wantsMobile3d() {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 900px)").matches
  );
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export default function ClubRecorrido() {
  const sectionRef = useRef(null);
  const sceneRef = useRef(null);
  const frameRef = useRef(null);
  const poiRef = useRef(null);
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  // La parada actual: de acá salen la tarjeta y el chip activo.
  const [step, setStep] = useState(0);

  const post = useCallback((msg) => {
    frameRef.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);

  // El iframe (three.js + texturas ~3 MB; los personajes, ~8 MB más, llegan después y aparecen solos)
  // se pide cuando la sección está por llegar a pantalla, nunca antes: ese parseo de varios MB
  // comparte el hilo principal con la landing (lo advierte el propio motor, ver index.html), así que
  // pedirlo con "cualquier gesto en cualquier parte de la página" —como antes— trababa el scroll
  // desde el primer toque, estés donde estés. El margen (40% del alto de pantalla) da tiempo a que
  // termine de armarse antes de que se vea; si aun así se llega antes, queda la foto + "Armando la
  // maqueta…" unos instantes, mejor que trabar toda la landing de entrada. Con ahorro de datos, se
  // espera a que la sección esté realmente a la vista.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;
    const saveData = navigator.connection?.saveData === true;
    let idleId = null;
    let timerId = null;
    // En el celu, armar la 3D (parsear varios MB y subir texturas) comparte el hilo con la
    // página: si arrancaba con la sección todavía a pantalla y media, el scroll de "Muzzaga Play"
    // se trababa. Ahí se arranca recién cuando la sección está por entrar y con el dedo quieto
    // (≈300 ms sin scroll); mientras tanto se ve la foto de la maqueta.
    const celu = wantsLite3d() || wantsMobile3d();
    let quietId = null;
    let lastScroll = 0;
    const onScroll = () => {
      lastScroll = performance.now();
    };
    const start = () => {
      io.disconnect();
      const run = () =>
        setLoad(wantsLite3d() ? "lite" : wantsMobile3d() ? "movil" : "full");
      const idle = () => {
        if ("requestIdleCallback" in window) {
          idleId = window.requestIdleCallback(run, { timeout: 1500 });
        } else {
          timerId = window.setTimeout(run, 200);
        }
      };
      if (!celu) return idle();
      const waitQuiet = () => {
        if (performance.now() - lastScroll < 300) {
          quietId = window.setTimeout(waitQuiet, 120);
          return;
        }
        window.removeEventListener("scroll", onScroll);
        idle();
      };
      waitQuiet();
    };
    if (celu) window.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start();
      },
      { rootMargin: saveData || celu ? "10% 0px" : "40% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (quietId !== null) window.clearTimeout(quietId);
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.muzzaga === "ready") setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // La maqueta solo dibuja mientras la sección está a la vista (el iframe no puede saberlo por sí solo).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !ready) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => post({ muzzaga: "visible", v: entry.isIntersecting }),
      // Solo dibuja con la sección en pantalla: con margen, en el celu seguía
      // dibujando mientras se scrolleaba la sección de arriba.
      { rootMargin: "0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ready, post]);

  // Scroll → progreso 0..1 → cámara del iframe.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;
    let raf = 0;
    let last = -1;
    let fades = "";
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      // Bordes: mientras el arriba o el abajo de la sección está en pantalla, la maqueta se
      // funde con la página. El degradado se achica hasta 0 justo cuando la sección queda fija.
      const scene = sceneRef.current;
      if (scene) {
        const vh = window.innerHeight;
        const size = Math.min(180, vh * 0.22);
        const top = Math.round(Math.min(size, Math.max(0, rect.top)));
        const bottom = Math.round(
          Math.min(size, Math.max(0, vh - rect.bottom)),
        );
        // Antes era una máscara sobre la 3D que cambiaba de tamaño en cada
        // cuadro del scroll: el celu tenía que recomponer toda la maqueta y
        // se trababa. Ahora son dos franjas con el color de la página encima
        // (alto fijo) y solo cambia su opacidad, que es casi gratis.
        const key = `${top},${bottom}`;
        if (key !== fades) {
          fades = key;
          const franjas = scene.parentElement; // .club-tour-sticky
          franjas.style.setProperty("--fade-size", `${Math.round(size)}px`);
          franjas.style.setProperty("--fade-top-o", (top / size).toFixed(3));
          franjas.style.setProperty("--fade-bottom-o", (bottom / size).toFixed(3));
        }
      }
      const p = clamp01(
        -rect.top / Math.max(1, rect.height - window.innerHeight),
      );
      if (p === last) return;
      last = p;
      // la tarjeta (y el chip) siguen al scroll aunque la 3D todavía se esté armando
      setStep(stopAt(p));
      post({ muzzaga: "tour", p });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ready, post]);

  // Parallax suave: la posición del cursor se manda a la maqueta (se apaga con "reducir movimiento").
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return undefined;
    let raf = 0;
    let pending = null;
    const flush = () => {
      raf = 0;
      post({ muzzaga: "pointer", ...pending });
    };
    const onMove = (e) => {
      pending = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
      if (!raf) raf = requestAnimationFrame(flush);
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [post]);

  // En el celu la tira de zonas no entra entera: la zona activa se centra (solo la tira, no la página).
  useEffect(() => {
    const nav = poiRef.current;
    const i = ZONAS.findIndex((z) => z.stop === step);
    const btn = i >= 0 ? nav?.children[i] : null;
    if (!btn || nav.scrollWidth <= nav.clientWidth) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nav.scrollTo({
      left: btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [step]);

  // Tocar un punto de interés: scroll suave hasta ese tramo, la cámara lo sigue.
  const goTo = (p) => {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({
      top: top + p * (el.offsetHeight - window.innerHeight),
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const stop = STOPS[step];

  return (
    <section
      ref={sectionRef}
      id="recorrido"
      className="club-tour"
      data-load={load || undefined}
      aria-label="Recorrido 3D del club"
      style={{ "--stops": STOPS.length }}
    >
      <div className="club-tour-sticky">
        <div ref={sceneRef} className="club-tour-scene">
          {load && (
            <iframe
              ref={frameRef}
              className={`club-tour-frame${ready ? " is-ready" : ""}`}
              src={`/recorrido/index.html?embed=1${load === "lite" ? "&lite=1" : load === "movil" ? "&movil=1" : ""}&v=20261123c`}
              title="Maqueta 3D del club Muzzaga"
              tabIndex={-1}
              aria-hidden="true"
            />
          )}
        </div>
        {!ready && (
          <div className="club-tour-loading">
            <span className="club-tour-loading-ball" aria-hidden="true" />
            Armando la maqueta…
          </div>
        )}

        <nav ref={poiRef} className="club-tour-poi" aria-label="Zonas del club">
          {ZONAS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={item.stop === step ? "on" : ""}
              aria-current={item.stop === step ? "true" : undefined}
              onClick={() => goTo(item.p)}
            >
              <span className="club-tour-poi-dot" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="club-tour-card" role="status" aria-live="polite">
          <div className="club-tour-card-head">
            <span key={step} className="club-tour-kick">
              {stop.kick}
            </span>
            <a className="club-tour-link" href="/recorrido">
              Recorrer el club →
            </a>
          </div>
          <ol className="club-tour-dots" aria-hidden="true">
            {STOPS.map((s, i) => (
              <li key={s.title} className={i === step ? "on" : ""} />
            ))}
          </ol>
          {/* Todas las paradas en la misma celda (solo se ve la actual): la
              tarjeta mide lo que la más larga y no cambia de alto al
              scrollear (antes movía la página: CLS). */}
          <div className="club-tour-card-body">
            {STOPS.map((s, i) => {
              const on = i === step;
              const Title = on ? "h2" : "p";
              return (
                <div
                  key={s.title}
                  className={`club-tour-card-stop${on ? " on" : ""}`}
                  aria-hidden={on ? undefined : "true"}
                >
                  <Title className="club-tour-title">{s.title}</Title>
                  <p className="club-tour-text">{s.text}</p>
                </div>
              );
            })}
          </div>
          <div className="club-tour-actions">
            <a className="btn btn-orange-primary club-tour-btn" href="#reservar">
              Reservar turno
            </a>
            <a
              className="btn btn-secondary-whatsapp club-tour-btn"
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppLogo color="currentColor" /> WhatsApp
            </a>
          </div>
        </div>

        <span
          className="club-tour-scroll"
          aria-hidden="true"
          data-hide={step > 0}
        >
          Scrolleá ↓
        </span>
      </div>
    </section>
  );
}
