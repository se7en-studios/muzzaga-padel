// TEMPORAL: datos falsos para ver el calendario con ?demo. BORRAR.
export function zzDemoMonth(year, month, todayIso) {
  const n = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = [];
  let seed = year * 13 + month * 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 1; i <= n; i++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    const wd = (new Date(Date.UTC(year, month - 1, i)).getUTCDay() + 6) % 7;
    const closed = i === 3 || i === 10 || i === 17 || i === 24 || i === 25;
    const totalSlots = closed ? 0 : 36;
    const base = wd >= 4 ? 0.7 : 0.35;
    const turnos = closed ? 0 : date > todayIso ? Math.round(rnd() * 10) : Math.round(Math.min(1, base + (rnd() - 0.4) * 0.6) * 36);
    const cobrado = date > todayIso ? 0 : turnos * 18000 + Math.round(rnd() * 40) * 1000;
    days.push({
      date, day: i, turnos, bloqueados: 0, facturadoTurnos: turnos * 20000,
      cobradoTurnos: cobrado, cantina: 0, cobrado,
      porCobrar: rnd() > 0.6 ? 20000 : 0, pagadosSinCobro: rnd() > 0.85 ? 1 : 0,
      totalSlots, closed, closedReason: closed ? (i === 25 ? "Día bloqueado en Configuración" : "Cerrado por horario") : null,
      ocupacionPct: closed ? null : Math.round((turnos / 36) * 1000) / 10,
    });
  }
  const totals = days.reduce((t, d) => ({ turnos: t.turnos + d.turnos, cobrado: t.cobrado + d.cobrado }), { turnos: 0, cobrado: 0 });
  return { ok: true, days, totals, ocupacionPct: 58.3 };
}
