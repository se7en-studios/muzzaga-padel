import Header from "./Header";
import { getSiteContent } from "../lib/siteContentServer";
import { getClubConfig } from "../lib/clubConfigServer";

/**
 * Header con el link de Google Maps que se cargó en Configuración → Sitio
 * web, y el horario y los días bloqueados (el menú del celu muestra si el
 * club está abierto).
 */
export default async function SiteHeader() {
  const [{ location }, config] = await Promise.all([getSiteContent(), getClubConfig()]);
  return <Header mapsHref={location.mapsHref} schedule={config.schedule} blockedDates={config.blockedDates} />;
}
