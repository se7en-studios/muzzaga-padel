"use client";

import { useEffect, useRef, useState } from "react";
import { buildWhatsAppLink } from "../data/club";
import { WhatsAppLogo } from "./BrandLogos";
import { crearSecuencia, indiceDeCam } from "./secuenciaRecorrido";
import MANIFIESTO_CELU from "../public/recorrido/secuencia/movil/manifest.json";
import MANIFIESTO_COMPU from "../public/recorrido/secuencia/compu/manifest.json";

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
// del recorrido (cada foto de la secuencia tiene la suya). Entre dos puntos
// la cámara va de una a otra; la parada
// —tarjeta, chip y puntitos— es la del punto más cercano. Una sola cuenta
// para todo, así que nunca se desfasan.
// Compu: los 8 cuadros clave, uno por tramo (cam = i / 7), como siempre.
const RUTA_PC = [0, 0, 1, 1, 2, 3, 4, 5].map((stop, i) => ({ stop, cam: i / 7 }));
// Celu: solo vista general → canchas → barra y cantina (la sección mide 1,8
// pantallas en vez de 6; ver ClubRecorrido.css). El último tramo se queda en
// la barra para que se vea antes de seguir con la página. Mesas y Baños
// quedan en los chips: tocarlos lleva la foto ahí sin scrollear.
const RUTA_CELU = [
  { stop: 0, cam: 0 },
  { stop: 1, cam: STOPS[1].p },
  { stop: 2, cam: STOPS[2].p },
  { stop: 2, cam: STOPS[2].p },
];
// Misma condición que el CSS que acorta la sección.
const CELU_MQ = "(pointer: coarse), (max-width: 900px)";

/** Scroll 0..1 → { cam, stop, camParada } sobre la ruta. */
function enRuta(ruta, s) {
  const f = clamp01(s) * (ruta.length - 1);
  const i = Math.min(ruta.length - 2, Math.floor(f));
  const t = f - i;
  const cerca = ruta[Math.round(f)];
  return {
    cam: ruta[i].cam + (ruta[i + 1].cam - ruta[i].cam) * t,
    stop: cerca.stop,
    // con "reducir movimiento" no hay viaje: se queda en la foto de la parada
    camParada: cerca.cam,
  };
}

// Los chips: las paradas que son un lugar del club (la última no).
const ZONAS = STOPS.flatMap((s, i) => (s.zona ? [{ label: s.zona, p: s.p, stop: i }] : []));

const WHATSAPP_HREF = buildWhatsAppLink("Hola! Quiero reservar una cancha");

