// Lógica de torneos: categorías, sorteo de zonas, fixture de todos contra
// todos, tabla de posiciones, cuadro eliminatorio (cuartos, semis, final) y
// armado de horarios por cancha. Todo puro (sin Firebase ni React) para poder
// testearlo y usarlo igual en el admin y en el servidor.

/* ==========================================================================
   CATEGORÍAS Y PAREJAS
   ========================================================================== */

/** Atajos para elegir categoría al crear el torneo. */
export const CATEGORY_PRESETS = [
  "8va",
  "7ma",
  "6ta",
  "5ta",
  "4ta",
  "Damas",
  "Mixto",
  "Libre",
];

/** Torneos viejos (una sola categoría en texto) usan este id. */
export const LEGACY_CATEGORY_ID = "general";

const RECORD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const isId = (v) => typeof v === "string" && RECORD_ID.test(v);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GROUP_ID = /^[A-Z]$/;

const asList = (v) =>
  Array.isArray(v)
    ? v.filter((x) => x != null)
    : v && typeof v === "object"
      ? Object.values(v)
      : [];

/**
 * Categorías del torneo en orden. Un torneo sin categorías cargadas (los
 * creados antes de esta versión) tiene una sola, con el texto que tenía.
 * @returns {{ id: string, name: string }[]}
 */
export function tournamentCategories(t) {
  const raw = t?.categories;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const list = Object.entries(raw)
      .filter(([id, c]) => isId(id) && c && c.name)
      .map(([id, c]) => ({
        id,
        name: String(c.name),
        order: Number(c.order) || 0,
      }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    if (list.length) return list.map(({ id, name }) => ({ id, name }));
  }
  return [{ id: LEGACY_CATEGORY_ID, name: t?.category || "General" }];
}

/** Id de categoría de una pareja (las viejas, sin categoría, van a la primera). */
export function pairCategoryId(pair, categories) {
  const ids = categories.map((c) => c.id);
  return ids.includes(pair?.categoryId) ? pair.categoryId : ids[0];
}

export function pairsOfCategory(t, categoryId) {
  const categories = tournamentCategories(t);
  return (t?.players || []).filter(
    (p) => pairCategoryId(p, categories) === categoryId,
  );
}

/** "Juan Pérez / Pedro Gómez" */
export function pairName(p) {
  if (!p) return "";
  return p.partner ? `${p.name} / ${p.partner}` : p.name;
}

/** "J. Pérez / P. Gómez" para cuadros y el PDF, donde el lugar es poco. */
export function shortPairName(p) {
  if (!p) return "";
  const short = (full) => {
    const parts = String(full || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length < 2) return parts[0] || "";
    return `${parts[0][0].toUpperCase()}. ${parts.slice(1).join(" ")}`;
  };
  return p.partner ? `${short(p.name)} / ${short(p.partner)}` : short(p.name);
}

/**
 * Lee una lista pegada (de WhatsApp, una nota, una planilla): una pareja por
 * renglón. Acepta "Juan Pérez / Pedro Gómez 299 555-1234", "Juan y Pedro",
 * "1) Juan - Pedro", "Juan Pérez, Pedro Gómez, 2995551234".
 * @returns {{ name: string, partner: string, phone: string }[]}
 */
export function parsePairsList(text) {
  const out = [];
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    let line = rawLine
      .replace(/^\s*(?:[-*•·]|\d{1,3}\s*[).:-])\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!line) continue;

    // Teléfono: el último bloque con 8 o más dígitos.
    let phone = "";
    const phoneMatch = line.match(/(\+?\d[\d\s-]{6,}\d)\s*$/);
    if (phoneMatch && phoneMatch[1].replace(/\D/g, "").length >= 8) {
      phone = phoneMatch[1].trim();
      line = line
        .slice(0, phoneMatch.index)
        .replace(/[\s,;:-]+$/, "")
        .trim();
    }

    const parts = line
      .split(
        /\s*(?:\/|\||;|,|\s-\s|\s+y\s+|\s+e\s+|\s+&\s+|\s+con\s+|\s+vs\.?\s+)\s*/i,
      )
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) continue;
    out.push({
      name: parts[0].slice(0, 60),
      partner: (parts.slice(1).join(" ") || "").slice(0, 60),
      phone: phone.slice(0, 30),
    });
  }
  return out;
}

/* ==========================================================================
   SORTEO DE ZONAS
   ========================================================================== */

/**
 * Tamaños de las zonas para `n` parejas. Prefiere zonas del tamaño pedido
 * (3 o 4) y reparte el resto para que ninguna quede de 2.
 * planGroups(10, 3) → [4, 3, 3]; planGroups(8, 4) → [4, 4]
 */
