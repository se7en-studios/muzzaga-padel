// Esqueletos de carga de Clientes, Torneos, Números, Ajustes y Movimientos.
// Copian la forma de lo que va a aparecer (marcador, tarjetas, línea de
// tiempo) para que al llegar los datos no salte nada. El brillo que los
// recorre está en torneos-reportes.css y solo se mueve si el sistema no pide
// menos movimiento.

/** Un "hueso": bloque gris del tamaño del texto o control que reemplaza. */
export function Bone({ w = "100%", h = 14, r, round, className = "" }) {
  return (
    <span
      className={`sk-bone${round ? " is-round" : ""}${className ? ` ${className}` : ""}`}
      style={{ width: w, height: h, borderRadius: r }}
      aria-hidden
    />
  );
}

/** Contenedor accesible: un solo aviso de "Cargando…" para lectores. */
function Busy({ label, className, children }) {
  return (
    <div className={`sk ${className}`} role="status" aria-busy="true">
      <span className="sk-sr">{label}</span>
      {children}
    </div>
  );
}

const range = (n) => Array.from({ length: n }, (_, i) => i);
// Anchos distintos por fila para que no parezca una grilla de ladrillos.
const W = ["62%", "48%", "71%", "55%", "66%", "44%", "58%", "69%"];

/* ---------- Clientes: marcador de segmentos + planilla ---------- */
export function ClientesSkeleton() {
  return (
    <Busy label="Cargando clientes…" className="sk-cc">
      <div className="sk-cc-board">
        {range(5).map((i) => (
          <div key={i} className={`sk-cc-tile${i === 0 ? " sk-court" : ""}`}>
            <span className="sk-row">
              <Bone w={26} h={26} round className={i === 0 ? "is-light" : ""} />
              <Bone w="46%" h={11} className={i === 0 ? "is-light" : ""} />
            </span>
            <Bone w={44} h={30} r={6} className={i === 0 ? "is-light" : ""} />
            <Bone w="64%" h={10} className={i === 0 ? "is-light" : ""} />
          </div>
        ))}
      </div>
      <div className="sk-card sk-cc-roster">
        <div className="sk-cc-toolbar">
          <Bone h={44} r={10} className="sk-cc-search" />
          <Bone w={120} h={12} />
        </div>
        {range(7).map((i) => (
          <div key={i} className="sk-cc-rowline">
            <span className="sk-row sk-grow">
              <Bone w={40} h={40} round />
              <span className="sk-col sk-grow">
                <Bone w={W[i]} h={13} />
                <Bone w="34%" h={10} />
              </span>
            </span>
            <span className="sk-col sk-cc-cell">
              <Bone w={46} h={12} />
              <Bone w="80%" h={5} r={99} />
            </span>
            <Bone w={84} h={12} className="sk-cc-cell" />
            <Bone w={96} h={12} className="sk-cc-cell" />
            <Bone w={92} h={34} r={99} className="sk-cc-cell sk-cc-contact" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/* ---------- Torneos: tarjetas tipo afiche ---------- */
export function TorneosSkeleton() {
  return (
    <Busy label="Cargando torneos…" className="sk-tn tn-list">
      {range(3).map((i) => (
        <div key={i} className="sk-card sk-tn-card">
          <div className="sk-court sk-tn-court">
            <Bone w={58} h={58} r={10} className="is-light" />
            <span className="sk-col sk-grow">
              <Bone w={70} h={18} r={99} className="is-light" />
              <Bone w={W[i + 2]} h={22} className="is-light" />
              <Bone w="40%" h={11} className="is-light" />
            </span>
          </div>
          <div className="sk-col sk-tn-body">
            <span className="sk-row">
              <Bone w={92} h={26} r={99} />
              <Bone w={78} h={26} r={99} />
              {i === 0 && <Bone w={64} h={26} r={99} />}
            </span>
            <Bone w="55%" h={11} />
            <Bone h={7} r={99} />
            <Bone w="45%" h={11} />
            <Bone h={7} r={99} />
          </div>
        </div>
      ))}
    </Busy>
  );
}

/* ---------- Números del mes: cancha grande + KPIs + barras ---------- */
const BARS = [38, 52, 30, 64, 70, 46, 82, 58, 40, 66, 74, 50, 88, 61, 35, 57, 72, 49];

export function ReportesSkeleton() {
  return (
    <Busy label="Armando el reporte…" className="sk-rp">
      <div className="sk-court sk-rp-hero">
        <span className="sk-col sk-rp-hero-main">
          <span className="sk-row">
            <span className="sk-ball" aria-hidden />
            <Bone w={150} h={14} className="is-light" />
          </span>
          <Bone w={180} h={18} className="is-light" />
          <Bone w={190} h={62} r={8} className="is-light" />
          <Bone w={230} h={12} className="is-light" />
        </span>
        <span className="sk-rp-hero-side">
          <Bone w="70%" h={11} />
          <Bone w="92%" h={14} />
        </span>
      </div>
      <div className="sk-rp-kpis">
        {range(4).map((i) => (
          <div key={i} className="sk-card sk-col">
            <span className="sk-row">
              <Bone w={32} h={32} r={9} />
              <Bone w="50%" h={11} />
            </span>
            <Bone w="46%" h={30} r={6} />
            <Bone w="78%" h={10} />
          </div>
        ))}
      </div>
      <div className="sk-card sk-rp-chart">
        <Bone w={220} h={16} />
        <div className="sk-rp-bars" aria-hidden>
          {BARS.map((h, i) => (
            <Bone key={i} h={`${h}%`} r="6px 6px 2px 2px" />
          ))}
        </div>
      </div>
    </Busy>
  );
}

/* ---------- Ajustes: índice + tarjeta de sección ---------- */
export function AjustesSkeleton() {
  return (
    <Busy label="Cargando los ajustes…" className="sk-cfg">
      <div className="sk-card sk-cfg-nav">
        <Bone w={60} h={11} />
        {range(7).map((i) => (
          <span key={i} className="sk-row">
            <Bone w={18} h={12} />
            <Bone w={W[i]} h={14} />
          </span>
        ))}
      </div>
      <div className="sk-col sk-cfg-main">
        <div className="sk-court sk-cfg-hero">
          <Bone w={180} h={12} className="is-light" />
          <span className="sk-row sk-cfg-hero-stats">
            {range(4).map((i) => (
              <span key={i} className="sk-col">
                <Bone w={64} h={30} r={6} className="is-light" />
                <Bone w={58} h={10} className="is-light" />
              </span>
            ))}
          </span>
        </div>
        {range(2).map((i) => (
          <div key={i} className="sk-card sk-cfg-section">
            <span className="sk-row">
              <span className="sk-court sk-cfg-badge" aria-hidden />
              <span className="sk-col sk-grow">
                <Bone w={i ? 140 : 200} h={18} />
                <Bone w="58%" h={12} />
              </span>
            </span>
            <span className="sk-cfg-fields">
              <Bone h={44} r={10} />
              <Bone h={44} r={10} />
            </span>
            <Bone w="80%" h={12} />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Lista del equipo mientras llega (dentro de Ajustes → Equipo). */
export function StaffSkeleton() {
  return (
    <Busy label="Cargando el equipo…" className="sk-staff">
      {range(3).map((i) => (
        <span key={i} className="sk-row sk-staff-row">
          <Bone w={38} h={38} round />
          <span className="sk-col sk-grow">
            <Bone w={W[i]} h={13} />
            <Bone w="30%" h={10} />
          </span>
          <Bone w={72} h={32} r={99} />
        </span>
      ))}
    </Busy>
  );
}

/** Sitio web: ubicación + tira de fotos. */
export function SitioSkeleton() {
  return (
    <Busy label="Cargando el sitio web…" className="sk-site">
      <span className="sk-site-loc">
        <span className="sk-col">
          <Bone w={120} h={16} />
          <Bone h={44} r={10} />
          <Bone h={44} r={10} />
        </span>
        <span className="sk-court sk-site-map" aria-hidden />
      </span>
      <Bone w={110} h={16} />
      <span className="sk-site-photos">
        {range(5).map((i) => (
          <span key={i} className="sk-col sk-site-photo">
            <span className="sk-court" aria-hidden />
            <Bone w="70%" h={12} />
            <Bone h={36} r={10} />
          </span>
        ))}
      </span>
    </Busy>
  );
}

/** Carta de la cantina: renglones con nombre y precio. */
export function CartaSkeleton() {
  return (
    <Busy label="Cargando la carta…" className="sk-carta">
      <span className="sk-row sk-carta-head">
        <Bone w={150} h={18} />
        <Bone w={110} h={40} r={10} className="sk-push" />
      </span>
      <Bone h={44} r={10} />
      {range(6).map((i) => (
        <span key={i} className="sk-row sk-carta-row">
          <Bone w={36} h={36} r={10} />
          <Bone w={W[i]} h={14} className="sk-grow-soft" />
          <Bone w={96} h={40} r={10} className="sk-push" />
        </span>
      ))}
    </Busy>
  );
}

/** Movimientos: un día con su línea de tiempo. */
export function ActividadSkeleton() {
  return (
    <Busy label="Cargando movimientos…" className="sk-act">
      <span className="sk-row sk-act-day">
        <Bone w={48} h={22} r={99} />
        <Bone w={200} h={16} />
      </span>
      {range(5).map((i) => (
        <span key={i} className="sk-act-item">
          <Bone w={40} h={12} />
          <span className="sk-act-dot" aria-hidden />
          <span className="sk-card sk-row sk-act-card">
            <Bone w={36} h={36} round />
            <span className="sk-col sk-grow">
              <Bone w={W[i]} h={13} />
              <Bone w="38%" h={10} />
            </span>
          </span>
        </span>
      ))}
    </Busy>
  );
}
