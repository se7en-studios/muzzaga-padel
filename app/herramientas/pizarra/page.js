import Link from "next/link";
import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";
import BottomNav from "../../../components/BottomNav";
import TacticalCourtSimulator from "../../../components/TacticalCourtSimulator";
import Mascota from "../../../components/Mascota";
import { pageMetadata } from "../../../lib/pageMeta";

export const metadata = pageMetadata({
  title: "Pizarra táctica de pádel interactiva · Muzzaga Pádel",
  description:
    "Simulador interactivo de jugadas y táctica de pádel en cancha de cristal: víbora a la reja, smash por 3, bandeja y chiquita animadas paso a paso.",
  path: "/herramientas/pizarra",
});

export default function PizarraPage() {
  return (
    <>
      <SiteHeader />
      <main style={{ paddingTop: 90, minHeight: "80vh" }}>
        <div className="container" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
            <Link className="back-link" href="/" style={{ color: "var(--color-accent-orange-text)", textDecoration: "none", fontWeight: 600 }}>
              ← Volver al inicio
            </Link>
            <span>/</span>
            <span>Herramientas</span>
            <span>/</span>
            <span style={{ color: "var(--text-primary)" }}>Pizarra táctica</span>
          </div>
        </div>

        <TacticalCourtSimulator />

        <div className="container" style={{ margin: "40px auto 60px", textAlign: "center" }}>
          <div
            style={{
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-hairline-strong)",
              borderRadius: "var(--radius-xl)",
              padding: "32px 24px",
              maxWidth: 600,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Mascota
              pose="enredado-paleta"
              alt="Muzzaguito enredado con la paleta"
              className="mascot-cta"
            />
            <h3 style={{ fontSize: 20, color: "var(--color-ink)", marginBottom: 8 }}>
              Llevá la táctica a la pista
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20, maxWidth: 440 }}>
              Reservá turno en nuestras canchas de cristal y poné a prueba estas jugadas en tu próximo partido.
            </p>
            <Link href="/#turnos" className="btn btn-linear-primary" style={{ padding: "10px 24px" }}>
              Reservar turno →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
