import Link from "next/link";

/**
 * "Volver al inicio / Herramientas / Test de nivel" de las páginas internas.
 * Antes estaba copiado a mano en cada página; acá el volver es un botón
 * fácil de tocar y en el celu el paso del medio se oculta para que entre
 * en un renglón.
 *
 * @param {{ items: { label: string, href?: string }[] }} props
 */
export default function PageCrumbs({ items }) {
  return (
    <div className="container">
      <nav className="page-crumbs" aria-label="Estás en">
        <Link className="page-crumbs-back" href="/">
          <span aria-hidden="true">←</span> Inicio
        </Link>
        <ol>
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={item.label} className={last ? undefined : "is-middle"}>
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
