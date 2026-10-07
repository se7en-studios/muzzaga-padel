import { NextResponse } from "next/server";
import { getDb, isFirebaseConfigured } from "../../../../lib/firebase";
import { getClubConfig } from "../../../../lib/clubConfigServer";
import {
  createMercadoPagoPreference,
  depositForBooking,
  findBookingByCode,
  isValidBookingCode,
} from "../../../../lib/mercadopago";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    // Del cliente solo se usa el código: monto, cancha y horario salen de la
    // reserva guardada, así nadie puede armar una preferencia de $1.
    const bookingCode = String(body?.bookingCode || "").trim().toUpperCase();

    if (!isValidBookingCode(bookingCode)) {
      return NextResponse.json(
        { ok: false, error: "Código de reserva inválido" },
        { status: 400 }
      );
    }

    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Pagos online no disponibles en este momento" },
        { status: 503 }
      );
    }

    const found = await findBookingByCode(getDb(), bookingCode);
    const booking = found?.booking || null;
    const deposit = depositForBooking(booking, await getClubConfig());
    if (!deposit.ok) {
      return NextResponse.json(
        { ok: false, error: deposit.error },
        { status: deposit.status }
      );
    }

    const result = await createMercadoPagoPreference({
      bookingCode,
      courtName: booking.courtName || "Cancha de Pádel",
      date: booking.date || "",
      startTime: booking.startTime || "",
      endTime: booking.endTime || "",
      amount: deposit.amount,
      payerName: booking.playerName || "Jugador",
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error creando preferencia de Mercado Pago:", err);
    return NextResponse.json(
      { ok: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