// Las fotos del recorrido (scripts/render-recorrido.mjs): una secuencia
// vertical para el celu y una apaisada para la compu, cada una con su
// manifiesto (cuántas fotos, tamaño, cámara de cada una y archivos, con el
// hash en el nombre). Los manifiestos vienen dentro de este JS: no hay pedido
// aparte y nunca quedan desfasados de las fotos.
const SECUENCIAS = {
  celu: { manifiesto: MANIFIESTO_CELU, carpeta: "/recorrido/secuencia/movil" },
  compu: { manifiesto: MANIFIESTO_COMPU, carpeta: "/recorrido/secuencia/compu" },
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function ClubRecorrido() {
  const sectionRef = useRef(null);
  const sceneRef = useRef(null);
  const canvasRef = useRef(null);
  const poiRef = useRef(null);
  // ya se dibujó la primera foto (hasta entonces se ve la foto fija de fondo)
  const [listo, setListo] = useState(false);
  // La parada actual: de acá salen la tarjeta y el chip activo.
  const [step, setStep] = useState(0);
  // Recorrido corto del celu (RUTA_CELU) o el completo de la compu. El alto
  // de la sección lo pone el CSS con la misma media query: el HTML del
  // servidor ya llega con la altura justa y no salta nada al hidratar.
  // null hasta saberlo (al montar): así no se empieza a bajar la secuencia
  // equivocada.
  const [celu, setCelu] = useState(null);
  const ruta = celu ? RUTA_CELU : RUTA_PC;
  // Zona elegida con un chip que no está en la ruta (Mesas o Baños en el
  // celu): la cámara va ahí sin scrollear y vuelve a seguir al scroll apenas
  // la persona se mueve un poco.
  const fueraRef = useRef(null);
  // Para el chip "fuera de ruta": le avisa al bucle de dibujo que recalcule.
  const refrescarRef = useRef(() => {});

  useEffect(() => {
    const mq = window.matchMedia(CELU_MQ);
    const sync = () => setCelu(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Scroll → parada (tarjeta y chip) y posición en la secuencia → lienzo.
  // Todo en un requestAnimationFrame y solo con la sección en pantalla: fuera
  // de la vista no se hace nada (ni se escucha el scroll).
  useEffect(() => {
    const el = sectionRef.current;
    const scene = sceneRef.current;
    const canvas = canvasRef.current;
    if (!el || !scene || !canvas || celu === null) return undefined;
    const { manifiesto, carpeta } = SECUENCIAS[celu ? "celu" : "compu"];
    const cams = manifiesto.cams;
    const reduce = reduceMotion();
    // Cerca de una foto se queda en esa foto justa: el scroll redondea a
    // medio píxel y quedaba un 2 % de fundido con la vecina (se veía el
    // fantasma de la etiqueta de la parada).
    const indice = (cam) => {
      const i = indiceDeCam(cams, cam);
      return Math.abs(i - Math.round(i)) < 0.08 ? Math.round(i) : i;
    };
    // primero la vista general, después el resto de las paradas de la ruta y
    // las de los chips (cada parada se ve nítida apenas se llega)
    const claves = [
      ...new Set([0, ...ruta.map((r) => r.cam), ...ZONAS.map((z) => z.p)].map((c) => Math.round(indice(c)))),
    ];
    const ctx = canvas.getContext("2d", { alpha: false });
    let raf = 0;
    let visible = false;
    let pos = -1; // foto que se ve (con decimales: fundido entre dos)
    let meta = 0; // foto a la que se va
    let lento = false; // viaje de un chip fuera de ruta: más pausado
    let antes = 0;
    let dibujado = "";
    let fades = "";
    let ancho = 0;
    let alto = 0;

    const seq = crearSecuencia({
      manifiesto,
      carpeta,
      claves,
      soloClaves: reduce,
      alCambiar: () => {
        dibujado = "";
        pedir();
      },
    });

    const dibujar = () => {
      if (!ancho || !alto) return;
      const d = seq.paraDibujar(pos);
      if (!d) return;
      // solo se dibuja si cambió algo que se vea (foto, fundido o tamaño)
      const key = `${d.A._i}|${d.B ? d.B._i : ""}|${Math.round(d.t * 24)}|${ancho}x${alto}`;
      if (key === dibujado) return;
      dibujado = key;
      // como object-fit: cover, centrada
      const fw = manifiesto.ancho;
      const fh = manifiesto.alto;
      const k = Math.max(ancho / fw, alto / fh);
      const sw = ancho / k;
      const sh = alto / k;
      const sx = (fw - sw) / 2;
      const sy = (fh - sh) / 2;
      ctx.globalAlpha = 1;
      ctx.drawImage(d.A, sx, sy, sw, sh, 0, 0, ancho, alto);
      if (d.B && Math.round(d.t * 24) > 0) {
        ctx.globalAlpha = Math.round(d.t * 24) / 24;
        ctx.drawImage(d.B, sx, sy, sw, sh, 0, 0, ancho, alto);
        ctx.globalAlpha = 1;
      }
      if (!el.dataset.listo) {
        el.dataset.listo = "1";
        setListo(true);
      }
    };

    // La foto que se ve persigue a la del scroll con un suavizado corto
    // (como la cámara de la maqueta): al scrollear de a saltos —rueda del
    // mouse, flick del celu— igual se ve un viaje parejo.
    const paso = (now) => {
      raf = 0;
      const dt = antes ? Math.min(0.1, (now - antes) / 1000) : 1 / 60;
      antes = now;
      if (pos < 0 || reduce) pos = meta;
      else {
        pos += (meta - pos) * (1 - Math.exp(-dt / (lento ? 0.32 : 0.09)));
        if (Math.abs(meta - pos) < 0.01) pos = meta;
      }
      dibujar();
      if (pos !== meta && visible) raf = requestAnimationFrame(paso);
      else antes = 0;
    };
    function pedir() {
      if (!raf && visible) raf = requestAnimationFrame(paso);
    }

    const medir = () => {
      const r = scene.getBoundingClientRect();
      // a la resolución de las fotos como mucho (más grande no suma nitidez)
      const k = Math.max(r.width / manifiesto.ancho, r.height / manifiesto.alto);
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.max(1, 1 / k));
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (w === ancho && h === alto) return;
      ancho = canvas.width = w;
      alto = canvas.height = h;
      dibujado = "";
      pedir();
    };

    const update = () => {
      const rect = el.getBoundingClientRect();
      // Bordes: mientras el arriba o el abajo de la sección está en pantalla, la maqueta se
      // funde con la página. El degradado se achica hasta 0 justo cuando la sección queda fija.
      // Son dos franjas con el color de la página encima (alto fijo) y solo cambia su
      // opacidad, que es casi gratis.
      const vh = window.innerHeight;
      const size = Math.min(180, vh * 0.22);
      const top = Math.round(Math.min(size, Math.max(0, rect.top)));
      const bottom = Math.round(Math.min(size, Math.max(0, vh - rect.bottom)));
      const key = `${top},${bottom}`;
      if (key !== fades) {
        fades = key;
        const franjas = scene.parentElement; // .club-tour-sticky
        franjas.style.setProperty("--fade-size", `${Math.round(size)}px`);
        franjas.style.setProperty("--fade-top-o", (top / size).toFixed(3));
        franjas.style.setProperty("--fade-bottom-o", (bottom / size).toFixed(3));
      }
      const fuera = fueraRef.current;
      if (fuera && Math.abs(window.scrollY - fuera.y) < 48) {
        meta = indice(fuera.cam);
        lento = true;
      } else {
        fueraRef.current = null;
        lento = false;
        const s = clamp01(-rect.top / Math.max(1, rect.height - vh));
        const r = enRuta(ruta, s);
        // la tarjeta (y el chip) siguen al scroll aunque la foto todavía esté bajando
        setStep(r.stop);
        meta = indice(reduce ? r.camParada : r.cam);
      }
      pedir();
    };
    refrescarRef.current = update;

    let scrollRaf = 0;
    const onScroll = () => {
      if (visible && !scrollRaf)
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          update();
        });
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        medir();
        update();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        antes = 0;
      }
    });
    io.observe(el);
    const ro = new ResizeObserver(() => {
      if (!visible) return;
      medir();
      update();
    });
    ro.observe(scene);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      refrescarRef.current = () => {};
      seq.destruir();
      delete el.dataset.listo;
    };
  }, [celu, ruta]);

  // Parallax suave con el cursor (compu): la foto se corre apenas, como
  // antes giraba un poco la cámara. Solo un transform del lienzo; se apaga
  // con "reducir movimiento" y en pantallas táctiles.
  useEffect(() => {
    const el = sectionRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas || reduceMotion() || !window.matchMedia("(pointer: fine)").matches)
      return undefined;
    let raf = 0;
    let x = 0;
    let y = 0;
    const flush = () => {
      raf = 0;
      canvas.style.transform = `scale(1.03) translate3d(${(-x * 0.9).toFixed(2)}%, ${(-y * 0.6).toFixed(2)}%, 0)`;
    };
    const onMove = (e) => {
      x = (e.clientX / window.innerWidth) * 2 - 1;
      y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
      canvas.style.transform = "";
    };
  }, []);

  // En el celu la tira de zonas no entra entera: la zona activa se centra (solo la tira, no la página).
  useEffect(() => {
    const nav = poiRef.current;
    const i = ZONAS.findIndex((z) => z.stop === step);
    const btn = i >= 0 ? nav?.children[i] : null;
    if (!btn || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({
      left: btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2,
      behavior: reduceMotion() ? "auto" : "smooth",
    });
  }, [step]);

  // Tocar un punto de interés: scroll suave hasta su tramo de la ruta y la
  // foto lo sigue. Si la zona no está en la ruta (celu), viaja directo, sin
  // mover la página.
  const goTo = (zona) => {
    const el = sectionRef.current;
    if (!el) return;
    const j = ruta.findIndex((r) => r.stop === zona.stop);
    if (j < 0) {
      fueraRef.current = { y: window.scrollY, cam: zona.p };
      setStep(zona.stop);
      refrescarRef.current();
      return;
    }
    fueraRef.current = null;
    const p = j / (ruta.length - 1);
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + p * (el.offsetHeight - window.innerHeight),
      behavior: reduceMotion() ? "auto" : "smooth",
    });
  };

  const stop = STOPS[step];
  const paradas = [...new Set(ruta.map((r) => r.stop))];

  return (
    <section
      ref={sectionRef}
      id="recorrido"
      className="club-tour"
      aria-label="Recorrido 3D del club"
      style={{ "--stops": STOPS.length }}
    >
      <div className="club-tour-sticky">
        <div ref={sceneRef} className="club-tour-scene">
          <canvas
            ref={canvasRef}
            className={`club-tour-canvas${listo ? " is-ready" : ""}`}
            aria-hidden="true"
          />
        </div>
        {!listo && (
          <div className="club-tour-loading">
            <span className="club-tour-loading-ball" aria-hidden="true" />
            Cargando el recorrido…
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
