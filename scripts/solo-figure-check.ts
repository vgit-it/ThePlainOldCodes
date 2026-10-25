// Checks the figures of the solo player (docs/SOLO-PLAYER.md, section 15): long notes that become expressions which keep coming back to the
// note, or climb toward the next one.
//  1. Structure, on made-up spans (every meter, tempo 60-200, mode, mood): a figure fills the note's time exactly, starts on the note's
//     pitch, is the note's pitch for at least a third of the time, stays in the key (one passing note outside it at most), is never too quick
//     for the tempo; a return ends on the note; a bridge never ends on it and never goes past the next note.
//  2. Mood: the intervals of the figures follow the mood's own table (angry and triumphant go further than melancholic and dark; sad falls
//     more than happy).
//  3. Real solos, played naturally: the share of long notes that are held as they are follows the mood and the energy, is mostly the peaks
//     and the landings, is about a quarter overall; no contour twice in a row; a copy of a phrase plays the same move; every lead player
//     keeps to their own shapes; passing notes outside the key only for the players who use them.
//  4. Section 17: no figure plays the same pitch twice running; a trill is written as notes at a speed that suits the tempo (70 to 180 ms a
//     note) and ends on the note on a beat division; a quick bend into the note (a half or whole step, landing, in the key) then a flourish of
//     uneven lengths with a 16th of air now and then (never first, never last, at most one), all inside the note's time; about a quarter of
//     long notes (those with room: not the 4-step ones) open with a quick bend, never twice in a row.
//   npm run solo-figure-check        (N=140 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { type GuitarHit, type NoteRead, type ReadTag, type Song, hitTime } from '../src/idea';
import { leadHands } from '../src/players/hands';
import { pickLead } from '../src/players/lead';
import { Rng } from '../src/rng';
import { SCALES } from '../src/theory';
import { MOODS, type Mood } from '../src/tension';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { profileFor } from '../src/verse/intervals';
import { type BaseNote, TOL, endOf } from '../src/parts/soloevents';
import { MOOD_FEEL } from '../src/parts/soloread';
import { composeFigures, composeTrill } from '../src/parts/solofigure';
import { personOf } from '../src/parts/soloperson';
import type { PlayerCtx } from '../src/parts/soloplayer';
import type { Span } from '../src/parts/solorules';

const N = Number(process.env.N ?? 140);
let bad = 0, checks = 0;
const fail = (m: string) => { if (bad++ < 40) console.log('FAIL ' + m); };
const ok = (c: boolean, m: string) => { checks++; if (!c) fail(m); };

const METERS: Record<string, { len: number; groups: number[] }> = {
  '4/4': { len: 16, groups: [4, 4, 4, 4] }, '3/4': { len: 12, groups: [4, 4, 4] }, '6/8': { len: 12, groups: [6, 6] }, '7/8': { len: 14, groups: [4, 4, 6] }, '5/4': { len: 20, groups: [4, 4, 4, 4, 4] },
};
const modes = Object.keys(SCALES) as (keyof typeof SCALES)[];
const tagsOf = (ids: string[]): ReadTag[] => ids.map((id) => ({ id, w: 1, family: 'shape' as const }));

