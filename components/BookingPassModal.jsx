"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Portal from "./Portal";
import useDialogFocus from "../lib/useDialogFocus";
import Mascota from "./Mascota";

// Antes esta pantalla mostraba un CBU y un alias inventados (placeholder de
// ejemplo) como si fueran los datos reales del club, con botón "Copiar" y
// todo. Un cliente que confiara en eso podía transferir la seña a una cuenta
// que no existe. Mientras no haya un dato real para mostrar (vía env var),
// mandamos a confirmarlo por WhatsApp en vez de fingir un número de cuenta.
// Ahora el dato sale de Ajustes → Cobros del panel (prop `payment`); las env
// vars quedan como respaldo.
const ENV_ALIAS = process.env.NEXT_PUBLIC_PAYMENT_ALIAS || null;
const ENV_CBU = process.env.NEXT_PUBLIC_PAYMENT_CBU || null;
const ENV_TITULAR = process.env.NEXT_PUBLIC_PAYMENT_TITULAR || "Muzzaga Pádel";

import { trackEvent } from "../lib/analytics";
import { buildGoogleCalendarUrl, downloadIcsCalendar } from "../lib/calendar";
import { CalendarPlus, Download, Users, Check } from "lucide-react";

// "2026-11-21" → "Sáb 21 Nov": el formato de sistema no se lee de un vistazo.
const PASS_DATE = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});
function passDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return iso;
  return PASS_DATE.format(new Date(Date.UTC(y, m - 1, d)))
    .replace(/[.,]/g, "")
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/ (\w)(\w*)$/, (_, a, b) => ` ${a.toUpperCase()}${b}`);
}

