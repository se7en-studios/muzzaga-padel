import { SITE_URL } from "./site.js";

/**
 * Lógica pura para formatear el carnet de nivel y mensajes de WhatsApp de Muzzaga Pádel.
 */

export function buildLevelShareMessage({
  rating = "3.5",
  categoryName = "5ta Categoría",
  categoryLabel = "Intermedio",
  playerName = "",
}) {
  const nameStr = playerName && playerName.trim() ? ` de *${playerName.trim()}*` : "";

  return (
    `🎾 *FICHA DE JUGADOR — MUZZAGA PÁDEL*\n` +
    `Evaluación de nivel${nameStr}:\n\n` +
    `⭐ *Categoría:* ${categoryName} (${categoryLabel})\n` +
    `📊 *Rating Internacional:* ${rating} / 7.0\n\n` +
    `🏆 *Recomendación:* Apto para torneos y partidos parejos de ${categoryName}.\n` +
    `📍 Canchas de cristal templado en Muzzaga Pádel (Catriel).\n\n` +
    `👉 Hacé tu test de nivel gratis acá:\n${SITE_URL}/herramientas/nivel`
  );
}

export function buildLevelWhatsAppUrl(params) {
  const text = buildLevelShareMessage(params);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function evaluatePlayerSkills(
  quizAnswers = { exp: 1, wall: 1, net: 1, serve: 1, position: 1, tactic: 1 },
) {
  const expLabels = [
    "Iniciación (< 6 meses)",
    "En consolidación (6m - 2 años)",
    "Experimentado (+ 2 años)",
  ];
  const wallLabels = [
    "Aprendiendo lectura de rebote",
    "Paso controlado con cristal",
    "Ataque profundo de pared",
  ];
  const netLabels = [
    "Juego conservador de fondo",
    "Voleas firmes y bandeja armada",
    "Definición y smash agresivo",
  ];
  const serveLabels = [
    "Saque básico, cuesta cubrir la cancha",
    "Saque con variantes y buen desplazamiento",
    "Saque con efecto/potencia y cobertura total",
  ];
  const positionLabels = [
    "Cada uno cubre lo suyo, sin coordinar",
    "Se turnan la red y el fondo, con alguna duda",
    "Suben y cierran la cancha en equipo",
  ];
  const tacticLabels = [
    "Sin experiencia en torneos",
    "Torneos sociales o amistosos",
    "Compite en torneos/ligas federadas",
  ];

  return {
    experience: expLabels[quizAnswers.exp] ?? expLabels[1],
    wallPlay: wallLabels[quizAnswers.wall] ?? wallLabels[1],
    netPlay: netLabels[quizAnswers.net] ?? netLabels[1],
    serve: serveLabels[quizAnswers.serve] ?? serveLabels[1],
    position: positionLabels[quizAnswers.position] ?? positionLabels[1],
    tactic: tacticLabels[quizAnswers.tactic] ?? tacticLabels[1],
  };
}
