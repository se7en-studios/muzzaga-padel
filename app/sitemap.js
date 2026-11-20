import { SITE_URL } from "../lib/site";

// Solo las páginas públicas (el admin y la API quedan afuera, ver robots.js).
// Sin lastModified: con la fecha de cada pedido Google lo ignora igual.
const PAGES = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/torneos", changeFrequency: "weekly", priority: 0.9 },
  { path: "/menu", changeFrequency: "weekly", priority: 0.8 },
  { path: "/herramientas/nivel", changeFrequency: "monthly", priority: 0.6 },
  { path: "/herramientas/americano", changeFrequency: "monthly", priority: 0.6 },
  { path: "/herramientas/dividir-gastos", changeFrequency: "monthly", priority: 0.6 },
  { path: "/herramientas/pizarra", changeFrequency: "monthly", priority: 0.6 },
];

export default function sitemap() {
  return PAGES.map(({ path, ...rest }) => ({
    // Sin barra final en la home: igual que el canónico que arma Next.
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    ...rest,
  }));
}
