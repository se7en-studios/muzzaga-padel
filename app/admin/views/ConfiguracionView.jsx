"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarX,
  Check,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  Save,
  Store,
  Tag,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import {
  adminGetClubConfig,
  adminGetStaff,
  adminSaveClubConfig,
  adminSaveStaffMember,
  adminSetStaffActive,
} from "../actions";
import {
  MAX_COURTS,
  bandFor,
  depositFor,
  maskCbu,
  normalizeConfig,
  penaltyFor,
  slotTimesFor,
} from "../../../lib/clubConfig";
import { isoAddDays, todayInClub } from "../../../lib/booking";
import { formatARS, formatDate, plural } from "../../../lib/format";
import { beelupStreamInfo, youtubeEmbedUrl } from "../../../lib/beelup";
import { AjustesSkeleton, StaffSkeleton } from "./Esqueletos";
import StaffPinModal from "../ui/StaffPinModal";
import BusyButton from "../ui/BusyButton";
import { usePinGate } from "../ui/usePinGate";
import { AJUSTES_SECTION_KEY } from "../nav";

// Espejo del server (lib/staff.js no se puede importar en un componente
// "use client": usa node:crypto para hashear PINs).
const STAFF_ROLE_OPTIONS = [
  "Administrador",
  "Encargado",
  "Recepción",
  "Cantina",
  "Profesor",
];
const EMPTY_STAFF_FORM = { id: null, name: "", role: "Recepción", pin: "" };

const ICON = { size: 18, strokeWidth: 1.75, "aria-hidden": true };
const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
// Se muestra lunes primero, como lo piensa el club.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// `save` dice cómo se guarda cada sección, para que nadie crea que ya
// aplicó un cambio que todavía espera el botón Guardar (o al revés).
const SECTIONS = [
  {
    id: "canchas",
    label: "Canchas y precios",
    icon: Tag,
    hint: "Cuántas canchas hay, cómo se llaman y cuánto sale el turno.",
    save: "form",
  },
  {
    id: "horarios",
    label: "Horarios",
    icon: Clock,
    hint: "Qué días abre el club, de qué hora a qué hora y cuánto dura cada turno.",
    save: "form",
  },
  {
    id: "cobros",
    label: "Cobros",
    icon: CreditCard,
    hint: "La seña que se pide al reservar, la multa por cancelar sobre la hora y los datos para transferir.",
    save: "form",
  },
  {
    id: "cierres",
    label: "Cierres",
    title: "Días de cierre extraordinario",
    icon: CalendarX,
    hint: "Feriados, mantenimiento o eventos: ese día no se puede reservar ni en la web ni en la agenda.",
    save: "form",
  },
  {
    id: "club",
    label: "Club",
    icon: Store,
    hint: "El WhatsApp al que escriben los clientes desde la web.",
    save: "form",
  },
  {
    id: "camaras",
    label: "Cámaras",
    icon: Video,
    hint: "Los links de Beelup o YouTube que se ven en el inicio, uno por cancha.",
    save: "form",
  },
  {
    id: "equipo",
    label: "Equipo",
    icon: Users,
    hint: "Quién usa el panel. Cada uno firma con su PIN lo que borra o cancela.",
    save: "pin",
  },
];
// Sitio web (fotos, ubicación, galería) ahora es una sección propia del menú.
const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

const SAVE_TAGS = {
  form: { icon: Save, text: "Se aplica al tocar Guardar" },
  pin: { icon: KeyRound, text: "Cada cambio se confirma con PIN" },
};

// En qué sección se ve el error de cada campo que devuelve el servidor.
function sectionForField(key) {
  if (/^courts\.\d+\.streamUrl/.test(key) || key === "beelupUrl") return "camaras";
  if (key.startsWith("courts") || key.startsWith("pricing")) return "canchas";
  if (key.startsWith("schedule") || key === "slotDurationMin") return "horarios";
  if (key === "depositPct" || key === "penaltyPct" || key.startsWith("payment"))
    return "cobros";
  if (key.startsWith("blockedDates")) return "cierres";
  if (key === "clubPhone") return "club";
  return null;
}

// La sección elegida se recuerda en la pestaña del navegador; un link con
// #cfg-<sección> (ej. #cfg-equipo) abre directo esa.
function initialSection() {
  try {
    const fromHash = /^#cfg-([a-z]+)$/.exec(window.location.hash)?.[1];
    if (SECTION_BY_ID[fromHash]) return fromHash;
    const stored = window.sessionStorage.getItem(AJUSTES_SECTION_KEY);
    if (SECTION_BY_ID[stored]) return stored;
  } catch {
    // Sin acceso al almacenamiento: arranca en la primera.
  }
  return SECTIONS[0].id;
}

