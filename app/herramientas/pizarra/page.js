import Link from "next/link";
import "../herramientas.css";
import PageCrumbs from "../../../components/PageCrumbs";
import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";
import BottomNav from "../../../components/BottomNav";
import TacticalCourtSimulator from "../../../components/TacticalCourtSimulator";
import Mascota from "../../../components/Mascota";
import { pageMetadata } from "../../../lib/pageMeta";

export const metadata = pageMetadata({
  title: "Pizarra táctica de pádel interactiva · Muzzaga Pádel Catriel",
  description:
    "Jugadas de pádel animadas paso a paso en cancha de cristal: víbora a la reja, smash por 3, bandeja y chiquita. Pizarra gratis de Muzzaga Pádel, Catriel.",
  path: "/herramientas/pizarra",
});

export default function PizarraPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main">
        <PageCrumbs items={[{ label: "Herramientas", href: "/#herramientas" }, { label: "Pizarra táctica" }]} />

        <TacticalCourtSimulator />

        <aside className="hx-cierre" aria-label="Reservar turno">
          <span className="hx-cierre-pelota" aria-hidden="true" />
          <Mascota pose="enredado-paleta" size="s" alt="" className="hx-cierre-masc" />
          <div className="hx-cierre-texto">
            <h2 className="hx-cierre-titulo">Llevá la táctica a la cancha</h2>
            <p className="hx-cierre-desc">
              Reservá turno en nuestras canchas de cristal y probá estas jugadas en tu próximo partido.
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
