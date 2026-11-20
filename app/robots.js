import { SITE_URL } from "../lib/site";

// Todo público menos el panel y la API. La tarjeta /opengraph-image queda
// permitida: si no, WhatsApp y Google no ven la imagen.
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