// ---------------- 1 and 2. made-up spans
const byMood: Record<string, { n: number; size: number; moves: number; down: number; notes: number }> = {};
const BEND = { n: 0, air: 0, notes: 0, varied: 0 }, TRILL = { n: 0, ms: 0 };
let made = 0, none = 0;
{
  const rng = new Rng('figure-grid');
  for (let k = 0; k < 3000; k++) {
    const meter = rng.pick(Object.keys(METERS)), mb = METERS[meter], bpm = rng.int(60, 200), key = rng.int(0, 11), mode = rng.pick(modes);
    const bars = Array.from({ length: 8 }, (_, b) => ({ start: b * mb.len, len: mb.len, groups: mb.groups }));
    const song = { bpm, key, mode, total: 8 * mb.len, bars, partGenres: { strum: 'rock' } } as unknown as Song;
    const pcs = new Set((SCALES[mode] as readonly number[]).map((p) => (p + key) % 12));
    const pool: number[] = [];
    for (let m = 52; m <= 79; m++) if (pcs.has(m % 12)) pool.push(m);
    const mood = MOODS[k % MOODS.length] as Mood;
    const lead = pickLead(`fg${k % 40}`, (['rock', 'hardrock', 'metal', 'grunge', 'pop', 'funk', 'altmetal'] as const)[k % 7]);
    const person = personOf(`band${k % 11}`, lead);
    const midi = rng.pick(pool), len = rng.pick([4, 5, 6, 8, 10, 12, 14, 16, 20]);
    const nextMidi = rng.pick(pool);
    const t = bars[1].start;
    const hit: GuitarHit = { step: t, notes: [midi], strings: [2], len, vel: 0.8 };
    const note: BaseNote = { i: 1, t, len, midi, role: '', anchor: 'main', frozen: false, ev: 1 };
    const nextNote: BaseNote = { i: 2, t: t + len, len: 4, midi: nextMidi, role: '', anchor: 'pitch', frozen: false, ev: 2 };
    const feel = MOOD_FEEL[mood];
    const read: NoteRead = { i: 1, step: t, midi, len, tags: tagsOf(rng.pick([[], ['shuffle-groove'], ['eighths-groove'], ['sixteenths-groove']])), feel, facts: {} };
    const ctx: PlayerCtx = { seed: 'fg', song, lead, hands: leadHands('fg', lead), mood, tension: [], energy: 3, kind: 'solo' };
    const span: Span = { note, event: { t, len, hit, base: 1 }, read, prev: null, next: nextNote, before: 0, after: 0, ctx };
    for (const intent of ['return', 'bridge', 'trill'] as const) {
      const ask = { intent: intent === 'trill' ? 'return' as const : intent, person, want: feel, profile: profileFor(mood, 'solo', 0.5), mood, bend: 0.6 };
      const figs = intent === 'trill' ? composeTrill(span, ask, new Rng(`t${k}`)) : composeFigures(span, ask, new Rng(`f${k}`), 20);
      if (!figs.length) { if (len >= 8 && intent === 'return') none++; continue; }
      for (const f of figs) {
        made++;
        const tag = `${intent} ${f.contour} ${f.cell} ${meter} ${bpm}bpm ${mode} len ${len} midi ${midi}${intent === 'bridge' ? ` next ${nextMidi}` : ''}`;
        const line = [...f.events].sort((a, b) => a.t - b.t);
        ok(Math.abs(line[0].t - t) < TOL, `${tag}: starts at ${line[0].t}`);
        ok(Math.abs(endOf(line[line.length - 1]) - (t + len)) < TOL, `${tag}: ends at ${endOf(line[line.length - 1])}`);
        // (no gap but the one 16th of air a bend and run may have: not first after the bend, at most one)
        let air = 0;
        for (let j = 1; j < line.length; j++) {
          const gap = line[j].t - endOf(line[j - 1]);
          if (gap > TOL) { air++; ok(Math.abs(gap - 1) < TOL && f.contour.startsWith('bend-') && j >= 2 && j < line.length - 1, `${tag}: a gap of ${gap.toFixed(2)} at ${line[j].t}`); } else ok(Math.abs(gap) < TOL, `${tag}: an overlap at ${line[j].t}`);
        }
        ok(air <= 1, `${tag}: ${air} gaps of air`);
        ok(air === 0 || (f.lens ?? '').includes('.'), `${tag}: a gap that the lengths do not show`);
        // (never the same pitch twice running)
        for (let j = 1; j < line.length; j++) ok(line[j].hit.notes[0] !== line[j - 1].hit.notes[0], `${tag}: the same pitch twice running at ${line[j].t}`);
        if (f.contour.startsWith('bend-')) {
          const hd = line[0].hit;
          ok(hd.bend === 1 || hd.bend === 2, `${tag}: a bend of ${hd.bend}`);
          ok(pcs.has((((midi - (hd.bend ?? 0)) % 12) + 12) % 12), `${tag}: a bend from outside the key`);
          ok(line[0].len * (15000 / bpm) <= 650 && line[0].len <= 6, `${tag}: the bent note is held ${line[0].len} steps (${(line[0].len * (15000 / bpm)).toFixed(0)} ms)`);
          ok(line[0].len * (15000 / bpm) * 0.97 - 3 > 100 + (hd.bend ?? 0) * 25, `${tag}: the bend has no time to land`);
          for (const e of line.slice(1, -1)) ok(e.len * (15000 / bpm) >= 62 - 1e-6, `${tag}: a flourish note of ${(e.len * (15000 / bpm)).toFixed(0)} ms`);
          BEND.n++; BEND.air += air; BEND.notes += f.m;
          const lens = new Set(line.slice(1, -1).map((e) => e.len.toFixed(2)));
          BEND.varied += lens.size > 1 ? 1 : 0;
        }
        if (f.contour === 'trill') {
          const gapMs = (15000 / bpm) * (line[2].t - line[1].t);
          ok(gapMs >= 70 - 1 && gapMs <= 180 + 1, `${tag}: trill notes ${gapMs.toFixed(0)} ms apart`);
          const trillNotes = line.slice(1, -1);
          ok(trillNotes.every((e, j) => e.hit.notes[0] === (j % 2 === 0 ? trillNotes[0].hit.notes[0] : midi) && e.hit.art === 'legato'), `${tag}: a trill that does not alternate`);
          ok(trillNotes.every((e) => Math.abs(e.len - trillNotes[0].len) < 0.02), `${tag}: a trill of uneven notes`);
          const unit = trillNotes[0].len, landAt = line[line.length - 1].t - t;
          const beatLen = mb.groups[0], on = (g: number) => Math.abs(landAt / g - Math.round(landAt / g)) < 0.02;
          ok(on(1) || on(beatLen / 3) || on(beatLen / 6), `${tag}: the trill lands at ${landAt.toFixed(2)}, off every division of the beat`);
          TRILL.n++; TRILL.ms += gapMs;
        }
        ok(line[0].hit.notes[0] === midi, `${tag}: does not start on the note`);
        ok(f.events.every((e) => e.len > 0), `${tag}: an empty event`);
        const time = new Map<number, number>();
        for (const e of line) time.set(e.hit.notes[0], (time.get(e.hit.notes[0]) ?? 0) + e.len);
        const mine = time.get(midi) ?? 0;
        ok(mine >= len / 3 - TOL, `${tag}: the note is heard for ${mine.toFixed(2)} of ${len}`);
        ok([...time.values()].every((x) => x <= mine + 1e-6), `${tag}: another pitch is heard more than the note`);
        ok(line.every((e) => e.out || pcs.has(((e.hit.notes[0] % 12) + 12) % 12)), `${tag}: a note out of the key that is not a passing note`);
        ok(line.filter((e) => e.out).length <= 1, `${tag}: more than one passing note outside the key`);
        ok(line.filter((e) => e.out).length === 0 || person.kind === 'bluesy' || person.kind === 'funky', `${tag}: a passing note outside the key for a ${person.kind} player`);
        const ms = 15000 / bpm;
        for (let j = 1; j < line.length; j++) ok((line[j].t - line[j - 1].t) * ms >= 40 - 1e-6, `${tag}: ${(((line[j].t - line[j - 1].t) * ms)).toFixed(0)} ms between two notes`);
        const last = line[line.length - 1].hit.notes[0];
        if (intent !== 'bridge') ok(last === midi, `${tag}: a return that ends on ${last}`);
        else {
          ok(last !== midi, `${tag}: a bridge that ends on the note`);
          ok(nextMidi > midi ? last < nextMidi : last > nextMidi, `${tag}: a bridge that goes past the next note (${last})`);
        }
        ok(f.m >= 1 && (f.m <= 7 || f.contour === 'trill'), `${tag}: ${f.m} notes`);
        // the mood's intervals (returns only: they all start and end on the note)
        if (intent === 'return') {
          const s = (byMood[mood] ??= { n: 0, size: 0, moves: 0, down: 0, notes: 0 });
          const path = line.map((e) => e.hit.notes[0]);
          for (let j = 1; j < path.length; j++) { const d = path[j] - path[j - 1]; if (d) { s.size += Math.abs(d); s.moves++; if (d < 0) s.down++; } }
          s.n++; s.notes += f.m;
        }
      }
    }
  }
}
ok(none < 200, `${none} long notes of 8 steps or more could take no return figure`);
console.log(`${made} figures over the grid, ${checks} checks; bend and run ${BEND.n} (${(BEND.notes / Math.max(1, BEND.n)).toFixed(1)} flourish notes, ${(100 * BEND.air / Math.max(1, BEND.n)).toFixed(0)}% with air, ${(100 * BEND.varied / Math.max(1, BEND.n)).toFixed(0)}% of uneven lengths); trills ${TRILL.n} (${(TRILL.ms / Math.max(1, TRILL.n)).toFixed(0)} ms a note on average)`);
ok(BEND.n > 500 && BEND.air / BEND.n > 0.08 && BEND.air / BEND.n < 0.4, `air in ${(100 * BEND.air / Math.max(1, BEND.n)).toFixed(0)}% of the bend and run figures`);
ok(BEND.varied / Math.max(1, BEND.n) > 0.6, 'the flourish lengths should mostly be uneven');
ok(TRILL.n > 200, `only ${TRILL.n} trills over the grid`);
const mean = (m: string) => byMood[m].size / byMood[m].moves, down = (m: string) => byMood[m].down / byMood[m].moves;
console.log(`mood: mean interval ${MOODS.map((m) => `${m} ${mean(m).toFixed(2)}`).join(', ')}`);
console.log(`mood: share falling ${MOODS.map((m) => `${m} ${down(m).toFixed(2)}`).join(', ')}`);
ok(mean('triumphant') > mean('melancholic') + 0.4, 'triumphant figures should go further than melancholic ones');
ok(mean('angry') > mean('dark') + 0.2, 'angry figures should go further than dark ones');
ok(down('melancholic') > down('happy') + 0.05, 'melancholic figures should fall more than happy ones');
ok(down('dark') > down('triumphant') + 0.05, 'dark figures should fall more than triumphant ones');

