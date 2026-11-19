// Datos institucionales y de contacto de Muzzaga Pádel

export const CLUB_INFO = {
  name: "Muzzaga Pádel",
  tagline: "Más que pádel",
  phoneRaw: "5492995974176",
  phoneFormatted: "+54 9 299 597-4176",
  city: "Catriel",
  province: "Río Negro",
  country: "Argentina",
  address: "Catriel, Río Negro, Argentina",
  geo: {
    lat: -37.8832905,
    lng: -67.8005469,
  },
  instagram: "https://instagram.com/muzzagapadel",
  instagramHandle: "@muzzagapadel",
  mapsUrl: "https://maps.app.goo.gl/kR1h9mhdLqGLKatV7",
  wazeUrl: "https://waze.com/ul?ll=-37.8832905,-67.8005469&navigate=yes",
  courtsCount: 2,
  courtType: "Canchas de cristal templado con césped sintético e iluminación LED",
};

/**
 * Generador de enlaces contextuales a WhatsApp
 */
export function buildWhatsAppLink(text) {
  return `https://wa.me/${CLUB_INFO.phoneRaw}?text=${encodeURIComponent(text)}`;
}
