// The lick library as data (docs/RECIPE-LAB.md): every named lick lives in src/recipes/licks.json, one entry each,
// with what it is (notes, player, speed, minor or major) and what Paul marks on it (its job in a solo, genres,
// moods, energy, credit, notes). The app plays the "live" licks (Guitar 2, src/parts/licks.ts), in file order;
// "draft" licks are only heard in the recipe lab until they are switched on.
// Kept free of the browser and the rest of the app: the recipe lab, the check and the dev server's save hook
// (vite.config.ts) all read and write the file through here.

export type Speed = 'slow' | 'mid' | 'fast';
/** The lead player kinds (src/players/lead.ts, LickKind). */
export const WHO = ['sung', 'blues', 'run', 'simple', 'muted'] as const;
export type Who = (typeof WHO)[number];
export const SPEEDS: Speed[] = ['slow', 'mid', 'fast'];
export const QS = ['min', 'maj', 'any'] as const;
export const STATUSES = ['live', 'draft'] as const;
/** A lick's job in a solo (the story's parts, docs/SOLO-STORY.md). */
export const ROLES = ['phrase', 'lead-in', 'tag', 'fill', 'build', 'ramp', 'peak', 'release', 'ending'] as const;
export const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'] as const;
export const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
export type Role = (typeof ROLES)[number];

/** One note of a lick, parsed. `semi`: the note (as it sounds, after any bend) above the chord's root. */
export interface LibNote {
  pos: number;
  semi: number;
  len: number;
  /** Bent up into it this many semitones. */
  bend?: number;
  /** The bend let down again (with `bend`), or a pre-bend released (without). */
  unbend?: number;
  art?: 'pick' | 'legato' | 'slide';
  /** A second note under it this many semitones (0: a unison bend, 12: an octave); any bend is on the lower note. */
  dyad?: number;
  trill?: number;
  tremolo?: boolean;
  rake?: boolean;
  /** A muted ghost note. */
  dead?: boolean;
  /** A passing note outside the key the lick means (a blue note, a chromatic step). */
  out?: boolean;
  /** Wide vibrato. */
  vib?: boolean;
  /** A pinch harmonic (the squeal over the picked note) or a natural harmonic (a chime at the note), docs/GUITAR-SOUNDS.md. */
  harm?: 'pinch' | 'natural';
  /** A whammy dive through the end of the note, this many semitones. */
  dive?: number;
  /** Feedback taking the held note over, this many semitones up. */
  feedback?: number;
  /** A pick scrape into the note, this many 16ths long. */
  scrape?: number;
  /** The string it is fingered on in the tab (1 high E to 6 low E): only for showing the tab, the app picks its own. */
  str?: number;
}

/** A lick as stored in the file. */
export interface LickEntry {
  id: string;
  name: string;
  status: (typeof STATUSES)[number];
  who: Who[];
  speed: Speed;
  /** Over minor chords, major chords, or either. */
  q: (typeof QS)[number];
  /** Notes as "pos:semi:len:techniques" (see `parseNotes`). */
  notes: string;
  role?: Role[];
  genres?: string[];
  moods?: string[];
  /** 1 calm to 5 wild. */
  energy?: number;
  /** The player it comes from or sounds like. */
  credit?: string;
  /** Where it was found (a doc, a lesson, own idea). */
  source?: string;
  /** Free notes. */
  about?: string;
}

export interface LickFile { about: string; licks: LickEntry[] }

/**
 * Notes as "pos:semi:len:techniques", techniques comma-separated: bN bent up N, rN let down N, pbN
 * pre-bent N and released, h hammered/pulled (legato), s slid, d-N a second note N below (d-0 a unison
 * bend, d-12 an octave), trN trilled N above, trem tremolo picked, rk raked, x ghost, c a passing
 * note outside the key, v wide vibrato, ph a pinch harmonic, nh a natural harmonic, dvN a whammy dive N
 * down, fbN feedback N up, scN a pick scrape N 16ths long into it, @N fingered on string N (the tab only).
 * Throws on anything it doesn't know, so a typo can't slip into the library.
 */
export function parseNotes(src: string): LibNote[] {
  return src.trim().split(/\s+/).map((tok) => {
    const [pos, semi, len, tech = '', ...more] = tok.split(':');
    if (more.length || !isInt(pos) || !isInt(semi) || !isInt(len)) throw new Error(`"${tok}": a note is pos:semi:len:techniques`);
    const n: LibNote = { pos: +pos, semi: +semi, len: +len };
    for (const t of tech.split(',').filter(Boolean)) {
      const num = (k: number) => { const v = t.slice(k); if (!isInt(v)) throw new Error(`"${tok}": "${t}" needs a number`); return +v; };
      if (t.startsWith('pb')) n.unbend = num(2);
      else if (t === 'trem') n.tremolo = true;
      else if (t === 'rk') n.rake = true;
      else if (t === 'ph') n.harm = 'pinch';
      else if (t === 'nh') n.harm = 'natural';
      else if (t.startsWith('dv')) n.dive = num(2);
      else if (t.startsWith('fb')) n.feedback = num(2);
      else if (t.startsWith('sc')) n.scrape = num(2);
      else if (t.startsWith('tr')) n.trill = num(2);
      else if (t.startsWith('b')) n.bend = num(1);
      else if (t.startsWith('r')) n.unbend = num(1);
      else if (t.startsWith('d-')) n.dyad = num(2);
      else if (t.startsWith('@')) n.str = num(1);
      else if (t === 'h') n.art = 'legato';
      else if (t === 's') n.art = 'slide';
      else if (t === 'x') n.dead = true;
      else if (t === 'c') n.out = true;
      else if (t === 'v') n.vib = true;
      else throw new Error(`"${tok}": unknown technique "${t}"`);
    }
    return n;
  });
}

