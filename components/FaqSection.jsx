"use client";

import { useEffect, useRef, useState } from "react";
import { FAQS } from "../data/faq";

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);
  const sectionRef = useRef(null);

  // Movimiento (anim-faq-ubicacion.css): "faq-fx" arma los estados de
  // entrada solo si corre este JS y se acepta movimiento; "faq-in" cuando
  // las preguntas llegan a pantalla; el cierre recibe "is-in" al entrar e
  // "is-visible" mientras se ve (su pelota pica en loop solo entonces).
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !("IntersectionObserver" in window)) return undefined;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches)
      return undefined;
    const lista = section.querySelector(".faq-list");
    const cierre = section.querySelector(".faq-cierre");
    section.classList.add("faq-fx");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target === lista && e.isIntersecting) section.classList.add("faq-in");
          if (e.target === cierre) {
            if (e.isIntersecting) cierre.classList.add("is-in");
            cierre.classList.toggle("is-visible", e.isIntersecting);
          }
        }
      },
      { threshold: 0.2 },
    );
    if (lista) io.observe(lista);
    if (cierre) io.observe(cierre);
    return () => {
      io.disconnect();
      section.classList.remove("faq-fx", "faq-in");
    };
  }, []);

  const toggleFaq = (idx) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="section-turnos" ref={sectionRef}>
      <div className="container faq-layout">
        {/* Celu: encabezado → preguntas → cierre, uno abajo del otro. En la
            compu el encabezado y el cierre van a la izquierda y las
            preguntas a la derecha (grilla en herramientas-faq.css). */}
        <div className="section-header-row">
          <div>
            <span
              className="badge-linear badge-indigo"
              style={{ marginBottom: 8 }}
            >
              Dudas habituales
            </span>
            <h2 className="section-title">Preguntas frecuentes</h2>
            <p className="section-desc">
              Todo lo que necesitás saber antes de venir a jugar a Muzzaga
              Pádel.
            </p>
          </div>
        </div>

        <div className="faq-list">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            const num = String(idx + 1).padStart(2, "0");
            return (
              <div key={idx} className={`faq-card${isOpen ? " active" : ""}`}>
                <h3 className="faq-q">
                  <button
                    type="button"
                    id={`faq-q-${num}`}
                    className="faq-question-btn"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${num}`}
                  >
                    <span className="faq-question-main">
                      <span className="faq-eyebrow">
                        <span className="faq-num">{num}</span>
                        {faq.tema && <span className="faq-tema">{faq.tema}</span>}
                      </span>
                      <span className="faq-question-text">{faq.q}</span>
                    </span>
                    <span className="faq-icon" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                  </button>
                </h3>
                <div
                  id={`faq-a-${num}`}
                  role="region"
                  aria-labelledby={`faq-q-${num}`}
                  className={`faq-answer-wrap${isOpen ? " open" : ""}`}
                  inert={!isOpen}
                >
                  <div className="faq-answer-content">
                    <p>{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cierre: si la duda no está en la lista, que pregunte al club.
            El botón de WhatsApp vivía arriba de las preguntas; acá abajo
            llega justo cuando el que lee no encontró su respuesta. */}
        <div className="faq-cierre">
          <span className="faq-cierre-pelota" aria-hidden="true" />
          <div className="faq-cierre-texto">
            <p className="faq-cierre-kicker">¿Seguís con dudas?</p>
            <h3 className="faq-cierre-titulo">Preguntale al club</h3>
            <p className="faq-cierre-desc">
              Escribinos por WhatsApp y te respondemos al toque.
            </p>
          </div>
          <a
            href="https://wa.me/5492995974176?text=Hola%20Muzzaga!%20Tengo%20una%20consulta."
            target="_blank"
            rel="noopener"
            className="btn btn-secondary-whatsapp faq-cierre-btn"
            style={{ gap: 8 }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Preguntar por WhatsApp →
          </a>
        </div>
      </div>
    </section>
  );
}
