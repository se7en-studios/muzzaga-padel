import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildPreferencePayload,
  checkPaymentForBooking,
  depositForBooking,
  findBookingByCode,
  isValidBookingCode,
  isValidPaymentId,
  verifyWebhookSignature,
} from "../lib/mercadopago.js";
import { normalizeConfig } from "../lib/clubConfig.js";

const config = normalizeConfig({ depositPct: 25 });
const booking = {
  bookingCode: "MUZZ-AB_1C",
  total: 60000,
  status: "confirmado",
  paymentStatus: "pending",
};
const approved = {
  status: "approved",
  currency_id: "ARS",
  external_reference: "MUZZ-AB_1C",
  transaction_amount: 15000,
};

test("la seña sale de la reserva guardada, no del monto que mande el cliente", () => {
  // El cliente podría mandar total: 4; la ruta ni lo lee: solo cuenta booking.total.
  const forged = { ...booking, clientTotal: 4 };
  assert.deepEqual(depositForBooking(forged, config), { ok: true, amount: 15000 });
  assert.deepEqual(depositForBooking({ ...booking, total: 80000 }, config), {
    ok: true,
    amount: 20000,
  });
});

test("depositForBooking rechaza reservas inexistentes, canceladas o ya pagas", () => {
  assert.equal(depositForBooking(null, config).status, 404);
  assert.equal(depositForBooking({ ...booking, status: "cancelado" }, config).status, 409);
  assert.equal(depositForBooking({ ...booking, paymentStatus: "approved" }, config).status, 409);
  assert.equal(depositForBooking(booking, normalizeConfig({ depositPct: 0 })).ok, false);
});

test("findBookingByCode devuelve la reserva única y null si no hay o es ambigua", async () => {
  const fakeDb = (rows) => ({
    ref: () => ({
      orderByChild: () => ({
        equalTo: () => ({
          limitToFirst: () => ({
            once: async () => ({
              exists: () => rows.length > 0,
              numChildren: () => rows.length,
              forEach: (fn) => rows.forEach((r) => fn({ ref: r.id, val: () => r })),
            }),
          }),
        }),
      }),
    }),
  });
  const found = await findBookingByCode(fakeDb([{ id: "k1", ...booking }]), "MUZZ-AB_1C");
  assert.equal(found.ref, "k1");
  assert.equal(found.booking.total, 60000);
  assert.equal(await findBookingByCode(fakeDb([]), "MUZZ-AB_1C"), null);
  assert.equal(await findBookingByCode(fakeDb([{ id: "a" }, { id: "b" }]), "MUZZ-AB_1C"), null);
});

test("valida formato de bookingCode y paymentId", () => {
  assert.ok(isValidBookingCode("MUZZ-AB_1C"));
  assert.ok(!isValidBookingCode("MUZZ-AB_1C/../x"));
  assert.ok(!isValidBookingCode(undefined));
  assert.ok(isValidPaymentId("123456789"));
  assert.ok(isValidPaymentId(123456789));
  assert.ok(!isValidPaymentId("123/../../users/me"));
  assert.ok(!isValidPaymentId(""));
});

test("webhook aprueba un pago correcto (con tolerancia de float)", () => {
  assert.deepEqual(checkPaymentForBooking(approved, booking, 15000), { ok: true });
  assert.ok(checkPaymentForBooking({ ...approved, transaction_amount: 14999.995 }, booking, 15000).ok);
});

test("webhook rechaza un pago menor a la seña", () => {
  assert.deepEqual(
    checkPaymentForBooking({ ...approved, transaction_amount: 1 }, booking, 15000),
    { ok: false, reason: "amount" }
  );
  assert.equal(checkPaymentForBooking(approved, booking, 0).ok, false);
});

test("webhook rechaza external_reference distinto, otra moneda o estado no aprobado", () => {
  assert.equal(
    checkPaymentForBooking({ ...approved, external_reference: "MUZZ-ZZZZZ" }, booking, 15000).reason,
    "external_reference"
  );
  assert.equal(checkPaymentForBooking(approved, null, 15000).ok, false);
  assert.equal(checkPaymentForBooking({ ...approved, currency_id: "USD" }, booking, 15000).reason, "currency");
  assert.equal(checkPaymentForBooking({ ...approved, status: "pending" }, booking, 15000).reason, "status");
});

test("verifyWebhookSignature acepta la firma de MP y rechaza una falsa", () => {
  const secret = "s3cr3t";
  const ts = "1704908010";
  const manifest = `id:123456;request-id:req-1;ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  const args = { xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "123456", secret };

  assert.ok(verifyWebhookSignature(args));
  assert.ok(!verifyWebhookSignature({ ...args, xSignature: `ts=${ts},v1=${"0".repeat(64)}` }));
  assert.ok(!verifyWebhookSignature({ ...args, dataId: "999" }));
  assert.ok(!verifyWebhookSignature({ ...args, secret: "otro" }));
  assert.ok(!verifyWebhookSignature({ ...args, xSignature: null }));
  assert.ok(!verifyWebhookSignature({ ...args, xSignature: "basura" }));
});

test("buildPreferencePayload creates valid Mercado Pago structure", () => {
  const payload = buildPreferencePayload({
    bookingCode: "MZG-TEST1",
    courtName: "Cancha 1 (Cristal)",
    date: "2026-09-25",
    startTime: "18:30",
    endTime: "20:00",
    amount: 30000,
    payerName: "Franco Riquero",
    payerEmail: "franco@example.com",
    siteUrl: "https://muzzagapadel.com.ar",
  });

  assert.equal(payload.external_reference, "MZG-TEST1");
  assert.equal(payload.auto_return, "approved");
  assert.ok(payload.items && payload.items.length === 1);
  assert.equal(payload.items[0].unit_price, 30000);
  assert.equal(payload.items[0].currency_id, "ARS");
  assert.match(payload.items[0].title, /Cancha 1/);

  assert.equal(
    payload.back_urls.success,
    "https://muzzagapadel.com.ar/?reserva=MZG-TEST1&status=approved"
  );
  assert.equal(
    payload.back_urls.failure,
    "https://muzzagapadel.com.ar/?reserva=MZG-TEST1&status=failure"
  );
  assert.equal(
    payload.notification_url,
    "https://muzzagapadel.com.ar/api/mercadopago/webhook"
  );
});
