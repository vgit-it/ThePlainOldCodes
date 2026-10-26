// Checks the moves between the cores (docs/SOLO-CORE.md, step 2): "Chosen bars, with moves between" fills the gaps between the core notes.
//  - The cores are the same as in "cores only" (step, note, length). "Cores only" is unchanged, and nothing set plays as off.
//  - No move twice in a row; a rare move (weight 1 in the genre) once per solo at most.
//  - The signature lick comes back 2 or 3 times in solos of 6 bars or more (1 or 2 in shorter ones).
//  - A move (except a rest or stabs) ends within 2 scale steps of the next core, or bends or slides into it.
//  - Notes: in the key (off-scale at most 10%), inside the playable window, never over a core.
//  - The genre leans show (metal more runs, trills, arpeggios and pedals than rock; funk the most stabs; pop more stairs, arches and answers than metal);
//    every move shows up in at least 4 genres; rests are 10-40% of the gaps; the same seed plays the same.
//   npm run solo-moves-check        (N=140 songs, two takes of each)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { MIN_GAP, MOVE_NAMES, type MoveName, isRare, scaleSteps } from '../src/parts/solomoves';
import { SCALES } from '../src/theory';

const N = Number(process.env.N ?? 140);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const METERS = ['4/4', '4/4', '4/4', '3/4', '6/8', '7/8', '5/4', 'mixed'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const pct = (a: number, b: number) => (b ? (100 * a / b).toFixed(0) + '%' : '-');
const mod = (n: number, m: number) => ((n % m) + m) % m;

type Sw = { soloCores?: 'only' | 'travel' | 'off' };
type Land = { step: number; midi: number; len: number; role: string };
// (two songs for each number, so that every genre has plenty of solos: 2 x N songs in all)
const play = (j: number, sw: Sw) => {
  const i = j >> 1, genre = GENRES[i % 7], meter = METERS[Math.floor(i / 7) % METERS.length], mood = MOODS[(i + (j & 1) * 3) % MOODS.length], s = `mv-${j}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return (buildTrack(idea, { ...defaultTrackOptions(idea), soloPlan: 'perform', solo: 'on', mood, ...sw } as never).sections as any[]).filter((x) => x.section?.solo).map((sec) => ({
    s, genre: sec.song.partGenres.strum as string, sec, lands: (sec.soloCurve?.landings ?? []).filter((l: any) => l.role !== 'waypoint') as Land[], travel: (sec.soloCurve?.travel ?? []) as any[],
  }));
};
const key = (sec: any) => sec.guitar2.map((h: any) => `${h.step}:${h.len}:${h.notes.join('.')}:${h.bend ?? 0}:${h.trill ?? 0}`).join('|');
const landKey = (ls: Land[]) => ls.map((l) => `${l.step}:${l.midi}:${l.len}`).join('|');

const share: Record<string, Record<string, number>> = {};
const moves: Record<string, number> = {};
const gensWith: Record<string, Set<string>> = {};
let gapsWithSpace = 0, noRoom = 0, solos = 0, recs = 0, space = 0, hitsN = 0, off = 0, notes = 0, withSig = 0, bigSig = 0, bigSigOk = 0, retTotal = 0, grace = 0, gaps = 0;
// (the rare moves need a few solos to show up in 4 genres: if some have not by then, more songs are played, up to 4 times as many)
const seenIn = (m: string) => gensWith[m]?.size ?? 0;
const missing = () => MOVE_NAMES.some((m) => seenIn(m) < 4);
for (let i = process.env.ONLY ? Number(process.env.ONLY) : 0; process.env.ONLY ? i === Number(process.env.ONLY) : i < 2 * N || (missing() && i < 8 * N); i++) {
  const a = play(i, { soloCores: 'travel' }), b = i % 3 === 0 ? play(i, { soloCores: 'only' }) : [];
  a.forEach((x, k) => {
    solos++;
    const { bars, total } = x.sec.song, tonic = x.sec.song.key, scale = SCALES[x.sec.song.mode as keyof typeof SCALES] as readonly number[];
    const inKey = (m: number) => scale.includes(mod(m - tonic, 12));
    const centre = x.sec.soloCurve.centre as number[];
    const window = (g: number): [number, number] => { const c = centre[Math.min(centre.length - 1, g)]; return [Math.max(50, c - 6), Math.min(83, c + 6)]; };
    // the cores are the same as in "cores only", and "cores only" has no moves
    if (b[k] && landKey(x.lands) !== landKey(b[k].lands)) fail(`${x.s}: the cores are not the same as in 'only'`);
    if (b[k]?.travel.length) fail(`${x.s}: 'only' has moves`);
    if (b[k] && (b[k].sec.guitar2.length < b[k].lands.length - 1 || b[k].sec.guitar2.length > b[k].lands.length + 2)) fail(`${x.s}: 'only' is not just the cores`);
    // (the song's ending can make the last core over: from a little before it, the hits are the ending's)
    const isCore = (h: any) => x.lands.some((l) => l.step === h.step || (l.role === 'end' && (h.step >= l.step - 2 || (h.len >= 8 && l.step - h.step <= 6))));
    const moveHits = x.sec.guitar2.filter((h: any) => !isCore(h));
    // notes: window, key, no overlap with a core
    for (const h of moveHits) {
      // (a move plays in the window of the core it leads into, widened a little where that core sits at the window's edge)
      const r = x.travel.find((q) => h.step >= q.from && h.step < q.to), core = r ? x.lands[r.into] : undefined;
      // (a key change can lift the whole section: the window and the notes move together)
      const shift = core && r ? core.midi - r.core : 0;
      const [wlo, whi] = window(core ? core.step : h.step), lo = Math.min(wlo + shift, (core?.midi ?? wlo) - 3), hi = Math.max(whi + shift, (core?.midi ?? whi) + 3);
      const ps: number[] = [...h.notes, ...(h.trill ? [Math.max(...h.notes) + h.trill] : [])];
      for (const m of ps) { notes++; if (m < lo || m > hi) fail(`${x.s}: a note outside the window (step ${h.step}, midi ${m}, window ${lo}-${hi}, ${r ? r.move + ' ' + r.from + '-' + r.to + ' into ' + r.into : 'no move'}, core ${core?.step}:${core?.midi}, centre ${centre[core ? core.step : h.step]})`); if (!inKey(m)) off++; }
      hitsN++;
      if (x.lands.some((l) => h.step < l.step + l.len && l.step < h.step + h.len )) fail(`${x.s}: a move note over a core (step ${h.step})`);
    }
    // the moves in order
    const rs = x.travel.filter((r) => r.move !== 'grace').sort((p, q) => p.from - q.from || p.to - q.to);
    grace += x.travel.length - rs.length;
    gaps += new Set(rs.map((r) => r.gap)).size;
    gapsWithSpace += new Set(rs.filter((r) => r.move === 'space').map((r) => r.gap)).size;
    rs.forEach((r, j) => {
      recs++; if (r.move === 'space') space++;
      // (the signature and its returns are repeats and answers by name; the genre's leans are read from the other moves)
      if (!r.label) {
        (share[x.genre] ??= {})[r.move] = (share[x.genre][r.move] ?? 0) + 1;
        moves[x.genre] = (moves[x.genre] ?? 0) + 1;
        (gensWith[r.move] ??= new Set()).add(x.genre);
      }
      if (j && rs[j - 1].move === r.move) fail(`${x.s}: ${r.move} twice in a row (steps ${rs[j - 1].from} and ${r.from})`);
      if (r.label !== 'return' && MIN_GAP[r.move as MoveName] > r.to - r.from) fail(`${x.s}: ${r.move} in a gap of ${r.to - r.from}`);
      if (r.move === 'space' || r.move === 'stab') return;
      const hs = moveHits.filter((h: any) => h.step >= r.from && h.step < r.to).sort((p: any, q: any) => p.step - q.step);
      if (!hs.length) { fail(`${x.s}: ${r.move} wrote no notes`); return; }
      const z = hs[hs.length - 1], core = x.lands[r.into], top = Math.max(...z.notes);
      // (the song's ending can trim the last notes before the last core)
      if (r.into < x.lands.length - 1 && scaleSteps(x.sec.song, top, core.midi) > 2 && !(z.bend > 0) && z.art !== 'slide') fail(`${x.s}: ${r.move} ends ${scaleSteps(x.sec.song, top, core.midi)} scale steps from the core (${top} to ${core.midi}); into ${r.into}/${x.lands.length - 1}, planned last ${r.last}, from ${r.from} to ${r.to}, hits ${hs.map((h: any) => h.step + ':' + h.notes.join('.')).join(' ')}`);
    });
    for (const m of MOVE_NAMES) if (isRare(m, x.genre) && rs.filter((r) => r.move === m).length > 1) fail(`${x.s}: the rare move ${m} ${rs.filter((r) => r.move === m).length} times in ${x.genre}`);
    // the signature
    const sig = rs.filter((r) => r.label === 'signature'), ret = rs.filter((r) => r.label === 'return');
    if (sig.length > 1) fail(`${x.s}: ${sig.length} signatures`);
    if (sig.length) {
      withSig++; retTotal += ret.length;
      // (it needs gaps to come back in: when fewer than two later moves have room for it, it comes back in those)
      const room = rs.filter((q) => q.from > sig[0].from && q.move !== 'space' && q.to - q.from >= 6).length;
      if (bars.length >= 6) { bigSig++; if (ret.length >= 2 && ret.length <= 3) bigSigOk++; else if (ret.length <= 3 && ret.length >= Math.min(2, room)) noRoom++; else fail(`${x.s}: the signature comes back ${ret.length} times in ${bars.length} bars (moves after it: ${rs.filter((q) => q.from > sig[0].from).map((q) => q.move + ':' + (q.to - q.from)).join(' ')})`); }
      else if (ret.length > 2) fail(`${x.s}: the signature comes back ${ret.length} times in ${bars.length} bars`);
      if (sig[0].from > ret.reduce((m, r) => Math.min(m, r.from), Infinity)) fail(`${x.s}: a return before the signature`);
    } else if (ret.length) fail(`${x.s}: a return with no signature`);
    if (!rs.length && total > 0 && x.lands.length > 1 && x.lands[0].step > 8) fail(`${x.s}: no moves in a solo with gaps`);
  });
  // the same switches, the same song, the same notes
  if (i % 5 === 0) { const c = play(i, { soloCores: 'travel' }); if (a.map((x) => key(x.sec)).join('#') !== c.map((x) => key(x.sec)).join('#')) fail(`song ${i}: not the same twice`); }
}
// a link from before the switch (nothing set) plays as 'off' set by hand
for (let i = 0; i < Math.min(2 * N, 12); i++) if (play(i, {}).map((x) => key(x.sec)).join('#') !== play(i, { soloCores: 'off' }).map((x) => key(x.sec)).join('#')) fail(`song ${i}: off is not the same as nothing set`);

// ---- the table
const shr = (g: string, ms: string[]) => ms.reduce((s, m) => s + (share[g]?.[m] ?? 0), 0) / Math.max(1, moves[g] ?? 0);
console.log(`solos ${solos}, moves ${recs} (${(recs / Math.max(1, solos)).toFixed(1)} per solo), ${grace} grace notes, notes per solo ${(hitsN / Math.max(1, solos)).toFixed(1)}`);
console.log('move share by genre:');
console.log('  ' + 'move'.padEnd(20) + GENRES.map((g) => g.padStart(9)).join(''));
for (const m of [...MOVE_NAMES]) console.log('  ' + m.padEnd(20) + GENRES.map((g) => pct(share[g]?.[m] ?? 0, moves[g] ?? 0).padStart(9)).join('') + `   (in ${gensWith[m]?.size ?? 0} genres)`);
console.log(`rests: in ${pct(gapsWithSpace, gaps)} of the gaps (${pct(space, recs)} of the moves); off-scale: ${pct(off, notes)} of ${notes} notes; signature in ${withSig} of ${solos} solos, back ${(retTotal / Math.max(1, withSig)).toFixed(1)} times on average (${bigSigOk} of ${bigSig} solos of 6+ bars have 2-3; ${noRoom} more had no room for two)`);
if (!(shr('metal', ['run', 'trill', 'arpeggio', 'pedal']) > shr('rock', ['run', 'trill', 'arpeggio', 'pedal']))) fail('metal does not lean more to run, trill, arpeggio, pedal than rock');
if (!GENRES.filter((g) => g !== 'funk').every((g) => shr('funk', ['stab']) > shr(g, ['stab']))) fail('funk does not have the most stabs');
if (!(shr('pop', ['stairs', 'arch', 'answer']) > shr('metal', ['stairs', 'arch', 'answer']))) fail('pop does not lean more to stairs, arch, answer than metal');
for (const m of MOVE_NAMES) if ((gensWith[m]?.size ?? 0) < 4) fail(`${m} shows up in only ${gensWith[m]?.size ?? 0} genres`);
const sp = gapsWithSpace / Math.max(1, gaps);
if (!(sp >= 0.1 && sp <= 0.4)) fail(`rests are in ${pct(gapsWithSpace, gaps)} of the gaps`);
if (!(off / Math.max(1, notes) <= 0.1)) fail(`off-scale notes are ${pct(off, notes)}`);
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