export function planGroups(n, size = 3) {
  if (!Number.isFinite(n) || n < 2) return [];
  const pref = size >= 4 ? 4 : 3;
  let groups = pref === 3 ? Math.floor(n / 3) : Math.ceil(n / 4);
  groups = Math.max(1, Math.min(groups, 26));
  while (groups > 1 && n / groups < 3) groups -= 1;
  const base = Math.floor(n / groups);
  const extra = n % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < extra ? 1 : 0));
}

export const groupLetter = (i) => String.fromCharCode(65 + i);

function shuffle(list, random = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sortea las zonas. Las cabezas de serie (seed) van una por zona, en orden;
 * el resto se reparte al azar.
 * @param {{ id: string, seed?: number|boolean }[]} pairs
 * @returns {{ id: string, pairIds: string[] }[]}
 */
export function drawGroups(pairs, { size = 3, random = Math.random } = {}) {
  const sizes = planGroups(pairs.length, size);
  const groups = sizes.map((cap, i) => ({
    id: groupLetter(i),
    pairIds: [],
    cap,
  }));
  if (!groups.length) return [];

  const seeds = pairs
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.seed)
    .sort(
      (x, y) => (Number(x.p.seed) || 1) - (Number(y.p.seed) || 1) || x.i - y.i,
    )
    .map(({ p }) => p);
  const rest = shuffle(
    pairs.filter((p) => !p.seed),
    random,
  );

  // Cabezas de serie en serpentina: A, B, C, C, B, A...
  const G = groups.length;
  seeds.forEach((p, k) => {
    const lap = Math.floor(k / G);
    let g = lap % 2 === 0 ? k % G : G - 1 - (k % G);
    for (
      let tries = 0;
      groups[g].pairIds.length >= groups[g].cap && tries < G;
      tries += 1
    ) {
      g = (g + 1) % G;
    }
    groups[g].pairIds.push(p.id);
  });

  for (const p of rest) {
    let best = null;
    for (const g of groups) {
      const free = g.cap - g.pairIds.length;
      if (free > 0 && (!best || free > best.cap - best.pairIds.length))
        best = g;
    }
    (best || groups[0]).pairIds.push(p.id);
  }
  return groups.map(({ id, pairIds }) => ({ id, pairIds }));
}

/**
 * Todos contra todos por el método del círculo: en cada fecha nadie juega
 * dos veces y, en zonas de 3, cada pareja descansa entre partido y partido.
 * @returns {{ round: number, a: string, b: string }[]}
 */
export function roundRobin(ids) {
  const list = [...ids];
  if (list.length < 2) return [];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const out = [];
  for (let r = 0; r < n - 1; r += 1) {
    for (let i = 0; i < n / 2; i += 1) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) out.push({ round: r + 1, a, b });
    }
    list.splice(1, 0, list.pop());
  }
  return out;
}

/* ==========================================================================
   CUADRO ELIMINATORIO
   ========================================================================== */

export function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Nombre de la ronda según cuántas parejas la juegan. */
export function roundName(size) {
  if (size <= 2) return "Final";
  if (size === 4) return "Semifinal";
  if (size === 8) return "Cuartos de final";
  if (size === 16) return "Octavos de final";
  return `${size / 2}avos de final`;
}

export function roundShortName(size) {
  if (size <= 2) return "Final";
  if (size === 4) return "Semi";
  if (size === 8) return "Cuartos";
  if (size === 16) return "Octavos";
  return `${size / 2}avos`;
}

