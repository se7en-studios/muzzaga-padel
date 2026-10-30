// Datos de prueba del Monitor TV, solo en desarrollo (/admin/monitor?demo).
// El monitor real necesita la sesión del admin contra la base de producción;
// con esto se puede ver y ajustar el diseño en local sin entrar.
// ?demo=8 deja 8 minutos al partido de la primera cancha (por defecto 37).
import { COURTS, nowInClubTimezone, todayInClub } from "../../../lib/booking";
import { toMinutes } from "./schedule";

const hhmm = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function isMonitorDemo() {
  return (
    process.env.NODE_ENV === "development" &&
    new URLSearchParams(window.location.search).has("demo")
  );
}

export function monitorDemoData() {
  const params = new URLSearchParams(window.location.search);
  const left = Number(params.get("demo")) || 37;
  const now = toMinutes(nowInClubTimezone().hhmm);
  const date = todayInClub();
  const [c1, c2] = COURTS;
  const turno = (id, courtId, start, playerName, playersCount = 4) => ({
    id,
    date,
    courtId,
    startTime: hhmm(start),
    endTime: hhmm(start + 90),
    playerName,
    playersCount,
    status: "confirmado",
  });
  const start1 = now + left - 90;
  return {
    ok: true,
    courts: [
      { ...c1, name: "El Tano" },
      { ...c2, name: "La Vasca" },
    ],
    bookings: [
      turno("d1", c1.id, start1, "Aldana Martínez"),
      turno("d2", c1.id, start1 + 90, "Anabella Zeballos"),
      turno("d3", c1.id, start1 + 270, "Equipo Los Pibes", 4),
      turno("d4", c2.id, now + 40, "Pablo Funes", 2),
      turno("d5", c2.id, now + 130, "Martín Riquero"),
    ],
  };
}
