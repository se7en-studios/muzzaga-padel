import Link from "next/link";
import "./Extras.css";

/**
 * "← Inicio" de las páginas internas (Torneos, Menú). Antes estaba copiado
 * a mano en cada página; acá el volver es un botón fácil de tocar y en el
 * celu el paso del medio se oculta para que entre en un renglón.
 *
 * La página actual no se muestra: el H1 que viene justo abajo ya la nombra
 * ("← Inicio | MENÚ DE LA CANTINA" y enseguida "Menú de la cantina" era el
 * mismo título dos veces). Queda para lectores de pantalla.
 *
 * @param {{ items: { label: string, href?: string }[] }} props
 */
export default function PageCrumbs({ items }) {
  return (
    <div className="container">
      <nav className="page-crumbs" aria-label="Estás en">
        <Link className="page-crumbs-back" href="/">
          <span className="page-crumbs-flecha" aria-hidden="true">
            ←
          </span>
          Inicio
        </Link>
        <ol>
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={item.label} className={last ? "page-crumbs-actual" : "is-middle"}>
                {last ? (
                  <span aria-current="page">{item.label}</span>
                ) : item.href ? (
                  <Link href={item.href}>{item.label}</Link>
                ) : (
                  <span>{item.label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