/** Orden clásico de siembra: 1 y 2 solo se cruzan en la final. */
export function seedPositions(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

const sameGroup = (x, y) => x?.group && y?.group && x.group === y.group;

/**
 * Arma el cuadro a partir de las parejas clasificadas, en orden de siembra
 * (primero todos los 1°, después los 2°...). Si no son potencia de 2, los
 * mejores pasan directo (bye). Evita que dos de la misma zona se crucen en la
 * primera ronda.
 * @param {object[]} entrants fuentes: { group, pos } | { pair }
 * @returns {object[]} partidos del cuadro
 */
export function buildBracket(entrants) {
  const n = entrants.length;
  if (n < 2) return [];
  const size = nextPow2(n);
  const slots = seedPositions(size).map((seed) =>
    seed <= n ? { ...entrants[seed - 1] } : { bye: true },
  );

  // Dos de la misma zona tienen que cruzarse lo más tarde posible (ideal:
  // recién en la final). Los 1° quedan fijos en su lugar de siembra; a los
  // demás se los intercambia mientras eso mejore el cuadro.
  const levels = Math.log2(size);
  const meetRound = (i, j) => {
    let k = 0;
    while (i >> k !== j >> k) k += 1;
    return k; // 1 = primera ronda ... levels = final
  };
  const cost = () => {
    let total = 0;
    for (let i = 0; i < size; i += 1) {
      for (let j = i + 1; j < size; j += 1) {
        if (sameGroup(slots[i], slots[j]))
          total += 4 ** (levels - meetRound(i, j));
      }
    }
    return total;
  };
  const movable = slots
    .map((s, i) => (s.group && s.pos > 1 ? i : -1))
    .filter((i) => i >= 0);
  let best = cost();
  for (
    let improved = true, guard = 0;
    improved && best > 0 && guard < 50;
    guard += 1
  ) {
    improved = false;
    for (let x = 0; x < movable.length; x += 1) {
      for (let y = x + 1; y < movable.length; y += 1) {
        const i = movable[x];
        const j = movable[y];
        [slots[i], slots[j]] = [slots[j], slots[i]];
        const c = cost();
        if (c < best) {
          best = c;
          improved = true;
        } else {
          [slots[i], slots[j]] = [slots[j], slots[i]];
        }
      }
    }
  }

  const matches = [];
  let prev = [];
  for (let roundSize = size; roundSize >= 2; roundSize /= 2) {
    const count = roundSize / 2;
    const current = [];
    for (let i = 0; i < count; i += 1) {
      const id = `R${roundSize}_${i + 1}`;
      const m =
        roundSize === size
          ? {
              id,
              stage: "bracket",
              size: roundSize,
              index: i,
              a: slots[2 * i],
              b: slots[2 * i + 1],
            }
          : {
              id,
              stage: "bracket",
              size: roundSize,
              index: i,
              a: { from: prev[2 * i].id },
              b: { from: prev[2 * i + 1].id },
            };
      current.push(m);
      matches.push(m);
    }
    prev = current;
  }
  return matches;
}

/* ==========================================================================
   FIXTURE COMPLETO DE UNA CATEGORÍA
   ========================================================================== */

/**
 * Arma el fixture de una categoría: zonas + partidos de zona + cuadro.
 * @param {{ format: "zonas"|"directo", groups?: {id:string,pairIds:string[]}[], pairs?: {id:string,seed?:any}[], qualify?: number, groupSize?: number, random?: () => number }} opts
 */
export function buildFixture({
  format = "zonas",
  groups = [],
  pairs = [],
  qualify = 2,
  groupSize = 3,
  random = Math.random,
}) {
  const matches = {};
  if (format === "directo") {
    const seeds = pairs.filter((p) => p.seed);
    const rest = shuffle(
      pairs.filter((p) => !p.seed),
      random,
    );
    const ordered = [...seeds, ...rest];
    for (const m of buildBracket(ordered.map((p) => ({ pair: p.id }))))
      matches[m.id] = m;
    return {
      format,
      groupSize,
      qualify: 0,
      groups: [],
      matches,
      createdAt: Date.now(),
    };
  }

  for (const g of groups) {
    roundRobin(g.pairIds).forEach((rm, k) => {
      const id = `G${g.id}${k + 1}`;
      matches[id] = {
        id,
        stage: "group",
        group: g.id,
        round: rm.round,
        a: { pair: rm.a },
        b: { pair: rm.b },
      };
    });
  }
  const minSize = Math.min(...groups.map((g) => g.pairIds.length));
  const q = Math.max(0, Math.min(Number(qualify) || 0, minSize));
  const entrants = [];
  for (let pos = 1; pos <= q; pos += 1) {
    for (const g of groups) entrants.push({ group: g.id, pos });
  }
  for (const m of buildBracket(entrants)) matches[m.id] = m;
  return {
    format: "zonas",
    groupSize,
    qualify: q,
    groups: groups.map((g) => ({ id: g.id, pairIds: [...g.pairIds] })),
    matches,
    createdAt: Date.now(),
  };
}

/** Lo que le pasa al dueño del club en palabras: "3 zonas · 6 clasifican · cuartos". */
export function describePlan(
  n,
  { format = "zonas", groupSize = 3, qualify = 2 } = {},
) {
  if (n < 2) return "Hacen falta al menos 2 parejas para armar el torneo.";
  if (format === "directo") {
    const size = nextPow2(n);
    const byes = size - n;
    return `Cuadro de ${size}: arranca en ${roundName(size).toLowerCase()}${
      byes
        ? ` (${byes} ${byes === 1 ? "pareja pasa" : "parejas pasan"} directo)`
        : ""
    }.`;
  }
  const sizes = planGroups(n, groupSize);
  const counts = {};
  sizes.forEach((s) => (counts[s] = (counts[s] || 0) + 1));
  const zonas = Object.entries(counts)
    .sort((a, b) => b[0] - a[0])
    .map(([s, c]) => `${c} ${c === 1 ? "zona" : "zonas"} de ${s}`)
    .join(" y ");
  const q = Math.min(qualify, Math.min(...sizes));
  const total = sizes.length * q;
  const groupMatches = sizes.reduce((sum, s) => sum + (s * (s - 1)) / 2, 0);
  if (total < 2)
    return `${zonas} · ${groupMatches} partidos de zona. Sin cuadro final.`;
  const size = nextPow2(total);
  const byes = size - total;
  return `${zonas} · ${groupMatches} partidos de zona · clasifican ${total} → ${roundName(size).toLowerCase()}${
    byes ? ` (${byes} pasan directo)` : ""
  }.`;
}

/* ==========================================================================
   RESULTADOS Y POSICIONES
   ========================================================================== */

/**
 * "6-4 3-6 10-8" → { sets: [[6,4],[3,6],[10,8]], winner: "a" }.
 * Acepta "6/4", "6:4", comas. Sin sets válidos devuelve sets [] y winner null.
 */
export function parseScore(text) {
  const sets = [];
  const re = /(\d{1,2})\s*[-/:]\s*(\d{1,2})/g;
  let m;
  while ((m = re.exec(String(text || ""))) && sets.length < 5) {
    sets.push([Number(m[1]), Number(m[2])]);
  }
  let wa = 0;
  let wb = 0;
  for (const [x, y] of sets) {
    if (x > y) wa += 1;
    else if (y > x) wb += 1;
  }
  return { sets, winner: wa > wb ? "a" : wb > wa ? "b" : null };
}

export function isByeMatch(m) {
  return m?.stage === "bracket" && Boolean(m.a?.bye || m.b?.bye);
}

/** Partidos en un orden útil: zonas por fecha, después cuadro de mayor a menor. */
export function sortedMatches(fixture) {
  return Object.values(fixture?.matches || {}).sort((x, y) => {
    if (x.stage !== y.stage) return x.stage === "group" ? -1 : 1;
    if (x.stage === "group") {
      return (
        (x.round || 0) - (y.round || 0) ||
        String(x.group).localeCompare(String(y.group)) ||
        x.id.localeCompare(y.id)
      );
    }
    return (y.size || 0) - (x.size || 0) || (x.index || 0) - (y.index || 0);
  });
}

/**
 * Tablas de posiciones, quién juega cada partido del cuadro y quién ganó.
 * @param {object} fixture
 */
export function computeFixture(fixture) {
  const matches = fixture?.matches || {};
  const groups = fixture?.groups || [];
  const groupMatches = {};
  for (const m of Object.values(matches)) {
    if (m.stage === "group") (groupMatches[m.group] ||= []).push(m);
  }

  const standings = {};
  const groupDone = {};
  for (const g of groups) {
    const rows = new Map(
      g.pairIds.map((id) => [
        id,
        {
          pairId: id,
          played: 0,
          won: 0,
          lost: 0,
          setsFor: 0,
          setsAgainst: 0,
          gamesFor: 0,
          gamesAgainst: 0,
        },
      ]),
    );
    const list = groupMatches[g.id] || [];
    for (const m of list) {
      if (!m.winner) continue;
      const ra = rows.get(m.a?.pair);
      const rb = rows.get(m.b?.pair);
      if (!ra || !rb) continue;
      const { sets } = parseScore(m.score);
      ra.played += 1;
      rb.played += 1;
      if (m.winner === "a") {
        ra.won += 1;
        rb.lost += 1;
      } else {
        rb.won += 1;
        ra.lost += 1;
      }
      for (const [x, y] of sets) {
        ra.gamesFor += x;
        ra.gamesAgainst += y;
        rb.gamesFor += y;
        rb.gamesAgainst += x;
        if (x > y) {
          ra.setsFor += 1;
          rb.setsAgainst += 1;
        } else if (y > x) {
          rb.setsFor += 1;
          ra.setsAgainst += 1;
        }
      }
    }
    const headToHead = (x, y) => {
      const m = list.find(
        (mm) =>
          mm.winner &&
          ((mm.a?.pair === x && mm.b?.pair === y) ||
            (mm.a?.pair === y && mm.b?.pair === x)),
      );
      if (!m) return 0;
      const winnerId = m.winner === "a" ? m.a.pair : m.b.pair;
      return winnerId === x ? -1 : 1;
    };
    const table = [...rows.values()].sort((x, y) => {
      if (y.won !== x.won) return y.won - x.won;
      const tied = [...rows.values()].filter((r) => r.won === x.won).length;
      if (tied === 2) {
        const h = headToHead(x.pairId, y.pairId);
        if (h) return h;
      }
      const sd = y.setsFor - y.setsAgainst - (x.setsFor - x.setsAgainst);
      if (sd) return sd;
      const gd = y.gamesFor - y.gamesAgainst - (x.gamesFor - x.gamesAgainst);
      if (gd) return gd;
      return y.gamesFor - x.gamesFor;
    });
    standings[g.id] = table;
    groupDone[g.id] = list.length > 0 && list.every((m) => m.winner);
  }

  const cache = new Map();
  /** pairId que ocupa esa fuente, o null si todavía no se sabe. */
  function resolve(src, depth = 0) {
    if (!src || depth > 12) return null;
    if (src.pair) return src.pair;
    if (src.bye) return null;
    if (src.group) {
      if (!groupDone[src.group]) return null;
      return standings[src.group]?.[src.pos - 1]?.pairId || null;
    }
    if (src.from) return winnerOf(matches[src.from], depth + 1);
    return null;
  }
  function winnerOf(m, depth = 0) {
    if (!m) return null;
    if (cache.has(m.id)) return cache.get(m.id);
    let w = null;
    if (m.a?.bye) w = resolve(m.b, depth);
    else if (m.b?.bye) w = resolve(m.a, depth);
    else if (m.winner === "a") w = resolve(m.a, depth);
    else if (m.winner === "b") w = resolve(m.b, depth);
    cache.set(m.id, w);
    return w;
  }

  return {
    standings,
    groupDone,
    resolve,
    winnerOf,
    sides: (m) => ({ a: resolve(m.a), b: resolve(m.b) }),
  };
}

/** Nombre corto del partido: "Zona A · Fecha 2", "Cuartos 3", "Final". */
export function matchLabel(m) {
  if (!m) return "";
  if (m.stage === "group") return `Zona ${m.group} · Fecha ${m.round}`;
  return m.size <= 2 ? "Final" : `${roundShortName(m.size)} ${m.index + 1}`;
}

/** Texto para una fuente todavía sin pareja: "1° Zona A", "Ganador Semi 1". */
export function sourceLabel(src, matches) {
  if (!src) return "A definir";
  if (src.bye) return "Pasa directo";
  if (src.group) return `${src.pos}° Zona ${src.group}`;
  if (src.from) {
    const m = matches?.[src.from];
    if (isByeMatch(m)) {
      const real = m.a?.bye ? m.b : m.a;
      return sourceLabel(real, matches);
    }
    return `Ganador ${matchLabel(m)}`;
  }
  return "A definir";
}

/* ==========================================================================
   HORARIOS
   ========================================================================== */

export const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || "")
    .split(":")
    .map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const fromMinutes = (min) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Reparte los partidos en canchas y horarios. Respeta que:
 *  - una pareja no juegue dos partidos a la vez (y si se puede, que descanse
 *    un turno entre partido y partido);
 *  - el cuadro arranque cuando terminó la zona que lo alimenta, y cada ronda
 *    después de la anterior;
 *  - los horarios ya ocupados (partidos jugados o de otras categorías) no se
 *    pisen.
 *
 * @param {{ key: string, pairs: string[], deps: string[] }[]} items en orden de prioridad
 * @param {{ days: {date:string,from:string,to:string}[], duration: number, courts: string[], occupied?: {date:string,time:string,court:string,pairs?:string[]}[], done?: string[] }} opts
 * @returns {{ assigned: Record<string,{date:string,time:string,court:string}>, unscheduled: string[] }}
 */
