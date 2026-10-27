import Link from "next/link";
import EstadoMarca from "../components/EstadoMarca";
import { getSiteContent } from "../lib/siteContentServer";

// 404 con la marca. Next agrega <meta name="robots" content="noindex"> solo.
export const metadata = {
  title: "Página no encontrada · Muzzaga Pádel",
};

export default async function NotFound() {
  const { location } = await getSiteContent();
  return (
    <>
      <EstadoMarca
        pose="enredado-paleta"
        kicker="Error 404"
        title="Se nos enredó la paleta"
        text="La página que buscás no existe o cambió de lugar."
        location={location}
      >
        <Link href="/" className="btn btn-linear-primary">
          Ir al inicio
        </Link>
        <Link href="/#turnos" className="btn btn-secondary">
          Reservar turno
        </Link>
      </EstadoMarca>
    </>
  );
}
