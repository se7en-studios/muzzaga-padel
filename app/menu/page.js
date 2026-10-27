import { Suspense } from "react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import BottomNav from "../../components/BottomNav";
import MenuClient from "./MenuClient";
import { pageMetadata } from "../../lib/pageMeta";

export const metadata = pageMetadata({
  title: "Menú de la cantina · Muzzaga Pádel",
  description:
    "Carta completa de la cantina de Muzzaga Pádel: pizzas caseras, tostados, sándwiches de mila, cervezas heladas, bebidas frías y kiosco en Catriel.",
  path: "/menu",
});

export default function MenuPage() {
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
            <span style={{ color: "var(--text-primary)" }}>Menú de la cantina</span>
          </div>
        </div>

        <Suspense fallback={<div className="container" style={{ padding: 40, textAlign: "center" }}>Cargando carta de cantina…</div>}>
          <MenuClient />
        </Suspense>
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
