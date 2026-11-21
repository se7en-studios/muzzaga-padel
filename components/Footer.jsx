import Image from "next/image";
import Mascota from "./Mascota";
import FooterWordmark from "./FooterWordmark";
import { WhatsAppLogo, InstagramLogo, GoogleMapsLogo } from "./BrandLogos";
import { DEFAULT_LOCATION, presentLocation } from "../lib/siteLocation";
// El pie se ve en la home, Torneos, Menú, Herramientas y las páginas de
// error: sus estilos van con el componente y no en una hoja de la home.
import "./Footer.css";

const DEFAULT = presentLocation(DEFAULT_LOCATION);

const LINKS = [
  { href: "/#turnos", label: "Elegí tu turno" },
  { href: "/#instalaciones", label: "Instalaciones" },
  { href: "/torneos", label: "Torneos" },
  { href: "/menu", label: "Menú de cantina" },
  { href: "/herramientas/dividir-gastos", label: "Dividir gastos" },
  { href: "/herramientas/nivel", label: "Test de nivel" },
];

/**
 * El pie como el cierre de una transmisión de pádel: la cancha azul de
 * noche, la marca como placa de TV, el horario en el tablero y la red
 * separando el final (copyright, crédito y el acceso del personal).
 *
 * La dirección llega de Configuración → Sitio web vía SiteFooter; las
 * páginas de error (client) la usan sin prop y muestran la original.
 */
export default function Footer({ location = DEFAULT }) {
  return (
    <footer className="app-footer pie-sitio">
      <div className="container pie-contenido">
        <div className="pie-grid">
          {/* Marca: placa con el escudo, Muzzaguito y los tres contactos. */}
          <div className="pie-marca">
            <div className="pie-placa">
              <Image
                src="/img/logo_badge.png"
                alt="Muzzaga Pádel"
                width={44}
                height={44}
                className="pie-escudo"
              />
              <div className="pie-placa-texto">
                <strong className="pie-nombre">Muzzaga Pádel</strong>
                <span className="pie-lugar">Catriel, Río Negro</span>
              </div>
              <Mascota
                pose="mochila-pulgar"
                size="s"
                alt="Muzzaguito con su mochila haciendo pulgar arriba"
                className="pie-mascota"
              />
            </div>

            <p className="pie-desc">
              2 canchas de cristal templado, iluminación LED, torneos todo el año y cantina propia para el mejor tercer tiempo.{" "}
              <strong className="pie-saludo">¡Nos vemos en la cancha!</strong>
            </p>

            <div className="pie-acciones">
              <a
                href="https://wa.me/5492995974176"
                target="_blank"
                rel="noopener"
                className="pie-accion pie-accion-wa"
                aria-label="WhatsApp de Muzzaga"
              >
                <WhatsAppLogo size={16} color="currentColor" />
                <span>WhatsApp</span>
              </a>
              <a
                href="https://instagram.com/muzzagapadel"
                target="_blank"
                rel="noopener"
                className="pie-accion"
                aria-label="Instagram de Muzzaga"
              >
                <InstagramLogo size={16} />
                <span>Instagram</span>
              </a>
              <a
                href={location.mapsHref}
                target="_blank"
                rel="noopener"
                className="pie-accion"
                aria-label="Google Maps cómo llegar"
              >
                <GoogleMapsLogo size={16} />
                <span>Cómo llegar</span>
              </a>
            </div>
          </div>

          <nav className="pie-nav" aria-label="Navegación del pie">
            <h3 className="pie-titulo">Navegación</h3>
            <ul className="pie-chips">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="pie-chip">{l.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="pie-club">
            <h3 className="pie-titulo">Club y horarios</h3>
            <div className="pie-tablero">
              <div className="pie-tablero-fila">
                <Image src="/img/iconos/biblioteca/icono-reloj.webp" alt="" width={22} height={22} className="icono-3d pie-icono" />
                <span className="pie-tablero-dato">
                  <span className="pie-tablero-label">Lun a Sáb</span>
                  <span className="pie-hora">14:00 a 00:30 hs</span>
                </span>
              </div>
              <div className="pie-tablero-fila">
                <Image src="/img/iconos/biblioteca/icono-ubicacion.webp" alt="" width={22} height={22} className="icono-3d pie-icono" />
                <span className="pie-tablero-dato">
                  <span className="pie-tablero-label">Dirección</span>
                  <span className="pie-direccion">{location.street}</span>
                </span>
              </div>
            </div>
            <ul className="pie-specs">
              <li>
                <Image src="/img/iconos/icono-cristal.webp" alt="" width={18} height={18} className="icono-3d pie-icono-chico" />
                2 canchas de cristal templado
              </li>
              <li>
                <Image src="/img/iconos/biblioteca/icono-mate.webp" alt="" width={18} height={18} className="icono-3d pie-icono-chico" />
                Cantina y tercer tiempo
              </li>
            </ul>
          </div>
        </div>

        {/* La red: separa el partido del cierre. */}
        <div className="pie-red" aria-hidden="true" />

        <div className="pie-base">
          <p className="pie-copy">
            © 2026 Muzzaga Pádel · Catriel, Río Negro. Todos los derechos reservados.
          </p>
          <div className="pie-base-links">
            <a
              className="footer-credit"
              href="https://www.instagram.com/se7enstudio.ar/"
              target="_blank"
              rel="noopener"
              aria-label="Sitio hecho por se7en (Instagram @se7enstudio.ar)"
            >
              <span className="s7-label">Sitio hecho por</span>
              <span className="s7-badge">
                <Image src="/img/se7en-logo.webp" alt="" width={72} height={20} />
                <span className="s7-sep" aria-hidden="true" />
                <span className="s7-ig">
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
                  se7enstudio.ar
                </span>
              </span>
            </a>
            {/* Acceso del personal: discreto, para quien lo busca. */}
            <a
              href="/admin"
              className="pie-admin"
              aria-label="Admin: panel de administración del club"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              <span>Admin</span>
            </a>
          </div>
        </div>
      </div>

      <FooterWordmark />
    </footer>
  );
}