export function scheduleMatches(
  items,
  { days = [], duration = 60, courts = [], occupied = [], done = [] } = {},
) {
  const assigned = {};
  const slotOf = {}; // key → índice de turno
  const doneSet = new Set(done);
  const dur = Math.max(15, Math.min(240, Number(duration) || 60));

  // Turnos en orden cronológico.
  const slots = [];
  for (const d of [...days].sort((x, y) =>
    x.date < y.date ? -1 : x.date > y.date ? 1 : 0,
  )) {
    if (
      !ISO_DATE.test(d.date || "") ||
      !TIME.test(d.from || "") ||
      !TIME.test(d.to || "")
    )
      continue;
    for (let t = toMinutes(d.from); t <= toMinutes(d.to); t += dur) {
      slots.push({
        date: d.date,
        time: fromMinutes(t),
        dayStart: t === toMinutes(d.from),
      });
    }
  }

  const occupiedAt = new Map(); // "fecha hora" → { courts:Set, pairs:Set }
  const cell = (s) => {
    const k = `${s.date} ${s.time}`;
    if (!occupiedAt.has(k))
      occupiedAt.set(k, { courts: new Set(), pairs: new Set() });
    return occupiedAt.get(k);
  };
  for (const o of occupied) {
    const c = cell(o);
    if (o.court) c.courts.add(o.court);
    for (const p of o.pairs || []) c.pairs.add(p);
  }

  const pending = items.filter((it) => !doneSet.has(it.key));
  for (let si = 0; si < slots.length && pending.length; si += 1) {
    const s = slots[si];
    const c = cell(s);
    const prev = si > 0 && !s.dayStart ? cell(slots[si - 1]) : null;
    const freeCourts = courts.filter((ct) => !c.courts.has(ct));
    if (!freeCourts.length) continue;

    const ready = (it) =>
      it.deps.every(
        (d) => doneSet.has(d) || (slotOf[d] !== undefined && slotOf[d] < si),
      ) && it.pairs.every((p) => !c.pairs.has(p));

    for (const strict of [true, false]) {
      for (let i = 0; i < pending.length && freeCourts.length; i += 1) {
        const it = pending[i];
        if (!ready(it)) continue;
        if (strict && prev && it.pairs.some((p) => prev.pairs.has(p))) continue;
        const court = freeCourts.shift();
        assigned[it.key] = { date: s.date, time: s.time, court };
        slotOf[it.key] = si;
        c.courts.add(court);
        for (const p of it.pairs) c.pairs.add(p);
        pending.splice(i, 1);
        i -= 1;
      }
    }
  }
  return { assigned, unscheduled: pending.map((it) => it.key) };
}

