import Header from "./Header";
import Footer from "./Footer";
import BottomNav from "./BottomNav";
import Mascota from "./Mascota";
import "./EstadoMarca.css";

/**
 * Página de estado con la marca (404, error): header y footer del sitio,
 * una cancha vista desde arriba con la mascota (y el código, si hay, con la
 * pelota haciendo de cero), un título canchero y las salidas. `location` es
 * la de Configuración → Sitio web; la página de error (client) no la tiene
 * y muestra la original.
 */
export default function EstadoMarca({ pose, kicker, code, title, text, location, children }) {
  return (
    <>
      <Header mapsHref={location?.mapsHref} />
      <main className="estado-marca">
        <div className="estado-cancha" aria-hidden="true">
          <svg
            className="estado-cancha-lineas"
            viewBox="0 0 200 100"
            preserveAspectRatio="none"
            focusable="false"
          >
            <rect x="6" y="6" width="188" height="88" />
            <line x1="100" y1="2" x2="100" y2="98" className="estado-cancha-red" />
            <line x1="56" y1="6" x2="56" y2="94" />
            <line x1="144" y1="6" x2="144" y2="94" />
            <line x1="56" y1="50" x2="144" y2="50" />
          </svg>
          {code ? (
            <p className="estado-cancha-codigo">
              {String(code)
                .split("")
                .map((digit, i) =>
                  digit === "0" ? (
                    <span key={i} className="estado-cancha-pelota" />
                  ) : (
                    <span key={i}>{digit}</span>
                  ),
                )}
            </p>
          ) : (
            <span className="estado-cancha-pelota estado-cancha-pelota-sola" />
          )}
          {code ? <span className="estado-cancha-out">Out</span> : null}
          <Mascota pose={pose} priority className="estado-marca-mascota" />
        </div>

        <div className="estado-marca-copy">
          <p className="estado-marca-kicker">{kicker}</p>
          <h1 className="estado-marca-title">{title}</h1>
          <p className="estado-marca-text">{text}</p>
          <div className="estado-marca-actions">{children}</div>
        </div>
      </main>
      <Footer location={location} />
      <BottomNav />
    </>
  );
}
