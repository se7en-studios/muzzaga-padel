import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb, isFirebaseConfigured } from "../../../lib/firebase";
import { todayInClub } from "../../../lib/booking";
import { getCantinaMenu } from "../../../lib/cantinaMenuServer";
import { validateOrder } from "../../../lib/cantinaOrder";

// Freno para que nadie llene el panel de pedidos falsos: 6 cada 10 minutos
// por navegador y 40 por conexión. Con solo la IP, en el WiFi del club (o
// detrás del mismo NAT de la operadora) el séptimo cliente distinto quedaba
// afuera. Cuenta en la base (en Vercel cada request puede caer en otra
// instancia) y con los datos hasheados, no en claro.
const BROWSER_LIMIT = 6;
const CONNECTION_LIMIT = 40;
const ORDER_WINDOW_MS = 10 * 60 * 1000;
const BROWSER_ID = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_BODY_BYTES = 8 * 1024;
const NOT_SAVED = "No pudimos anotar el pedido en el sistema del club.";

const hashKey = (kind, raw) =>
  createHash("sha256").update(`cantina:${kind}:${raw}`).digest("hex").slice(0, 32);

function connectionKey(request) {
  const raw =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconocida";
  return hashKey("ip", raw);
}

async function takeSlot(db, key, limit) {
  const now = Date.now();
  const result = await db.ref(`cantinaOrderLimits/${key}`).transaction((current) => {
    if (!current || now - (current.since || 0) > ORDER_WINDOW_MS) {
      return { since: now, count: 1 };
    }
    if ((current.count || 0) >= limit) return; // sin lugar: aborta
    return { since: current.since, count: current.count + 1 };
  });
  return result.committed;
}

async function allowOrder(db, request, browserId) {
  // Sin id de navegador válido, cuenta solo por conexión con el tope bajo.
  if (!BROWSER_ID.test(browserId || "")) {
    return takeSlot(db, connectionKey(request), BROWSER_LIMIT);
  }
  return (
    (await takeSlot(db, hashKey("nav", browserId), BROWSER_LIMIT)) &&
    (await takeSlot(db, connectionKey(request), CONNECTION_LIMIT))
  );
}

/**
 * POST /api/cantina-orders — pedido de la carta para el panel de la cantina.
 *
 * Es una ruta y no un server action a propósito: el navegador abre WhatsApp
 * en el mismo toque (si no, el celu lo bloquea como ventana emergente) y la
 * página queda en segundo plano. Con `fetch(…, { keepalive: true })` el
 * pedido sale en ese mismo instante y llega aunque la página se pause; un
 * server action podía quedar en cola hasta que la persona volviera.
 *
 * Un error acá no frena el pedido (el WhatsApp ya salió): solo avisa que no
 * quedó anotado en el panel.
 */
export async function POST(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Pedido demasiado grande." }, { status: 413 });
  }
  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  // Los precios salen de la carta guardada en el panel, nunca del navegador.
  const { items: menu } = await getCantinaMenu();
  const checked = validateOrder(input, menu);
  if (!checked.ok) return NextResponse.json(checked, { status: 400 });

  if (!isFirebaseConfigured()) {
    console.error("cantina-orders: Firebase no está configurado.");
    return NextResponse.json({ ok: false, error: NOT_SAVED }, { status: 503 });
  }

  try {
    const db = getDb();
    if (!(await allowOrder(db, request, input?.browserId))) {
      return NextResponse.json(
        {
          ok: false,
          error: "Entraron muchos pedidos juntos y este no quedó anotado en el sistema del club.",
        },
        { status: 429 },
      );
    }
    const ref = db.ref("cantinaOrders").push();
    await ref.set({
      ...checked.order,
      date: todayInClub(),
      status: "nuevo",
      createdAt: Date.now(),
    });
    return NextResponse.json({ ok: true, orderId: ref.key });
  } catch (error) {
    console.error("cantina-orders: no se pudo guardar el pedido:", error.message);
    return NextResponse.json({ ok: false, error: NOT_SAVED }, { status: 500 });
  }
}
