import Header from "./Header";
import { getSiteContent } from "../lib/siteContentServer";

/** Header con el link de Google Maps que se cargó en Configuración → Sitio web. */
export default async function SiteHeader() {
  const { location } = await getSiteContent();
  return <Header mapsHref={location.mapsHref} />;
}
