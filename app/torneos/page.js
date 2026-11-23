import PageCrumbs from "../../components/PageCrumbs";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import BottomNav from "../../components/BottomNav";
import TorneosGallery from "../../components/TorneosGallery";
import TournamentSignup from "../../components/TournamentSignup";
import TorneosFx from "../../components/TorneosFx";
import Mascota from "../../components/Mascota";
import { CLUB_INFO } from "../../data/club";
import { pageMetadata } from "../../lib/pageMeta";
import { getSiteContent } from "../../lib/siteContentServer";
import { getOpenTournaments } from "../../lib/tournamentServer";
import "./torneos.css";

export const metadata = pageMetadata({
  title: "Torneos de pádel en Catriel · Muzzaga Pádel",
  description:
    "Torneos de pádel en Catriel, Río Negro, todo el año en Muzzaga Pádel: inscripción online para la próxima fecha, categorías, fotos y ganadores anteriores.",
  path: "/torneos",
});

// Las fotos se cargan desde Configuración → Sitio web y los torneos abiertos
// desde Torneos en el admin: se regenera cada 5 min y al guardar cambios.
export const revalidate = 300;

export default async function TorneosPage() {
  const [{ gallery }, openTournaments] = await Promise.all([
    getSiteContent(),
    getOpenTournaments(),
  ]);
  return (
    <>
      <SiteHeader />
      <main className="page-main tt-page">
        <PageCrumbs items={[{ label: "Torneos" }]} />

        {/* PORTADA: título grande con Muzzaguito y la copa; corta en el celu
            para que el afiche del torneo asome sin bajar. */}
        <header className="container tt-intro">
          <div className="tt-intro-text">
            <span className="tt-eyebrow">
              <i className="tt-pelota" aria-hidden="true" /> Circuito Muzzaga · Catriel
            </span>
            <h1 className="tt-h1">
              Torneos <span>de pádel</span>
            </h1>
            <p className="tt-lead">
              Anotá tu pareja para la próxima fecha y mirá quiénes ya levantaron la copa.
            </p>
          </div>
          <Mascota pose="trofeo-paleta" alt="" className="tt-intro-mascota" priority />
        </header>

        {/* PRÓXIMOS TORNEOS: los que el admin tiene con la inscripción abierta */}
        <div id="inscripcion" className="container tt-inscripcion">
          {openTournaments.length > 0 ? (
            <div className="tsu-list">
              {openTournaments.map((t) => (
                <TournamentSignup key={t.id} tournament={t} />
              ))}
            </div>
          ) : (
            /* Sin torneo abierto (lo más común): una banda de una línea y
               enseguida el cuadro de honor con las fotos reales. Antes iba un
               afiche grande "¿? Pronto" con la llave vacía. */
            <p className="tt-pronto-banda">
              <span className="tt-pronto-banda-txt">
                <i className="tt-pelota" aria-hidden="true" />
                <b>Próximo torneo:</b> fecha a confirmar
              </span>
              <a
                href={`https://wa.me/${CLUB_INFO.phoneRaw}?text=${encodeURIComponent("¡Hola Muzzaga! Quiero información e inscribirme para el próximo torneo de pádel.")}`}
                target="_blank"
                rel="noopener"
                className="tt-pronto-banda-cta"
              >
                Avisame por WhatsApp <span aria-hidden="true">→</span>
              </a>
            </p>
          )}
        </div>

        <TorneosGallery tournaments={gallery} signupOpen={openTournaments.length > 0} />
        <TorneosFx />
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
