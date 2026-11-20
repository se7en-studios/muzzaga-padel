import Link from "next/link";
import PageCrumbs from "../../../components/PageCrumbs";
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
      <main className="page-main">
        <PageCrumbs items={[{ label: "Herramientas", href: "/#herramientas" }, { label: "Dividir gastos" }]} />

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
