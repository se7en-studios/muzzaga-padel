"use client";

import { useEffect } from "react";

const TARGET_SELECTOR =
    ".section-header-row, .photo-bento-card, .open-card, .rating-box, .location-unified-card, .map-frame-wrap, .info-card, .info-link-card, .faq-card, .testimonial-card, .club-tool-card, .torneo-thumb, .spec-panel, .price-tag";

/** Renders nothing; just wires up the fade-in-on-scroll behavior for the static sections. */
export default function ScrollReveal() {
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches)
      return;
    if (!("IntersectionObserver" in window)) return;

    const targets = document.querySelectorAll(TARGET_SELECTOR);
    targets.forEach((el) => {
      el.classList.add("reveal-up");
      // Índice entre hermanos revelables → escalonado vía CSS (--i).
      const siblings = [...el.parentElement.children].filter((c) =>
        c.matches(TARGET_SELECTOR),
      );
      el.style.setProperty("--i", Math.min(siblings.indexOf(el), 6));
    });

    const timers = [];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add("in-view");
          io.unobserve(el);
          // Terminada la entrada (500 ms más su escalonado), la tarjeta
          // vuelve a sus transiciones propias. Si no, el hover heredaba los
          // 500 ms y la demora de la entrada.
          const i = Number(el.style.getPropertyValue("--i")) || 0;
          timers.push(
            setTimeout(() => {
              el.classList.remove("reveal-up", "in-view");
              el.style.removeProperty("--i");
            }, 500 + i * 60 + 250),
          );
        });
      },
      // Arranca apenas el borde de arriba está por entrar (10 % de pantalla
      // antes), no cuando ya se ve el 15 %: en tarjetas altas (la ficha
      // técnica) eso dejaba cientos de px vacíos al scrollear normal.
      { threshold: 0, rootMargin: "0px 0px 10% 0px" },
    );
    targets.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return null;
}
