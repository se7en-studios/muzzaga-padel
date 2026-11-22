"use client";

import { useEffect, useRef, useState } from "react";

// La pelota que abre la home: entra desde el costado más lejano, pica una
// vez en el piso, hace una parábola y cae justo donde va el punto de
// "Pádel de verdad." (que es una pelota). Es decoración pura: el título está
// visible desde el primer momento (no se esconde nada para el LCP) y se
// muestra una sola vez por visita. Con "reducir movimiento", o si la página
// tardó en hidratar, no se arma y el punto entra con su pique de siempre.
//
// El recorrido es real: en X la pelota va a velocidad constante y en Y cae
// acelerando (ease-in) y sube frenando (ease-out). Cada eje es una
// animación de transform en su propio <span>, así que todo va por GPU.

const CLAVE = "muzzaga-rally";
const DURACION = 1250; // ms, de que entra a que cae en el punto
const ESPERA = 650; // ms, para que primero suban los renglones del título

export default function HeroRally() {
  const ref = useRef(null);
  const [vuelo, setVuelo] = useState(null);

  useEffect(() => {
    const raiz = ref.current;
    const hero = raiz?.closest(".hero-night");
    const punto = hero?.querySelector(".hero-ball-dot");
    if (!hero || !punto) return undefined;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return undefined;
    if (performance.now() > 2500) return undefined;
    try {
      if (sessionStorage.getItem(CLAVE)) return undefined;
      sessionStorage.setItem(CLAVE, "1");
    } catch {
      // Sin storage (modo privado estricto): se muestra igual.
    }

    // El punto se apaga mientras la pelota viaja; lo prende el aterrizaje.
    hero.classList.add("is-rally");
    const timers = [];
    timers.push(
      setTimeout(() => {
        const hr = hero.getBoundingClientRect();
        const pr = punto.getBoundingClientRect();
        if (pr.width === 0 || pr.bottom < hr.top) {
          hero.classList.remove("is-rally");
          return;
        }
        const tx = pr.left - hr.left + pr.width / 2;
        const ty = pr.top - hr.top + pr.height / 2;
        const ancho = hr.width;
        // Sale del lado más lejano al punto, así el cruce se luce.
        const desdeIzq = tx > ancho / 2;
        const x0 = desdeIzq ? -40 : ancho + 40;
        const y0 = Math.max(24, ty - Math.min(200, hr.height * 0.22));
        const caida = Math.min(240, Math.max(140, hr.height * 0.26));
        const yPique = ty + caida;
        const yCima = ty - Math.min(90, caida * 0.45);
        const xPique = x0 + (tx - x0) * 0.5;
        const tam = Math.max(26, Math.min(40, pr.width * 2.2));
        setVuelo({
          "--x0": `${x0}px`,
          "--tx": `${tx}px`,
          "--y0": `${y0}px`,
          "--yp": `${yPique}px`,
          "--yc": `${yCima}px`,
          "--ty": `${ty}px`,
          "--xp": `${xPique}px`,
          "--tam": `${tam}px`,
          "--fin": `${(pr.width / tam).toFixed(3)}`,
          "--dur": `${DURACION}ms`,
        });
        timers.push(
          setTimeout(() => {
            hero.classList.remove("is-rally");
            hero.classList.add("is-rally-cae");
          }, DURACION),
          setTimeout(() => {
            // Queda quieto: si se sacara la clase, el punto repetiría su
            // pique de entrada.
            hero.classList.replace("is-rally-cae", "is-rally-ok");
            setVuelo(null);
          }, DURACION + 900),
        );
      }, ESPERA),
    );
    return () => {
      timers.forEach(clearTimeout);
      hero.classList.remove("is-rally", "is-rally-cae", "is-rally-ok");
    };
  }, []);

  return (
    <div ref={ref} className="hero-rally" aria-hidden="true" style={vuelo || undefined}>
      {vuelo ? (
        <>
          {/* Estela: tres copias que salen apenas después, más chicas y tenues. */}
          {[3, 2, 1, 0].map((k) => (
            <span key={k} className={`rally-x${k ? " rally-estela" : ""}`} style={{ "--k": k }}>
              <span className="rally-y">
                <span className="rally-pelota" />
              </span>
            </span>
          ))}
          <span className="rally-pique" />
          <span className="rally-golpe" />
        </>
      ) : null}
    </div>
  );
}
