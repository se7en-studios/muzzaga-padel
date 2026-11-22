import Image from "next/image";
import SiteHeader from "../components/SiteHeader";
import LiveWeatherRadar from "../components/LiveWeatherRadar";
import BookingCalendar from "../components/BookingCalendar";
import HomeCantinaTeaser from "../components/HomeCantinaTeaser";
// Secciones lejos de la primera pantalla: mismo HTML, pero su JS (y motion,
// que usa el carrusel de Instalaciones) se baja recién al acercarse.
import {
  CamarasSection,
  ClubRecorrido,
  AmenitiesSection,
  HomeTorneosTeaser,
  ClubToolsSection,
  FaqSection,
} from "../components/SeccionesDiferidas";
import FloatingLiveBar from "../components/FloatingLiveBar";
import MascotFloatHelper from "../components/MascotFloatHelper";
import BottomNav from "../components/BottomNav";
import SiteFooter from "../components/SiteFooter";
import ScrollReveal from "../components/ScrollReveal";
import ScrollProgress from "../components/ScrollProgress";
import MotionFx from "../components/MotionFx";
import StatCounter from "../components/StatCounter";
import HeroMascot from "../components/HeroMascot";
import HeroTablero from "../components/HeroTablero";
import HeroRally from "../components/HeroRally";
import HorarioSemana from "../components/HorarioSemana";
import MapaRuta from "../components/MapaRuta";
import { WhatsAppLogo, WazeLogo } from "../components/BrandLogos";
import "./landing.css";
import "./fondo-cancha.css";
import "../components/ClubRecorrido.css"; // acá y no en el componente (diferido): el HTML del servidor llega con estilos
import "./secciones/hero.css";
import "./secciones/hero-v2.css";
import "./secciones/turnos.css";
import "./secciones/camaras-instalaciones.css";
import "./secciones/torneos-cantina.css";
import "./secciones/herramientas-faq.css";
import "./secciones/ubicacion-pie.css";
import "./secciones/movimiento.css";
import "./secciones/anim-turnos.css";
import "./secciones/anim-camaras-torneos.css";
import "./secciones/anim-cantina-herramientas.css";
import "./secciones/anim-faq-ubicacion.css";

import { getClubConfig } from "../lib/clubConfigServer";
import { getSiteContent } from "../lib/siteContentServer";
import { getOpenTournaments } from "../lib/tournamentServer";
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

