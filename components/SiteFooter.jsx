import Footer from "./Footer";
import { getSiteContent } from "../lib/siteContentServer";

/** Footer con la ubicación que se cargó en Configuración → Sitio web. */
export default async function SiteFooter() {
  const { location } = await getSiteContent();
  return <Footer location={location} />;
}
