import Link from "next/link";
import Image from "next/image";
import "../herramientas.css";
import PageCrumbs from "../../../components/PageCrumbs";
import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";
import BottomNav from "../../../components/BottomNav";
import RatingCalculator from "../../../components/RatingCalculator";
import { PADEL_LEVELS } from "../../../data/levels";
import Mascota from "../../../components/Mascota";
import { pageMetadata } from "../../../lib/pageMeta";

export const metadata = pageMetadata({
  title: "Test de nivel de pádel y categoría · Muzzaga Pádel Catriel",
  description:
    "Descubrí tu nivel de pádel (escala 1.0 a 7.0) y su categoría argentina (8va a 1ra). Encontrá partidos parejos en Muzzaga Pádel, Catriel, Río Negro.",
  path: "/herramientas/nivel",
});

export default function NivelPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main">
        <PageCrumbs items={[{ label: "Herramientas", href: "/#herramientas" }, { label: "Test de nivel" }]} />

        <section className="hx-tool hx-tool--nivel">
          <div className="container">
            <header className="hx-hero">
              <span className="hx-hero-pelota" aria-hidden="true" />
              <Image
                src="/img/iconos/icono-nivel-v2.webp"
                alt=""
                width={124}
                height={124}
                priority
                className="hx-hero-icono icono-3d"
              />
              <div className="hx-hero-cabeza">
                <p className="hx-hero-kicker">Herramienta 02 · Competencia</p>
                <h1 className="hx-hero-titulo">Test de nivel</h1>
              </div>
              <p className="hx-hero-desc">
                6 situaciones de partido y te decimos tu categoría del pádel
                argentino (8va a 1era) y tu nivel en la escala internacional
                (1.0 a 7.0), para jugar siempre de igual a igual.
              </p>
              <ul className="hx-hero-chips" aria-label="Características">
                <li>1 minuto</li>
                <li>8va → 1era</li>
                <li>Ficha para compartir</li>
              </ul>
            </header>

            <div className="hx-nv-grid">
              <RatingCalculator />

              <div>
                <h2 className="hx-escalera-titulo">Categorías en Argentina</h2>
                <p className="hx-escalera-desc">
                  De 8va (debut) a 1era (élite). Tocá una para ver qué se juega en ese nivel.
                </p>

                <ol className="hx-escalera">
                  {PADEL_LEVELS.map((lvl, i) => (
                    <li key={lvl.id}>
                      <details className="hx-cat">
                        <summary>
                          <span className="hx-cat-num" style={{ "--i": i }}>
                            {lvl.shortName}
                          </span>
                          <span className="hx-cat-txt">
                            <strong>{lvl.tag}</strong>
                            {lvl.name}
                          </span>
                          <span className="hx-cat-rango">{lvl.ratingRange}</span>
                          <span className="hx-cat-flecha" aria-hidden="true" />
                        </summary>
                        <p>{lvl.desc}</p>
                      </details>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <aside className="hx-cierre" aria-label="Reservar turno">
          <span className="hx-cierre-pelota" aria-hidden="true" />
          <Mascota
            pose="pelota-padel-life"
            size="s"
            alt=""
            className="hx-cierre-masc"
          />
          <div className="hx-cierre-texto">
            <h2 className="hx-cierre-titulo">Jugá en tu nivel</h2>
            <p className="hx-cierre-desc">
              Reservá un turno y armá tu partido con jugadores de tu categoría.
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
