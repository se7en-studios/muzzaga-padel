// Ícono de cada producto de la cantina según el nombre, y si no coincide, el
// de su categoría. Lo usan la carta pública (/menu) y la caja de la cantina
// en el admin, así un producto se reconoce igual en los dos lados.

const BY_NAME = [
  [/empanad/i, "🥟"],
  [/pizza|muzza|napo|fugazz/i, "🍕"],
  [/tostad|s[aá]ndwich|mila|lomito|hamburgu/i, "🥪"],
  [/papas?\b|pringles|saladix|cintitas|chizitos/i, "🍟"],
  [/gomitas|caramelo|chupet/i, "🍬"],
  [/yerba/i, "🧉"],
  [/brownie|alfajor|chocolat|porci[oó]n dulce|torta|bud[ií]n/i, "🍫"],
  [/caf[eé]|cortado/i, "☕"],
  [/agua/i, "💧"],
  [/gatorade|powerade|suerox|monster|red bull|speed|energ/i, "⚡"],
  [/fernet|gancia|vino|campari|aperol|trago/i, "🥃"],
  [/cerveza|birra|stella|corona|heineken|quilmes|patagonia|brahma|imperial|budweiser|andes/i, "🍺"],
  [/pelota|tubo/i, "🎾"],
];

const BY_CATEGORY = {
  buffet: "🍕",
  "bebidas-sin": "🥤",
  "bebidas-con": "🍺",
  kiosco: "🍫",
  accesorios: "🎾",
};

/** Emoji para un producto; "🍽️" si no hay nada que lo identifique. */
export function productIcon(name, category) {
  const hit = BY_NAME.find(([re]) => re.test(String(name || "")));
  if (hit) return hit[1];
  return BY_CATEGORY[category] || "🍽️";
}
