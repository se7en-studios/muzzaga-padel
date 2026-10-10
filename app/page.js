import Image from "next/image";
import Header from "../components/Header";
import LiveWeatherRadar from "../components/LiveWeatherRadar";
import TodayFlashSlots from "../components/TodayFlashSlots";
import BookingCalendar from "../components/BookingCalendar";
import AmenitiesSection from "../components/AmenitiesSection";
import CommunityMatchesSection from "../components/CommunityMatchesSection";
import HomeTorneosTeaser from "../components/HomeTorneosTeaser";
import HomeCantinaTeaser from "../components/HomeCantinaTeaser";
import ClubToolsSection from "../components/ClubToolsSection";
import FaqSection from "../components/FaqSection";
import FloatingLiveBar from "../components/FloatingLiveBar";
import MascotFloatHelper from "../components/MascotFloatHelper";
import BottomNav from "../components/BottomNav";
import Footer from "../components/Footer";
import ScrollReveal from "../components/ScrollReveal";
import ScrollProgress from "../components/ScrollProgress";
import StatCounter from "../components/StatCounter";
import HeroMascot from "../components/HeroMascot";
import "./landing.css";

import { getClubConfig } from "../lib/clubConfigServer";
import { CLUB_INFO } from "../data/club";
import { todayInClub } from "../lib/booking";
import { FAQS } from "../data/faq";

