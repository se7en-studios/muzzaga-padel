import Link from "next/link";
import "../herramientas.css";
import HerramientasNav from "../../../components/HerramientasNav";
import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";
import BottomNav from "../../../components/BottomNav";
import AmericanoGenerator from "../../../components/AmericanoGenerator";
import { pageMetadata } from "../../../lib/pageMeta";

export const metadata = pageMetadata({
  title: "Generador de torneo americano de pádel · Muzzaga Pádel Catriel",
  description:
    "Armá gratis el fixture de tu americano de pádel (4 a 8 jugadores) con rotaciones balanceadas y copialo a WhatsApp. Herramienta de Muzzaga Pádel, Catriel.",
  path: "/herramientas/americano",
});

export default function AmericanoPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main">
        <HerramientasNav actual="americano" />

        <AmericanoGenerator />

        <aside className="hx-cierre" aria-label="Reservar turno">
          <span className="hx-cierre-pelota" aria-hidden="true" />
          <div className="hx-cierre-texto">
            <h2 className="hx-cierre-titulo">¿Arman un americano?</h2>
            <p className="hx-cierre-desc">
              Reservá turnos seguidos para jugar el torneo con tus amigos y quedarse al tercer tiempo en la cantina.
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
