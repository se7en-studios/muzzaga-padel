// TEMPORAL: datos falsos para ver la pantalla en dev con ?demo. BORRAR.
function iso(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
const RAW = [
  ["Demo Lionel Prueba", "2990000001", 12, 168000, 2, 70, 9000, 1],
  ["Demo Ana Ejemplo", "2990000002", 7, 98000, 5, 40, 0, 0],
  ["Demo Carlos Ficticio", "2990000003", 5, 70000, 9, 60, 14000, 1],
  ["Demo Sofía Test", "2990000004", 4, 56000, 21, 80, 0, 0],
  ["Demo Martín Falso", "2990000005", 3, 42000, 3, 30, 0, 0],
  ["Demo Julia Inventada", "", 3, 42000, 12, 50, 7000, 1],
  ["Demo Pedro Muestra", "2990000007", 2, 28000, 18, 25, 0, 0],
  ["Demo Lucía Prueba", "2990000008", 2, 28000, 40, 90, 0, 0],
  ["Demo Tomás Ejemplo", "2990000009", 1, 14000, 0, 0, 0, 0],
  ["Demo Valentina Test", "2990000010", 1, 14000, 6, 6, 0, 0],
  ["Demo Bruno Ficticio", "2990000011", 1, 14000, 75, 75, 14000, 1],
  ["Demo Camila Falsa", "2990000012", 6, 84000, 52, 200, 0, 0],
];
export const DEMO_CLIENTS = RAW.map(([name, phone, count, totalSpent, last, first, owed, owedCount], i) => ({
  key: `demo-${i}`, name, phone, count, totalSpent, lastDate: iso(last), firstDate: iso(first), owed, owedCount,
}));
export function demoDetail(client) {
  const bookings = Array.from({ length: Math.min(client.count, 6) }, (_, i) => ({
    id: `b${i}`, date: iso(i * 7 + 2), startTime: ["19:00", "20:30", "22:00"][i % 3],
    courtName: i % 2 ? "Cancha 2" : "Cancha 1", status: i === 0 && client.owed ? "señado" : i === 4 ? "cancelado" : "pagado",
    total: 14000, paid: i === 0 && client.owed ? 5000 : 14000,
  }));
  return { ok: true, bookings, cantina: [{ id: "c1", date: iso(2), items: [{ qty: 2, name: "Gatorade" }, { qty: 1, name: "Tostado" }], total: 7500, settled: false }], note: "3era · Drive · Prefiere turno noche" };
}
