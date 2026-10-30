import Link from "next/link";
import { BentoPhotoCard } from "./PhotoCard";
import { CLUB_INFO } from "../data/club";
import Mascota from "./Mascota";

/** `featured`: los destacados de la carta, ya recortados para el inicio. */
export default function HomeCantinaTeaser({ photos, featured }) {
  return (
    <section
      id="cantina"
      className="section-bento"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="container">
        <div className="section-header-row" style={{ alignItems: "center" }}>
          <div>
            <span
              className="badge-linear badge-amber"
              style={{ marginBottom: 6 }}
            >
              Gastronomía y encuentro
            </span>
            <h2 className="section-title">Cantina propia y tercer tiempo</h2>
            <p className="section-desc">
              Pizzas artesanales al horno, empanadas, cervezas frías y el mejor
              ambiente para seguir jugando afuera de la pista.
            </p>
          </div>
          <div className="mascot-section-badge">
            <Mascota
              pose="pizza-cerveza"
              alt="Muzzaguito con pizza y cerveza en la cantina"
              className="mascot-section-img"
            />
          </div>
        </div>
        <div className="cantina-photos">
          <BentoPhotoCard
            src={photos["cantina-tercer-tiempo"].src}
            alt={photos["cantina-tercer-tiempo"].alt}
            caption="Cantina Muzzaga · tercer tiempo con vista a las canchas"
            badge="Tercer tiempo"
            badgeClassName="badge-amber"
            title="Cervezas heladas y vista a las dos canchas"
          >
            Disfrutá una Patagonia, Heineken o Corona bien fría comentando los
            mejores puntos del partido con tus amigos.
          </BentoPhotoCard>

          <BentoPhotoCard
            src={photos["cantina-cocina"].src}
            alt={photos["cantina-cocina"].alt}
            caption="Cantina Muzzaga · empanadas y fútbol en la pantalla"
            badge="Cocina propia"
            badgeClassName="badge-emerald"
            title="Empanadas y el partido en la pantalla"
          >
            Muzzas bien cargadas, tostados en pan de miga y opciones sin TACC
            listas para cuando termines de jugar.
          </BentoPhotoCard>
        </div>

        {/* PRODUCTOS DESTACADOS CON PRECIO — pizarra de menú */}
        {featured.length > 0 && (
          <div className="menu-board">
            <div className="menu-board-head">
              <span className="menu-board-title">Lo más pedido</span>
              <span className="menu-board-note">Precios actualizados</span>
            </div>
            <ul className="menu-board-list">
              {featured.map((item) => (
                <li key={item.id} className="menu-board-item">
                  <span className="menu-board-name">
                    {item.name}
                    {item.tag && <span className="menu-board-tag">{item.tag}</span>}
                  </span>
                  <span className="menu-board-dots" aria-hidden="true" />
                  <span className="menu-board-price">${item.price.toLocaleString("es-AR")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="section-more">
          <Link href="/menu" className="section-more-link">
            Ver la carta completa <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
