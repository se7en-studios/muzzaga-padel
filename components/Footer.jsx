import Image from "next/image";
import Mascota from "./Mascota";
import FooterWordmark from "./FooterWordmark";
import { WhatsAppLogo, InstagramLogo, GoogleMapsLogo } from "./BrandLogos";
import { DEFAULT_LOCATION, presentLocation } from "../lib/siteLocation";

const DEFAULT = presentLocation(DEFAULT_LOCATION);

/**
 * La dirección llega de Configuración → Sitio web vía SiteFooter; las
 * páginas de error (client) la usan sin prop y muestran la original.
 */
export default function Footer({ location = DEFAULT }) {
  return (
    <footer className="app-footer">
      <div className="container">
        <div className="footer-top-grid">
          {/* Brand Col */}
          <div className="footer-brand-col">
            <div className="footer-brand-header">
              <Image
                src="/img/logo_badge.png"
                alt="Muzzaga Pádel"
                width={36}
                height={36}
                style={{ width: 36, height: 36, objectFit: "contain", display: "block" }}
              />
              <div>
                <strong className="footer-brand-name">Muzzaga Pádel</strong>
                <span className="footer-brand-location">Catriel, Río Negro</span>
              </div>
            </div>

            <p className="footer-brand-desc">
              Club de pádel en Catriel. 2 canchas de cristal templado, iluminación LED, torneos todo el año y cantina propia para el mejor tercer tiempo.
            </p>

            <div className="footer-social-row">
              <a
                href="https://wa.me/5492995974176"
                target="_blank"
                rel="noopener"
                className="footer-social-pill footer-pill-wa"
                aria-label="WhatsApp de Muzzaga"
              >
                <WhatsAppLogo size={15} />
                <span>WhatsApp</span>
              </a>
              <a
                href="https://instagram.com/muzzagapadel"
                target="_blank"
                rel="noopener"
                className="footer-social-pill footer-pill-ig"
                aria-label="Instagram de Muzzaga"
              >
                <InstagramLogo size={15} />
                <span>Instagram</span>
              </a>
              <a
                href={location.mapsHref}
                target="_blank"
                rel="noopener"
                className="footer-social-pill footer-pill-maps"
                aria-label="Google Maps cómo llegar"
              >
                <GoogleMapsLogo size={15} />
                <span>Cómo llegar</span>
              </a>
            </div>

            <div className="footer-mascot-box">
              <Mascota
                pose="mochila-pulgar"
                size="s"
                alt="Muzzaguito con su mochila haciendo pulgar arriba"
                className="footer-mascot"
              />
              <span className="footer-mascot-text">
                ¡Nos vemos en la cancha! Muzzaguito te acompaña en cada partido.
              </span>
            </div>
          </div>

          {/* Links Grid */}
          <div className="footer-links-group">
            <div className="footer-col">
              <h3 className="footer-col-title">Navegación</h3>
              <ul className="footer-links-list">
                <li><a href="/#turnos">Elegí tu turno</a></li>
                <li><a href="/#instalaciones">Instalaciones</a></li>
                <li><a href="/torneos">Torneos</a></li>
                <li><a href="/menu">Menú de cantina</a></li>
                <li><a href="/herramientas/dividir-gastos">Dividir gastos</a></li>
                <li><a href="/herramientas/nivel">Test de nivel</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h3 className="footer-col-title">Club y Horarios</h3>
              <div className="footer-club-info">
                <div className="footer-info-row">
                  <span className="footer-info-bullet"><Image src="/img/iconos/biblioteca/icono-ubicacion.webp" alt="" width={22} height={22} className="icono-3d" /></span>
                  <span>{location.street}</span>
                </div>
                <div className="footer-info-row">
                  <span className="footer-info-bullet"><Image src="/img/iconos/biblioteca/icono-reloj.webp" alt="" width={22} height={22} className="icono-3d" /></span>
                  <span>Lun a Sáb: 14:00 a 00:30 hs</span>
                </div>
                <div className="footer-info-row">
                  <span className="footer-info-bullet"><Image src="/img/iconos/icono-cristal.webp" alt="" width={22} height={22} className="icono-3d" /></span>
                  <span>2 canchas de cristal templado</span>
                </div>
                <div className="footer-info-row">
                  <span className="footer-info-bullet"><Image src="/img/iconos/biblioteca/icono-mate.webp" alt="" width={22} height={22} className="icono-3d" /></span>
                  <span>Cantina y tercer tiempo</span>
                </div>
              </div>
            </div>

            <div className="footer-col footer-col-admin">
              <h3 className="footer-col-title">Administración</h3>
              <p className="footer-admin-text">
                Acceso exclusivo para el personal del club: agenda, turnos, caja y torneos.
              </p>
              <a
                href="/admin"
                className="footer-admin-card-btn"
                aria-label="Admin: panel de administración del club"
              >
                <span className="footer-admin-icon" aria-hidden="true">
                  <Image src="/img/iconos/biblioteca/icono-candado.webp" alt="" width={26} height={26} className="icono-3d" />
                </span>
                <span>Admin</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom-bar">
          <div className="footer-copy">
            © 2026 Muzzaga Pádel · Catriel, Río Negro. Todos los derechos reservados.
          </div>
          <div className="footer-specs">
            2 canchas de cristal · Cantina propia · Iluminación LED
          </div>
          <span className="footer-credit">
            Sitio hecho por
            <Image src="/img/se7en-logo.webp" alt="se7en" width={72} height={20} />
          </span>
        </div>
      </div>

      <FooterWordmark />
    </footer>
  );
}
