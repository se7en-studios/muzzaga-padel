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

// La ruta: puntos repartidos parejo a lo largo del scroll de la sección, cada
// uno con su parada (índice de STOPS) y la posición de cámara `cam` (0..1)
// que se le manda a la maqueta. Entre dos puntos la cámara va de una a otra
// (la maqueta suaviza el viaje por los cuadros clave intermedios); la parada
// —tarjeta, chip y puntitos— es la del punto más cercano. Una sola cuenta
// para todo, así que nunca se desfasan.
// Compu: los 8 cuadros clave, uno por tramo (cam = i / 7), como siempre.
const RUTA_PC = [0, 0, 1, 1, 2, 3, 4, 5].map((stop, i) => ({ stop, cam: i / 7 }));
// Celu: solo vista general → canchas → barra y cantina (la sección mide 2,5
// pantallas en vez de 6; ver ClubRecorrido.css). El último tramo se queda en
// la barra para que se vea antes de seguir con la página. Mesas y Baños
// quedan en los chips: tocarlos mueve la cámara sin scrollear.
const RUTA_CELU = [
  { stop: 0, cam: 0 },
  { stop: 1, cam: STOPS[1].p },
  { stop: 2, cam: STOPS[2].p },
  { stop: 2, cam: STOPS[2].p },
];
// Misma condición que el CSS que acorta la sección (y que wantsMobile3d).
const CELU_MQ = "(pointer: coarse), (max-width: 900px)";

/** Scroll 0..1 → { cam, stop } sobre la ruta. */
function enRuta(ruta, s) {
  const f = clamp01(s) * (ruta.length - 1);
  const i = Math.min(ruta.length - 2, Math.floor(f));
  const t = f - i;
  return {
    cam: ruta[i].cam + (ruta[i + 1].cam - ruta[i].cam) * t,
    stop: ruta[Math.round(f)].stop,
  };
}

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
  // Recorrido corto del celu (RUTA_CELU) o el completo de la compu. El alto
  // de la sección lo pone el CSS con la misma media query: el HTML del
  // servidor ya llega con la altura justa y no salta nada al hidratar.
  const [celu, setCelu] = useState(false);
  const ruta = celu ? RUTA_CELU : RUTA_PC;
  // Zona elegida con un chip que no está en la ruta (Mesas o Baños en el
  // celu): la cámara va ahí sin scrollear y vuelve a seguir al scroll apenas
  // la persona se mueve un poco.
  const fueraRef = useRef(null);

  const post = useCallback((msg) => {
    frameRef.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);

  // Cuándo se arma la maqueta (three.js + texturas ~3 MB; los personajes, ~8 MB más, solo en la compu).
  // Armarla comparte el hilo principal con la landing (el iframe es del mismo sitio), así que el
  // truco es elegir el momento:
  // - Celu: apenas la página terminó de cargar y queda ociosa (requestIdleCallback), esté donde
  //   esté el usuario. La escena se arma en tandas cortas y, hasta que la sección se ve, no dibuja
  //   nada: cuando el usuario llega ya está lista ("que cargue ahí nomás"). Si llega antes (scroll
  //   rápido), a dos pantallas de distancia se arranca igual, sin esperar a que suelte el dedo.
  //   Antes se esperaba a estar al 10 % y con el dedo quieto: no trababa, pero aparecía tarde.
  // - Compu: al 40 % de pantalla, como siempre (arma rapidísimo).
  // - Con ahorro de datos: recién con la sección a la vista y el dedo quieto, como antes.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return undefined;
    const saveData = navigator.connection?.saveData === true;
    const celu = wantsLite3d() || wantsMobile3d();
    let idleId = null;
    let timerId = null;
    let quietId = null;
    let lastScroll = 0;
    let started = false;
    const onScroll = () => {
      lastScroll = performance.now();
    };
    const run = () =>
      setLoad(wantsLite3d() ? "lite" : wantsMobile3d() ? "movil" : "full");
    const start = (timeout = 1500) => {
      if (started) return;
      started = true;
      io.disconnect();
      window.removeEventListener("load", onLoad);
      if (timerId !== null) window.clearTimeout(timerId);
      const idle = () => {
        if ("requestIdleCallback" in window) {
          idleId = window.requestIdleCallback(run, { timeout });
        } else {
          timerId = window.setTimeout(run, 200);
        }
      };
      if (!saveData) return idle();
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
    // Celu: un ratito después de cargar (que primero termine lo de la primera pantalla).
    const onLoad = () => {
      timerId = window.setTimeout(() => start(3000), 600);
    };
    if (saveData) window.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start(celu ? 400 : 1500);
      },
      { rootMargin: saveData ? "10% 0px" : celu ? "200% 0px" : "40% 0px" },
    );
    io.observe(el);
    if (celu && !saveData) {
      if (document.readyState === "complete") onLoad();
      else window.addEventListener("load", onLoad, { once: true });
    }
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("load", onLoad);
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

  useEffect(() => {
    const mq = window.matchMedia(CELU_MQ);
    const sync = () => setCelu(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // La maqueta solo dibuja mientras la sección está a la vista (el iframe no puede saberlo por sí solo).
  // Ahora se arma mucho antes de llegar: arranca sin dibujar (ver index.html) y se le avisa desde
  // el primer momento; al estar lista se le repite, por si el aviso llegó antes que su oído.
  const visibleRef = useRef(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !load) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        post({ muzzaga: "visible", v: entry.isIntersecting });
      },
      // Solo dibuja con la sección en pantalla: con margen, en el celu seguía
      // dibujando mientras se scrolleaba la sección de arriba.
      { rootMargin: "0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [load, post]);
  useEffect(() => {
    if (ready) post({ muzzaga: "visible", v: visibleRef.current });
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
      const fuera = fueraRef.current;
      if (fuera && Math.abs(window.scrollY - fuera.y) < 48) {
        if (last !== -2) post({ muzzaga: "tour", p: fuera.cam });
        last = -2;
        return;
      }
      fueraRef.current = null;
      const s = clamp01(
        -rect.top / Math.max(1, rect.height - window.innerHeight),
      );
      if (s === last) return;
      last = s;
      const { cam, stop } = enRuta(ruta, s);
      // la tarjeta (y el chip) siguen al scroll aunque la 3D todavía se esté armando
      setStep(stop);
      post({ muzzaga: "tour", p: cam });
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
  }, [ready, post, ruta]);

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

  // Tocar un punto de interés: scroll suave hasta su tramo de la ruta y la
  // cámara lo sigue. Si la zona no está en la ruta (celu), la cámara va
  // directo, sin mover la página.
  const goTo = (zona) => {
    const el = sectionRef.current;
    if (!el) return;
    const j = ruta.findIndex((r) => r.stop === zona.stop);
    if (j < 0) {
      fueraRef.current = { y: window.scrollY, cam: zona.p };
      setStep(zona.stop);
      post({ muzzaga: "tour", p: zona.p });
      return;
    }
    fueraRef.current = null;
    const p = j / (ruta.length - 1);
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
  const paradas = [...new Set(ruta.map((r) => r.stop))];

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
              src={`/recorrido/index.html?embed=1${load === "lite" ? "&lite=1" : load === "movil" ? "&movil=1" : ""}&v=20261125a`}
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
              onClick={() => goTo(item)}
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
            {paradas.map((i) => (
              <li key={i} className={i === step ? "on" : ""} />
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
