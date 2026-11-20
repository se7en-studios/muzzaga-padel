// "Agregar a inicio": nombre corto que entra debajo del ícono, color de
// marca en la barra y los íconos cuadrados generados desde el badge (antes
// apuntaba al badge no cuadrado y al logo blanco sobre transparente, que en
// la pantalla de inicio se veía como una mancha).
export default function manifest() {
  return {
    name: "Muzzaga Pádel",
    short_name: "Muzzaga",
    description: "Club de pádel en Catriel, Río Negro. Reservá tu turno, torneos y cantina.",
    lang: "es-AR",
    dir: "ltr",
    id: "/",
    start_url: "/",
    scope: "/",
    categories: ["sports"],
    display: "standalone",
    background_color: "#1b1b19",
    theme_color: "#1b1b19",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Atajos al mantener apretado el ícono (Android).
    shortcuts: [
      { name: "Reservar turno", url: "/#turnos" },
      { name: "Torneos", url: "/torneos" },
      { name: "Menú de la cantina", url: "/menu" },
    ],
  };
}
