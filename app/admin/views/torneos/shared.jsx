"use client";

import { useState } from "react";
import { Clock, Pencil, X } from "lucide-react";
import BusyButton from "../../ui/BusyButton";
import {
  matchLabel,
  pairName,
  parseScore,
  roundName,
  shortPairName,
  sourceLabel,
} from "../../../../lib/tournament";

export const STATUS_LABELS = {
  abierto: { label: "Inscripción abierta", tone: "badge-emerald" },
  cerrado: { label: "En juego", tone: "badge-amber" },
  finalizado: { label: "Finalizado", tone: "badge-indigo" },
};

const weekdayFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  weekday: "short",
});

/** "sáb 07/11" */
export function dayLabel(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const wd = weekdayFormat
    .format(new Date(Date.UTC(+y, m - 1, +d)))
    .replace(".", "");
  return `${wd} ${d}/${m}`;
}

/** "Viernes 7 de noviembre" */
export function longDayLabel(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const text = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(+y, m - 1, +d)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const monthFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  month: "short",
});

/**
 * La fecha como tablero LED de la cancha: día de la semana, número grande y
 * mes. Si dura varios días, arriba va "VIE A DOM". Solo decorativo: la fecha
 * completa se lee en el texto de al lado.
 */
export function Marcador({ date, dateEnd, className = "" }) {
  let label = "Fecha";
  let num = "--";
  let mon = "a definir";
  if (date) {
    const [y, m, d] = date.split("-");
    const at = new Date(Date.UTC(+y, m - 1, +d));
    label = weekdayFormat.format(at).replace(".", "");
    num = d;
    mon = monthFormat.format(at).replace(".", "");
    if (dateEnd && dateEnd !== date) {
      const [y2, m2, d2] = dateEnd.split("-");
      const end = weekdayFormat
        .format(new Date(Date.UTC(+y2, m2 - 1, +d2)))
        .replace(".", "");
      label = `${label} a ${end}`;
    }
  }
  return (
    <span className={`tn-marcador ${className}`.trim()} aria-hidden>
      <span className="tn-marcador-label">{label}</span>
      <span className="tn-marcador-num">{num}</span>
      <span className="tn-marcador-mes">{mon}</span>
    </span>
  );
}

/** Rango de fechas del torneo: "Sáb 07/11" o "Vie 06/11 al Dom 08/11". */
export function tournamentDates(t) {
  if (!t?.date) return "Sin fecha";
  if (t.dateEnd && t.dateEnd !== t.date)
    return `${dayLabel(t.date)} al ${dayLabel(t.dateEnd)}`;
  return dayLabel(t.date);
}

export function courtNamer(courts) {
  const map = Object.fromEntries((courts || []).map((c) => [c.id, c.name]));
  return (id) => map[id] || id || "";
}

/**
 * Nombre de un lado del partido: la pareja si ya se sabe, o "1° Zona A" /
 * "Ganador Semi 1" mientras tanto.
 */
export function sideInfo(
  calc,
  fixture,
  pairsById,
  src,
  { short = false } = {},
) {
  const id = calc.resolve(src);
  if (id && pairsById[id]) {
    return {
      id,
      name: short ? shortPairName(pairsById[id]) : pairName(pairsById[id]),
      tbd: false,
    };
  }
  return { id: null, name: sourceLabel(src, fixture.matches), tbd: true };
}

/**
 * Edita resultado y horario de un partido en el lugar.
 * onSave recibe { score, winner } o { date, time, court } y devuelve la respuesta del server.
 */
