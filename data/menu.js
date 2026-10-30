// Carta original de la cantina de Muzzaga Pádel. Los productos y precios se
// cambian desde el panel (Cantina → Carta y precios, ver lib/cantinaMenu.js):
// esta lista es la que se ve mientras el club no guardó ninguna carta.

export const MENU_ITEMS = [
  // Cocina / Buffet
  { id: "pizza_muzza", category: "buffet", name: "Pizza muzza", price: 18000, featured: true },
  { id: "pizza_napo", category: "buffet", name: "Pizza napo", price: 20000, featured: true },
  { id: "pizza_especial", category: "buffet", name: "Pizza especial", price: 22000, featured: true },
  { id: "pizza_stacc", category: "buffet", name: "Pizza sin TACC", price: 18000, tag: "Sin TACC" },
  // "Pizza vegana" fuera hasta que el club confirme que la tiene (ver 2.8).
  { id: "tostados", category: "buffet", name: "Tostados", price: 14000, featured: true },
  { id: "empanada_unidad", category: "buffet", name: "Empanada (unidad)", price: 2000, featured: true },
  { id: "empanadas_docena", category: "buffet", name: "Docena de empanadas", price: 24000 },
  { id: "sandwich_mila", category: "buffet", name: "Sándwich de mila", price: 20000, featured: true },
  { id: "porcion_dulce", category: "buffet", name: "Porción dulce", price: 10000, featured: true },
  { id: "brownie_stacc", category: "buffet", name: "Brownie sin TACC", price: 8000, tag: "Sin TACC" },

  // Bebidas sin alcohol
  { id: "agua_500", category: "bebidas-sin", name: "Agua 500ml", price: 2000 },
  { id: "agua_850", category: "bebidas-sin", name: "Agua 850ml", price: 3000 },
  { id: "agua_15l", category: "bebidas-sin", name: "Agua 1.5L", price: 4000, featured: true },
  { id: "coca_500", category: "bebidas-sin", name: "Coca-Cola 500ml", price: 4000 },
  { id: "coca_15l", category: "bebidas-sin", name: "Coca-Cola 1.5L", price: 7000, featured: true },
  { id: "sprite_500", category: "bebidas-sin", name: "Sprite 500ml", price: 3000 },
  { id: "sprite_15l", category: "bebidas-sin", name: "Sprite 1.5L", price: 6000 },
  { id: "fanta_500", category: "bebidas-sin", name: "Fanta 500ml", price: 3000 },
  { id: "cepita_1l", category: "bebidas-sin", name: "Cepita 1L", price: 4000 },
  { id: "h2oh_500", category: "bebidas-sin", name: "H2OH 500ml", price: 2000 },
  { id: "levite_15l", category: "bebidas-sin", name: "Levité 1.5L", price: 4000 },
  { id: "gatorade_500", category: "bebidas-sin", name: "Gatorade 500ml", price: 4000 },
  { id: "gatorade_750", category: "bebidas-sin", name: "Gatorade 750ml", price: 5000 },
  { id: "suerox", category: "bebidas-sin", name: "Suerox", price: 4000 },
  { id: "monster_473", category: "bebidas-sin", name: "Monster 473ml", price: 4000 },
  { id: "redbull_250", category: "bebidas-sin", name: "Red Bull 250ml", price: 4000 },
  { id: "stella_zero", category: "bebidas-sin", name: "Stella Artois 0% 330ml", price: 4000, tag: "Sin alcohol" },

  // Bebidas con alcohol
  { id: "quilmes_473", category: "bebidas-con", name: "Quilmes 473ml", price: 4000 },
  { id: "stella_473", category: "bebidas-con", name: "Stella Artois 473ml", price: 4000 },
  { id: "stella_retornable", category: "bebidas-con", name: "Stella Artois Retornable 975ml", price: 10000, featured: true },
  { id: "corona_330", category: "bebidas-con", name: "Corona 330ml", price: 4000 },
  { id: "corona_710", category: "bebidas-con", name: "Corona 710ml", price: 10000, featured: true },
  { id: "heineken_litro", category: "bebidas-con", name: "Heineken litro", price: 10000, featured: true },
  { id: "patagonia_710", category: "bebidas-con", name: "Patagonia IPA 710ml", price: 9000, featured: true },
  { id: "fernet", category: "bebidas-con", name: "Fernet y Coca", price: 12000, featured: true },

  // Kiosco
  { id: "cafe_chico", category: "kiosco", name: "Café chico", price: 3000, featured: true },
  { id: "cafe_grande", category: "kiosco", name: "Café grande", price: 4000, featured: true },
  { id: "yerba", category: "kiosco", name: "Yerba", price: 4000 },
  { id: "9_de_oro", category: "kiosco", name: "9 de Oro", price: 3000 },
  { id: "alfajor", category: "kiosco", name: "Alfajor", price: 3000 },
  { id: "barrita", category: "kiosco", name: "Barrita Integral", price: 2000 },
  { id: "cintitas", category: "kiosco", name: "Cintitas", price: 3000 },
  { id: "gomitas", category: "kiosco", name: "Gomitas", price: 1000 },
  { id: "kitkat", category: "kiosco", name: "Kit-Kat", price: 3000 },
  { id: "oreo", category: "kiosco", name: "Oreo", price: 4000 },
  { id: "paseo", category: "kiosco", name: "Paseo", price: 3000 },
  { id: "pepas", category: "kiosco", name: "Pepas", price: 3000 },
  { id: "pringles", category: "kiosco", name: "Pringles", price: 5000 },
  { id: "rhodesia", category: "kiosco", name: "Rhodesia", price: 1000 },
  { id: "saladix", category: "kiosco", name: "Saladix", price: 3000 },
  { id: "trio", category: "kiosco", name: "Trío", price: 3000 },
  { id: "turron", category: "kiosco", name: "Turrón", price: 500 },
  { id: "tostex", category: "kiosco", name: "Tostex proteicas", price: 4000 },

  // Accesorios de pádel
  { id: "pelotas", category: "accesorios", name: "Pelotas de pádel (tubo)", price: 12000 },
  { id: "grip_liso", category: "accesorios", name: "Cubre grip liso", price: 3000 },
  { id: "grip_perforado", category: "accesorios", name: "Cubre grip perforado", price: 4000 },
  { id: "grip_relieve", category: "accesorios", name: "Cubre grip relieve", price: 5000 },
];

export const MENU_CATEGORIES = [
  { id: "all", label: "Todo" },
  { id: "buffet", label: "Cocina" },
  { id: "bebidas-sin", label: "Bebidas sin alcohol" },
  { id: "bebidas-con", label: "Bebidas con alcohol" },
  { id: "kiosco", label: "Kiosco" },
  { id: "accesorios", label: "Accesorios" },
];

// Subconjunto curado de ítems para la calculadora de 3er tiempo / split cost
export const CALCULATOR_ITEMS = MENU_ITEMS.filter((item) => item.featured);

export function getMenuByCategory(catId) {
  if (!catId || catId === "all") return MENU_ITEMS;
  return MENU_ITEMS.filter((item) => item.category === catId);
}
