"use client";

import { useState } from "react";
import FeatureCarousel from "./FeatureCarousel";
import Mascota from "./Mascota";
import { Grid2x2, Sprout, Lightbulb, Pizza } from "lucide-react";

// Solo lo que se puede afirmar sin la ficha técnica del club: el espesor
// del cristal, la homologación, el césped y los proyectores quedan afuera
// hasta que el club los confirme.
const SPECS = [
  {
    id: "cristal",
    short: "Cristales",
    title: "Cristal templado",
    subtitle: "Rebote parejo",
    icon: Grid2x2,
    tag: "Las dos canchas",
    desc: "Paredes de cristal templado en las dos canchas: el rebote es parejo en el fondo y en los laterales.",
  },
  {
    id: "cesped",
    short: "Césped",
    title: "Césped sintético",
    subtitle: "Buen agarre",
    icon: Sprout,
    tag: "Las dos canchas",
    desc: "Césped sintético para frenar, girar y arrancar sin resbalarte.",
  },
  {
    id: "led",
    short: "Iluminación",
    title: "Iluminación LED",
    subtitle: "Para jugar de noche",
    icon: Lightbulb,
    tag: "Turnos de noche",
    desc: "Iluminación LED en las dos canchas para jugar de noche, hasta el último turno.",
  },
  {
    id: "cantina",
    short: "Cantina",
    title: "Cantina y tercer tiempo",
    subtitle: "Después de cada partido",
    icon: Pizza,
    tag: "Menú completo",
    desc: "Mesas, pantalla grande para seguir partidos y torneos, pizzas caseras, bebidas frías y opciones sin TACC para después del partido.",
  },
];

export default function AmenitiesSection({ photos }) {
  const [selectedSpec, setSelectedSpec] = useState(SPECS[0].id);

  const active = SPECS.find((s) => s.id === selectedSpec) || SPECS[0];

  return (
    <section id="instalaciones" className="section-bento">
      <div className="container">
        <div className="section-header-row">
          <div>
            <span
              className="badge-linear badge-emerald"
              style={{ marginBottom: 8 }}
            >
              Instalaciones
            </span>
            <h2 className="section-title">
              Todo lo que necesitás para jugar al mejor nivel
            </h2>
            <p className="section-desc">
              Diseñado de cero para brindar la mejor experiencia deportiva y
              social de Catriel.
            </p>
          </div>
          <div className="mascot-section-badge">
            <Mascota
              pose="descanso-mate"
              alt="Muzzaguito descansando con mate y su paletero"
              className="mascot-section-img"
            />
          </div>
        </div>

        <FeatureCarousel photos={photos} />

        <div className="recorrido-cta">
          <div>
            <strong>Recorré el club en 3D</strong>
            <p>
              Caminá con Muzzaguito entre las dos canchas, la cantina y los
              vestuarios, y descubrí cada rincón antes de venir.
            </p>
          </div>
          <a className="btn btn-orange-primary" href="/recorrido">
            Entrar al recorrido
          </a>
        </div>

        {/* FICHA TÉCNICA INTERACTIVA DE PISTAS */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <div>
              <span className="spec-eyebrow">Ficha técnica</span>
              <h3 className="spec-heading">Especificaciones de las pistas</h3>
            </div>

            <div className="spec-tabs" role="tablist" aria-label="Especificaciones">
              {SPECS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedSpec === s.id}
                  className="spec-tab"
                  onClick={() => setSelectedSpec(s.id)}
                >
                  <s.icon size={20} className="icono-marca" aria-hidden="true" />
                  <span>{s.short}</span>
                </button>
              ))}
            </div>
          </div>

          {/* key: re-monta el detalle para que la animación de entrada corra en cada cambio */}
          <div className="spec-detail" key={active.id} role="tabpanel">
            <div className="spec-icon" aria-hidden="true"><active.icon size={20} className="icono-marca" /></div>
            <div>
              <div className="spec-title-row">
                <strong>{active.title}</strong>
                <span className="spec-tag">✓ {active.tag}</span>
              </div>
              <p className="spec-desc">{active.desc}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
