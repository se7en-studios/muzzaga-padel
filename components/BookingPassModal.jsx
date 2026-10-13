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
                  <strong
                    style={{
                      fontSize: 14,
                      color: "var(--text-primary)",
                      display: "block",
                      lineHeight: 1.2,
                    }}
                  >
                    MUZZAGA PÁDEL
                  </strong>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#38bdf8",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Pase digital de cancha
                  </span>
                </div>
              </div>
              <div className="pass-code-badge">{bookingCode}</div>
            </div>

            <div className="pass-divider" />

            {/* MAIN MATCH DETAILS */}
            <div className="pass-details-grid">
              <div className="pass-detail-item">
                <span className="pass-label">Fecha</span>
                <strong className="pass-val">{booking.date}</strong>
              </div>

              <div className="pass-detail-item">
                <span className="pass-label">Horario</span>
                <strong className="pass-val">
                  {booking.startTime} a {booking.endTime} hs
                </strong>
              </div>

              <div className="pass-detail-item">
                <span className="pass-label">Pista</span>
                <strong className="pass-val" style={{ color: "#38bdf8" }}>
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
                className="btn btn-whatsapp"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  height: 42,
                  fontSize: 13.5,
                  gap: 8,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="17"
                  height="17"
                  fill="currentColor"
                >
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.067-1.127-.072-.27-.087-.621-.21-1.077-.407-1.927-.834-3.176-2.778-3.272-2.906-.096-.129-.778-1.037-.778-1.977 0-.94.492-1.401.667-1.593.175-.192.38-.24.507-.24.127 0 .254.002.365.007.119.006.279-.045.437.334.162.388.555 1.353.603 1.451.048.098.08.213.016.341-.064.128-.096.208-.192.32-.096.112-.202.25-.288.336-.096.096-.197.201-.085.393.112.192.497.82 1.066 1.328.733.654 1.352.857 1.544.953.192.096.304.08.416-.048.112-.128.48-1.558.608-.752.128-.192.256-.16.432-.096.176.064 1.114.525 1.306.621.192.096.32.144.368.224.048.08.048.464-.096.869z" />
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
                  style={{ justifyContent: "center", height: 38, fontSize: 12 }}
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
                  style={{ justifyContent: "center", height: 38, fontSize: 12 }}
                  onClick={handleDownloadCalendar}
                >
                  <Download
                    size={20}
                    className="icono-marca"
                    aria-hidden="true"
                  />{" "}
                  Apple / Outlook (.ics)
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