/**
 * Items para scheduleMatches a partir de los fixtures de varias categorías.
 * La clave de cada partido es "categoria/partido". Los partidos con bye no
 * se programan (no se juegan).
 * @param {{ categoryId: string, fixture: object }[]} list
 */
export function scheduleItems(list) {
  const items = [];
  list.forEach(({ categoryId, fixture }, catIndex) => {
    const matches = fixture?.matches || {};
    const key = (id) => `${categoryId}/${id}`;
    const groupKeys = {};
    for (const m of Object.values(matches)) {
      if (m.stage === "group") (groupKeys[m.group] ||= []).push(key(m.id));
    }
    const depsOf = (src) => {
      if (!src || src.pair || src.bye) return [];
      if (src.group) return groupKeys[src.group] || [];
      if (src.from) {
        const m = matches[src.from];
        if (!m) return [];
        if (isByeMatch(m)) return depsOf(m.a?.bye ? m.b : m.a);
        return [key(m.id)];
      }
      return [];
    };
    for (const m of Object.values(matches)) {
      if (isByeMatch(m)) continue;
      const pairs = [m.a?.pair, m.b?.pair].filter(Boolean);
      items.push({
        key: key(m.id),
        categoryId,
        matchId: m.id,
        pairs: pairs.map((p) => `${categoryId}:${p}`),
        deps: [...depsOf(m.a), ...depsOf(m.b)],
        // Zonas: fecha 1 de todas las categorías, después fecha 2...; cuadro al final.
        order:
          m.stage === "group"
            ? [0, m.round || 0, catIndex, m.group, m.id]
            : [1, -(m.size || 0), catIndex, m.index || 0, m.id],
      });
    }
  });
  const cmp = (x, y) => {
    for (let i = 0; i < x.order.length; i += 1) {
      if (x.order[i] < y.order[i]) return -1;
      if (x.order[i] > y.order[i]) return 1;
    }
    return 0;
  };
  return items.sort(cmp);
}

