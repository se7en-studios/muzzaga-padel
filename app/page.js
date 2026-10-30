import Image from "next/image";
import SiteHeader from "../components/SiteHeader";
import LiveWeatherRadar from "../components/LiveWeatherRadar";
import TodayFlashSlots from "../components/TodayFlashSlots";
import BookingCalendar from "../components/BookingCalendar";
import AmenitiesSection from "../components/AmenitiesSection";
import HomeTorneosTeaser from "../components/HomeTorneosTeaser";
import HomeCantinaTeaser from "../components/HomeCantinaTeaser";
import ClubToolsSection from "../components/ClubToolsSection";
import FaqSection from "../components/FaqSection";
import FloatingLiveBar from "../components/FloatingLiveBar";
import MascotFloatHelper from "../components/MascotFloatHelper";
import BottomNav from "../components/BottomNav";
import SiteFooter from "../components/SiteFooter";
import ScrollReveal from "../components/ScrollReveal";
import ScrollProgress from "../components/ScrollProgress";
import StatCounter from "../components/StatCounter";
import HeroMascot from "../components/HeroMascot";
import HeroLiveSlots from "../components/HeroLiveSlots";
import { WhatsAppLogo, GoogleMapsLogo, WazeLogo } from "../components/BrandLogos";
import "./landing.css";
import "./fondo-cancha.css";

import { getClubConfig } from "../lib/clubConfigServer";
import { getSiteContent } from "../lib/siteContentServer";
import { getCantinaMenu } from "../lib/cantinaMenuServer";
import { HOME_FEATURED_COUNT, featuredItems } from "../lib/cantinaMenu";
import { publicPayment } from "../lib/clubConfig";
import { CLUB_INFO } from "../data/club";
import { todayInClub } from "../lib/booking";
import { FAQS } from "../data/faq";
import HeroVideo from "../components/HeroVideo";

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
  "Pistas cubiertas",
  "Torneos todo el año",
  "Cantina y tercer tiempo",
  "Catriel · Río Negro",
];

// El precio del turno, las fotos y la carta salen del panel: la home se
// regenera cada 5 min (y al guardar fotos o la carta) sin redeploy.
export const revalidate = 300;

export default async function Home() {
  const [config, { photos, location }, menu] = await Promise.all([
    getClubConfig(),
    getSiteContent(),
    getCantinaMenu(),
  ]);
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
      <SiteHeader />

      {/* 1. HERO */}
      <section id="top" className="hero-night">
        <div className="hero-night-photo" aria-hidden="true">
          <Image
            src={photos.hero.src}
            alt=""
            fill
            priority
            // La foto es 4:3 y en vertical se recorta con object-fit: cover: a 390
            // de ancho se dibuja a unos 1285 px (330vw), no a 100vw. Con "100vw"
            // el celular recibía 828 px para cubrir 2570 px de pantalla.
            sizes="(max-width: 480px) 330vw, (max-width: 900px) 170vw, 100vw"
          />
          <HeroVideo />
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
            </div>

            <ul className="hero-trust">
              <li>Confirmás con una seña por WhatsApp</li>
              <li>Pistas cubiertas, cero viento</li>
            </ul>
          </div>

          {/* Sin aria-hidden en el contenedor: los turnos en vivo son un botón.
              La mascota es decorativa (alt vacío) y el precio ya está en Reservas. */}
          <div className="hero-night-visual">
            <div className="hero-mascot-ring" aria-hidden="true" />
            <HeroMascot src="/img/mascotas/muzzaguito-lentes-hero.webp" width={720} height={657} />
            <div className="hero-float-card hero-float-price" aria-hidden="true">
              <span className="hero-float-label">{priceFrom ? "Turno desde" : "Turno"} · {config.slotDurationMin} min</span>
              <strong>${pricing.total.toLocaleString("es-AR")}</strong>
              <span className="hero-float-sub">${pricing.perPlayer.toLocaleString("es-AR")} c/u si son 4</span>
            </div>
            <HeroLiveSlots />
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
            <div className="hero-stat">
              <dt>Jugadores pasan por el club</dt>
              <dd><StatCounter value={300} prefix="+" /></dd>
            </div>
            <div className="hero-stat">
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

          <BookingCalendar
            serverToday={todayInClub()}
            mpEnabled={Boolean(process.env.MP_ACCESS_TOKEN)}
            payment={publicPayment(config)}
            schedule={config.schedule}
            blockedDates={config.blockedDates}
          />
        </div>
      </section>

      {/* Testimonios: fuera hasta tener reseñas reales con nombre y foto (o
          las de Google). El componente queda en components/. */}

      {/* 4. INSTALACIONES */}
      <AmenitiesSection photos={photos} />

      {/* 5. TORNEOS DESTACADOS */}
      <HomeTorneosTeaser photos={photos} />

      {/* 7. CANTINA DESTACADA */}
      <HomeCantinaTeaser
        photos={photos}
        featured={featuredItems(menu.items).slice(0, HOME_FEATURED_COUNT)}
      />

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
                    <Image src="/img/iconos/biblioteca/icono-ubicacion.webp" alt="" width={44} height={44} className="icono-3d" />
                  </div>
                  <div className="location-detail-content">
                    <span className="location-detail-label">Dirección</span>
                    <strong className="location-detail-value">{location.street}</strong>
                    <span className="location-detail-sub">{location.locality}</span>
                  </div>
                </div>

                <div className="location-detail-item">
                  <div className="location-detail-icon location-icon-clock" aria-hidden="true">
                    <Image src="/img/iconos/biblioteca/icono-reloj.webp" alt="" width={44} height={44} className="icono-3d" />
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
                  href={location.mapsHref}
                  target="_blank"
                  rel="noopener"
                  className="location-btn location-btn-maps"
                  aria-label="Abrir en Google Maps"
                >
                  <GoogleMapsLogo size={18} />
                  <span>Google Maps</span>
                  <span className="location-btn-arrow" aria-hidden="true">↗</span>
                </a>

                <a
                  href={location.wazeUrl}
                  target="_blank"
                  rel="noopener"
                  className="location-btn location-btn-waze"
                  aria-label="Navegar con Waze"
                >
                  <WazeLogo size={18} />
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
                  <WhatsAppLogo size={18} />
                  <span>WhatsApp</span>
                  <span className="location-btn-arrow" aria-hidden="true">↗</span>
                </a>
              </div>
            </div>

            <div className="location-map-pane">
              <iframe
                title={`Mapa de Muzzaga Pádel en ${location.city}`}
                src={location.embedUrl}
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
      <SiteFooter />
      <BottomNav />
      <ScrollReveal />
    </>
  );
}