// Solo en la home: sin zoom de pellizco (al ampliar se arrastraba hacia los costados).
// El admin y el resto del sitio conservan el zoom.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function Home() {
  const [config, { photos, location }, menu, openTournaments] = await Promise.all([
    getClubConfig(),
    getSiteContent(),
    getCantinaMenu(),
    getOpenTournaments(),
  ]);
  const { valle, pico, picoEnabled, picoDesde } = config.pricing;
  const ars = (n) => `$${n.toLocaleString("es-AR")}`;
  const perPlayer = (b) => b.perPlayer || Math.round(b.court / 4);
  // Con horario pico a otro precio se muestran los dos; si no, uno solo.
  const twoPrices = picoEnabled && pico.court !== valle.court;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
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
              {/* El punto final es una pelota (CSS): el "." sigue en el texto
                  para lectores de pantalla y buscadores. */}
              <span className="hero-line hero-line-accent">
                Pádel de verdad<span className="hero-ball-dot">.</span>
              </span>
            </h1>

            <p className="hero-night-lede">
              {config.courts?.length || 2} canchas de cristal templado cubiertas con iluminación LED, turnos de{" "}
              {config.slotDurationMin} minutos y cantina para el mejor tercer tiempo.
            </p>

            <div className="hero-night-ctas">
              <a href="#reservar" className="hero-btn-primary">
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

          {/* Los turnos libres de cada cancha, en vivo: tocar un horario
              lo deja elegido en la grilla de reservas. */}
          <div className="hero-v2-board">
            <HeroTablero
              precio={ars(Math.min(valle.court, twoPrices ? pico.court : valle.court))}
              precioSub={
                twoPrices
                  ? `turno ${config.slotDurationMin} min · ${ars(pico.court)} desde las ${picoDesde}`
                  : `el turno de ${config.slotDurationMin} min · ${ars(perPlayer(valle))} c/u`
              }
            />
          </div>

          {/* La mascota se asoma detrás del tablero y pisa la cinta. */}
          <div className="hero-night-visual" aria-hidden="true">
            <div className="hero-mascot-ring" />
            <HeroMascot src="/img/mascotas/muzzaguito-lentes-hero.webp" width={720} height={657} />
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

        <HeroRally />
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

      {/* Los turnos libres de hoy y mañana ya están en el tablero del hero
          (HeroTablero): la franja "Próximos turnos libres" que iba acá los
          repetía. */}

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
              {twoPrices ? (
                <>
                  <div className="price-tag-main">
                    {ars(valle.court)} hasta las {picoDesde} · {ars(pico.court)} desde las {picoDesde}
                  </div>
                  <div className="price-tag-sub">
                    Turno de {config.slotDurationMin} min · {ars(perPlayer(valle))} o{" "}
                    {ars(perPlayer(pico))} por jugador si son cuatro
                  </div>
                </>
              ) : (
                <>
                  <div className="price-tag-main">
                    {ars(valle.court)} por turno ({config.slotDurationMin} min)
                  </div>
                  <div className="price-tag-sub">
                    {ars(perPlayer(valle))} por jugador si son cuatro
                  </div>
                </>
              )}
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

      {/* 3. LOOP DE CÁMARAS (debajo de reservar turnos) */}
      <CamarasSection
        courts={config.courts.map(({ id, name, streamUrl }) => ({
          id,
          name,
          streamUrl: streamUrl || "",
        }))}
        beelupUrl={config.beelupUrl}
      />

      {/* RECORRIDO 3D POR SCROLL (después del loop de cámaras) */}
      <ClubRecorrido />

      {/* Testimonios: fuera hasta tener reseñas reales con nombre y foto (o
          las de Google). El componente queda en components/. */}

      {/* 4. INSTALACIONES */}
      <AmenitiesSection photos={photos} />

      {/* 5. TORNEOS DESTACADOS */}
      <HomeTorneosTeaser photos={photos} tournament={openTournaments[0]} />

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
            {/* El mapa no se arrastra: tiene el pin del club encima y todo el
                cuadro abre Google Maps (en el celu, un mapa embebido atrapaba
                el scroll). Abajo hay un mapa dibujado por si tarda en cargar. */}
            <div className="location-map-pane">
              <div className="mapa-dibujo" aria-hidden="true" />
              <iframe
                title={`Mapa de Muzzaga Pádel en ${location.city}`}
                src={location.embedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                tabIndex={-1}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a
                href={location.mapsHref}
                target="_blank"
                rel="noopener"
                className="mapa-abrir"
                aria-label="Ver la ubicación del club en Google Maps"
              >
                <MapaRuta />
                <span className="mapa-pin" aria-hidden="true">
                  <span className="mapa-pin-cartel">Muzzaga Pádel</span>
                  <span className="mapa-pin-gota" />
                  <span className="mapa-pin-sombra" />
                </span>
                <span className="mapa-abrir-chip" aria-hidden="true">
                  Abrir mapa <span>↗</span>
                </span>
              </a>
            </div>

            <div className="location-info-pane">
              <div className="location-detail-item location-direccion">
                <div className="location-detail-icon location-icon-pin" aria-hidden="true">
                  <Image src="/img/iconos/biblioteca/icono-ubicacion.webp" alt="" width={44} height={44} className="icono-3d" />
                </div>
                <div className="location-detail-content">
                  <span className="location-detail-label">Dirección</span>
                  <strong className="location-detail-value">{location.street}</strong>
                  <span className="location-detail-sub">{location.locality}</span>
                </div>
              </div>

              <div className="location-actions">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noopener"
                  className="location-btn location-btn-llegar"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" fillRule="evenodd" aria-hidden="true">
                    <path d="M21.7 11.3l-9-9a1 1 0 0 0-1.4 0l-9 9a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l9-9a1 1 0 0 0 0-1.4zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5-3.5 3.5z" />
                  </svg>
                  <span>Cómo llegar</span>
                </a>

                <a
                  href={location.wazeUrl}
                  target="_blank"
                  rel="noopener"
                  className="location-btn location-btn-waze"
                  aria-label="Ir con Waze"
                  title="Ir con Waze"
                >
                  <WazeLogo size={22} />
                  <span className="location-btn-txt">Waze</span>
                </a>

                <a
                  href={`https://wa.me/${CLUB_INFO.phoneRaw}`}
                  target="_blank"
                  rel="noopener"
                  className="location-btn location-btn-wa"
                  aria-label="Escribirle al club por WhatsApp"
                  title="WhatsApp del club"
                >
                  <WhatsAppLogo size={22} />
                  <span className="location-btn-txt">WhatsApp</span>
                </a>
              </div>

              {/* Lunes a domingo, del horario de Configuración, con el de hoy
                  marcado y el "abierto ahora / cerrado" de siempre. */}
              <HorarioSemana schedule={config.schedule} blockedDates={config.blockedDates} />
            </div>
          </div>
        </div>
      </section>

      <FloatingLiveBar schedule={config.schedule} blockedDates={config.blockedDates} />
      <MascotFloatHelper />
      <SiteFooter />
      <BottomNav />
      <ScrollReveal />
      <MotionFx />
    </>
  );
}