const SHORT_DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const toMin = (hhmm) => {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return h * 60 + m;
};
const hourLabel = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}`;
const monthShort = new Intl.DateTimeFormat("es-AR", {
  month: "short",
  timeZone: "UTC",
});
const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

/** Encabezado de cada sección: número, título, para qué sirve y cómo se guarda. */
function SectionHead({ id, dirty }) {
  const index = SECTIONS.findIndex((s) => s.id === id);
  const { label, title, icon: Icon, hint, save } = SECTIONS[index];
  const tag = SAVE_TAGS[save];
  return (
    <header className="admin-cfg-head">
      <span className="admin-cfg-head-num" aria-hidden>
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="admin-cfg-head-text">
        <h3 className="admin-section-title">
          <Icon {...ICON} /> {title || label}
        </h3>
        <p className="admin-cfg-head-hint">{hint}</p>
      </div>
      <span className={`admin-cfg-save-tag is-${save}${dirty ? " is-dirty" : ""}`}>
        <tag.icon size={14} strokeWidth={2} aria-hidden />
        {dirty ? "Con cambios sin guardar" : tag.text}
      </span>
    </header>
  );
}

/**
 * La semana como grilla: una columna por día y cada turno como una cancha
 * azul a su hora. Se redibuja mientras se editan los horarios de abajo, así
 * se ve el efecto antes de guardar. Tocar un día lleva a su fila.
 */
function WeekGrid({ form, onPickDay }) {
  const days = WEEK_ORDER.map((weekday) => {
    const day = form.schedule[weekday];
    if (!day.open) return { weekday, open: false, slots: [] };
    const date = nextDateFor(weekday);
    const open = toMin(day.start);
    const slots = slotTimesFor({ ...form, blockedDates: [] }, date).map((s) => {
      const raw = toMin(s.start);
      // Los turnos de la madrugada son de esa misma noche.
      const from = raw < open ? raw + 1440 : raw;
      return {
        ...s,
        from,
        to: from + form.slotDurationMin,
        pico: bandFor(form, date, s.start) === "pico",
      };
    });
    return { weekday, open: true, slots };
  });
  const all = days.flatMap((d) => d.slots);
  const min = all.length ? Math.floor(Math.min(...all.map((s) => s.from)) / 60) * 60 : 8 * 60;
  const max = all.length ? Math.ceil(Math.max(...all.map((s) => s.to)) / 60) * 60 : 24 * 60;
  const span = Math.max(60, max - min);
  const hours = [];
  for (let m = min; m <= max; m += 60) hours.push(m);
  const pct = (m) => `${((m - min) / span) * 100}%`;
  const perCourt = all.length;
  const courts = form.courts.length;

  return (
    <figure className="admin-cfg-week" style={{ "--hours": span / 60 }}>
      <figcaption className="admin-cfg-week-cap">
        <strong>{plural(perCourt, "turno", "turnos")} por semana en cada cancha</strong>
        {courts > 1 && (
          <span>
            {" "}
            · {perCourt * courts} entre las {courts} canchas
          </span>
        )}
      </figcaption>
      <div className="admin-cfg-week-grid">
        <span className="admin-cfg-week-corner" aria-hidden />
        {days.map(({ weekday, open, slots }) => (
          <button
            key={weekday}
            type="button"
            className={`admin-cfg-week-day${open ? "" : " is-closed"}`}
            onClick={() => onPickDay(weekday)}
            aria-label={`${WEEKDAYS[weekday]}: ${open ? plural(slots.length, "turno", "turnos") : "cerrado"}. Ir a editar`}
          >
            <strong>{SHORT_DAYS[weekday]}</strong>
            <small>{open ? slots.length : "—"}</small>
          </button>
        ))}

        <div className="admin-cfg-week-axis" aria-hidden>
          {hours.map((m) => (
            <span key={m} style={{ top: pct(m) }}>
              {hourLabel(m)}
            </span>
          ))}
        </div>
        {days.map(({ weekday, open, slots }) => (
          <div
            key={weekday}
            className={`admin-cfg-week-col${open ? "" : " is-closed"}`}
            aria-hidden
          >
            {open ? (
              slots.map((s) => (
                <span
                  key={s.start}
                  className={`admin-cfg-week-slot${s.pico ? " is-pico" : ""}`}
                  style={{ top: pct(s.from), height: pct(min + (s.to - s.from)) }}
                  title={`${WEEKDAYS[weekday]} ${s.start} a ${s.end}${s.pico ? " · pico" : ""}`}
                >
                  <span>{s.start}</span>
                </span>
              ))
            ) : (
              <span className="admin-cfg-week-closed">Cerrado</span>
            )}
          </div>
        ))}
      </div>
      <ul className="admin-cfg-week-legend" aria-hidden>
        <li>
          <i className="is-turno" /> Turno{form.pricing.picoEnabled ? " valle" : ""}
        </li>
        {form.pricing.picoEnabled && (
          <li>
            <i className="is-pico" /> Turno pico (desde {form.pricing.picoDesde})
          </li>
        )}
        <li>
          <i className="is-closed" /> Cerrado
        </li>
      </ul>
    </figure>
  );
}

/**
 * La semana en una línea, agrupando días seguidos con el mismo horario:
 * "Lun–Sáb 14:00–00:30 · Dom cerrado".
 */
function scheduleSummary(schedule) {
  const key = (d) => (d.open ? `${d.start}–${d.end}` : "cerrado");
  const runs = [];
  for (const weekday of WEEK_ORDER) {
    const k = key(schedule[weekday]);
    const last = runs[runs.length - 1];
    if (last && last.k === k) last.to = weekday;
    else runs.push({ k, from: weekday, to: weekday });
  }
  if (runs.length === 1 && runs[0].k === "cerrado") return "Cerrado toda la semana";
  return runs
    .map(({ k, from, to }) => {
      const days =
        from === to ? SHORT_DAYS[from] : `${SHORT_DAYS[from]}–${SHORT_DAYS[to]}`;
      return `${days} ${k}`;
    })
    .join(" · ");
}

/** Próximo día de la semana `weekday` desde hoy, para previsualizar turnos. */
function nextDateFor(weekday) {
  const today = todayInClub();
  for (let i = 0; i < 7; i += 1) {
    const d = isoAddDays(today, i);
    if (new Date(`${d}T12:00:00Z`).getUTCDay() === weekday) return d;
  }
  return today;
}

export default function ConfiguracionView({
  onExpiredSession,
  onToast,
  onSaved,
}) {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const { ask: askPin, pinModal } = usePinGate();
  const [fieldErrors, setFieldErrors] = useState({});
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [showCbu, setShowCbu] = useState(false);
  const [activeSection, setActiveSection] = useState(initialSection);
  // La grilla de la semana y los horarios día por día arrancan plegados en
  // un resumen de una línea; "Editar" los despliega.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const navRef = useRef(null);

  // Equipo (PINs de staff)
  const [staff, setStaff] = useState(null);
  const [staffNeedsSetup, setStaffNeedsSetup] = useState(false);
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF_FORM);
  const [staffError, setStaffError] = useState("");
  const [staffAuthOpen, setStaffAuthOpen] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);
  const [toggleTarget, setToggleTarget] = useState(null);

  useEffect(() => {
    adminGetClubConfig().then((res) => {
      if (res.ok) {
        setSaved(res.config);
        setForm(res.config);
      } else {
        onExpiredSession?.(res);
      }
    });
    refreshStaff();
  }, []);

  async function refreshStaff() {
    const res = await adminGetStaff();
    if (res.ok) {
      setStaff(res.staff);
      setStaffNeedsSetup(res.needsSetup);
    } else {
      onExpiredSession?.(res);
    }
  }

  async function callSaveStaff(authPin) {
    return adminSaveStaffMember({
      id: staffForm.id || undefined,
      name: staffForm.name,
      role: staffNeedsSetup ? "Administrador" : staffForm.role,
      pin: staffForm.pin || undefined,
      authPin,
    });
  }

  function onSubmitStaffForm(e) {
    e.preventDefault();
    setStaffError("");
    if (!staffForm.name.trim()) return setStaffError("Ingresá el nombre.");
    if ((!staffForm.id || staffForm.pin) && !/^\d{4,6}$/.test(staffForm.pin)) {
      return setStaffError("El PIN tiene que tener de 4 a 6 números.");
    }
    if (staffNeedsSetup) {
      setStaffSaving(true);
      callSaveStaff("").then((res) => {
        setStaffSaving(false);
        if (res.ok) {
          setStaffForm(EMPTY_STAFF_FORM);
          refreshStaff();
          onToast?.("Administrador creado");
        } else {
          setStaffError(res.error || "No se pudo guardar.");
        }
      });
    } else {
      setStaffAuthOpen(true);
    }
  }

  function editStaffMember(member) {
    setStaffError("");
    setStaffForm({
      id: member.id,
      name: member.name,
      role: member.role,
      pin: "",
    });
  }

  const isDirty = useMemo(
    () =>
      Boolean(form && saved && JSON.stringify(form) !== JSON.stringify(saved)),
    [form, saved],
  );

  // Avisar antes de cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // Qué secciones tienen cambios sin guardar: se marcan en el índice y en
  // la barra de guardar, para saber exactamente qué se va a aplicar.
  const dirtySections = useMemo(() => {
    if (!form || !saved) return [];
    const picks = {
      canchas: (c) => [c.courts.map(({ name, type }) => [name, type]), c.pricing],
      horarios: (c) => [c.slotDurationMin, c.schedule],
      cobros: (c) => [
        c.depositPct,
        c.penaltyPct,
        c.paymentAlias,
        c.paymentTitular,
        c.paymentCbu,
      ],
      cierres: (c) => c.blockedDates,
      club: (c) => c.clubPhone,
      camaras: (c) => [c.beelupUrl, c.courts.map((x) => x.streamUrl || "")],
    };
    return Object.keys(picks).filter(
      (id) => JSON.stringify(picks[id](form)) !== JSON.stringify(picks[id](saved)),
    );
  }, [form, saved]);

  // Si al guardar el servidor marca un error en otra sección, se pasa a
  // esa: con una sección por vez, si no, el error quedaría escondido.
  useEffect(() => {
    const withErrors = Object.keys(fieldErrors).map(sectionForField).filter(Boolean);
    if (withErrors.length && !withErrors.includes(activeSection)) {
      setActiveSection(withErrors[0]);
    }
    // Solo cuando llegan errores nuevos, no al cambiar de sección a mano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldErrors]);

  // Se muestra una sección por vez: la elegida queda guardada en la pestaña.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(AJUSTES_SECTION_KEY, activeSection);
    } catch {
      // Sin almacenamiento: solo no se recuerda.
    }
  }, [activeSection]);

  // En el celu el índice es una tira horizontal: la sección activa se corre
  // al medio para que no quede escondida fuera de la pantalla.
  useEffect(() => {
    const nav = navRef.current;
    const btn = nav?.querySelector('[aria-current="true"]');
    if (!nav || !btn || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({
      left: btn.offsetLeft - nav.clientWidth / 2 + btn.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [activeSection]);

  if (!form) {
    return (
      <AjustesSkeleton />
    );
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setPricing = (band, patch) =>
    setForm((f) => ({
      ...f,
      pricing: { ...f.pricing, [band]: { ...f.pricing[band], ...patch } },
    }));
  const setDay = (weekday, patch) =>
    setForm((f) => ({
      ...f,
      schedule: f.schedule.map((d, i) =>
        i === weekday ? { ...d, ...patch } : d,
      ),
    }));

  function setCourtCount(count) {
    const n = Math.min(MAX_COURTS, Math.max(1, count));
    setForm((f) => {
      const courts = Array.from(
        { length: n },
        (_, i) =>
          f.courts[i] || {
            id: `cancha-${i + 1}`,
            name: `Cancha ${i + 1}`,
            type: "Cristal",
            streamUrl: "",
          },
      );
      return { ...f, courts };
    });
  }

  function setCourt(index, patch) {
    setForm((f) => ({
      ...f,
      courts: f.courts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function addBlockedDate() {
    if (!newBlockedDate || form.blockedDates.includes(newBlockedDate)) return;
    set({ blockedDates: [...form.blockedDates, newBlockedDate].sort() });
    setNewBlockedDate("");
  }

  async function copyCbu() {
    try {
      await navigator.clipboard.writeText(form.paymentCbu);
      onToast?.("CBU copiado");
    } catch {
      onToast?.("No se pudo copiar el CBU.", { tone: "error" });
    }
  }

  async function handleSave() {
    setFieldErrors({});
    const res = await askPin(
      {
        title: "Guardar configuración",
        description:
          "Precios, seña y datos de pago mueven plata: lo autoriza un Administrador o Encargado con su PIN.",
        confirmButtonText: "Guardar",
      },
      async ({ pin }) => {
        setSaving(true);
        const r = await adminSaveClubConfig(form, pin);
        setSaving(false);
        if (!r.ok && r.fieldErrors) setFieldErrors(r.fieldErrors);
        return r;
      },
    );
    if (!res) return;
    if (res.ok) {
      const config = normalizeConfig(res.config);
      setSaved(config);
      setForm(config);
      onSaved?.(config);
      onToast?.(
        res.repriced
          ? `Configuración guardada · ${res.repriced} turno${res.repriced === 1 ? "" : "s"} con el precio nuevo`
          : "Configuración guardada",
      );
    } else if (!onExpiredSession?.(res)) {
      setFieldErrors(res.fieldErrors || {});
      onToast?.(res.error || "No se pudo guardar la configuración.", {
        tone: "error",
      });
    }
  }

  const smooth = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  // Cambiar de sección solo oculta la anterior (todas quedan montadas y el
  // formulario es uno solo), así que no se pierde nada sin guardar.
  function goTo(id) {
    setActiveSection(id);
    // Si el usuario bajó mucho, vuelve al principio de la sección nueva
    // (en el celu, contando la tira del índice que queda pegada arriba).
    requestAnimationFrame(() => {
      const el = document.getElementById(`cfg-${id}`);
      const strip = window.matchMedia?.("(max-width: 900px), (max-height: 500px)").matches;
      const limit = strip ? (navRef.current?.getBoundingClientRect().bottom ?? 0) : 0;
      if (el && el.getBoundingClientRect().top < limit) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
      }
    });
  }

  // Desde la grilla de la semana: lleva a la fila de ese día y la enfoca.
  function pickDay(weekday) {
    setScheduleOpen(true);
    const el =
      document.getElementById(`cfg-day-${weekday}-start`) ||
      document.getElementById(`cfg-day-${weekday}-open`);
    el?.scrollIntoView({ behavior: smooth(), block: "center" });
    el?.focus({ preventScroll: true });
  }

  const err = (key) =>
    fieldErrors[key] ? (
      <p className="admin-field-error" role="alert">
        {fieldErrors[key]}
      </p>
    ) : null;

  const valle = form.pricing.valle;
  const pico = form.pricing.pico;
  const autoPerPlayer = (court) => Math.round((Number(court) || 0) / 4);
  const cbuDigits = form.paymentCbu.replace(/\D/g, "");
  const cbuInvalid = cbuDigits.length > 0 && cbuDigits.length !== 22;
  const isSectionDirty = (id) => dirtySections.includes(id);
  const dirtyLabels = dirtySections.map((id) => SECTION_BY_ID[id].label);
  const depositPctShown = Math.min(100, Math.max(0, Number(form.depositPct) || 0));
  const depositSample = depositFor(form, valle.court);
  const penaltySample = penaltyFor(form, valle.court);
  const phoneDigits = form.clubPhone.replace(/\D/g, "");
  const isHttp = (url) => /^https?:\/\//i.test(String(url || "").trim());
  // Con un error en algún día, los horarios quedan abiertos para verlo.
  const scheduleForcedOpen = Object.keys(fieldErrors).some((k) =>
    k.startsWith("schedule."),
  );
  const showSchedule = scheduleOpen || scheduleForcedOpen;
  const weeklySlots = WEEK_ORDER.reduce(
    (n, weekday) =>
      form.schedule[weekday].open
        ? n + slotTimesFor({ ...form, blockedDates: [] }, nextDateFor(weekday)).length
        : n,
    0,
  );

  return (
    <div className="admin-settings admin-cfg">
      <nav
        ref={navRef}
        className="admin-settings-nav admin-cfg-nav"
        aria-label="Secciones de configuración"
      >
        <p className="admin-cfg-nav-title" aria-hidden>
          Secciones
        </p>
        {SECTIONS.map(({ id, label, icon: Icon }, i) => (
          <button
            key={id}
            type="button"
            aria-current={activeSection === id ? "true" : undefined}
            aria-controls={`cfg-${id}`}
            onClick={() => goTo(id)}
          >
            <span className="admin-cfg-nav-num" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <Icon {...ICON} />
            <span className="admin-cfg-nav-label">{label}</span>
            {isSectionDirty(id) && (
              <span className="admin-cfg-nav-dot" title="Con cambios sin guardar">
                <span className="sr-only">(con cambios sin guardar)</span>
              </span>
            )}
          </button>
        ))}
        <div className="admin-cfg-nav-legend" aria-hidden>
          {Object.entries(SAVE_TAGS).map(([k, t]) => (
            <span key={k} className={`is-${k}`}>
              <t.icon size={13} strokeWidth={2} /> {t.text}
            </span>
          ))}
        </div>
      </nav>

      <div className="admin-settings-body">
        {/* Portada: la cancha del club con un resumen y el estado de guardado. */}
        <div className={`admin-cfg-hero${isDirty ? " is-dirty" : ""}`}>
          <div className="admin-cfg-hero-text">
            <p className="admin-cfg-hero-kicker">Así está armado el club hoy</p>
            <ul className="admin-cfg-hero-facts">
              <li>
                <strong>{form.courts.length}</strong>
                {form.courts.length === 1 ? "cancha" : "canchas"}
              </li>
              <li>
                <strong>{form.slotDurationMin}</strong>min por turno
              </li>
              <li>
                <strong>{formatARS(valle.court)}</strong>
                {form.pricing.picoEnabled ? "turno valle" : "el turno"}
              </li>
              <li>
                <strong>{form.depositPct}%</strong>de seña
              </li>
            </ul>
          </div>
          <div className="admin-cfg-hero-status" role="status">
            {isDirty ? (
              <>
                <span className="admin-cfg-ball" aria-hidden />
                <span>
                  <strong>Cambios sin guardar</strong>
                  <small>
                    {dirtyLabels.length ? dirtyLabels.join(" · ") : "Revisalos y tocá Guardar"}
                  </small>
                </span>
              </>
            ) : (
              <>
                <Check size={18} strokeWidth={2.5} aria-hidden />
                <span>
                  <strong>Todo guardado</strong>
                  <small>Probá tranquilo: nada se aplica hasta tocar Guardar</small>
                </span>
              </>
            )}
          </div>
        </div>

        {/* CANCHAS Y PRECIOS */}
        <section
          id="cfg-canchas"
          hidden={activeSection !== "canchas"}
          className={`admin-settings-card admin-cfg-card${isSectionDirty("canchas") ? " is-dirty" : ""}`}
        >
          <SectionHead id="canchas" dirty={isSectionDirty("canchas")} />

          <div className="admin-field">
            <label className="admin-field-label" htmlFor="cfg-court-count">
              Cantidad de canchas
            </label>
            <div className="admin-stepper">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCourtCount(form.courts.length - 1)}
                disabled={form.courts.length <= 1}
                aria-label="Una cancha menos"
              >
                −
              </button>
              <output id="cfg-court-count">{form.courts.length}</output>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCourtCount(form.courts.length + 1)}
                disabled={form.courts.length >= MAX_COURTS}
                aria-label="Una cancha más"
              >
                +
              </button>
            </div>
            <p className="admin-field-hint">
              Si sacás una cancha que tiene reservas futuras, esas reservas
              siguen en la base pero no aparecen en la grilla.
            </p>
          </div>

          <div className="admin-court-names admin-cfg-courts">
            {form.courts.map((c, i) => (
              <div key={c.id} className="admin-field-row admin-cfg-court">
                <span className="admin-cfg-court-mini" aria-hidden>
                  {i + 1}
                </span>
                <div className="admin-field">
                  <label
                    className="admin-field-label"
                    htmlFor={`cfg-court-${i}`}
                  >
                    Nombre cancha {i + 1}
                  </label>
                  <input
                    id={`cfg-court-${i}`}
                    type="text"
                    maxLength={30}
                    value={c.name}
                    onChange={(e) => setCourt(i, { name: e.target.value })}
                  />
                </div>
                <div className="admin-field">
                  <label
                    className="admin-field-label"
                    htmlFor={`cfg-court-type-${i}`}
                  >
                    Tipo
                  </label>
                  <input
                    id={`cfg-court-type-${i}`}
                    type="text"
                    maxLength={20}
                    placeholder="Cristal, techada…"
                    value={c.type}
                    onChange={(e) => setCourt(i, { type: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
          {err("courts")}

          <label className="admin-toggle admin-cfg-switch admin-cfg-pico-toggle">
            <input
              type="checkbox"
              checked={form.pricing.picoEnabled}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  pricing: { ...f.pricing, picoEnabled: e.target.checked },
                }))
              }
            />
            Precio diferenciado en horario pico
          </label>

          <div className="admin-price-bands">
            {[
              [
                "valle",
                form.pricing.picoEnabled ? "Horario valle" : "Precio del turno",
                valle,
              ],
              ...(form.pricing.picoEnabled
                ? [["pico", "Horario pico", pico]]
                : []),
            ].map(([band, label, value]) => (
              <fieldset key={band} className={`admin-price-band is-${band}`}>
                <legend>{label}</legend>
                <div className="admin-field">
                  <label
                    className="admin-field-label"
                    htmlFor={`cfg-${band}-court`}
                  >
                    Cancha completa ($)
                  </label>
                  <input
                    id={`cfg-${band}-court`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={value.court}
                    onChange={(e) =>
                      setPricing(band, { court: Number(e.target.value) })
                    }
                  />
                  {err(`pricing.${band}`)}
                </div>
                <div className="admin-field">
                  <label
                    className="admin-field-label"
                    htmlFor={`cfg-${band}-pp`}
                  >
                    Por jugador ($)
                  </label>
                  {value.perPlayer == null ? (
                    <div className="admin-computed">
                      <strong>{formatARS(autoPerPlayer(value.court))}</strong>
                      <span>cancha ÷ 4</span>
                      <button
                        type="button"
                        className="admin-link-btn"
                        onClick={() =>
                          setPricing(band, {
                            perPlayer: autoPerPlayer(value.court),
                          })
                        }
                      >
                        Personalizar
                      </button>
                    </div>
                  ) : (
                    <div className="admin-computed">
                      <input
                        id={`cfg-${band}-pp`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={value.perPlayer}
                        onChange={(e) =>
                          setPricing(band, {
                            perPlayer: Number(e.target.value),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="admin-link-btn"
                        onClick={() => setPricing(band, { perPlayer: null })}
                      >
                        Volver a automático
                      </button>
                    </div>
                  )}
                  {err(`pricing.${band}.perPlayer`)}
                </div>
              </fieldset>
            ))}
          </div>

          {form.pricing.picoEnabled && (
            <div className="admin-field" style={{ maxWidth: 220 }}>
              <label className="admin-field-label" htmlFor="cfg-pico-desde">
                Horario pico desde
              </label>
              <input
                id="cfg-pico-desde"
                type="time"
                value={form.pricing.picoDesde}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pricing: { ...f.pricing, picoDesde: e.target.value },
                  }))
                }
              />
              <p className="admin-field-hint">
                Los turnos que arrancan desde esta hora (hasta el cierre) cobran
                precio pico.
              </p>
              {err("pricing.picoDesde")}
            </div>
          )}
        </section>

        {/* HORARIOS */}
        <section
          id="cfg-horarios"
          hidden={activeSection !== "horarios"}
          className={`admin-settings-card admin-cfg-card${isSectionDirty("horarios") ? " is-dirty" : ""}`}
        >
          <SectionHead id="horarios" dirty={isSectionDirty("horarios")} />

          {/* Resumen de la semana en una línea; la grilla y los horarios día
              por día se despliegan con "Editar". */}
          <div className={`admin-cfg-sched-sum${showSchedule ? " is-open" : ""}`}>
            <div className="admin-cfg-sched-sum-text">
              <span className="admin-cfg-sched-sum-kicker">Así abre el club</span>
              <strong>{scheduleSummary(form.schedule)}</strong>
              <small>
                Turnos de {form.slotDurationMin} min ·{" "}
                {plural(weeklySlots, "turno", "turnos")} por semana en cada cancha
              </small>
            </div>
            <button
              type="button"
              className="btn btn-secondary admin-cfg-sched-toggle"
              aria-expanded={showSchedule}
              aria-controls="cfg-schedule-edit"
              onClick={() => setScheduleOpen((v) => !v)}
              disabled={scheduleForcedOpen}
            >
              {showSchedule ? "Plegar" : (
                <>
                  <Pencil size={15} strokeWidth={2} aria-hidden /> Editar
                </>
              )}
              <ChevronDown size={16} strokeWidth={2} aria-hidden className="admin-cfg-sched-chev" />
            </button>
          </div>

          <div className="admin-field" style={{ maxWidth: 220 }}>
            <label className="admin-field-label" htmlFor="cfg-duration">
              Duración del turno
            </label>
            <select
              id="cfg-duration"
              value={form.slotDurationMin}
              onChange={(e) => set({ slotDurationMin: Number(e.target.value) })}
            >
              {[60, 75, 90, 105, 120].map((m) => (
                <option key={m} value={m}>
                  {m} minutos
                </option>
              ))}
            </select>
            {err("slotDurationMin")}
          </div>

          <div id="cfg-schedule-edit" className="admin-cfg-sched-edit" hidden={!showSchedule}>
          <WeekGrid form={form} onPickDay={pickDay} />

          <div className="admin-schedule">
            {WEEK_ORDER.map((weekday) => {
              const day = form.schedule[weekday];
              const preview = day.open
                ? slotTimesFor(
                    { ...form, blockedDates: [] },
                    nextDateFor(weekday),
                  )
                : [];
              return (
                <div
                  key={weekday}
                  className={`admin-schedule-row${day.open ? "" : " is-closed"}`}
                >
                  <label className="admin-toggle admin-cfg-switch">
                    <input
                      id={`cfg-day-${weekday}-open`}
                      type="checkbox"
                      checked={day.open}
                      onChange={(e) =>
                        setDay(weekday, { open: e.target.checked })
                      }
                    />
                    <span className="admin-schedule-day">
                      {WEEKDAYS[weekday]}
                    </span>
                  </label>
                  {day.open ? (
                    <>
                      <input
                        id={`cfg-day-${weekday}-start`}
                        type="time"
                        aria-label={`Apertura ${WEEKDAYS[weekday]}`}
                        value={day.start}
                        onChange={(e) =>
                          setDay(weekday, { start: e.target.value })
                        }
                      />
                      <span aria-hidden>a</span>
                      <input
                        type="time"
                        aria-label={`Cierre ${WEEKDAYS[weekday]}`}
                        value={day.end}
                        onChange={(e) =>
                          setDay(weekday, { end: e.target.value })
                        }
                      />
                      <span className="admin-field-hint admin-cfg-day-sum">
                        <strong>{plural(preview.length, "turno", "turnos")}</strong>
                        {preview.length > 0 &&
                          ` · ${preview[0].start} a ${preview[preview.length - 1].end}`}
                      </span>
                    </>
                  ) : (
                    <span className="admin-field-hint admin-cfg-day-sum">
                      Cerrado: no se puede reservar
                    </span>
                  )}
                  {err(`schedule.${weekday}`)}
                </div>
              );
            })}
          </div>
          <p className="admin-field-hint">
            Un cierre antes de la apertura (ej. 00:30) se toma como del día
            siguiente.
          </p>
          </div>
        </section>

        {/* COBROS */}
        <section
          id="cfg-cobros"
          hidden={activeSection !== "cobros"}
          className={`admin-settings-card admin-cfg-card${isSectionDirty("cobros") ? " is-dirty" : ""}`}
        >
          <SectionHead id="cobros" dirty={isSectionDirty("cobros")} />

          <div className="admin-field" style={{ maxWidth: 260 }}>
            <label className="admin-field-label" htmlFor="cfg-deposit">
              Seña (% del turno)
            </label>
            <input
              id="cfg-deposit"
              type="number"
              min={0}
              max={100}
              value={form.depositPct}
              onChange={(e) => set({ depositPct: Number(e.target.value) })}
            />
            <p className="admin-field-hint">
              Un turno de {formatARS(valle.court)} pide{" "}
              {formatARS(depositSample)} de seña.
            </p>
            {err("depositPct")}
          </div>


          {/* La seña dibujada sobre el precio del turno: se entiende de un vistazo. */}
          <div className="admin-cfg-deposit" aria-hidden>
            <div className="admin-cfg-deposit-bar">
              <span style={{ width: `${depositPctShown}%` }} />
            </div>
            <div className="admin-cfg-deposit-legend">
              <span className="is-deposit">
                Seña <strong>{formatARS(depositSample)}</strong>
              </span>
              <span>
                En el club <strong>{formatARS(Math.max(0, valle.court - depositSample))}</strong>
              </span>
            </div>
          </div>

          <div className="admin-field" style={{ maxWidth: 320 }}>
            <label className="admin-field-label" htmlFor="cfg-penalty">
              Multa por cancelar sobre la hora (% del turno)
            </label>
            <input
              id="cfg-penalty"
              type="number"
              min={0}
              max={100}
              value={form.penaltyPct ?? 50}
              onChange={(e) => set({ penaltyPct: Number(e.target.value) })}
            />
            <p className="admin-field-hint">
              Se sugiere al cancelar un turno (por ejemplo, un fijo que cede el
              horario tarde): un turno de {formatARS(valle.court)} lleva{" "}
              {formatARS(penaltySample)} de multa. Se puede cambiar en cada caso.
            </p>
            {err("penaltyPct")}
          </div>

          <div className="admin-field-row">
            <div className="admin-field">
              <label className="admin-field-label" htmlFor="cfg-alias">
                Alias
              </label>
              <input
                id="cfg-alias"
                type="text"
                value={form.paymentAlias}
                onChange={(e) => set({ paymentAlias: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label className="admin-field-label" htmlFor="cfg-titular">
                Titular de la cuenta
              </label>
              <input
                id="cfg-titular"
                type="text"
                value={form.paymentTitular}
                onChange={(e) => set({ paymentTitular: e.target.value })}
              />
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-field-label" htmlFor="cfg-cbu">
              CBU / CVU
            </label>
            <div className="admin-cbu">
              {showCbu ? (
                <input
                  id="cfg-cbu"
                  className="admin-mono"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={26}
                  value={form.paymentCbu}
                  aria-invalid={cbuInvalid || undefined}
                  onChange={(e) =>
                    set({ paymentCbu: e.target.value.replace(/[^\d\s]/g, "") })
                  }
                />
              ) : (
                <output id="cfg-cbu" className="admin-mono admin-cbu-masked">
                  {cbuDigits ? maskCbu(cbuDigits) : "Sin cargar"}
                </output>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCbu((v) => !v)}
                aria-label={showCbu ? "Ocultar CBU" : "Mostrar y editar CBU"}
              >
                {showCbu ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
                {showCbu ? "Ocultar" : "Editar"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={copyCbu}
                disabled={!cbuDigits}
                aria-label="Copiar CBU"
              >
                <Copy {...ICON} /> Copiar
              </button>
            </div>
            {cbuInvalid ? (
              <p className="admin-field-error" role="alert">
                Tiene {cbuDigits.length} dígitos: un CBU/CVU tiene 22.
              </p>
            ) : (
              err("paymentCbu")
            )}
          </div>
        </section>

        {/* CIERRES */}
        <section
          id="cfg-cierres"
          hidden={activeSection !== "cierres"}
          className={`admin-settings-card admin-cfg-card${isSectionDirty("cierres") ? " is-dirty" : ""}`}
        >
          <SectionHead id="cierres" dirty={isSectionDirty("cierres")} />
          <div className="admin-inline-form">
            <input
              type="date"
              aria-label="Fecha a bloquear"
              min={todayInClub()}
              value={newBlockedDate}
              onChange={(e) => setNewBlockedDate(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addBlockedDate}
              disabled={!newBlockedDate}
            >
              <Plus {...ICON} /> Bloquear día
            </button>
          </div>
          {form.blockedDates.length === 0 ? (
            <p className="admin-field-hint admin-cfg-empty">
              No hay días bloqueados: se puede reservar todos los días que abre el club.
            </p>
          ) : (
            <ul className="admin-chip-list admin-cfg-closed">
              {form.blockedDates.map((d) => (
                <li key={d} className="admin-chip">
                  <span className="admin-cfg-closed-date" aria-hidden>
                    <strong>{Number(d.slice(8))}</strong>
                    <small>
                      {monthShort
                        .format(new Date(`${d}T12:00:00Z`))
                        .replace(".", "")}
                    </small>
                  </span>
                  <span className="admin-cfg-closed-label">
                    {formatDate(d, "long")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      set({
                        blockedDates: form.blockedDates.filter((x) => x !== d),
                      })
                    }
                    aria-label={`Desbloquear ${formatDate(d, "long")}`}
                  >
                    <X size={14} strokeWidth={1.75} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* CLUB */}
        <section
          id="cfg-club"
          hidden={activeSection !== "club"}
          className={`admin-settings-card admin-cfg-card${isSectionDirty("club") ? " is-dirty" : ""}`}
        >
          <SectionHead id="club" dirty={isSectionDirty("club")} />
          <div className="admin-field" style={{ maxWidth: 320 }}>
            <label className="admin-field-label" htmlFor="cfg-phone">
              WhatsApp del club
            </label>
            <input
              id="cfg-phone"
              type="tel"
              inputMode="tel"
              value={form.clubPhone}
              onChange={(e) => set({ clubPhone: e.target.value })}
            />
            <p className="admin-field-hint">
              Con código de país, sin espacios: 549…
            </p>
            {phoneDigits.length >= 10 && (
              <a
                className="admin-cfg-try"
                href={`https://wa.me/${phoneDigits}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} strokeWidth={2} aria-hidden /> Probar
                el número en WhatsApp
              </a>
            )}
          </div>
        </section>

        {/* CÁMARAS (Beelup) */}
        <section
          id="cfg-camaras"
          hidden={activeSection !== "camaras"}
          className={`admin-settings-card admin-cfg-card${isSectionDirty("camaras") ? " is-dirty" : ""}`}
        >
          <SectionHead id="camaras" dirty={isSectionDirty("camaras")} />
          <p className="admin-field-hint admin-cfg-lead">
            Se ven en el inicio, en la sección de cámaras debajo de las
            reservas. Al guardar, la página se actualiza sola. Cada cancha
            acepta la transmisión de YouTube que arma Beelup (recomendado: se
            ve en cualquier celular o compu) o un link de stream de Beelup.
            Una cancha sin link, o con el link vencido, muestra el loop.
          </p>

          <div className="admin-field">
            <label className="admin-field-label" htmlFor="cfg-beelup">
              Link del club en Beelup
            </label>
            <input
              id="cfg-beelup"
              type="url"
              inputMode="url"
              placeholder="https://beelup.com/…"
              value={form.beelupUrl}
              onChange={(e) => set({ beelupUrl: e.target.value })}
            />
            <p className="admin-field-hint">
              Lo abre la mascota y el botón &quot;Ver tus jugadas en Beelup&quot;.
            </p>
            {err("beelupUrl")}
          </div>

          <div className="admin-cfg-cams">
          {form.courts.map((c, i) => {
            const info = beelupStreamInfo(c.streamUrl);
            const isYoutube = Boolean(c.streamUrl && youtubeEmbedUrl(c.streamUrl));
            // Estado de la cámara de un vistazo, con las mismas reglas que la ayuda de abajo.
            const status = !c.streamUrl
              ? { tone: "off", text: "Sin link · muestra el loop" }
              : isYoutube
                ? { tone: "ok", text: "YouTube" }
                : info.expired
                  ? { tone: "bad", text: "Link vencido" }
                  : { tone: "ok", text: "Beelup" };
            return (
              <div key={c.id} className={`admin-field admin-cfg-cam is-${status.tone}`}>
                <div className="admin-cfg-cam-head">
                  <span className="admin-cfg-court-mini" aria-hidden>
                    {i + 1}
                  </span>
                  <label className="admin-field-label" htmlFor={`cfg-stream-${i}`}>
                    Cámara en vivo · {c.name || `Cancha ${i + 1}`}
                  </label>
                  <span className="admin-cfg-cam-status">
                    <span aria-hidden className="admin-cfg-cam-led" />
                    {status.text}
                  </span>
                  {isHttp(c.streamUrl) && (
                    <a
                      className="admin-cfg-try"
                      href={c.streamUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} strokeWidth={2} aria-hidden /> Abrir
                    </a>
                  )}
                </div>
                <input
                  id={`cfg-stream-${i}`}
                  type="url"
                  inputMode="url"
                  placeholder="https://www.youtube.com/live/… o link de Beelup"
                  value={c.streamUrl || ""}
                  onChange={(e) => setCourt(i, { streamUrl: e.target.value })}
                />
                {c.streamUrl && (
                  <p
                    className={info.expired ? "admin-field-error" : "admin-field-hint"}
                    role={info.expired ? "alert" : undefined}
                  >
                    {youtubeEmbedUrl(c.streamUrl)
                      ? "Transmisión de YouTube: se ve en cualquier celular o compu."
                      : null}
                    {!youtubeEmbedUrl(c.streamUrl) && info.camera && `Cámara ${info.camera}. `}
                    {youtubeEmbedUrl(c.streamUrl) ? null : info.expiresAt
                      ? info.expired
                        ? "Este link ya venció: pegá uno nuevo de Beelup."
                        : `Beelup da este link hasta el ${new Date(
                            info.expiresAt,
                          ).toLocaleString("es-AR", {
                            timeZone: "America/Argentina/Buenos_Aires",
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })} hs; después hay que pegar uno nuevo.`
                      : "Link sin fecha de vencimiento."}
                  </p>
                )}
                {err(`courts.${i}.streamUrl`)}
              </div>
            );
          })}
          </div>
        </section>

        {/* EQUIPO */}
        <section
          id="cfg-equipo"
          hidden={activeSection !== "equipo"}
          className="admin-settings-card admin-cfg-card"
        >
          <SectionHead id="equipo" />
          <p className="admin-field-hint admin-cfg-lead">
            Cada integrante tiene su propio PIN (4 a 6 números): lo pide el
            panel al cancelar o eliminar un turno, anular una venta, etc., así
            queda registrado quién hizo el cambio.
          </p>

          {staff === null ? (
            <StaffSkeleton />
          ) : (
            <>
              {staff.length > 0 && (
                <ul className="admin-cfg-staff">
                  {staff.map((m) => (
                    <li
                      key={m.id}
                      className={`admin-cfg-staff-card${m.active ? "" : " is-off"}${staffForm.id === m.id ? " is-editing" : ""}`}
                      data-role={m.role}
                    >
                      <span className="admin-cfg-avatar" aria-hidden>
                        {initials(m.name)}
                      </span>
                      <div className="admin-cfg-staff-who">
                        <strong>{m.name}</strong>
                        <span className="admin-cfg-role">
                          {m.role}
                          {!m.active && " · dado de baja"}
                        </span>
                      </div>
                      <div className="admin-cfg-staff-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => editStaffMember(m)}
                          aria-label={`Editar a ${m.name}`}
                        >
                          <Pencil size={14} strokeWidth={1.75} aria-hidden />
                          <span className="admin-cfg-btn-text">Editar</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setToggleTarget(m)}
                          aria-label={
                            m.active
                              ? `Dar de baja a ${m.name}`
                              : `Reactivar a ${m.name}`
                          }
                        >
                          {m.active ? "Dar de baja" : "Reactivar"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <form
                onSubmit={onSubmitStaffForm}
                className="admin-field-row admin-cfg-staff-form"
                aria-label={staffForm.id ? `Editar a ${staffForm.name}` : "Sumar integrante"}
              >
                <p className="admin-cfg-staff-form-title">
                  {staffForm.id ? (
                    <>
                      <Pencil size={14} strokeWidth={2} aria-hidden /> Editando
                      a un integrante
                    </>
                  ) : (
                    <>
                      <Plus size={14} strokeWidth={2} aria-hidden />{" "}
                      {staffNeedsSetup ? "Crear el primer Administrador" : "Sumar a alguien al equipo"}
                    </>
                  )}
                </p>
                <div className="admin-field">
                  <label className="admin-field-label" htmlFor="cfg-staff-name">
                    Nombre
                  </label>
                  <input
                    id="cfg-staff-name"
                    type="text"
                    maxLength={40}
                    value={staffForm.name}
                    onChange={(e) =>
                      setStaffForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div className="admin-field">
                  <label className="admin-field-label" htmlFor="cfg-staff-role">
                    Rol
                  </label>
                  {staffNeedsSetup ? (
                    <output id="cfg-staff-role">Administrador</output>
                  ) : (
                    <select
                      id="cfg-staff-role"
                      value={staffForm.role}
                      onChange={(e) =>
                        setStaffForm((f) => ({ ...f, role: e.target.value }))
                      }
                    >
                      {STAFF_ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="admin-field">
                  <label className="admin-field-label" htmlFor="cfg-staff-pin">
                    PIN {staffForm.id && "(dejalo vacío para no cambiarlo)"}
                  </label>
                  <input
                    id="cfg-staff-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    placeholder="••••"
                    value={staffForm.pin}
                    onChange={(e) =>
                      setStaffForm((f) => ({
                        ...f,
                        pin: e.target.value.replace(/\D/g, "").slice(0, 6),
                      }))
                    }
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-linear-primary"
                  disabled={staffSaving}
                >
                  {staffForm.id ? "Guardar cambios" : "Agregar"}
                </button>
                {staffForm.id && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setStaffForm(EMPTY_STAFF_FORM)}
                  >
                    Cancelar
                  </button>
                )}
              </form>
              {staffNeedsSetup && (
                <p className="admin-field-hint">
                  El primer integrante tiene que ser Administrador. Después vas
                  a poder sumar al resto del equipo con su PIN.
                </p>
              )}
              {staffError && (
                <p className="admin-field-error" role="alert">
                  {staffError}
                </p>
              )}
            </>
          )}
        </section>
      </div>

      {pinModal}

      {toggleTarget && (
        <StaffPinModal
          isOpen={Boolean(toggleTarget)}
          title={toggleTarget.active ? "Dar de Baja" : "Reactivar Integrante"}
          description={`¿Confirmás ${toggleTarget.active ? "dar de baja a" : "reactivar a"} ${toggleTarget.name} (${toggleTarget.role})?`}
          confirmButtonText={toggleTarget.active ? "Dar de Baja" : "Reactivar"}
          confirmButtonTone={toggleTarget.active ? "danger" : "primary"}
          onClose={() => setToggleTarget(null)}
          onConfirm={async ({ pin }) => {
            const res = await adminSetStaffActive({
              id: toggleTarget.id,
              active: !toggleTarget.active,
              authPin: pin,
            });
            if (!res.ok) throw new Error(res.error || "No se pudo actualizar.");
            const wasActive = toggleTarget.active;
            setToggleTarget(null);
            refreshStaff();
            onToast?.(
              wasActive ? "Integrante dado de baja" : "Integrante reactivado",
            );
          }}
        />
      )}

      {staffAuthOpen && (
        <StaffPinModal
          isOpen={staffAuthOpen}
          title={staffForm.id ? "Editar Integrante" : "Agregar Integrante"}
          description="El PIN de un Administrador o Encargado autoriza este cambio en el equipo."
          confirmButtonText="Confirmar"
          confirmButtonTone="primary"
          onClose={() => setStaffAuthOpen(false)}
          onConfirm={async ({ pin }) => {
            const res = await callSaveStaff(pin);
            if (!res.ok) throw new Error(res.error || "No se pudo guardar.");
            const wasEditing = Boolean(staffForm.id);
            setStaffForm(EMPTY_STAFF_FORM);
            setStaffAuthOpen(false);
            refreshStaff();
            onToast?.(
              wasEditing ? "Integrante actualizado" : "Integrante agregado",
            );
          }}
        />
      )}

      {isDirty && (
        <div
          className="admin-unsaved-bar admin-cfg-savebar"
          role="region"
          aria-label="Cambios sin guardar"
        >
          <span className="admin-cfg-savebar-text">
            <span className="admin-cfg-ball" aria-hidden />
            <span>
              <strong>Cambios sin guardar</strong>
              <small>
                {dirtyLabels.length
                  ? `En ${dirtyLabels.join(", ")}. Hasta que no guardes, todo sigue como antes.`
                  : "Hasta que no guardes, todo sigue como antes."}
              </small>
            </span>
          </span>
          <div className="admin-cfg-savebar-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setForm(saved);
                setFieldErrors({});
              }}
              disabled={saving}
            >
              <Trash2 {...ICON} /> Descartar
            </button>
            <BusyButton
              type="button"
              className="btn btn-linear-primary"
              onClick={handleSave}
              disabled={saving || cbuInvalid}
              busy={saving}
            >
              {saving ? "Guardando…" : "Guardar"}
            </BusyButton>
          </div>
        </div>
      )}
    </div>
  );
}
