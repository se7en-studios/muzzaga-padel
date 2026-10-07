import { NextResponse } from "next/server";
import { getDb, isFirebaseConfigured } from "../../../../lib/firebase";
import { depositFor } from "../../../../lib/clubConfig";
import { getClubConfig } from "../../../../lib/clubConfigServer";
import {
  checkPaymentForBooking,
  findBookingByCode,
  isValidBookingCode,
  isValidPaymentId,
  verifyWebhookSignature,
} from "../../../../lib/mercadopago";

export async function POST(req) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    // El ID de pago puede venir en el body o en searchParams
    const paymentId =
      body?.data?.id ||
      body?.id ||
      url.searchParams.get("data.id") ||
      url.searchParams.get("id");

    // Con MP_WEBHOOK_SECRET cargado (panel de MP > Webhooks), solo aceptamos
    // notificaciones firmadas por Mercado Pago. Sin la variable se saltea,
    // pero el chequeo de monto de abajo sigue siendo obligatorio.
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (
      secret &&
      !verifyWebhookSignature({
        xSignature: req.headers.get("x-signature"),
        xRequestId: req.headers.get("x-request-id"),
        dataId: url.searchParams.get("data.id") || paymentId,
        secret,
      })
    ) {
      console.warn("Webhook de Mercado Pago con firma inválida, ignorado.");
      return NextResponse.json({ received: false }, { status: 401 });
    }

    if (!paymentId) {
      return NextResponse.json({ received: true, note: "Sin ID de pago" });
    }
    if (!isValidPaymentId(paymentId)) {
      return NextResponse.json({ received: true, note: "ID de pago inválido" });
    }

    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      console.warn("Mercado Pago webhook recibido pero MP_ACCESS_TOKEN no está configurado.");
      return NextResponse.json({ received: true, note: "Token no configurado" });
    }

    // Consultar el estado del pago en la API de Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!mpRes.ok) {
      console.error(`Error consultando pago ${paymentId} en Mercado Pago`);
      return NextResponse.json({ received: true, error: "Error consultando MP" });
    }

    const payment = await mpRes.json();
    const { status, external_reference, transaction_amount } = payment;

    if (
      status !== "approved" ||
      !isValidBookingCode(external_reference) ||
      !isFirebaseConfigured()
    ) {
      return NextResponse.json({ received: true, status });
    }

    // Buscar la reserva por bookingCode (external_reference)
    const found = await findBookingByCode(getDb(), external_reference);
    if (!found) {
      console.warn(`Pago ${paymentId}: no hay reserva única para ${external_reference}`);
      return NextResponse.json({ received: true, status });
    }

    // La seña esperada se recalcula acá, nunca se toma del pago ni del cliente.
    // ponytail: usa el % de seña vigente; si el admin lo sube entre la
    // preferencia y el pago, ese pago queda sin marcar y se registra a mano.
    const config = await getClubConfig();
    const expected = depositFor(config, Number(found.booking.total) || 0);
    const check = checkPaymentForBooking(payment, found.booking, expected);
    if (!check.ok) {
      console.warn(
        `Pago ${paymentId} NO aplicado a ${external_reference} (${check.reason}): pagó ${transaction_amount} ${payment.currency_id}, seña esperada ${expected}`
      );
      return NextResponse.json({ received: true, status });
    }

    await found.ref.update({
      paymentStatus: "approved",
      paymentId: String(paymentId),
      paidAmount: transaction_amount,
      paidAt: Date.now(),
    });
    console.log(`Pago ${paymentId} aprobado y registrado para ${external_reference}`);

    return NextResponse.json({ received: true, status });
  } catch (err) {
    console.error("Error procesando webhook de Mercado Pago:", err);
    return NextResponse.json({ received: true, error: "Error interno" }, { status: 500 });
  }
}