/* ==========================================================================
   VALIDACIÓN (servidor) Y NORMALIZACIÓN (lo que vuelve de Firebase)
   ========================================================================== */

function cleanSource(src, pairIds, matchIds) {
  if (!src || typeof src !== "object") return null;
  if (src.bye === true) return { bye: true };
  if (isId(src.pair) && pairIds.has(src.pair)) return { pair: src.pair };
  if (typeof src.group === "string" && GROUP_ID.test(src.group)) {
    const pos = Number(src.pos);
    if (Number.isInteger(pos) && pos >= 1 && pos <= 8)
      return { group: src.group, pos };
  }
  if (isId(src.from) && matchIds.has(src.from)) return { from: src.from };
  return null;
}

/** Datos de horario y resultado de un partido, limpios. */
export function cleanMatchInfo(input = {}) {
  const out = {};
  if ("date" in input)
    out.date = ISO_DATE.test(input.date || "") ? input.date : null;
  if ("time" in input)
    out.time = TIME.test(input.time || "") ? input.time : null;
  if ("court" in input) out.court = isId(input.court) ? input.court : null;
  if ("score" in input)
    out.score =
      String(input.score || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40) || null;
  if ("winner" in input)
    out.winner =
      input.winner === "a" || input.winner === "b" ? input.winner : null;
  return out;
}

/**
 * Valida un fixture que manda el navegador antes de guardarlo. Devuelve el
 * fixture limpio o null si algo no cierra.
 * @param {object} input
 * @param {string[]} validPairIds parejas de esa categoría
 */
