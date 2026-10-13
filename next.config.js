const isDev = process.env.NODE_ENV !== "production";

// Política de contenido. Lo que protege de verdad va estricto: scripts solo
// propios (más los inline que Next necesita para hidratar), sin <object>,
// <base> ni formularios hacia afuera, y nadie puede embeber el sitio.
// Lo demás (iframes, imágenes, fuentes, conexiones, media) se permite por
// https: el mapa de Google redirige entre dominios según el país
// (google.com, google.com.ar...) y los navegadores internos de Instagram y
// WhatsApp cargan recursos propios: una lista corta de hosts los bloqueaba
// con "Este contenido está bloqueado". En desarrollo React necesita eval.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https:",
  "frame-src https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Fotos que el club sube desde Configuración → Sitio web (Vercel Blob).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/sitio/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Las fotos llegan ya achicadas (lib/compressImage.js, tope 3,8 MB);
      // Vercel no acepta cuerpos de más de 4,5 MB.
      bodySizeLimit: "4.5mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: CSP,
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