export function MatchEditor({
  match,
  sides,
  courts,
  defaultDate,
  mode = "result",
  onSave,
  onClose,
}) {
  const [score, setScore] = useState(match.score || "");
  const [winner, setWinner] = useState(match.winner || null);
  const [date, setDate] = useState(match.date || defaultDate || "");
  const [time, setTime] = useState(match.time || "");
  const [court, setCourt] = useState(match.court || courts?.[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const parsed = parseScore(score);
  const autoWinner = parsed.winner;

  async function submit(e) {
    e?.preventDefault();
    setSaving(true);
    const payload =
      mode === "result"
        ? { score, winner: autoWinner || winner }
        : { date, time, court };
    const ok = await onSave(payload);
    setSaving(false);
    if (ok) onClose();
  }

  if (mode === "schedule") {
    return (
      <form className="tn-result-editor" onSubmit={submit}>
        <input
          type="date"
          aria-label="Día"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          type="time"
          aria-label="Hora"
          value={time}
          step={300}
          onChange={(e) => setTime(e.target.value)}
        />
        <select
          aria-label="Cancha"
          value={court}
          onChange={(e) => setCourt(e.target.value)}
        >
          {(courts || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <BusyButton
          type="submit"
          className="btn btn-linear-primary"
          disabled={saving}
          busy={saving}
        >
          {saving ? "Guardando..." : "Guardar horario"}
        </BusyButton>
        {(match.date || match.time) && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const ok = await onSave({ date: "", time: "", court: "" });
              setSaving(false);
              if (ok) onClose();
            }}
          >
            Sacar horario
          </button>
        )}
        <button
          type="button"
          className="tn-icon-btn"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={15} />
        </button>
      </form>
    );
  }

  return (
    <form className="tn-result-editor" onSubmit={submit}>
      <input
        type="text"
        inputMode="numeric"
        autoFocus
        aria-label="Resultado"
        placeholder="6-4 6-3"
        value={score}
        onChange={(e) => setScore(e.target.value)}
      />
      {autoWinner ? (
        <span className="tn-muted">
          Ganó{" "}
          <strong>{autoWinner === "a" ? sides.a.name : sides.b.name}</strong>
        </span>
      ) : (
        <span className="tn-row" style={{ gap: 6 }}>
          <span className="tn-muted">¿Quién ganó?</span>
          {["a", "b"].map((k) => (
            <button
              key={k}
              type="button"
              className={`tn-icon-btn${winner === k ? " is-on" : ""}`}
              onClick={() => setWinner(k)}
              title="Para W.O. o abandono"
            >
              {sides[k].name.length > 22
                ? `${sides[k].name.slice(0, 22)}…`
                : sides[k].name}
            </button>
          ))}
        </span>
      )}
      <BusyButton
        type="submit"
        className="btn btn-linear-primary"
        disabled={saving || (!autoWinner && !winner && score.trim() !== "")}
        busy={saving}
      >
        {saving ? "Guardando..." : "Guardar"}
      </BusyButton>
      {match.winner && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const ok = await onSave({ score: "", winner: null });
            setSaving(false);
            if (ok) onClose();
          }}
        >
          Borrar resultado
        </button>
      )}
      <button
        type="button"
        className="tn-icon-btn"
        onClick={onClose}
        aria-label="Cerrar"
      >
        <X size={15} />
      </button>
    </form>
  );
}

/**
 * Un partido en lista: horario, quiénes juegan, resultado y botones para
 * cargar resultado o cambiar el horario.
 */
