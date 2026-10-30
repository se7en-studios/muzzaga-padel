import { Suspense } from "react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import BottomNav from "../../components/BottomNav";
import MenuClient from "./MenuClient";
import { pageMetadata } from "../../lib/pageMeta";
import { getCantinaMenu } from "../../lib/cantinaMenuServer";

export const metadata = pageMetadata({
  title: "Menú de la cantina · Muzzaga Pádel",
  description:
    "Carta completa de la cantina de Muzzaga Pádel: pizzas caseras, tostados, sándwiches de mila, cervezas heladas, bebidas frías y kiosco en Catriel.",
  path: "/menu",
});

// La carta sale del panel (Cantina → Carta y precios): se regenera al
// guardarla y, por las dudas, cada 5 min.
export const revalidate = 300;

export default async function MenuPage() {
  const { items } = await getCantinaMenu();
  return (
    <>
      <SiteHeader />
      <main style={{ paddingTop: 90, minHeight: "80vh" }}>
        <div className="container" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 8px", fontSize: 13, color: "var(--text-muted)" }}>
            <Link className="back-link" href="/" style={{ color: "var(--color-accent-orange-text)", textDecoration: "none", fontWeight: 600 }}>
              ← Volver al inicio
            </Link>
            <span>/</span>
            <span style={{ color: "var(--text-primary)" }}>Menú de la cantina</span>
          </div>
        </div>

        <Suspense fallback={<div className="container" style={{ padding: 40, textAlign: "center" }}>Cargando carta de cantina…</div>}>
          <MenuClient items={items} />
        </Suspense>
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
