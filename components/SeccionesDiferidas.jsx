"use client";

import { Suspense, lazy, useEffect } from "react";

// Secciones de la landing que quedan lejos de la primera pantalla. El HTML
// llega igual del servidor (se ve idéntico y lo leen los buscadores); lo que
// se demora es bajar y ejecutar su JS hasta que el usuario se acerca. Así el
// celu no paga al abrir, por ejemplo, la librería de animaciones (motion) del
// carrusel de Instalaciones. Mientras tanto React deja ese HTML tal cual y lo
// "despierta" cuando llega el código.
//
// No se usa next/dynamic a propósito: con SSR agrega <link rel="preload"> del
// chunk en el HTML y se bajaría al abrir igual.

// Margen amplio: el código llega bastante antes de que la sección entre en
// pantalla (el recorrido 3D arranca su propia carga al 40 % de pantalla).
const MARGEN = "1200px 0px";
const EN_SERVIDOR = typeof window === "undefined";
// Hasta que la página termina de hidratarse, el HTML de cada sección ya está
// en el DOM. Después, una sección nueva viene de una navegación del cliente:
// no hay HTML que esperar (y un id igual de la página anterior, como #torneos
// en /torneos, dejaría la carga colgada), así que se carga ya.
let paginaHidratada = false;

function diferida(id, cargar) {
  let soltar;
  let soltada = false;
  let observada = null;
  // Si se soltó porque la sección no estaba en el DOM (llegada por navegación
  // del cliente, p. ej. "/#herramientas" desde las migas), hay que reubicar el ancla.
  let porNavegacion = 0;
  const permiso = EN_SERVIDOR ? null : new Promise((r) => (soltar = r));

  const Seccion = lazy(() => (EN_SERVIDOR ? cargar() : permiso.then(cargar)));

  function liberar(navegacion) {
    if (soltada) return;
    soltada = true;
    if (navegacion) porNavegacion = Date.now();
    soltar();
  }

  // Se mira en el render (no en un efecto): en la hidratación hay que decidir
  // antes de que React intente mostrar la sección.
  function vigilar() {
    if (EN_SERVIDOR || soltada) return;
    if (paginaHidratada) {
      liberar(true);
      return;
    }
    const el = document.getElementById(id);
    if (!el || typeof IntersectionObserver === "undefined") {
      liberar(!el);
      return;
    }
    if (observada === el) return;
    observada = el;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          liberar(false);
        }
      },
      { rootMargin: MARGEN },
    );
    io.observe(el);
  }

  function Reubicar() {
    useEffect(() => {
      // Solo recién llegado por navegación: no mover a quien ya scrolleó.
      if (!porNavegacion || Date.now() - porNavegacion > 3000) return;
      porNavegacion = 0;
      const hash = decodeURIComponent(window.location.hash.slice(1));
      document.getElementById(hash)?.scrollIntoView();
    }, []);
    return null;
  }

  function Diferida(props) {
    vigilar();
    useEffect(() => {
      paginaHidratada = true;
    }, []);
    return (
      <Suspense fallback={null}>
        <Seccion {...props} />
        <Reubicar />
      </Suspense>
    );
  }
  Diferida.displayName = `Diferida(${id})`;
  return Diferida;
}

export const CamarasSection = diferida("camaras", () => import("./CamarasSection"));
export const ClubRecorrido = diferida("recorrido", () => import("./ClubRecorrido"));
export const AmenitiesSection = diferida("instalaciones", () => import("./AmenitiesSection"));
export const HomeTorneosTeaser = diferida("torneos", () => import("./HomeTorneosTeaser"));
export const ClubToolsSection = diferida("herramientas", () => import("./ClubToolsSection"));
export const FaqSection = diferida("faq", () => import("./FaqSection"));
