"use client";

import { useEffect, useState } from "react";
import { Banknote, CalendarDays, CircleAlert, CircleCheck } from "lucide-react";
import {
  isoAddDays,
  nextDays,
  nowInClubTimezone,
  businessDayInClub,
} from "../../../lib/booking";
import { hasSlotStarted, minutesIntoNight } from "../../../lib/clubConfig";
import { formatARS, formatPct } from "../../../lib/format";
import {
  isCountableBooking,
  paymentState,
  pendingAmount,
} from "../../../lib/metrics";
import { adminGetRangeStats } from "../actions";
import CourtTimeline from "./agenda/CourtTimeline";
import DayStrip from "./agenda/DayStrip";
import WeekChart from "./agenda/WeekChart";
import { EmptyState, Skeleton, SkeletonRows } from "../ui/states";

const BOARD_ICON = { size: 15, strokeWidth: 1.9, "aria-hidden": true };

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
  weekStats,
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
      <div className="admin-agenda">
        {strip}
        {/* Mismo tamaño que el marcador oscuro y la grilla: sin saltos al
            llegar los datos. */}
        <div className="admin-agenda-skeleton" aria-busy="true" aria-label="Cargando la agenda">
          <Skeleton height={138} radius={16} />
          <Skeleton width={220} height={26} />
          <SkeletonRows count={7} height={64} />
        </div>
      </div>
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

  // Lo que se está jugando ahora y lo libre que queda: mismos criterios que
  // usa la grilla (empezó y no terminó / todavía no empezó).
  const isLive = minutesIntoNight(activeDate, now) !== null;
  const playing = isLive
    ? dayData.slots.filter(
        (s) =>
          s.booking &&
          isCountableBooking(s.booking) &&
          hasSlotStarted(clubConfig, activeDate, s.start, now) &&
          !hasSlotStarted(clubConfig, activeDate, s.end, now),
      )
    : [];
  const freeLeft = dayData.slots.filter(
    (s) => !s.isTaken && !hasSlotStarted(clubConfig, activeDate, s.start, now),
  ).length;
  const isClosed = stats.totalSlots === 0;
  const occupancy = Math.min(100, Math.max(0, stats.ocupacionPct ?? 0));

  return (
    <div className="admin-agenda">
      {strip}
      <div className={loading ? "admin-content-loading" : ""}>
        {/* Marcador del día: los tres números y el próximo turno en una sola
            franja, así la grilla entra entera en la compu del mostrador. */}
        <section className="admin-board" aria-label="Resumen del día">
          <div className="admin-board-cell is-turnos">
            <span className="admin-board-label">
              <CalendarDays {...BOARD_ICON} /> Turnos reservados
            </span>
            <strong className="admin-board-value">
              {summary.turnos}
              {!isClosed && <small>/{stats.totalSlots}</small>}
            </strong>
            {!isClosed && (
              <span className="admin-board-meter-row">
                <span className="admin-board-meter" aria-hidden>
                  <span style={{ width: `${occupancy}%` }} />
                </span>
                <em>{formatPct(stats.ocupacionPct ?? 0)} ocupado</em>
              </span>
            )}
            <span className="admin-board-sub">
              {isClosed
                ? "El club está cerrado"
                : `${freeLeft} ${freeLeft === 1 ? "libre" : "libres"} por jugar`}
            </span>
          </div>

          <div className="admin-board-cell is-cash">
            <span className="admin-board-label">
              <Banknote {...BOARD_ICON} /> Plata que entró
            </span>
            <strong className="admin-board-value">{formatARS(summary.cobrado)}</strong>
            <span className="admin-board-sub">Turnos y cantina</span>
          </div>

          <div
            className={`admin-board-cell is-owing${summary.porCobrar > 0 ? " has-debt" : ""}`}
          >
            <span className="admin-board-label">
              {summary.porCobrar > 0 ? (
                <CircleAlert {...BOARD_ICON} />
              ) : (
                <CircleCheck {...BOARD_ICON} />
              )}{" "}
              Falta cobrar
            </span>
            <strong className="admin-board-value">{formatARS(summary.porCobrar)}</strong>
            <span className="admin-board-sub">
              {owing > 0
                ? `${owing} ${owing === 1 ? "turno debe" : "turnos deben"}`
                : "Todo cobrado"}
            </span>
          </div>

          {nextSlot ? (
            <button
              type="button"
              className="admin-board-next"
              data-state={paymentState(nextSlot.booking)}
              onClick={() => onOpenDetail(nextSlot.booking)}
            >
              <span className="admin-board-label">Próximo turno</span>
              <span className="admin-board-next-row">
                <strong className="admin-board-next-time">
                  {nextSlot.start}
                  <small>hs</small>
                </strong>
                <span className="admin-board-next-who">
                  <span className="admin-board-next-court">{nextCourt}</span>
                  <strong className="admin-board-next-name">
                    {nextSlot.booking.playerName}
                  </strong>
                </span>
              </span>
              <span className="admin-board-next-foot">
                <span
                  className={`admin-board-next-money${nextOwes > 0 ? " is-owing" : ""}`}
                >
                  {nextOwes > 0 ? `Debe ${formatARS(nextOwes)}` : "Pagado"}
                </span>
                <span className="admin-board-next-cta">
                  {nextOwes > 0 ? "Cobrar →" : "Ver →"}
                </span>
              </span>
            </button>
          ) : (
            <div className="admin-board-next is-empty">
              <span className="admin-board-label">Próximo turno</span>
              <span className="admin-board-next-none">
                {isClosed ? "Este día no se juega" : "No quedan turnos por empezar"}
              </span>
            </div>
          )}
        </section>

        <section
          className="admin-day-courts"
          aria-labelledby="admin-day-courts-title"
        >
          <div className="admin-day-courts-head">
            <div className="admin-day-courts-titles">
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
            <div className="admin-day-courts-meta">
              {isLive && !isClosed && (
                <span
                  className={`admin-live-chip${playing.length > 0 ? " is-on" : ""}`}
                >
                  {playing.length > 0
                    ? `En juego ahora: ${playing.length} de ${dayData.courts.length} ${dayData.courts.length === 1 ? "cancha" : "canchas"}`
                    : "Ninguna cancha en juego ahora"}
                </span>
              )}
              <ul className="admin-agenda-legend" aria-label="Qué significa cada color">
                <li data-state="pagado">Pagado</li>
                <li data-state="senado">Seña</li>
                <li data-state="pendiente">Debe</li>
                <li className="is-free">Libre</li>
              </ul>
            </div>
          </div>

          {isClosed ? (
            <div className="admin-closed-day">
              <EmptyState
                mascot="descanso-mate"
                title="El club no abre este día"
                text="Día de descanso. Elegí otro día en la tira de arriba para ver o cargar turnos."
              />
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

        <WeekSection weekStats={weekStats} />
      </div>
    </div>
  );
}

/**
 * Últimos 7 días (hasta hoy, sin importar el día que se esté mirando). Los
 * datos llegan aparte de los del día (adminGetWeekStats, que el panel ya
 * pedía después de la agenda): mientras tanto, la grilla ya se puede usar.
 * `weekStats`: null = cargando, false = falló, [] / días = listo.
 */
function WeekSection({ weekStats }) {
  const days = Array.isArray(weekStats) ? weekStats : null;
  const totalTurnos = days ? days.reduce((s, d) => s + (d.turnos || 0), 0) : 0;
  const totalCobrado = days ? days.reduce((s, d) => s + (d.cobrado || 0), 0) : 0;
  const isEmpty = days && totalTurnos === 0 && totalCobrado === 0;

  return (
    <section className="admin-week" aria-labelledby="admin-week-title">
      <div className="admin-week-head">
        <h2 id="admin-week-title" className="admin-section-title admin-m0">
          Últimos 7 días
        </h2>
        {days && !isEmpty && (
          <p className="admin-week-totals">
            <span>
              <strong>{totalTurnos}</strong>{" "}
              {totalTurnos === 1 ? "turno" : "turnos"}
            </span>
            <span>
              <strong>{formatARS(totalCobrado)}</strong> cobrado
            </span>
          </p>
        )}
      </div>
      {weekStats === false ? (
        <div className="admin-week-empty">
          <EmptyState
            mascot="enredado-grip"
            title="No se pudo cargar la semana"
            text="Probá actualizar en un rato."
          />
        </div>
      ) : !days ? (
        <div className="admin-week-loading" aria-busy="true" aria-label="Cargando la semana">
          <Skeleton height={210} radius={16} />
        </div>
      ) : isEmpty ? (
        <div className="admin-week-empty">
          <EmptyState
            mascot="pelota-padel-life"
            title="Semana sin movimiento"
            text="Todavía no hay turnos ni cobros en los últimos 7 días. Cuando entren, el gráfico aparece acá."
          />
        </div>
      ) : (
        <WeekChart days={days} />
      )}
    </section>
  );
}
