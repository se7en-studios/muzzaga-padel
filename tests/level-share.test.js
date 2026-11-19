import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLevelShareMessage,
  buildLevelWhatsAppUrl,
  evaluatePlayerSkills,
} from "../lib/levelShare.js";

test("buildLevelShareMessage creates complete WhatsApp message", () => {
  const msg = buildLevelShareMessage({
    rating: "3.8",
    categoryName: "4ta Categoría",
    categoryLabel: "Intermedio Avanzado",
    playerName: "Lucas",
  });

  assert.ok(msg.includes("FICHA DE JUGADOR — MUZZAGA PÁDEL"));
  assert.ok(msg.includes("de *Lucas*"));
  assert.ok(msg.includes("4ta Categoría"));
  assert.ok(msg.includes("3.8 / 7.0"));
  assert.ok(msg.includes("https://muzzaga-padel-seven.vercel.app/herramientas/nivel"));
});

test("buildLevelWhatsAppUrl returns valid WhatsApp link", () => {
  const url = buildLevelWhatsAppUrl({
    rating: "2.5",
    categoryName: "7ma Categoría",
    categoryLabel: "Iniciación",
  });

  assert.ok(url.startsWith("https://wa.me/?text="));
  assert.ok(url.includes("7ma"));
});

test("evaluatePlayerSkills maps quiz indices to descriptive labels", () => {
  const skills = evaluatePlayerSkills({
    exp: 2,
    wall: 2,
    net: 2,
    serve: 2,
    position: 2,
    tactic: 2,
  });
  assert.equal(skills.experience, "Experimentado (+ 2 años)");
  assert.equal(skills.wallPlay, "Ataque profundo de pared");
  assert.equal(skills.netPlay, "Definición y smash agresivo");
  assert.equal(skills.serve, "Saque con efecto/potencia y cobertura total");
  assert.equal(skills.position, "Suben y cierran la cancha en equipo");
  assert.equal(skills.tactic, "Compite en torneos/ligas federadas");

  const beginner = evaluatePlayerSkills({
    exp: 0,
    wall: 0,
    net: 0,
    serve: 0,
    position: 0,
    tactic: 0,
  });
  assert.equal(beginner.experience, "Iniciación (< 6 meses)");
  assert.equal(beginner.position, "Cada uno cubre lo suyo, sin coordinar");
  assert.equal(beginner.tactic, "Sin experiencia en torneos");
});
