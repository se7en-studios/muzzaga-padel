import Link from "next/link";
import "../herramientas.css";
import HerramientasNav from "../../../components/HerramientasNav";
import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";
import BottomNav from "../../../components/BottomNav";
import SplitCostCalculator from "../../../components/SplitCostCalculator";
import { pageMetadata } from "../../../lib/pageMeta";
import { getCantinaMenu } from "../../../lib/cantinaMenuServer";
import { featuredItems } from "../../../lib/cantinaMenu";

export const metadata = pageMetadata({
  title: "Dividir cancha y cantina entre amigos · Muzzaga Pádel Catriel",
  description:
    "Dividí en segundos el turno de pádel y lo de la cantina de Muzzaga Pádel (Catriel) entre tus amigos, con los precios actuales. Copiá el desglose a WhatsApp.",
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
        <HerramientasNav actual="dividir-gastos" />

        <SplitCostCalculator extras={featuredItems(items)} />

        <aside className="hx-cierre" aria-label="Reservar turno">
          <span className="hx-cierre-pelota" aria-hidden="true" />
          <div className="hx-cierre-texto">
            <h2 className="hx-cierre-titulo">¿Ya tienen el equipo?</h2>
            <p className="hx-cierre-desc">
              Elegí día y horario para tu partido en nuestras canchas de cristal templado.
            </p>
          </div>
          <Link href="/#turnos" className="hx-cierre-btn">
            Reservar turno →
          </Link>
        </aside>
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
