"use client";

import { useEffect, useState } from "react";
import { Banknote, CalendarDays, CircleAlert, CircleCheck } from "lucide-react";
import {
  isoAddDays,
  nextDays,
  nowInClubTimezone,
  businessDayInClub,
} from "../../../lib/booking";
import { hasSlotStarted } from "../../../lib/clubConfig";
import { formatARS } from "../../../lib/format";
import { isCountableBooking, pendingAmount } from "../../../lib/metrics";
import { adminGetRangeStats } from "../actions";
import CourtTimeline from "./agenda/CourtTimeline";
import DayStrip from "./agenda/DayStrip";
import KpiCard, { KpiGrid } from "../ui/KpiCard";
import { SkeletonCards, SkeletonRows } from "../ui/states";

/**
 * Agenda del día. Pensada para que la entienda cualquiera de un vistazo:
 * cuántos turnos hay, cuánta plata entró, cuánta falta, y la grilla de
 * canchas donde se toca un turno para cobrarlo o un horario libre para
 * reservarlo. Todos los números salen de dayData (lib/metrics.js).
 */
export default function AgendaView({
  dayData,
  activeDate,
  setActiveDate,
  loading,
  clubConfig,
  onRefresh,
  onOpenCreate,
  onOpenDetail,
}) {
  const [rangeStats, setRangeStats] = useState(null);
  // Jornada: a la 01:00 la agenda sigue mostrando los turnos de esa noche.
  const todayIso = businessDayInClub();
  const now = nowInClubTimezone();
  const days = nextDays(14, todayIso);

  // Ocupación de los próximos 14 días para la tira
  useEffect(() => {
    let cancelled = false;
    adminGetRangeStats(todayIso, 14).then((res) => {
      if (!cancelled && res.ok) setRangeStats(res.days);
    });
    return () => {
      cancelled = true;
    };
  }, [dayData, todayIso]);

  // Atajos de teclado: flechas izquierda/derecha para navegar días, 't' para hoy
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (document.querySelector(".admin-modal-backdrop")) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveDate((d) => isoAddDays(d, -1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveDate((d) => isoAddDays(d, 1));
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setActiveDate(todayIso);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [todayIso, setActiveDate]);

  const strip = (
    <DayStrip
      days={days}
      rangeStats={rangeStats}
      activeDate={activeDate}
      todayIso={todayIso}
      loading={loading}
      onSelect={setActiveDate}
      onRefresh={onRefresh}
    />
  );

  if (!dayData) {
    return (
      <>
        {strip}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SkeletonCards count={3} />
          <SkeletonRows count={7} height={64} />
        </div>
      </>
    );
  }

  const { summary, stats } = dayData;
  const bookings = dayData.bookings || [];
  const owing = bookings.filter(
    (b) => isCountableBooking(b) && pendingAmount(b) > 0,
  ).length;

  const rowOrder = [...new Set(dayData.slots.map((s) => s.start))];
  const nextSlot =
    dayData.slots
      .filter((s) => s.booking && isCountableBooking(s.booking))
      .filter((s) => !hasSlotStarted(clubConfig, activeDate, s.start, now))
      .sort(
        (a, b) => rowOrder.indexOf(a.start) - rowOrder.indexOf(b.start),
      )[0] || null;
  const nextCourt = nextSlot
    ? dayData.courts.find((c) => c.id === nextSlot.courtId)?.name ||
      nextSlot.courtId
    : null;
  const nextOwes = nextSlot ? pendingAmount(nextSlot.booking) : 0;

  return (
    <>
      {strip}
      <div className={loading ? "admin-content-loading" : ""}>
        <KpiGrid min={200}>
          <KpiCard
            title="Turnos reservados"
            value={summary.turnos}
            sub={
              stats.totalSlots > 0
                ? `de ${stats.totalSlots} horarios del día`
                : "El club está cerrado"
            }
            icon={CalendarDays}
          />
          <KpiCard
            title="Plata que entró"
            value={formatARS(summary.cobrado)}
            sub="Turnos y cantina"
            icon={Banknote}
            tone="success"
          />
          <KpiCard
            title="Falta cobrar"
            value={formatARS(summary.porCobrar)}
            sub={
              owing > 0
                ? `${owing} ${owing === 1 ? "turno debe" : "turnos deben"}`
                : "Todo cobrado"
            }
            icon={summary.porCobrar > 0 ? CircleAlert : CircleCheck}
            tone={summary.porCobrar > 0 ? "danger" : "success"}
          />
        </KpiGrid>

        {nextSlot && (
          <button
            type="button"
            className="admin-next-turn"
            onClick={() => onOpenDetail(nextSlot.booking)}
          >
            <span className="admin-next-turn-label">Próximo turno</span>
            <strong className="admin-next-turn-title">
              {nextSlot.start} hs · {nextCourt} · {nextSlot.booking.playerName}
            </strong>
            <span
              className={`admin-next-turn-money${nextOwes > 0 ? " is-owing" : ""}`}
            >
              {nextOwes > 0 ? `Debe ${formatARS(nextOwes)}` : "Pagado"}
            </span>
            <span className="admin-next-turn-cta">
              {nextOwes > 0 ? "Cobrar →" : "Ver →"}
            </span>
          </button>
        )}

        <section
          className="admin-day-courts"
          aria-labelledby="admin-day-courts-title"
        >
          <div className="admin-day-courts-head">
            <h2
              id="admin-day-courts-title"
              className="admin-section-title admin-m0"
            >
              Canchas del día
            </h2>
            <p className="admin-day-courts-hint">
              Tocá un turno para cobrar o ver el detalle. Tocá un horario libre
              para reservarlo.
            </p>
          </div>

          {stats.totalSlots === 0 ? (
            <div className="admin-settings-card admin-closed-day">
              El club no abre este día.
            </div>
          ) : (
            <CourtTimeline
              courts={dayData.courts}
              slots={dayData.slots}
              activeDate={activeDate}
              clubConfig={clubConfig}
              now={now}
              onAssign={onOpenCreate}
              onOpenDetail={onOpenDetail}
            />
          )}
        </section>
      </div>
    </>
  );
}
