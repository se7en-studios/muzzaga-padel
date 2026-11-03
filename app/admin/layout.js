import { Inter } from "next/font/google";
import "./admin.css";
import "./agenda.css";
import "./views.css";
import "./insights.css";
import "./ui/ui.css";
import "./torneos.css";
import "./brand.css";

// Una sola sans para todo el admin (inputs, montos, placeholders). La web
// pública sigue con Poppins: esta fuente y admin.css solo aplican dentro de
// .admin-root.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Administración · Muzzaga Pádel",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }) {
  return <div className={`${inter.variable} admin-root`}>{children}</div>;
}