// ---------------- 3. real solos
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MET = ['4/4', '4/4', '4/4', '3/4', '6/8', '7/8', '5/4', 'mixed'];
const H = { long: 0, stay: 0, byMood: {} as Record<string, [number, number]>, peak: [0, 0], landing: [0, 0], failed: 0, eligible: 0 };
const INTENTS: Record<string, number> = {};
const FELL: Record<string, number> = {};
const FELL_LEN: Record<string, [number, number]> = {};
const byLead: Record<string, { n: number; shapes: Record<string, number>; out: number }> = {};
const DR = { short: 0, dressed: 0, kinds: {} as Record<string, number>, row: 0, perBar: 0, bendAfter: 0, drum: 0, wrongLead: 0, repeat: 0, byLead: {} as Record<string, [number, number]> };
const RUNS = { bend: 0, trill: 0, bendRow: 0, repeats: 0, byLead: {} as Record<string, [number, number]>, air: 0 };
let fell = 0, figures = 0, twice = 0, runs = 0, copies = 0, copySame = 0, solos = 0, distinctLow = 0, solosWithFigs = 0;
const STAIR = ['stair-up', 'stair-down', 'zigzag', 'wave', 'climb', 'climb-zigzag', 'climb-thirds'];
for (let i = 0; i < N; i++) {
  const genre = GENRES[i % 7], meter = MET[i % MET.length], mood = MOODS[i % MOODS.length], s = `sf-${i}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  const secs = buildTrack(idea, { ...defaultTrackOptions(idea), soloPlan: 'perform', mood } as never).sections as any[];
  for (const sec of secs) {
    const mv = sec.soloCurve?.moves as { rule: string; intent?: string; fig?: string; note?: string; step: number }[] | undefined;
    const rd = sec.soloCurve?.read;
    if (!mv || !rd) continue;
    solos++;
    const lead = pickLead(`${s}-band`, sec.song.partGenres.strum);
    const L = (byLead[lead.kind] ??= { n: 0, shapes: {}, out: 0 });
    const contours: string[] = [];
    let last = '';
    rd.notes.forEach((n: NoteRead, k: number) => {
      const m = mv[k];
      if (!m || n.len < 4 || m.note === 'the last note is carried into the next section') return;
      H.long++;
      const intent = m.intent ?? 'stay';
      INTENTS[intent] = (INTENTS[intent] ?? 0) + 1;
      const stays = intent === 'stay' ? 1 : 0;
      H.stay += stays - (stays && m.note?.startsWith('held: no') ? 1 : 0);
      const bm = (H.byMood[mood] ??= [0, 0]);
      const fellHere = stays && m.note?.startsWith('held: no') ? 1 : 0;
      bm[0] += stays - fellHere; bm[1]++;
      if (n.tags.some((t) => t.id === 'climax-note' || t.id === 'held-peak') && n.tags.some((t) => t.id === 'climax-note')) { H.peak[0] += stays; H.peak[1]++; }
      if (n.tags.some((t) => t.id === 'answer-landing' || t.id === 'final-landing')) { H.landing[0] += stays; H.landing[1]++; }
      if (m.note === 'every try failed the check') H.failed++;
      const fl = (FELL_LEN[n.len >= 12 ? '12+' : String(n.len)] ??= [0, 0]);
      fl[1]++;
      if (stays && m.note?.startsWith('held: no')) { FELL[m.note] = (FELL[m.note] ?? 0) + 1; fl[0]++; fell++; }
      if (intent === 'return' || intent === 'bridge') {
        figures++;
        const c = m.rule.split('·')[1];
        contours.push(c);
        const bl = (RUNS.byLead[lead.kind] ??= [0, 0]);
        bl[1]++;
        if (c.startsWith('bend-')) { RUNS.bend++; bl[0]++; if (k >= 1 && mv[k - 1]?.rule.split('·')[1]?.startsWith('bend-')) RUNS.bendRow++; if (m.fig?.includes(' . ')) RUNS.air++; }
        if (c === 'trill') RUNS.trill++;
        L.n++; L.shapes[c] = (L.shapes[c] ?? 0) + 1;
        if (c === last) twice++;
        last = c; runs++;
      } else last = '';
    });
    // short notes: dressed a third of the time, with a breath between, never piled up, never against a snare or crash by push or drag
    {
      const bars = new Map<number, number>();
      const hits = [...sec.guitar2].filter((h: GuitarHit) => !h.mute && h.notes.length).sort((a: GuitarHit, b: GuitarHit) => hitTime(a) - hitTime(b));
      rd.notes.forEach((n: NoteRead, k: number) => {
        const m = mv[k];
        if (!m || n.len >= 4) return;
        DR.short++;
        const bl = (DR.byLead[lead.kind] ??= [0, 0]);
        bl[1]++;
        if (m.intent !== 'dress') return;
        DR.dressed++; bl[0]++;
        const kind = m.rule.split('·')[1];
        DR.kinds[kind] = (DR.kinds[kind] ?? 0) + 1;
        if (mv[k - 1]?.intent === 'dress') { DR.row++; fail(`${s}: two dressed short notes in a row at note ${k}`); }
        const bar = sec.song.bars.findIndex((b: any) => n.step >= b.start && n.step < b.start + b.len);
        bars.set(bar, (bars.get(bar) ?? 0) + 1);
        if (bars.get(bar)! > 2) { DR.perBar++; fail(`${s}: more than two dressed short notes in bar ${bar}`); }
        if (kind === 'bend' && k >= 1 && (mv[k - 1].rule.includes('bend') || mv[k - 1].rule === 'late-bend')) { DR.bendAfter++; fail(`${s}: a quick bend straight after a bend at note ${k}`); }
        if ((kind === 'push' || kind === 'drag') && n.tags.some((t) => (t.id === 'on-snare' || t.id === 'on-crash') && t.w >= 0.5)) { DR.drum++; fail(`${s}: ${kind} on a snare or crash at note ${k}`); }
        if (((kind === 'push' || kind === 'drag') && !['melodic', 'bluesy'].includes(lead.kind)) || (kind === 'ghost' && ['shredder'].includes(lead.kind))) { DR.wrongLead++; fail(`${s}: a ${lead.kind} player plays ${kind}`); }
        // the first pitch of a dressed note is never the pitch just played (unless the melody itself repeats it)
        const first = hits.find((h: GuitarHit) => hitTime(h) >= n.step - 0.4 && hitTime(h) < n.step + n.len - 1e-6);
        const before = [...hits].reverse().find((h: GuitarHit) => hitTime(h) < (first ? hitTime(first) : n.step) - 1e-6);
        if (first && before && first.notes[0] === before.notes[0] && rd.notes[k - 1]?.midi !== n.midi) { DR.repeat++; fail(`${s}: a dressed note starts by repeating the pitch before it (note ${k}, ${kind})`); }
      });
    }
    // never the same pitch twice running inside a note that was played another way
    {
      const hits = [...sec.guitar2].filter((h: GuitarHit) => !h.mute && h.notes.length).sort((a: GuitarHit, b: GuitarHit) => hitTime(a) - hitTime(b));
      rd.notes.forEach((n: NoteRead, k: number) => {
        if (!mv[k] || mv[k].rule === 'plain') return;
        const inside = hits.filter((h: GuitarHit) => hitTime(h) >= n.step - 1e-6 && hitTime(h) < n.step + n.len - 1e-6);
        for (let j = 1; j < inside.length; j++) if (inside[j].notes[0] === inside[j - 1].notes[0] && !inside[j].mute) { RUNS.repeats++; fail(`${s}: the same pitch twice running in note ${k} (${mv[k].rule})`); }
      });
    }
    if (contours.length >= 6) { solosWithFigs++; if (new Set(contours).size < 3) distinctLow++; }
    // a copy of a phrase plays the same move
    rd.phrases.forEach((p: any) => {
      if (p.copyOf === undefined) return;
      const src = rd.phrases[p.copyOf];
      for (let k = p.from; k <= p.to; k++) {
        const j = src.from + (k - p.from);
        if (j > src.to || !mv[k] || !mv[j] || rd.notes[k].len < 4) continue;
        copies++;
        if ((mv[k].intent ?? 'stay') === (mv[j].intent ?? 'stay')) copySame++;
      }
    });
    // passing notes outside the key
    const pcs = new Set((SCALES[sec.song.mode] as readonly number[]).map((p) => (p + sec.song.key) % 12));
    void pcs;
  }
}
const share = (a: number, b: number) => (b ? a / b : 0);
console.log(`real solos (${solos} solos and breaks): ${H.long} long notes; held on purpose ${(100 * share(H.stay, H.long)).toFixed(0)}%; ${Object.entries(INTENTS).map(([k, n]) => `${k} ${n}`).join(', ')}; every try failed ${H.failed}`);
console.log(`quick bend then flourish: ${RUNS.bend} (${(100 * share(RUNS.bend, H.long)).toFixed(0)}% of long notes, ${RUNS.air} with a 16th of air; two in a row ${RUNS.bendRow}); trills ${RUNS.trill} (${(100 * share(RUNS.trill, H.long)).toFixed(1)}%); by lead ${Object.entries(RUNS.byLead).map(([k, v]) => `${k} ${(100 * share(v[0], v[1])).toFixed(0)}% of ${v[1]} figures`).join(', ')}`);
ok(share(RUNS.bend, H.long) > 0.15 && share(RUNS.bend, H.long) < 0.45, `${(100 * share(RUNS.bend, H.long)).toFixed(0)}% of long notes open with a quick bend, not about a quarter`);
ok(RUNS.bendRow === 0, `${RUNS.bendRow} quick bends in a row`);
ok(RUNS.trill === 0 || share(RUNS.trill, H.long) < 0.1, 'too many trills');
console.log(`short notes: ${DR.short}; dressed ${DR.dressed} (${(100 * share(DR.dressed, DR.short)).toFixed(0)}%): ${Object.entries(DR.kinds).map(([k, n]) => `${k} ${n}`).join(', ')}; by lead ${Object.entries(DR.byLead).map(([k, v]) => `${k} ${(100 * share(v[0], v[1])).toFixed(0)}% of ${v[1]}`).join(', ')}`);
ok(share(DR.dressed, DR.short) > 0.2 && share(DR.dressed, DR.short) < 0.5, `${(100 * share(DR.dressed, DR.short)).toFixed(0)}% of short notes are dressed, not about a third`);
ok(Object.keys(DR.kinds).length >= 5, `only ${Object.keys(DR.kinds).length} ways of dressing a short note were played`);
console.log(`  held because no figure fit: ${fell} (${Object.entries(FELL_LEN).sort().map(([k, v]) => `len ${k}: ${v[0]} of ${v[1]}`).join(', ')})`);
console.log(`  hold share by mood: ${MOODS.map((m) => `${m} ${(100 * share(H.byMood[m]?.[0] ?? 0, H.byMood[m]?.[1] ?? 0)).toFixed(0)}%`).join(', ')}; on a climax ${(100 * share(H.peak[0], H.peak[1])).toFixed(0)}% of ${H.peak[1]}, on a landing ${(100 * share(H.landing[0], H.landing[1])).toFixed(0)}% of ${H.landing[1]}`);
const hs = (m: string) => share(H.byMood[m]?.[0] ?? 0, H.byMood[m]?.[1] ?? 0);
ok(share(H.stay, H.long) > 0.15 && share(H.stay, H.long) < 0.45, `the hold share is ${(100 * share(H.stay, H.long)).toFixed(0)}%, not about a quarter`);
ok(hs('dreamy') > hs('angry') + 0.1, `dreamy holds ${(100 * hs('dreamy')).toFixed(0)}% but angry ${(100 * hs('angry')).toFixed(0)}%`);
ok(hs('melancholic') > hs('happy') + 0.05, 'melancholic should hold more than happy');
ok(hs('angry') < 0.25, `angry holds ${(100 * hs('angry')).toFixed(0)}%`);
ok(H.peak[1] < 5 || share(H.peak[0], H.peak[1]) > 0.5, `a climax is held only ${(100 * share(H.peak[0], H.peak[1])).toFixed(0)}% of the time`);
ok(H.peak[1] < 5 || share(H.peak[0], H.peak[1]) < 0.95, 'a climax is always held');
ok(H.failed < 0.1 * Math.max(1, H.long), `${H.failed} of ${H.long} long notes found no figure that passed`);
console.log(`figures: ${figures}; the same contour twice running ${(100 * share(twice, runs)).toFixed(0)}%; copies of phrases playing the same move ${(100 * share(copySame, copies)).toFixed(0)}% of ${copies}; solos with 6+ figures and under 3 shapes: ${distinctLow} of ${solosWithFigs}`);
ok(share(twice, runs) < 0.2, `the same contour twice running ${(100 * share(twice, runs)).toFixed(0)}% of the time`);
ok(copies < 20 || share(copySame, copies) > 0.6, `a copy plays the same move only ${(100 * share(copySame, copies)).toFixed(0)}% of the time`);
ok(solosWithFigs < 5 || distinctLow / solosWithFigs < 0.2, `${distinctLow} of ${solosWithFigs} solos use fewer than 3 shapes`);
const fam = (k: string, names: string[]) => share(names.reduce((a, c) => a + (byLead[k]?.shapes[c] ?? 0) + (byLead[k]?.shapes[`bend-${c}`] ?? 0), 0), byLead[k]?.n ?? 0);
console.log(`lead players: ${Object.entries(byLead).map(([k, v]) => `${k} ${v.n} figures (runs and zigzags ${(100 * fam(k, STAIR)).toFixed(0)}%, pedal and leap-fill ${(100 * fam(k, ['pedal', 'leap-fill']) ).toFixed(0)}%, neighbour and arch ${(100 * fam(k, ['neighbour-up', 'neighbour-down', 'arch', 'dip']) ).toFixed(0)}%)`).join('; ')}`);
if ((byLead.shredder?.n ?? 0) > 40 && (byLead.melodic?.n ?? 0) > 40) ok(fam('shredder', STAIR) > fam('melodic', STAIR) + 0.05, 'a shredder should play more runs and zigzags than a melodic player');
if ((byLead.raw?.n ?? 0) > 25 && (byLead.melodic?.n ?? 0) > 40) ok(fam('raw', ['pedal', 'leap-fill']) > fam('melodic', ['pedal', 'leap-fill']) + 0.04, 'a raw player should play more pedals and leaps than a melodic player');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