export default function BookingPassModal({
  bookingCode,
  booking,
  whatsappUrl,
  onClose,
  // Solo con credenciales de Mercado Pago en el servidor. Sin ellas el botón
  // abría un "Modo demostración": ahora directamente no aparece.
  mpEnabled = false,
  payment = null,
}) {
  const REAL_ALIAS = payment?.alias || ENV_ALIAS;
  const REAL_CBU = payment?.cbu || ENV_CBU;
  const TITULAR = payment?.titular || ENV_TITULAR;
  const [copiedField, setCopiedField] = useState(null);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [payingMp, setPayingMp] = useState(false);
  const [mpMessage, setMpMessage] = useState(null);
  const dialogRef = useDialogFocus(Boolean(booking), onClose);

  // Con el pase abierto la página de atrás no se mueve (mismo fix que el
  // drawer de reserva: sin esto, en celu la landing scrollea detrás del modal).
  useEffect(() => {
    if (!booking) return;
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbar) root.style.paddingRight = `${scrollbar}px`;
    return () => {
      root.style.overflow = "";
      root.style.paddingRight = "";
    };
  }, [booking]);

  // Guardar pase en localStorage para consulta offline (Sprint 2.4)
  useEffect(() => {
    if (booking && bookingCode) {
      try {
        localStorage.setItem(
          "muzzaga_last_booking",
          JSON.stringify({ bookingCode, booking, savedAt: Date.now() }),
        );
      } catch (e) {
        // Ignorar si storage está bloqueado
      }
    }
  }, [booking, bookingCode]);

  const handlePayMercadoPago = async () => {
    setPayingMp(true);
    setMpMessage(null);
    trackEvent("booking_mp_checkout_click", { bookingCode });

    try {
      const res = await fetch("/api/mercadopago/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingCode,
          courtName: booking.courtName,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          total: booking.total,
          playerName: booking.name,
        }),
      });

      const data = await res.json();
      setPayingMp(false);

      if (data.ok && data.init_point) {
        window.location.href = data.init_point;
      } else if (data.ok && data.mock) {
        setMpMessage(
          "El pago online no está disponible ahora. Coordiná la seña por WhatsApp.",
        );
      } else {
        setMpMessage(
          data.error ||
            "No pudimos conectar con Mercado Pago. Coordiná la seña por WhatsApp.",
        );
      }
    } catch (err) {
      setPayingMp(false);
      setMpMessage(
        "Error de conexión. Coordiná tu seña directamente por WhatsApp.",
      );
    }
  };

  const copyValue = (field, value) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 2000);
  };

  const handleShareGroup = async () => {
    const text = `🎾 ¡Turno reservado en Muzzaga Pádel!\n📅 Fecha: ${booking.date}\n⏰ Horario: ${booking.startTime} a ${booking.endTime} hs\n📍 Pista: ${booking.courtName}\n🔖 Código: ${bookingCode}\n💰 Total: $${booking.total?.toLocaleString("es-AR")} ($${Math.round((booking.total || 60000) / 4).toLocaleString("es-AR")} c/u)\nConfirmamos la seña por WhatsApp. ¡Nos vemos en la cancha!`;

    trackEvent("booking_share_group", { bookingCode });

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Turno Muzzaga Pádel (${booking.date} ${booking.startTime} hs)`,
          text,
        });
        return;
      } catch (err) {
        // User cancelled or unsupported, fallback to copy
      }
    }

    navigator.clipboard.writeText(text);
    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 2500);
  };

  const handleDownloadCalendar = () => {
    trackEvent("booking_add_calendar_ics", { bookingCode });
    downloadIcsCalendar({
      courtName: booking.courtName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      bookingCode,
      total: booking.total,
    });
  };

  const googleCalUrl = buildGoogleCalendarUrl({
    courtName: booking.courtName,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    bookingCode,
  });

  if (!booking) return null;

  return (
    <Portal>
      <div
        className="admin-modal-backdrop"
        onClick={onClose}
        style={{ zIndex: 1001 }}
      >
        <div
          className="digital-pass-modal"
          onClick={(e) => e.stopPropagation()}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Pase digital de tu reserva"
          tabIndex={-1}
        >
          {/* CONFIRMATION BANNER */}
          <div
            style={{
              background: "rgba(232, 114, 42, 0.12)",
              border: "1px solid rgba(232, 114, 42, 0.3)",
              borderRadius: "var(--radius-md, 8px)",
              padding: "10px 14px",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* Reserva confirmada: la mascota festeja (entra una vez y queda quieta). */}
            <Mascota pose="trofeo-paleta" size="s" className="pass-festejo" />
            <div
              style={{
                fontSize: 12.5,
                color: "var(--color-ink)",
                lineHeight: 1.35,
              }}
            >
              <strong>¡Listo!</strong> Tu turno queda reservado. Para
              confirmarlo de forma definitiva, aboná la seña y envianos el
              comprobante.
            </div>
          </div>

          {/* TOP PASS BAR */}
          <div className="digital-pass-card">
            <div className="pass-header-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Image
                  src="/img/logo_badge.png"
                  alt="Muzzaga"
                  width={30}
                  height={30}
                  style={{
                    width: 30,
                    height: 30,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
                <div>
                  <strong className="pass-brand">MUZZAGA PÁDEL</strong>
                  <span className="pass-sub-brand">Pase digital de cancha</span>
                </div>
              </div>
              <div className="pass-code-badge">{bookingCode}</div>
            </div>

            <div className="pass-divider" />

            {/* MAIN MATCH DETAILS */}
            <div className="pass-details-grid">
              <div className="pass-detail-item">
                <span className="pass-label">Fecha</span>
                <strong className="pass-val">{passDate(booking.date)}</strong>
              </div>

              <div className="pass-detail-item">
                <span className="pass-label">Horario</span>
                <strong className="pass-val">
                  {booking.startTime} a {booking.endTime} hs
                </strong>
              </div>

              <div className="pass-detail-item">
                <span className="pass-label">Pista</span>
                <strong className="pass-val pass-val-court">
                  {booking.courtName}
                </strong>
              </div>

              <div className="pass-detail-item">
                <span className="pass-label">Titular</span>
                <strong className="pass-val">{booking.name}</strong>
              </div>
            </div>

            {/* FINANCIALS */}
            <div className="pass-financial-row">
              <div>
                <span className="pass-label">Total cancha (90 min)</span>
                <div className="pass-price-val">
                  ${booking.total.toLocaleString("es-AR")}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  ${Math.round(booking.total / 4).toLocaleString("es-AR")} por
                  jugador si son cuatro
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="pass-label">Seña para confirmar</span>
                <div className="pass-sena-val">
                  ${Math.round(booking.total / 2).toLocaleString("es-AR")}
                </div>
              </div>
            </div>

            {/* TRANSFER DATA BOX */}
            <div className="pass-transfer-box">
              <div className="pass-transfer-header">
                <span>Datos para transferir la seña:</span>
              </div>

              {REAL_ALIAS || REAL_CBU ? (
                <>
                  {REAL_ALIAS && (
                    <div className="pass-bank-row">
                      <div>
                        <span className="pass-bank-sub">
                          Alias (Mercado Pago / Banco):
                        </span>
                        <code className="pass-alias-code">{REAL_ALIAS}</code>
                      </div>
                      <button
                        type="button"
                        className={`pass-copy-btn${copiedField === "alias" ? " copied" : ""}`}
                        onClick={() => copyValue("alias", REAL_ALIAS)}
                      >
                        {copiedField === "alias" ? "Copiado" : "Copiar alias"}
                      </button>
                    </div>
                  )}

                  {REAL_CBU && (
                    <div className="pass-bank-row" style={{ marginTop: 8 }}>
                      <div>
                        <span className="pass-bank-sub">CBU / CVU:</span>
                        <code className="pass-cbu-code">{REAL_CBU}</code>
                      </div>
                      <button
                        type="button"
                        className={`pass-copy-btn${copiedField === "cbu" ? " copied" : ""}`}
                        onClick={() => copyValue("cbu", REAL_CBU)}
                      >
                        {copiedField === "cbu" ? "Copiado" : "Copiar CBU"}
                      </button>
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 6,
                    }}
                  >
                    Titular: {TITULAR}
                  </div>
                </>
              ) : (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  Consultá el alias por WhatsApp o en el mostrador.
                </p>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="pass-actions-col">
              {/* MERCADO PAGO / WHATSAPP ACTIONS */}
              {mpEnabled && (
                <>
                  {mpMessage && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--color-ink)",
                        background: "rgba(56, 189, 248, 0.12)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        lineHeight: 1.35,
                      }}
                    >
                      {mpMessage}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn"
                    disabled={payingMp}
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      height: 44,
                      fontSize: 14,
                      fontWeight: 700,
                      background: "#009ee3",
                      color: "#ffffff",
                      border: "none",
                      gap: 8,
                      boxShadow: "0 2px 8px rgba(0, 158, 227, 0.25)",
                    }}
                    onClick={handlePayMercadoPago}
                  >
                    {payingMp ? (
                      "Generando pago seguro…"
                    ) : (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="currentColor"
                        >
                          <path d="M19 4H5c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H5V8h14v10z" />
                        </svg>
                        Pagar seña con Mercado Pago ($
                        {Math.round(
                          (booking.total || 60000) / 2,
                        ).toLocaleString("es-AR")}
                        )
                      </>
                    )}
                  </button>
                </>
              )}

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener"
                className="btn btn-whatsapp pass-wa-main"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  height: 54,
                  fontSize: 15.5,
                  gap: 10,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="17"
                  height="17"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                {mpEnabled ? "O confirmar" : "Confirmar"} seña por WhatsApp →
              </a>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <a
                  href={googleCalUrl}
                  target="_blank"
                  rel="noopener"
                  className="btn btn-secondary"
                  style={{ justifyContent: "center", height: 44, fontSize: 12.5, whiteSpace: "nowrap" }}
                >
                  <CalendarPlus
                    size={20}
                    className="icono-marca"
                    aria-hidden="true"
                  />{" "}
                  Google Calendar
                </a>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ justifyContent: "center", height: 44, fontSize: 12.5, whiteSpace: "nowrap" }}
                  onClick={handleDownloadCalendar}
                >
                  <Download
                    size={20}
                    className="icono-marca"
                    aria-hidden="true"
                  />{" "}
                  Apple · Outlook
                </button>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  height: 38,
                  fontSize: 12.5,
                }}
                onClick={handleShareGroup}
              >
                {shareSuccess ? (
                  <>
                    <Check
                      size={20}
                      className="icono-marca"
                      aria-hidden="true"
                    />{" "}
                    Mensaje para el grupo copiado
                  </>
                ) : (
                  <>
                    <Users
                      size={20}
                      className="icono-marca"
                      aria-hidden="true"
                    />{" "}
                    Compartir al grupo de WhatsApp
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  height: 38,
                  fontSize: 13,
                  marginTop: 2,
                }}
                onClick={onClose}
              >
                Listo, cerrar pase
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