export function MatchRow({
  match,
  fixture,
  calc,
  pairsById,
  courts,
  courtName,
  categoryName,
  defaultDate,
  compact = false,
  slot = false,
  conflict = "",
  onSave,
}) {
  const [editing, setEditing] = useState(null); // "result" | "schedule" | null
  const a = sideInfo(calc, fixture, pairsById, match.a);
  const b = sideInfo(calc, fixture, pairsById, match.b);
  const ready = !a.tbd && !b.tbd;
  // Si el resultado no se entiende como sets (ej. "W.O."), va como texto.
  const rawScore =
    match.score && !parseScore(match.score).sets.length ? match.score : "";

  return (
    <div
      className={`tn-match${compact ? " is-compact" : ""}${slot ? " is-slot" : ""}${match.winner ? " is-played" : ""}${conflict ? " is-conflict" : ""}`}
    >
      {!compact && !slot && (
        <div className="tn-match-when">
          {match.time ? (
            <>
              <strong>{match.time}</strong>
              <span>{courtName(match.court)}</span>
            </>
          ) : (
            <span>Sin horario</span>
          )}
        </div>
      )}
      <div className="tn-match-sides">
        <span className="tn-match-tag">
          {categoryName && (
            <span className="tn-match-cat">{categoryName}</span>
          )}
          <span>{matchLabel(match)}</span>
          {slot && match.court && (
            <span className="tn-match-court">{courtName(match.court)}</span>
          )}
        </span>
        {compact && (
          <span className="tn-match-chip">
            {match.time
              ? `${dayLabel(match.date)} · ${match.time} · ${courtName(match.court)}`
              : "Sin horario"}
          </span>
        )}
        {[
          ["a", a],
          ["b", b],
        ].map(([k, side]) => (
          <span
            key={k}
            className={`tn-match-side${match.winner === k ? " is-winner" : ""}${match.winner && match.winner !== k ? " is-loser" : ""}${side.tbd ? " is-tbd" : ""}`}
          >
            <span className="tn-match-name">
              {match.winner === k && <span className="sr-only">Ganó: </span>}
              {side.name}
            </span>
            <SetScores score={match.score} side={k} className="tn-sets" />
          </span>
        ))}
        {conflict && <span className="tn-match-conflict">⚠ {conflict}</span>}
      </div>
      <div className="tn-match-actions">
        {rawScore && <span className="tn-score">{rawScore}</span>}
        <button
          type="button"
          className={`tn-icon-btn tn-result-btn${!match.winner && ready ? " is-due" : ""}`}
          onClick={() => setEditing(editing === "result" ? null : "result")}
          disabled={!ready}
          title={
            ready
              ? "Cargar resultado"
              : "Se define cuando terminen los partidos anteriores"
          }
        >
          <Pencil size={14} /> {match.winner ? "Editar" : "Resultado"}
        </button>
        <button
          type="button"
          className="tn-icon-btn"
          onClick={() => setEditing(editing === "schedule" ? null : "schedule")}
          title="Cambiar día, hora o cancha"
          aria-label="Cambiar horario"
        >
          <Clock size={14} />
        </button>
      </div>
      {editing && (
        <MatchEditor
          match={match}
          sides={{ a, b }}
          courts={courts}
          defaultDate={defaultDate}
          mode={editing}
          onSave={onSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/**
 * Resultado por set en casilleros, como un marcador: los sets que ganó ese
 * lado van resaltados. side = "a" | "b".
 */
export function SetScores({ score, side, className = "bk-sets" }) {
  const { sets } = parseScore(score);
  if (!sets.length) return null;
  const i = side === "a" ? 0 : 1;
  return (
    <span className={className}>
      {sets.map((s, k) => (
        <span key={k} className={s[i] > s[1 - i] ? "is-won" : ""}>
          {s[i]}
        </span>
      ))}
    </span>
  );
}

/**
 * Árbol del cuadro con líneas que unen cada par de partidos con el de la
 * ronda siguiente. Lo usan la pantalla y el PDF (cambia solo el estilo).
 * @param {{ rounds: {size:number, matches:object[]}[], renderMatch: (m:object)=>import("react").ReactNode, champion?: import("react").ReactNode, className?: string }} props
 */
export function BracketTree({ rounds, renderMatch, champion, className = "" }) {
  const template = `repeat(${rounds.length}, minmax(var(--bk-col), 1fr))${
    champion ? " minmax(var(--bk-champ-col), 0.75fr)" : ""
  }`;
  return (
    <div
      className={`bk ${className}`}
      style={{ gridTemplateColumns: template }}
    >
      {rounds.map((r, ri) => {
        const hasNext = ri < rounds.length - 1 || Boolean(champion);
        const groups =
          r.matches.length === 1
            ? [r.matches]
            : Array.from({ length: Math.ceil(r.matches.length / 2) }, (_, k) =>
                r.matches.slice(2 * k, 2 * k + 2),
              );
        return (
          <div key={r.size} className={`bk-col${hasNext ? " has-next" : ""}`}>
            <div className="bk-round">{roundName(r.size)}</div>
            <div className="bk-slots">
              {groups.map((g) => (
                <div
                  key={g[0].id}
                  className={g.length === 2 ? "bk-pair" : "bk-single"}
                >
                  {g.map((m) => (
                    <div key={m.id} className="bk-slot">
                      {renderMatch(m)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {champion && (
        <div className="bk-col bk-col-champion">
          <div className="bk-round">Campeón</div>
          <div className="bk-slots">
            <div className="bk-single">
              <div className="bk-slot">{champion}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
