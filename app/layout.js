import { Poppins, JetBrains_Mono, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import "./marca.css";
import LightboxProvider from "../components/LightboxProvider";
import ServiceWorkerRegister from "../components/ServiceWorkerRegister";
import InstallPrompt from "../components/InstallPrompt";
import { Analytics } from "@vercel/analytics/react";
import { SITE_URL } from "../lib/site";
import { OG_BASE, clubJsonLd } from "../lib/pageMeta";
import { getSiteContent } from "../lib/siteContentServer";
import { getClubConfig } from "../lib/clubConfigServer";
import { getOpenTournaments } from "../lib/tournamentServer";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

// --font-mono apuntaba a Poppins (no es monoespaciada): los precios de la
// grilla de turnos/admin y los códigos de reserva (<code>) usan esa variable
// esperando dígitos alineados tipo ticket, y con una tipografía proporcional
// nunca lo consiguen.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Display condensada para titulares de la landing (tono de marcador deportivo).
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

// Home: título de hasta ~60 caracteres para que Google no lo corte, con lo
// que busca la gente ("pádel en Catriel", "canchas", "turnos").
const HOME_TITLE = "Canchas de pádel en Catriel · Turnos online | Muzzaga Pádel";
const HOME_DESCRIPTION =
  "Reservá tu turno de pádel en Catriel, Río Negro: 2 canchas de cristal templado con iluminación LED, turnos de 90 min, torneos todo el año y cantina propia.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Muzzaga Pádel",
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  category: "sports",
  // Deja a Google mostrar la foto grande en resultados y Discover. Sin
  // index/follow: chocaría con el noindex que Next le pone al 404.
  robots: { googleBot: { "max-image-preview": "large", "max-snippet": -1 } },
  // Íconos: app/favicon.ico, app/icon.png y app/apple-icon.png (convención de
  // archivos). La imagen para compartir es app/opengraph-image.js, que Next
  // también usa para Twitter/X.
  openGraph: { ...OG_BASE, title: HOME_TITLE, description: HOME_DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: HOME_DESCRIPTION },
};

export const viewport = {
  // Negro de marca: el naranja pintaba toda la barra del navegador.
  themeColor: "#1b1b19",
};

export default async function RootLayout({ children }) {
  // Horarios, precio y canchas salen de Configuración; la dirección, de
  // Sitio web; los torneos abiertos, de Torneos. Todo ya cacheado por render.
  const [{ location }, config, tournaments] = await Promise.all([
    getSiteContent(),
    getClubConfig(),
    getOpenTournaments(),
  ]);
  return (
    <html lang="es-AR" className={`${poppins.variable} ${jetbrainsMono.variable} ${barlowCondensed.variable}`}>
      <head>
        <script
          type="application/ld+json"
          // La dirección la escribe el club: un "</script>" no puede cerrar el tag.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(clubJsonLd({ location, config, tournaments })).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body>
        <LightboxProvider>{children}</LightboxProvider>
        <ServiceWorkerRegister />
        <InstallPrompt />
        <Analytics />
      </body>
    </html>
  );
}
