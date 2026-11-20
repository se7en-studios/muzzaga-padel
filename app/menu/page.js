import { Suspense } from "react";
import PageCrumbs from "../../components/PageCrumbs";
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
      <main className="page-main">
        <PageCrumbs items={[{ label: "Menú de la cantina" }]} />

        <Suspense fallback={<div className="container" style={{ padding: 40, textAlign: "center" }}>Cargando carta de cantina…</div>}>
          <MenuClient items={items} />
        </Suspense>
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
