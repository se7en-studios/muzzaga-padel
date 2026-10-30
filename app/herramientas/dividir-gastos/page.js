import Link from "next/link";
import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";
import BottomNav from "../../../components/BottomNav";
import SplitCostCalculator from "../../../components/SplitCostCalculator";
import { pageMetadata } from "../../../lib/pageMeta";
import { getCantinaMenu } from "../../../lib/cantinaMenuServer";
import { featuredItems } from "../../../lib/cantinaMenu";

export const metadata = pageMetadata({
  title: "Calculadora para dividir cancha y cantina · Muzzaga Pádel",
  description:
    "Dividí en segundos el costo del turno de pádel y las consumiciones de cantina entre tus amigos. Copiá el desglose directo a WhatsApp.",
  path: "/herramientas/dividir-gastos",
});

// Los productos y precios salen de la carta del panel (se regenera al guardarla).
export const revalidate = 300;

export default async function DividirGastosPage() {
  const { items } = await getCantinaMenu();
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
            <span style={{ color: "var(--text-primary)" }}>Dividir gastos</span>
          </div>
        </div>

        <SplitCostCalculator extras={featuredItems(items)} />

        <div className="container" style={{ margin: "40px auto 60px", textAlign: "center" }}>
          <div
            style={{
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-hairline-strong)",
              borderRadius: "var(--radius-xl)",
              padding: "32px 24px",
              maxWidth: 600,
              margin: "0 auto",
            }}
          >
            <h3 style={{ fontSize: 20, color: "var(--color-ink)", marginBottom: 8 }}>
              ¿Ya tienen el equipo listo?
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
              Elegí día y horario para tu partido en nuestras canchas de cristal templado.
            </p>
            <Link href="/#turnos" className="btn btn-linear-primary" style={{ padding: "10px 24px" }}>
              Reservar turno →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
