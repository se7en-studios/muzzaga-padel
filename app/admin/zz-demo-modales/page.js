"use client";

// TEMPORAL (zz-demo): vista previa de los modales con datos falsos. BORRAR.
import { useEffect, useState } from "react";
import { DEFAULT_CONFIG } from "../../../lib/clubConfig";
import CreateBookingModal from "../CreateBookingModal";
import BookingDetailModal from "../BookingDetailModal";

const base = {
  id: "zzdemo1",
  courtId: "cancha-1",
  courtName: "Cancha 1",
  date: "2026-11-24",
  startTime: "19:00",
  endTime: "20:30",
  playerName: "Juan Pérez",
  playerPhone: "299 597 4176",
  status: "confirmado",
  total: 60000,
  bookingCode: "MZ7K2Q",
  notes: "Traen pelotas nuevas",
  recurringId: "r1",
  fullCourt: true,
};

const variants = {
  debe: { ...base },
  sena: {
    ...base,
    playerNames: ["Nico Gómez", "Sofi Ruiz", "Lucas Díaz"],
    payments: { p1: { method: "transferencia", amount: 15000, createdAt: 1 } },
  },
  bloqueo: { ...base, status: "bloqueado", playerName: "Clase del profe Nico", playerPhone: "", total: undefined, notes: "", recurringId: null, bookingCode: "" },
  cancelado: { ...base, status: "cancelado", recurringId: null },
  prueba: { ...base, isTest: true, recurringId: null, courtName: "Cancha Central" },
  pagado: {
    ...base,
    recurringId: null,
    notes: "",
    playerNames: ["Nico Gómez", "Sofi Ruiz", "Lucas Díaz"],
    payments: {
      p1: { method: "transferencia", amount: 15000, createdAt: 1 },
      p2: { method: "efectivo", amount: 45000, createdAt: 2 },
    },
  },
};

export default function ZzDemo() {
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState({
    courtId: "cancha-1",
    startTime: typeof window !== "undefined" && window.location.search.includes("vacio") ? "" : "18:30",
    playerName: "",
    playerPhone: "",
    playersCount: 4,
    fullCourt: true,
    status: "confirmado",
    notes: "",
    isRecurring: false,
    recurringWeeks: 8,
  });
  const [payForm, setPayForm] = useState({ amount: "", method: "efectivo" });
  useEffect(() => {
    setMode(new URLSearchParams(window.location.search).get("m") || "nueva");
  }, []);
  if (!mode) return null;
  return (
    <div className="admin-dashboard-layout" style={{ minHeight: "100vh" }}>
      <main className="admin-main" style={{ padding: 40 }}>
        <h1 className="admin-page-title">Agenda (demo)</h1>
      </main>
      {mode === "nueva" ? (
        <CreateBookingModal
          activeDate="2026-11-24"
          clubConfig={DEFAULT_CONFIG}
          modalForm={form}
          setModalForm={setForm}
          modalSubmitting={false}
          clients={[]}
          onClose={() => {}}
          onSubmit={(e) => e.preventDefault()}
          onPlayerNameBlur={() => {}}
        />
      ) : (
        <BookingDetailModal
          booking={variants[mode] || variants.debe}
          clubConfig={DEFAULT_CONFIG}
          clients={[{ name: "Juan Pérez", phone: "299 597 4176", count: 14 }]}
          paymentForm={payForm}
          setPaymentForm={setPayForm}
          paymentSubmitting={false}
          onClose={() => {}}
          onAddPayment={(e) => e?.preventDefault?.()}
          onRemovePayment={() => {}}
          onCancel={() => {}}
          onCancelSeries={() => {}}
          onToggleTest={() => {}}
        />
      )}
    </div>
  );
}
