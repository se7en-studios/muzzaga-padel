"use client";

import FeatureCarousel from "./FeatureCarousel";
import Mascota from "./Mascota";

export default function AmenitiesSection({ photos }) {
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

        {/* Instalaciones y ficha técnica en un solo bloque: cada foto lleva su
            renglón de especificación (ver FICHA en FeatureCarousel). Antes la
            ficha iba aparte, debajo, y repetía lo mismo que el carrusel. */}
        <FeatureCarousel photos={photos} />
      </div>
    </section>
  );
}
