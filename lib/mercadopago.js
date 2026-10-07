/**
 * Utilidades para integración de pagos con Mercado Pago Checkout Pro.
 * Permite abonar la seña del turno en Muzzaga Pádel.
 *
 * El monto nunca sale del navegador: se recalcula con la reserva guardada y
 * el % de seña de Configuración (depositFor), tanto al crear la preferencia
 * como al recibir el webhook.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "./site.js";
import { depositFor } from "./clubConfig.js";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || null;

// Mismo formato que arma createBooking: "MUZZ-" + últimos 5 chars del push key.
const BOOKING_CODE_RE = /^MUZZ-[A-Z0-9_-]{5}$/;
// Los IDs de pago de MP son numéricos; cualquier otra cosa no va a la URL.
const PAYMENT_ID_RE = /^\d{1,20}$/;
// Tolerancia por redondeo de float en transaction_amount.
const AMOUNT_EPSILON = 0.01;

export function isValidBookingCode(code) {
  return typeof code === "string" && BOOKING_CODE_RE.test(code);
}

export function isValidPaymentId(id) {
  return PAYMENT_ID_RE.test(String(id ?? ""));
}

/**
 * Busca una reserva por bookingCode. Devuelve { ref, booking } o null.
 * ponytail: el código son 5 chars del push key; si dos reservas chocan se
 * trata como no encontrada (mejor cobrar a mano que marcar la equivocada).
 */
export async function findBookingByCode(db, bookingCode) {
  const snapshot = await db
    .ref("bookings")
    .orderByChild("bookingCode")
    .equalTo(bookingCode)
    .limitToFirst(2)
    .once("value");
  if (!snapshot.exists() || snapshot.numChildren() !== 1) return null;
  let found = null;
  snapshot.forEach((child) => {
    found = { ref: child.ref, booking: child.val() };
  });
  return found;
}

/**
 * Seña a cobrar por una reserva, calculada solo con datos del servidor.
 * @returns {{ ok: true, amount: number } | { ok: false, status: number, error: string }}
 */
export function depositForBooking(booking, config) {
  if (!booking) {
    return { ok: false, status: 404, error: "Reserva no encontrada" };
  }
  if (booking.status === "cancelado") {
    return { ok: false, status: 409, error: "La reserva está cancelada" };
  }
  if (booking.paymentStatus === "approved") {
    return { ok: false, status: 409, error: "La seña ya fue abonada" };
  }
  const amount = depositFor(config, Number(booking.total) || 0);
  if (!(amount > 0)) {
    return { ok: false, status: 409, error: "Esta reserva no requiere seña online" };
  }
  return { ok: true, amount };
}

/**
 * Decide si un pago de MP (ya consultado con nuestro token) salda la seña.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkPaymentForBooking(payment, booking, expectedDeposit) {
  if (payment?.status !== "approved") return { ok: false, reason: "status" };
  if (payment.currency_id !== "ARS") return { ok: false, reason: "currency" };
  if (!booking || payment.external_reference !== booking.bookingCode) {
    return { ok: false, reason: "external_reference" };
  }
  const paid = Number(payment.transaction_amount);
  if (!(expectedDeposit > 0) || !(paid + AMOUNT_EPSILON >= expectedDeposit)) {
    return { ok: false, reason: "amount" };
  }
  return { ok: true };
}

/**
 * Verifica el header x-signature de Mercado Pago ("ts=...,v1=...").
 * Manifest documentado: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * firmado con HMAC-SHA256 (hex) usando la clave secreta del webhook.
 */
export function verifyWebhookSignature({ xSignature, xRequestId, dataId, secret }) {
  if (!xSignature || !secret) return false;
  const parts = Object.fromEntries(
    String(xSignature)
      .split(",")
      .map((p) => p.split("=").map((x) => x.trim()))
  );
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  // MP pide el data.id en minúscula si es alfanumérico; los opcionales
  // ausentes se omiten del manifest.
  let manifest = "";
  if (dataId) manifest += `id:${String(dataId).toLowerCase()};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(v1));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Genera el payload de preferencia para Mercado Pago Checkout Pro
 */
export function buildPreferencePayload({
  bookingCode,
  courtName,
  date,
  startTime,
  endTime,
  amount,
  payerEmail = "pagos@muzzagapadel.com.ar",
  payerName = "Cliente Muzzaga",
  siteUrl = SITE_URL,
}) {
  return {
    items: [
      {
        id: bookingCode,
        title: `Seña Turno Muzzaga Pádel - ${courtName} (${date} ${startTime} a ${endTime} hs)`,
        description: `Seña para reserva de cancha de cristal en Muzzaga Pádel (Catriel). Código: ${bookingCode}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: Number(amount),
      },
    ],
    payer: {
      name: payerName,
      email: payerEmail,
    },
    back_urls: {
      success: `${siteUrl}/?reserva=${bookingCode}&status=approved`,
      pending: `${siteUrl}/?reserva=${bookingCode}&status=pending`,
      failure: `${siteUrl}/?reserva=${bookingCode}&status=failure`,
    },
    auto_return: "approved",
    external_reference: bookingCode,
    notification_url: `${siteUrl}/api/mercadopago/webhook`,
    statement_descriptor: "MUZZAGA PADEL",
  };
}

/**
 * Crea la preferencia en la API de Mercado Pago
 */
export async function createMercadoPagoPreference(bookingData) {
  if (!MP_ACCESS_TOKEN) {
    // Modo simulación/sandbox local si no hay token configurado
    return {
      ok: true,
      init_point: null,
      sandbox_init_point: null,
      mock: true,
      message: "Mercado Pago no configurado en entorno. Se utiliza coordinación manual.",
    };
  }

  const payload = buildPreferencePayload(bookingData);

  try {
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("Mercado Pago rechazó la preferencia:", res.status, errData.message);
      return { ok: false, error: "Error al crear preferencia en Mercado Pago" };
    }

    const data = await res.json();
    return {
      ok: true,
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    };
  } catch (err) {
    console.error("Error creando preferencia en Mercado Pago:", err);
    return { ok: false, error: "Error al crear preferencia en Mercado Pago" };
  }
}
