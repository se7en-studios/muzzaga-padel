import Link from "next/link";
import Image from "next/image";

const TOOLS = [
  {
    href: "/herramientas/dividir-gastos",
    badge: "Para grupos",
    badgeColor: "badge-emerald",
    icon: "/img/iconos/icono-dividir.webp",
    title: "Dividir cancha y tercer tiempo",
    desc: "Calculá en segundos cuánto paga cada uno por el turno y los consumos de cantina. Copiá el desglose directo al grupo de WhatsApp.",
    cta: "Abrir calculadora",
  },
  {
    href: "/herramientas/nivel",
    badge: "Competencia",
    badgeColor: "badge-indigo",
    icon: "/img/iconos/icono-nivel.webp",
    title: "Test de nivel y categorías",
    desc: "Descubrí si sos 7ma, 6ta o 5ta según tu juego y la escala internacional (1.0 a 7.0). Ideal para anotarte en partidos parejos.",
    cta: "Calcular mi nivel",
  },
  {
    href: "/herramientas/pizarra",
    badge: "Estrategia",
    badgeColor: "badge-amber",
    icon: "/img/iconos/icono-pizarra.webp",
    title: "Pizarra táctica interactiva",
    desc: "Simulador interactivo de jugadas en cancha de cristal: repasá paso a paso la víbora a la reja, el smash por 3, bandejas y chiquitas.",
    cta: "Ver simulador táctico",
  },
  {
    href: "/herramientas/americano",
    badge: "Torneos express",
    badgeColor: "badge-emerald",
    icon: "/img/iconos/icono-americano.webp",
    title: "Generador de torneo americano",
    desc: "Armá el fixture de rotación para 4 a 8 jugadores donde todos juegan con todos en partidos cortos y equilibrados.",
    cta: "Generar fixture",
  },
];

export default function ClubToolsSection() {
  return (
    <section
      id="herramientas"
      className="section-turnos"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="container">
        <div className="section-header-row">
          <div>
            <span
              className="badge-linear badge-amber"
              style={{ marginBottom: 8 }}
            >
              Herramientas gratis
            </span>
            <h2 className="section-title">
              Herramientas para jugar mejor
            </h2>
            <p className="section-desc">
              Herramientas interactivas creadas para ayudarte a organizar tus
              partidos, mejorar tu táctica y saber tu categoría.
            </p>
          </div>
        </div>

        <div className="tools-grid">
          {TOOLS.map((tool) => (
            <div key={tool.href} className="club-tool-card">
              <div>
                <div className="club-tool-top">
                  <span className="club-tool-icon" aria-hidden="true">
                    <Image src={tool.icon} alt="" width={76} height={76} className="icono-3d" />
                  </span>
                  <span className={`badge-linear ${tool.badgeColor}`}>
                    {tool.badge}
                  </span>
                </div>
                <h3 className="club-tool-title">{tool.title}</h3>
                <p className="club-tool-desc">{tool.desc}</p>
              </div>

              <Link href={tool.href} className="club-tool-link">
                {tool.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
