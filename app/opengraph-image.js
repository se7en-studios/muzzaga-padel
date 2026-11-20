import { ImageResponse } from "next/og";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { getSiteContent } from "../lib/siteContentServer";

// Tarjeta para compartir el link (WhatsApp, redes): el logo real, la
// mascota de lentes sobre una cancha azul vista de arriba y las tipografías
// de la marca. "Catriel" va en verde pelota: es lo que buscan y lo primero
// que tiene que leerse en la miniatura del celular.

export const runtime = "nodejs";
export const alt = "Muzzaga Pádel · Canchas de pádel en Catriel, Río Negro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const AZUL = "#2350d6";
const NARANJA = "#e8722a";
const PELOTA = "#d7f03a";
const FONDO = "#1b1b19";

const TITLE_1 = "CANCHAS DE PÁDEL";
const TITLE_2 = "EN CATRIEL";
const SUB = "2 canchas de cristal · LED · Turnos de 90 min";
const CTA = "Reservá tu turno online";

// Google Fonts devuelve TTF cuando no se pide woff2; `text` recorta la
// fuente a los caracteres que se usan. Si falla la red, queda la fuente
// por defecto de next/og y la imagen se genera igual.
async function googleFont(family, weight, text) {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1]);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

const asset = async (name) =>
  `data:image/png;base64,${(await readFile(join(process.cwd(), "assets/og", name))).toString("base64")}`;

// Líneas blancas de la cancha (20 × 10 m vista de arriba): red al medio y
// líneas de saque a 6,95 m de la red.
function Cancha() {
  const W = 360;
  const H = 560;
  const saque = Math.round((H / 2) * (6.95 / 10));
  const linea = "rgba(255,255,255,0.85)";
  const abs = { position: "absolute", display: "flex" };
  return (
    <div
      style={{
        ...abs,
        right: 56,
        top: 35,
        width: W,
        height: H,
        borderRadius: 22,
        backgroundColor: AZUL,
        backgroundImage: "linear-gradient(160deg, #2f62f0 0%, #2350d6 55%, #1a3fae 100%)",
        border: `5px solid ${linea}`,
        boxShadow: "0 30px 80px rgba(35, 80, 214, 0.45)",
      }}
    >
      {/* Red */}
      <div style={{ ...abs, left: -5, right: -5, top: H / 2 - 7, height: 8, backgroundColor: "#ffffff" }} />
      {/* Líneas de saque */}
      <div style={{ ...abs, left: 0, right: 0, top: H / 2 - 5 - saque, height: 4, backgroundColor: linea }} />
      <div style={{ ...abs, left: 0, right: 0, top: H / 2 - 5 + saque, height: 4, backgroundColor: linea }} />
      {/* Línea central */}
      <div
        style={{
          ...abs,
          left: W / 2 - 7,
          width: 4,
          top: H / 2 - 5 - saque,
          height: saque * 2,
          backgroundColor: linea,
        }}
      />
    </div>
  );
}

export default async function Image() {
  // La dirección sale del panel (Configuración → Sitio web), como en la web.
  // Va antes de pedir las fuentes: `text` tiene que traer sus letras.
  const { location } = await getSiteContent();
  const foot = [location.street, location.locality];
  const [logo, mascota, display, sansMedium, sansBold] = await Promise.all([
    asset("logo-blanco.png"),
    asset("mascota-lentes-paleta.png"),
    googleFont("Barlow+Condensed", 800, TITLE_1 + TITLE_2),
    googleFont("Poppins", 500, SUB + foot.join("")),
    googleFont("Poppins", 700, CTA),
  ]);

  const fonts = [
    display && { name: "Barlow Condensed", data: display, weight: 800, style: "normal" },
    sansMedium && { name: "Poppins", data: sansMedium, weight: 500, style: "normal" },
    sansBold && { name: "Poppins", data: sansBold, weight: 700, style: "normal" },
  ].filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: FONDO,
          backgroundImage: `radial-gradient(circle at 78% 50%, rgba(35, 80, 214, 0.42) 0%, rgba(27, 27, 25, 0) 52%), radial-gradient(circle at 8% 100%, rgba(232, 114, 42, 0.22) 0%, rgba(27, 27, 25, 0) 45%)`,
          color: "#ffffff",
          fontFamily: "Poppins",
        }}
      >
        <Cancha />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 0 50px 72px",
            width: 740,
          }}
        >
          <img src={logo} width={224} height={116} alt="" />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontFamily: "Barlow Condensed",
                fontWeight: 800,
                fontSize: 90,
                whiteSpace: "nowrap",
                lineHeight: 0.92,
                letterSpacing: -0.5,
              }}
            >
              <span>{TITLE_1}</span>
              <span style={{ color: PELOTA }}>{TITLE_2}</span>
            </div>
            <div style={{ marginTop: 20, fontSize: 27, fontWeight: 500, color: "rgba(255,255,255,0.88)" }}>
              {SUB}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                padding: "12px 24px",
                borderRadius: 999,
                backgroundColor: NARANJA,
                fontSize: 25,
                fontWeight: 700,
                whiteSpace: "nowrap",
                flexShrink: 0,
                marginRight: 18,
              }}
            >
              {CTA}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 19,
                fontWeight: 500,
                lineHeight: 1.3,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              <span>{foot[0]}</span>
              <span>{foot[1]}</span>
            </div>
          </div>
        </div>

        <img
          src={mascota}
          width={430}
          height={400}
          alt=""
          style={{ position: "absolute", right: 14, bottom: 92 }}
        />
      </div>
    ),
    // Con fonts: [] next/og no carga su fuente por defecto y falla.
    { ...size, ...(fonts.length ? { fonts } : {}) }
  );
}