export function sanitizeFixture(input, validPairIds) {
  if (!input || typeof input !== "object") return null;
  const pairIds = new Set(validPairIds);
  const format = input.format === "directo" ? "directo" : "zonas";

  const seen = new Set();
  const groups = [];
  for (const g of asList(input.groups).slice(0, 26)) {
    if (!g || !GROUP_ID.test(g.id || "") || groups.some((x) => x.id === g.id))
      return null;
    const ids = asList(g.pairIds).filter(
      (id) => isId(id) && pairIds.has(id) && !seen.has(id),
    );
    ids.forEach((id) => seen.add(id));
    if (ids.length < 1 || ids.length > 8) return null;
    groups.push({ id: g.id, pairIds: ids });
  }
  if (format === "zonas" && !groups.length) return null;

  const rawMatches = asList(input.matches).slice(0, 300);
  const matchIds = new Set(rawMatches.map((m) => m?.id).filter(isId));
  const groupIds = new Set(groups.map((g) => g.id));
  const matches = {};
  for (const m of rawMatches) {
    if (!m || !isId(m.id) || matches[m.id]) return null;
    const a = cleanSource(m.a, pairIds, matchIds);
    const b = cleanSource(m.b, pairIds, matchIds);
    if (!a || !b) return null;
    const base = { id: m.id, a, b, ...cleanMatchInfo(m) };
    if (m.stage === "group") {
      if (!groupIds.has(m.group) || !a.pair || !b.pair) return null;
      matches[m.id] = {
        ...base,
        stage: "group",
        group: m.group,
        round: Math.max(1, Math.min(20, Number(m.round) || 1)),
      };
    } else if (m.stage === "bracket") {
      const size = Number(m.size);
      if (![2, 4, 8, 16, 32, 64].includes(size)) return null;
      matches[m.id] = {
        ...base,
        stage: "bracket",
        size,
        index: Math.max(0, Math.min(31, Number(m.index) || 0)),
      };
    } else {
      return null;
    }
  }
  // Firebase no guarda null: se sacan las claves vacías.
  for (const m of Object.values(matches)) {
    for (const k of Object.keys(m)) if (m[k] == null) delete m[k];
  }

  return {
    format,
    groupSize: Number(input.groupSize) >= 4 ? 4 : 3,
    qualify: Math.max(0, Math.min(8, Number(input.qualify) || 0)),
    groups,
    matches,
    createdAt: Date.now(),
  };
}

/** Lo que vuelve de Firebase (arrays que se hacen objetos, vacíos que faltan). */
export function normalizeFixture(raw) {
  if (!raw || typeof raw !== "object") return null;
  const groups = asList(raw.groups)
    .filter((g) => g && g.id)
    .map((g) => ({ id: g.id, pairIds: asList(g.pairIds) }));
  const matches = {};
  for (const [id, m] of Object.entries(raw.matches || {})) {
    if (m && typeof m === "object") matches[id] = { ...m, id };
  }
  return {
    format: raw.format === "directo" ? "directo" : "zonas",
    groupSize: Number(raw.groupSize) || 3,
    qualify: Number(raw.qualify) || 0,
    groups,
    matches,
    createdAt: raw.createdAt || 0,
  };
}

/* ==========================================================================
   TEXTO PARA WHATSAPP
   ========================================================================== */

/**
 * Zonas y partidos de una categoría listos para pegar en el grupo de WhatsApp.
 * @param {{ tournamentName: string, categoryName: string, fixture: object, pairsById: Record<string, object>, courtName?: (id:string)=>string, dateLabel?: (iso:string)=>string }} opts
 */
export function fixtureWhatsappText({
  tournamentName,
  categoryName,
  fixture,
  pairsById,
  courtName = (c) => c,
  dateLabel = (d) => d,
}) {
  if (!fixture) return "";
  const calc = computeFixture(fixture);
  const name = (src) => {
    const id = calc.resolve(src);
    return id ? pairName(pairsById[id]) : sourceLabel(src, fixture.matches);
  };
  const when = (m) =>
    [
      m.date && dateLabel(m.date),
      m.time && `${m.time} hs`,
      m.court && courtName(m.court),
    ]
      .filter(Boolean)
      .join(" · ");
  const lines = [`🏆 *${tournamentName}* — ${categoryName}`, ""];
  for (const g of fixture.groups) {
    lines.push(`*ZONA ${g.id}*`);
    g.pairIds.forEach((id, i) =>
      lines.push(`${i + 1}. ${pairName(pairsById[id])}`),
    );
    for (const m of sortedMatches(fixture).filter(
      (x) => x.stage === "group" && x.group === g.id,
    )) {
      const w = when(m);
      lines.push(
        `  ▸ ${name(m.a)} vs ${name(m.b)}${w ? ` — ${w}` : ""}${m.score ? ` (${m.score})` : ""}`,
      );
    }
    lines.push("");
  }
  const bracket = sortedMatches(fixture).filter(
    (m) => m.stage === "bracket" && !isByeMatch(m),
  );
  if (bracket.length) {
    lines.push("*CUADRO FINAL*");
    let lastSize = null;
    for (const m of bracket) {
      if (m.size !== lastSize) {
        lines.push(`_${roundName(m.size)}_`);
        lastSize = m.size;
      }
      const w = when(m);
      lines.push(
        `  ▸ ${name(m.a)} vs ${name(m.b)}${w ? ` — ${w}` : ""}${m.score ? ` (${m.score})` : ""}`,
      );
    }
  }
  return lines.join("\n").trim();
}

/* ==========================================================================
   INSCRIPCIÓN DESDE LA WEB
   ========================================================================== */

export const MAX_TOURNAMENT_PAIRS = 128;

const PHONE = /^[+\d\s().-]{6,30}$/;
const cleanText = (v, max) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
const phoneDigits = (v) => String(v || "").replace(/\D/g, "");

