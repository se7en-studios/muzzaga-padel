import Image from "next/image";
import Mascota from "./Mascota";
import { DEFAULT_LOCATION, presentLocation } from "../lib/siteLocation";

const DEFAULT = presentLocation(DEFAULT_LOCATION);

const GoogleMapsIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" />
    <circle cx="12" cy="9" r="2.8" fill="#ffffff" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="#25D366" aria-hidden="true">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.41a8.214 8.214 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.01-1.24-.75-.67-1.25-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.13.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.17-.48-.29z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

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
                <WhatsAppIcon />
                <span>WhatsApp</span>
              </a>
              <a
                href="https://instagram.com/muzzagapadel"
                target="_blank"
                rel="noopener"
                className="footer-social-pill footer-pill-ig"
                aria-label="Instagram de Muzzaga"
              >
                <InstagramIcon />
                <span>Instagram</span>
              </a>
              <a
                href={location.mapsHref}
                target="_blank"
                rel="noopener"
                className="footer-social-pill footer-pill-maps"
                aria-label="Google Maps cómo llegar"
              >
                <GoogleMapsIcon />
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
                  <span className="footer-info-bullet">📍</span>
                  <span>{location.street}</span>
                </div>
                <div className="footer-info-row">
                  <span className="footer-info-bullet">⏰</span>
                  <span>Lun a Sáb: 14:00 a 00:30 hs</span>
                </div>
                <div className="footer-info-row">
                  <span className="footer-info-bullet">🎾</span>
                  <span>2 canchas de cristal templado</span>
                </div>
                <div className="footer-info-row">
                  <span className="footer-info-bullet">🍻</span>
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
                aria-label="Panel de Control: administración del club"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Panel de Control</span>
                <span className="footer-admin-arrow" aria-hidden="true">↗</span>
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
        </div>
      </div>
    </footer>
  );
}
