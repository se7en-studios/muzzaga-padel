import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import BottomNav from "../../components/BottomNav";
import TorneosGallery from "../../components/TorneosGallery";
import { CLUB_INFO } from "../../data/club";
import { pageMetadata } from "../../lib/pageMeta";
import { getSiteContent } from "../../lib/siteContentServer";

export const metadata = pageMetadata({
  title: "Torneos de pádel en Catriel · Muzzaga Pádel",
  description:
    "Torneos de pádel en Catriel, Río Negro, todo el año: fotos de las ediciones anteriores, ganadores e inscripción para la próxima fecha.",
  path: "/torneos",
});

// Las fotos se cargan desde Configuración → Sitio web: se regenera cada 5 min
// y al guardar cambios en la galería.
export const revalidate = 300;

export default async function TorneosPage() {
  const { gallery } = await getSiteContent();
  return (
    <>
      <Header />
      <main style={{ paddingTop: 90, minHeight: "80vh" }}>
        <div className="container" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
            <Link className="back-link" href="/" style={{ color: "var(--color-accent-orange-text)", textDecoration: "none", fontWeight: 600 }}>
              ← Volver al inicio
            </Link>
            <span>/</span>
            <span style={{ color: "var(--text-primary)" }}>Torneos</span>
          </div>
        </div>

        {/* PRÓXIMO TORNEO DESTACADO */}
        <div className="container" style={{ marginBottom: 20 }}>
          <div
            style={{
              background: "linear-gradient(135deg, var(--color-accent-orange-subtle) 0%, var(--color-surface-card) 100%)",
              border: "1px solid var(--color-hairline-strong)",
              borderRadius: "var(--radius-xl)",
              padding: "28px 24px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div>
              <span className="badge-linear badge-amber" style={{ marginBottom: 8 }}>
                Próximo torneo
              </span>
              <h2 style={{ fontSize: 22, color: "var(--color-ink)", margin: "4px 0 8px" }}>
                Fecha a confirmar
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0, maxWidth: 500 }}>
                Escribinos por WhatsApp y te avisamos la fecha y las categorías apenas estén definidas.
              </p>
            </div>
            <a
              href={`https://wa.me/${CLUB_INFO.phoneRaw}?text=${encodeURIComponent("¡Hola Muzzaga! Quiero información e inscribirme para el próximo torneo de pádel.")}`}
              target="_blank"
              rel="noopener"
              className="btn btn-linear-primary"
              style={{ padding: "10px 22px" }}
            >
              Anotarme por WhatsApp →
            </a>
          </div>

          {/* Cuadros "en vivo": ocultos hasta tener datos reales del torneo
              (el componente, con jugadores de ejemplo, queda en components/). */}
        </div>

        <TorneosGallery tournaments={gallery} />
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
