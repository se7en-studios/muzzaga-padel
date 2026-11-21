import PageCrumbs from "../../components/PageCrumbs";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import BottomNav from "../../components/BottomNav";
import TorneosGallery from "../../components/TorneosGallery";
import TournamentSignup from "../../components/TournamentSignup";
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
            /* Sin torneo abierto (lo más común): el mismo afiche, con la
               fecha en signos de pregunta y la invitación a WhatsApp. */
            <article className="tsu-card tt-pronto" aria-labelledby="tt-pronto-title">
              <div className="tsu-poster">
                <div className="tt-marcador" aria-hidden="true">
                  <span className="tt-marcador-label">Fecha</span>
                  <strong className="tt-marcador-num">¿?</strong>
                  <span className="tt-marcador-mes">Pronto</span>
                </div>
                <div className="tsu-info">
                  <span className="tt-tag">Próximo torneo</span>
                  <h2 id="tt-pronto-title" className="tsu-title">
                    Fecha a confirmar
                  </h2>
                  <p className="tsu-when">
                    Escribinos por WhatsApp y te avisamos la fecha y las categorías apenas estén definidas.
                  </p>
                </div>
                <div className="tt-llave" aria-hidden="true">
                  <div className="tt-llave-col">
                    <i /><i /><i /><i />
                  </div>
                  <div className="tt-llave-col">
                    <i /><i />
                  </div>
                  <div className="tt-llave-col">
                    <i className="tt-llave-vos">¿Tu pareja?</i>
                  </div>
                  <span className="tt-llave-copa">🏆</span>
                </div>
              </div>
              <div className="tt-pronto-side">
                <p className="tsu-form-head">
                  Cómo te anotás <span>Sin vueltas</span>
                </p>
                <ol className="tsu-steps tt-pronto-pasos">
                  <li className="tsu-step">
                    <p className="tsu-step-title">Escribinos por WhatsApp</p>
                    <p className="tsu-hint">Con tu nombre y tu categoría.</p>
                  </li>
                  <li className="tsu-step">
                    <p className="tsu-step-title">Te avisamos la fecha</p>
                    <p className="tsu-hint">Apenas estén las categorías y el precio.</p>
                  </li>
                  <li className="tsu-step">
                    <p className="tsu-step-title">Anotás a tu pareja</p>
                    <p className="tsu-hint">Desde esta misma página, en un minuto.</p>
                  </li>
                </ol>
                <a
                  href={`https://wa.me/${CLUB_INFO.phoneRaw}?text=${encodeURIComponent("¡Hola Muzzaga! Quiero información e inscribirme para el próximo torneo de pádel.")}`}
                  target="_blank"
                  rel="noopener"
                  className="tt-cta tt-cta--wa"
                >
                  Anotarme por WhatsApp <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          )}
        </div>

        <TorneosGallery tournaments={gallery} signupOpen={openTournaments.length > 0} />
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