const isInt = (s: string | undefined) => s !== undefined && /^-?\d+$/.test(s);

/** Notes back to text (the order of the techniques is fixed, so a saved lick always reads the same). */
export function writeNotes(notes: LibNote[]): string {
  return notes.map((n) => {
    const t: string[] = [];
    if (n.dyad !== undefined) t.push(`d-${n.dyad}`);
    if (n.bend) t.push(`b${n.bend}`);
    if (n.unbend) t.push(n.bend ? `r${n.unbend}` : `pb${n.unbend}`);
    if (n.art === 'legato') t.push('h');
    if (n.art === 'slide') t.push('s');
    if (n.trill) t.push(`tr${n.trill}`);
    if (n.tremolo) t.push('trem');
    if (n.rake) t.push('rk');
    if (n.dead) t.push('x');
    if (n.out) t.push('c');
    if (n.vib) t.push('v');
    if (n.harm) t.push(n.harm === 'pinch' ? 'ph' : 'nh');
    if (n.dive) t.push(`dv${n.dive}`);
    if (n.feedback) t.push(`fb${n.feedback}`);
    if (n.scrape) t.push(`sc${n.scrape}`);
    if (n.str) t.push(`@${n.str}`);
    return `${n.pos}:${n.semi}:${n.len}${t.length ? ':' + t.join(',') : ''}`;
  }).join(' ');
}

/** The last 16th the lick sounds (its length). */
export const spanOf = (notes: LibNote[]) => Math.max(...notes.map((n) => n.pos + n.len));

/** Everything wrong with the file, as plain sentences (empty: it's fine). */
export function problems(f: LickFile): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const oneOf = <T>(xs: readonly T[], v: unknown) => xs.includes(v as T);
  if (!f || !Array.isArray(f.licks)) return ['no "licks" list'];
  f.licks.forEach((l, i) => {
    const at = `lick ${i + 1} (${l?.id ?? '?'})`;
    if (!l || typeof l !== 'object') { out.push(`${at}: not an object`); return; }
    if (typeof l.id !== 'string' || !/^[a-z0-9-]+$/.test(l.id)) out.push(`${at}: the id must be lower-case letters, digits and dashes`);
    else if (ids.has(l.id)) out.push(`${at}: the id is used twice`);
    ids.add(l.id);
    if (typeof l.name !== 'string' || !l.name.trim()) out.push(`${at}: no name`);
    if (!oneOf(STATUSES, l.status)) out.push(`${at}: status must be ${STATUSES.join(' or ')}`);
    if (!Array.isArray(l.who) || !l.who.length || l.who.some((w) => !oneOf(WHO, w))) out.push(`${at}: player must be some of ${WHO.join(', ')}`);
    if (!oneOf(SPEEDS, l.speed)) out.push(`${at}: speed must be ${SPEEDS.join(', ')}`);
    if (!oneOf(QS, l.q)) out.push(`${at}: chord must be ${QS.join(', ')}`);
    try {
      const ns = parseNotes(l.notes);
      if (ns.some((n) => n.pos < 0 || n.len < 1)) out.push(`${at}: a note starts before 0 or has no length`);
      if (ns.some((n, k) => k && n.pos < ns[k - 1].pos)) out.push(`${at}: the notes are not in time order`);
      if (ns.some((n) => n.str !== undefined && (n.str < 1 || n.str > 6))) out.push(`${at}: a string must be 1 to 6`);
    } catch (e) { out.push(`${at}: ${(e as Error).message}`); }
    const list = (k: 'role' | 'genres' | 'moods', xs: readonly string[]) => {
      const v = l[k];
      if (v !== undefined && (!Array.isArray(v) || v.some((x) => !xs.includes(x)))) out.push(`${at}: ${k} must be some of ${xs.join(', ')}`);
    };
    list('role', ROLES); list('genres', GENRES); list('moods', MOODS);
    if (l.energy !== undefined && !(Number.isInteger(l.energy) && l.energy >= 1 && l.energy <= 5)) out.push(`${at}: energy must be 1 to 5`);
    for (const k of ['credit', 'source', 'about'] as const) if (l[k] !== undefined && typeof l[k] !== 'string') out.push(`${at}: ${k} must be text`);
  });
  return out;
}

const FIELDS: (keyof LickEntry)[] = ['id', 'name', 'status', 'who', 'speed', 'q', 'notes', 'role', 'genres', 'moods', 'energy', 'credit', 'source', 'about'];

/** The file as text: one field a line, so a change to a lick is a one-line change in git. Empty fields are left out. */
export function formatFile(f: LickFile): string {
  const lick = (l: LickEntry) => {
    const lines = FIELDS.filter((k) => l[k] !== undefined && l[k] !== '' && !(Array.isArray(l[k]) && !(l[k] as unknown[]).length))
      .map((k) => { const v = l[k]; return `      ${JSON.stringify(k)}: ${Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(', ')}]` : JSON.stringify(v)}`; });
    return `    {\n${lines.join(',\n')}\n    }`;
  };
  return `{\n  "about": ${JSON.stringify(f.about)},\n  "licks": [\n${f.licks.map(lick).join(',\n')}\n  ]\n}\n`;
}

/** A name to an id: lower case, dashes. */
export const slug = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lick';
