import Link from "next/link";
import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";
import BottomNav from "../../../components/BottomNav";
import RatingCalculator from "../../../components/RatingCalculator";
import { PADEL_LEVELS } from "../../../data/levels";
import Mascota from "../../../components/Mascota";
import { pageMetadata } from "../../../lib/pageMeta";

export const metadata = pageMetadata({
  title: "Test de nivel de pádel: ¿qué categoría sos? · Muzzaga Pádel",
  description:
    "Descubrí tu nivel de pádel en la escala internacional (1.0 a 7.0) y su equivalencia con las categorías argentinas (7ma a 1ra). Sumate a partidos parejos.",
  path: "/herramientas/nivel",
});

export default function NivelPage() {
  return (
    <>
      <SiteHeader />
      <main style={{ paddingTop: 90, minHeight: "80vh" }}>
        <div className="container" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 8px", fontSize: 13, color: "var(--text-muted)" }}>
            <Link className="back-link" href="/" style={{ color: "var(--color-accent-orange-text)", textDecoration: "none", fontWeight: 600 }}>
              ← Volver al inicio
            </Link>
            <span>/</span>
            <span>Herramientas</span>
            <span>/</span>
            <span style={{ color: "var(--text-primary)" }}>Test de nivel</span>
          </div>
        </div>

        <section className="section-turnos" style={{ paddingTop: 10 }}>
          <div className="container">
            <div className="section-header-row">
              <div>
                <span className="badge-linear badge-indigo" style={{ marginBottom: 8 }}>
                  Evaluación deportiva
                </span>
                <h1 className="section-title">Calculá tu nivel de juego</h1>
                <p className="section-desc">
                  Mapeamos la escala internacional de nivel (1.0 a 7.0) con las
                  categorías del pádel argentino (7ma a 1ra) para que siempre
                  compitas de igual a igual.
                </p>
              </div>
              <div className="mascot-section-badge">
                <Mascota
                  pose="pelota-padel-life"
                  alt="Muzzaguito sosteniendo pelota de pádel"
                  className="mascot-section-img"
                />
              </div>
            </div>

            <div className="rating-grid-layout" style={{ marginTop: 24 }}>
              <div>
                <h2 style={{ fontSize: 18, color: "var(--color-ink)", marginBottom: 14 }}>
                  Categorías en Argentina
                </h2>

                {PADEL_LEVELS.map((lvl) => (
                  <div className="rating-category-card" key={lvl.id}>
                    <div>
                      <strong
                        style={{
                          color: "var(--text-primary)",
                          display: "block",
                          fontSize: 15,
                        }}
                      >
                        {lvl.name} · {lvl.tag}
                      </strong>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {lvl.desc}
                      </span>
                    </div>
                    <span className={`badge-linear ${lvl.badge}`}>{lvl.ratingRange}</span>
                  </div>
                ))}

                <div
                  style={{
                    marginTop: 24,
                    padding: "16px 20px",
                    background: "var(--color-canvas-soft)",
                    border: "1px solid var(--color-hairline-strong)",
                    borderRadius: "var(--radius-lg)",
                  }}
                >
                  <h3 style={{ fontSize: 14, color: "var(--color-ink)", margin: "0 0 6px" }}>
                    ¿Querés jugar en tu nivel?
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px" }}>
                    Reservá un turno y armá tu partido con jugadores de tu categoría.
                  </p>
                  <Link href="/#turnos" className="btn btn-secondary" style={{ fontSize: 13, padding: "6px 14px" }}>
                    Reservar turno →
                  </Link>
                </div>
              </div>

              <div>
                <RatingCalculator />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