export const metadata = {
  alternates: { canonical: "/" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

const TICKER_ITEMS = [
  "Cristal templado",
  "Iluminación LED",
  "Turnos de 90 min",
  "Canchas Abiertas",
  "Torneos todo el año",
  "Cantina y tercer tiempo",
  "Catriel · Río Negro",
];

// El precio del turno sale de Configuración: la home se regenera cada 5 min
// para reflejar cambios sin redeploy.
export const revalidate = 300;

export default async function Home() {
  const config = await getClubConfig();
  const { valle, pico, picoEnabled } = config.pricing;
  // Se anuncia el precio más bajo ("desde") cuando hay horario pico.
  const cheapest = picoEnabled && pico.court < valle.court ? pico : valle;
  const pricing = {
    total: cheapest.court,
    perPlayer: cheapest.perPlayer || Math.round(cheapest.court / 4),
  };
  const priceFrom = picoEnabled && pico.court !== valle.court ? "Desde " : "";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <ScrollProgress />
      <Header />

      {/* 1. HERO */}
      <section id="top" className="hero-night">
        <div className="hero-night-photo" aria-hidden="true">
          <Image
            src="/img/court_glass_night_match.jpg"
            alt=""
            fill
            priority
            // La foto es 4:3 y en vertical se recorta con object-fit: cover: a 390
            // de ancho se dibuja a unos 1285 px (330vw), no a 100vw. Con "100vw"
            // el celular recibía 828 px para cubrir 2570 px de pantalla.
            sizes="(max-width: 480px) 330vw, (max-width: 900px) 170vw, 100vw"
          />
        </div>
        <svg className="hero-court-lines" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden="true">
          <path d="M150 600 L420 160 L780 160 L1050 600" />
          <path d="M285 380 L915 380" />
          <path d="M600 160 L600 600" />
          <path d="M360 260 L840 260" />
        </svg>

        <div className="container hero-night-grid">
          <div className="hero-night-copy">
            <LiveWeatherRadar schedule={config.schedule} blockedDates={config.blockedDates} />

            <p className="hero-kicker">
              <span className="hero-kicker-line" /> Club de pádel · Catriel, Río Negro
            </p>

            <h1 className="hero-night-title">
              <span className="hero-line">Canchas de pádel</span>{" "}
              <span className="hero-line">en Catriel.</span>{" "}
              <span className="hero-line hero-line-accent">Pádel de verdad.</span>
            </h1>

            <p className="hero-night-lede">
              {config.courts?.length || 2} canchas de cristal templado cubiertas con iluminación LED, turnos de{" "}
              {config.slotDurationMin} minutos y cantina para el mejor tercer tiempo.
            </p>

            <div className="hero-night-ctas">
              <a href="#turnos" className="hero-btn-primary">
                <span>Reservar turno</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </a>
              <a href="#canchas-abiertas" className="hero-btn-ghost hero-cta-desktop-only">
                Canchas Abiertas <span aria-hidden="true">→</span>
              </a>
            </div>

            <ul className="hero-trust">
              <li>Confirmás con una seña por WhatsApp</li>
              <li>Pistas cubiertas, cero viento</li>
            </ul>
          </div>

          <div className="hero-night-visual" aria-hidden="true">
            <div className="hero-mascot-ring" />
            <HeroMascot src="/img/mascotas/muzzaguito-lentes-hero.webp" width={1024} height={935} />
            <div className="hero-float-card hero-float-price">
              <span className="hero-float-label">{priceFrom ? "Turno desde" : "Turno"} · {config.slotDurationMin} min</span>
              <strong>${pricing.total.toLocaleString("es-AR")}</strong>
              <span className="hero-float-sub">${pricing.perPlayer.toLocaleString("es-AR")} c/u si son 4</span>
            </div>
            <div className="hero-float-card hero-float-glass">
              <span className="hero-float-dot" />
              Cristal templado · LED
            </div>
          </div>

          <dl className="hero-stats">
            <div className="hero-stat">
              <dt>Canchas de cristal</dt>
              <dd><StatCounter value={config.courts?.length || 2} /></dd>
            </div>
            <div className="hero-stat">
              <dt>Torneos</dt>
              <dd className="hero-stat-word">Todo el año</dd>
            </div>
            <div className="hero-stat hero-stat-desktop-only">
              <dt>Jugadores pasan por el club</dt>
              <dd><StatCounter value={300} prefix="+" /></dd>
            </div>
            <div className="hero-stat hero-stat-desktop-only">
              <dt>Minutos por turno</dt>
              <dd><StatCounter value={config.slotDurationMin} /></dd>
            </div>
          </dl>
        </div>

      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((k) => (
            <div className="ticker-group" key={k}>
              {TICKER_ITEMS.map((t) => (
                <span key={t} className="ticker-item">
                  {t}
                  <span className="ticker-ball" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* WIDGET DISPONIBILIDAD INMEDIATA (HOY / MAÑANA) */}
      <TodayFlashSlots />

      {/* 2. RESERVÁ TU TURNO */}
      <section id="turnos" className="section-turnos">
        <div className="container">
          <div className="section-header-row">
            <div>
              <span className="badge-linear badge-amber" style={{ marginBottom: 8 }}>
                Disponibilidad real
              </span>
              <h2 className="section-title">Reservá tu cancha</h2>
              <p className="section-desc">
                Elegí día y horario en tiempo real y confirmá tu turno al instante.
              </p>
            </div>
            <div className="price-tag">
              <div className="price-tag-main">
                {priceFrom}${pricing.total.toLocaleString("es-AR")} por turno (
                {config.slotDurationMin} min)
              </div>
              <div className="price-tag-sub">
                ${pricing.perPlayer.toLocaleString("es-AR")} por jugador si son cuatro
              </div>
            </div>
          </div>

          <BookingCalendar serverToday={todayInClub()} mpEnabled={Boolean(process.env.MP_ACCESS_TOKEN)} />
        </div>
      </section>

      {/* Testimonios: fuera hasta tener reseñas reales con nombre y foto (o
          las de Google). El componente queda en components/. */}

      {/* 4. INSTALACIONES */}
      <AmenitiesSection />

      {/* 5. CANCHAS ABIERTAS */}
      <CommunityMatchesSection />

      {/* 6. TORNEOS DESTACADOS */}
      <HomeTorneosTeaser />

      {/* 7. CANTINA DESTACADA */}
      <HomeCantinaTeaser />

      {/* 8. HERRAMIENTAS DEL CLUB */}
      <ClubToolsSection />

      {/* 9. FAQ */}
      <FaqSection />

      {/* 10. UBICACIÓN Y CONTACTO */}
      <section id="ubicacion" className="section-turnos section-ubicacion">
        <div className="container">
          <div className="section-header-row" style={{ marginBottom: 20 }}>
            <div>
              <span className="badge-linear badge-emerald" style={{ marginBottom: 8 }}>
                Cómo llegar
              </span>
              <h2 className="section-title">Ubicación y horarios</h2>
            </div>
          </div>

          <div className="location-unified-card">
            <div className="location-info-pane">
              <div className="location-details-list">
                <div className="location-detail-item">
                  <div className="location-detail-icon location-icon-pin" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div className="location-detail-content">
                    <span className="location-detail-label">Dirección</span>
                    <strong className="location-detail-value">Av. Cacique Catriel y Córdoba</strong>
                    <span className="location-detail-sub">Catriel, Río Negro</span>
                  </div>
                </div>

                <div className="location-detail-item">
                  <div className="location-detail-icon location-icon-clock" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div className="location-detail-content">
                    <span className="location-detail-label">Horarios</span>
                    <strong className="location-detail-value">Lunes a sábado</strong>
                    <span className="location-detail-sub">14:00 a 00:30 hs</span>
                  </div>
                </div>
              </div>

              <div className="location-actions">
                <a
                  href={CLUB_INFO.mapsUrl}
                  target="_blank"
                  rel="noopener"
                  className="location-btn location-btn-maps"
                  aria-label="Abrir en Google Maps"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                    <path
                      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                      fill="#EA4335"
                    />
                    <circle cx="12" cy="9" r="2.8" fill="#ffffff" />
                  </svg>
                  <span>Google Maps</span>
                  <span className="location-btn-arrow" aria-hidden="true">↗</span>
                </a>

                <a
                  href={CLUB_INFO.wazeUrl}
                  target="_blank"
                  rel="noopener"
                  className="location-btn location-btn-waze"
                  aria-label="Navegar con Waze"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  <span>Waze</span>
                  <span className="location-btn-arrow" aria-hidden="true">↗</span>
                </a>

                <a
                  href={`https://wa.me/${CLUB_INFO.phoneRaw}`}
                  target="_blank"
                  rel="noopener"
                  className="location-btn location-btn-wa"
                  aria-label="Contactar por WhatsApp"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#25D366" aria-hidden="true">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.067-1.127-.072-.27-.087-.621-.21-1.077-.407-1.927-.834-3.176-2.778-3.272-2.906-.096-.129-.778-1.037-.778-1.977 0-.94.492-1.401.667-1.593.175-.192.38-.24.507-.24.127 0 .254.002.365.007.119.006.279-.045.437.334.162.388.555 1.353.603 1.451.048.098.08.213.016.341-.064.128-.096.208-.192.32-.096.112-.202.25-.288.336-.096.096-.197.201-.085.393.112.192.497.82 1.066 1.328.733.654 1.352.857 1.544.953.192.096.304.08.416-.048.112-.128.48-1.558.608-.752.128-.192.256-.16.432-.096.176.064 1.114.525 1.306.621.192.096.32.144.368.224.048.08.048.464-.096.869z" />
                  </svg>
                  <span>WhatsApp</span>
                  <span className="location-btn-arrow" aria-hidden="true">↗</span>
                </a>
              </div>
            </div>

            <div className="location-map-pane">
              <iframe
                title="Mapa de Muzzaga Pádel en Catriel"
                src="https://maps.google.com/maps?q=-37.8832905,-67.8005469&hl=es&z=16&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      <FloatingLiveBar schedule={config.schedule} blockedDates={config.blockedDates} />
      <MascotFloatHelper />
      <Footer />
      <BottomNav />
      <ScrollReveal />
    </>
  );
}
