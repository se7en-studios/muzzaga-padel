// Utilidades puras de mensajería, cobros y exportación del admin

import { paidAmount, pendingAmount } from "./metrics.js";

export { paidAmount, pendingAmount };

/** Plantilla WhatsApp: Recordatorio de turno */
export function buildReminderMessage(booking) {
  const pending = pendingAmount(booking);
  const saldoTxt =
    pending > 0
      ? `\n💰 *Saldo a abonar en recepción:* $${pending.toLocaleString("es-AR")}`
      : `\n✅ *Turno totalmente abonado.*`;
  return `Hola ${booking.playerName}! Te recordamos tu turno de hoy en *Muzzaga Pádel*:\n\n📅 *Fecha:* ${booking.date}\n⏰ *Horario:* ${booking.startTime} hs\n📍 *Pista:* ${booking.courtName}${saldoTxt}\n\n¡Te esperamos 10 min antes para entrar en calor! 🎾`;
}

/** Plantilla WhatsApp: Solicitud de seña */
export function buildDepositRequestMessage(
  booking,
  alias = "MUZZAGA.PADEL",
  depositAmount = 15000,
) {
  return `Hola ${booking.playerName}! Para asegurar tu turno del ${booking.date} a las ${booking.startTime} hs en *Muzzaga Pádel*, podés transferir la seña a nuestra cuenta:\n\n🏦 *Alias:* ${alias}\n💵 *Monto seña:* $${depositAmount.toLocaleString("es-AR")}\n\nPor favor envianos el comprobante por este medio una vez realizado. ¡Muchas gracias! 🎾`;
}

/** Plantilla WhatsApp: Confirmación */
export function buildConfirmationMessage(booking) {
  return `¡Hola ${booking.playerName}! Tu turno en *Muzzaga Pádel* está *CONFIRMADO*:\n\n📅 ${booking.date} · ${booking.startTime} hs\n🏟️ ${booking.courtName}\n🔖 Código: #${booking.bookingCode || "MZ"}\n\n¡Nos vemos en la cancha! 🎾`;
}

/** Plantilla WhatsApp: aviso de multa por cancelar sobre la hora */
export function buildPenaltyMessage(booking, alias = "") {
  const pending = pendingAmount(booking);
  const amount = Number(booking?.penalty?.amount) || 0;
  const cuenta = alias ? `\n\n🏦 *Alias para transferir:* ${alias}` : "";
  const saldo =
    pending > 0 && pending < amount
      ? `\n💰 *Falta abonar:* $${pending.toLocaleString("es-AR")} (ya tomamos lo que habías pagado)`
      : "";
  return `Hola ${booking.playerName}! El turno del ${booking.date} a las ${booking.startTime} hs en *Muzzaga Pádel* se canceló sobre la hora, así que corresponde la multa por cancelación tardía:\n\n💵 *Multa:* $${amount.toLocaleString("es-AR")}${saldo}${cuenta}\n\nPodés abonarla en recepción o por transferencia. ¡Gracias! 🎾`;
}

/** Exporta listado de turnos a formato CSV descargable para Excel */
export function exportBookingsToCSV(bookings = [], date = "") {
  const headers = [
    "Fecha",
    "Horario Inicio",
    "Horario Fin",
    "Cancha",
    "Jugador",
    "Telefono",
    "Estado",
    "Total",
    "Cobrado",
    "Saldo Pendiente",
    "Metodos Pago",
  ];

  const rows = bookings.map((b) => {
    const paid = paidAmount(b);
    const pending = pendingAmount(b);
    const methods = Object.values(b.payments || {})
      .map((p) => p.method)
      .join("+");

    return [
      b.date || date,
      b.startTime || "",
      b.endTime || "",
      `"${(b.courtName || "").replace(/"/g, '""')}"`,
      `"${(b.playerName || "").replace(/"/g, '""')}"`,
      `"${b.playerPhone || ""}"`,
      b.status || "confirmado",
      b.total || 0,
      paid,
      pending,
      `"${methods}"`,
    ].join(";");
  });

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `turnos-muzzaga-${date || "export"}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
