import Link from "next/link";
import { Beer, Candy, CupSoda, Pizza, ShoppingBag, Smartphone } from "lucide-react";
import { BentoPhotoCard } from "./PhotoCard";
import Mascota from "./Mascota";
import { productIcon } from "../lib/productIcon";
import { MENU_CATEGORIES } from "../lib/cantinaMenu";

// Los mismos íconos de categoría que la carta (/menu).
const CATEGORY_ICONS = {
  buffet: Pizza,
  "bebidas-sin": CupSoda,
  "bebidas-con": Beer,
  kiosco: Candy,
  accesorios: ShoppingBag,
};

/** Destacados agrupados por categoría, en el orden de la carta. */
function byCategory(items) {
  return MENU_CATEGORIES.filter((c) => c.id !== "all")
    .map((c) => ({ ...c, items: items.filter((it) => it.category === c.id) }))
    .filter((g) => g.items.length > 0);
}

/** `featured`: los destacados de la carta, ya recortados para el inicio. */
export default function HomeCantinaTeaser({ photos, featured }) {
  const groups = byCategory(featured);

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

        <div className={`cantina-grid${groups.length ? "" : " sin-pizarra"}`}>
          {/* En el celu las dos fotos van en una tira que se desliza de
              costado (se asoma la segunda); en la compu, apiladas al lado
              de la pizarra. */}
          <div
            className="cantina-photos"
            role="region"
            aria-label="Fotos de la cantina"
            tabIndex={0}
          >
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

          {/* PRODUCTOS DESTACADOS CON PRECIO — pizarra de bar con marco de
              madera, agrupados por categoría como en la carta. Nombres y
              precios vienen de la carta que carga el club. */}
          {groups.length > 0 && (
            <div className="menu-board tc-pizarra">
              <div className="menu-board-head">
                <span className="menu-board-title">
                  <span className="tc-pizarra-pelota" aria-hidden="true" />
                  Lo más pedido
                </span>
                <span className="menu-board-note">Precios actualizados</span>
              </div>

              {groups.map((g) => {
                const Icon = CATEGORY_ICONS[g.id];
                return (
                  <div key={g.id} className="tc-pizarra-grupo">
                    <h3 className="tc-pizarra-cat">
                      {Icon && <Icon size={15} strokeWidth={2.25} aria-hidden="true" />}
                      {g.label}
                    </h3>
                    <ul className="menu-board-list">
                      {g.items.map((item) => (
                        <li key={item.id} className="menu-board-item">
                          <span className="tc-pizarra-icono" aria-hidden="true">
                            {productIcon(item.name, item.category)}
                          </span>
                          <span className="menu-board-name">
                            {item.name}
                            {item.tag && <span className="menu-board-tag">{item.tag}</span>}
                          </span>
                          <span className="menu-board-dots" aria-hidden="true" />
                          <span className="menu-board-price">
                            ${item.price.toLocaleString("es-AR")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {/* La carta acepta el QR de cada mesa o cancha (?mesa=…): el
                  pedido sale con esa entrega ya puesta. */}
              <div className="tc-pizarra-pie">
                <p className="tc-pizarra-qr">
                  <Smartphone size={22} strokeWidth={2} aria-hidden="true" />
                  <span>
                    <strong>¿Ya estás en el club?</strong> Hacé tu pedido
                    desde el celu con la carta online.
                  </span>
                </p>
                <Link href="/menu" className="tc-pizarra-cta">
                  Ver la carta completa <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {groups.length === 0 && (
          <div className="section-more">
            <Link href="/menu" className="section-more-link">
              Ver la carta completa <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