/**
 * Lo que ve el público de un torneo: nombre, fechas, precio y cuántas parejas
 * hay por categoría. Nombres y teléfonos de los inscriptos quedan en la base.
 */
export function toPublicTournament(id, t) {
  const players = asList(t?.players);
  const list = tournamentCategories(t);
  const categories = list.map((c) => ({
    ...c,
    pairs: players.filter((p) => pairCategoryId(p, list) === c.id).length,
  }));
  return {
    id,
    name: String(t?.name || "Torneo"),
    date: ISO_DATE.test(t?.date || "") ? t.date : "",
    dateEnd: ISO_DATE.test(t?.dateEnd || "") ? t.dateEnd : "",
    price: Math.max(0, Math.round(Number(t?.price) || 0)),
    status: String(t?.status || "abierto"),
    categories,
  };
}

/**
 * Torneos con la inscripción abierta que todavía no terminaron, el más
 * próximo primero (los que no tienen fecha, al final).
 * @param {Record<string, object>|null} raw  nodo `tournaments` de la base
 * @param {string} today "YYYY-MM-DD" en hora del club
 */
export function openTournamentsForWeb(raw, today) {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .filter(([id, t]) => isId(id) && t && typeof t === "object")
    .map(([id, t]) => toPublicTournament(id, t))
    .filter((t) => t.status === "abierto")
    .filter((t) => !t.date || (t.dateEnd || t.date) >= today)
    .sort((a, b) => {
      if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : 0;
      return a.date.localeCompare(b.date);
    });
}

/** Valida el formulario público de inscripción (sin mirar la base). */
export function validateTournamentSignup(input = {}) {
  const tournamentId = input.tournamentId;
  const categoryId = input.categoryId;
  if (!isId(tournamentId) || !isId(categoryId)) {
    return { ok: false, error: "Elegí el torneo y la categoría." };
  }
  const name = cleanText(input.name, 60);
  const partner = cleanText(input.partner, 60);
  const phone = cleanText(input.phone, 30);
  if (name.length < 2) return { ok: false, error: "Ingresá tu nombre y apellido." };
  if (partner.length < 2) {
    return { ok: false, error: "Ingresá el nombre y apellido de tu compañero/a." };
  }
  if (!PHONE.test(phone) || phoneDigits(phone).length < 8) {
    return { ok: false, error: "Ingresá un WhatsApp válido (con código de área)." };
  }
  return { ok: true, value: { tournamentId, categoryId, name, partner, phone } };
}

/**
 * ¿Se puede anotar esta pareja en el torneo (ya leído de la base)?
 * Frena torneos cerrados, categorías que no existen, el tope de parejas y
 * el mismo WhatsApp anotado dos veces en la misma categoría.
 */
export function checkTournamentSignup(t, { categoryId, phone }) {
  if (!t || typeof t !== "object") return { ok: false, error: "El torneo no existe." };
  if ((t.status || "abierto") !== "abierto") {
    return { ok: false, error: "La inscripción de este torneo ya cerró." };
  }
  const categories = tournamentCategories(t);
  if (!categories.some((c) => c.id === categoryId)) {
    return { ok: false, error: "Esa categoría no existe en el torneo." };
  }
  const players = asList(t.players);
  if (players.length >= MAX_TOURNAMENT_PAIRS) {
    return { ok: false, error: "El torneo ya no tiene lugar." };
  }
  const digits = phoneDigits(phone).slice(-8);
  const repeated = players.some(
    (p) =>
      pairCategoryId(p, categories) === categoryId &&
      phoneDigits(p.phone).slice(-8) === digits,
  );
  if (repeated) {
    return { ok: false, error: "Ya hay una pareja anotada con ese WhatsApp en esta categoría." };
  }
  return { ok: true };
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * Fechas del torneo para la web: "Sábado 7 de noviembre",
 * "Sábado 7 y domingo 8 de noviembre", "Del viernes 6 al domingo 8 de
 * noviembre", "Del viernes 30 de octubre al
 * domingo 1 de noviembre" o "Fecha a confirmar".
 */
export function tournamentDateText(date, dateEnd) {
  if (!ISO_DATE.test(date || "")) return "Fecha a confirmar";
  const parts = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return { wd, d, month: MONTHS[m - 1], m };
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const a = parts(date);
  if (!ISO_DATE.test(dateEnd || "") || dateEnd <= date) {
    return cap(`${a.wd} ${a.d} de ${a.month}`);
  }
  const b = parts(dateEnd);
  if (a.m !== b.m) {
    return `Del ${a.wd} ${a.d} de ${a.month} al ${b.wd} ${b.d} de ${b.month}`;
  }
  if (addDays(date, 1) === dateEnd) {
    return cap(`${a.wd} ${a.d} y ${b.wd} ${b.d} de ${a.month}`);
  }
  return `Del ${a.wd} ${a.d} al ${b.wd} ${b.d} de ${a.month}`;
}
