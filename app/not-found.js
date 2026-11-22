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
        pose="golpe-pelota"
        kicker="Error 404"
        code="404"
        title="¡Pelota afuera!"
        text="Esta página quedó fuera de la cancha: no existe o cambió de lugar. Volvé al juego desde acá."
        location={location}
      >
        <Link href="/#turnos" className="estado-btn estado-btn-primary">
          Reservar turno
        </Link>
        <Link href="/" className="estado-btn estado-btn-secondary">
          <span aria-hidden="true">←</span> Volver al inicio
        </Link>
      </EstadoMarca>
    </>
  );
}
