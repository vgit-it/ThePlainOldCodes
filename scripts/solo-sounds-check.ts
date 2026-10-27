// Checks the "Lead guitar sounds" switch (docs/SOLO-SOUNDS.md) over many songs, every solo writer:
//  - Switched on, the song is the same except for the sound marks (harm, dive, feedback, scrape), and only solos and lead breaks get any.
//  - Each mark sits where it should: a pinch on a held single note, a natural harmonic on a held unbent note an open
//    string gives, feedback on the last note or a long one, a scrape (a beat or two) into the first note of a full solo
//    or into a phrase after a rest; no pinch, feedback or scrape on a clean or acoustic guitar; at most MOST of each a solo.
//  - The genres lean as set: metal squeals and dives more than pop; every sound turns up.
//  - The same seed gives the same marks.
//   npm run solo-sounds-check        (N=60 songs a genre)
import { MAIN_GUITARS, generate } from '../src/generator';
import type { GuitarHit } from '../src/idea';
import { HARMONIC_NOTES, type LeadSound, MOST } from '../src/parts/solosounds';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 60);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'] as const;
const WRITERS = ['off', 'on', 'perform'] as const;
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

const MARKS = ['harm', 'dive', 'feedback', 'scrape'] as const;
const strip = (h: GuitarHit) => { const x: Record<string, unknown> = { ...h }; for (const k of MARKS) delete x[k]; return x; };
const marked = (h: GuitarHit) => MARKS.some((k) => h[k] !== undefined);
const build = (g: string, i: number, writer: string, sounds?: 'on') => {
  const s = `ss-${g}-${i}`;
  const idea = generate({ genre: g, meter: i % 5 === 4 ? '3/4' : '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return buildTrack(idea, { ...defaultTrackOptions(idea), soloPlan: writer, solo: 'on', ...(sounds ? { soloSounds: sounds } : {}) } as never).sections as any[];
};

const count: Record<string, Record<LeadSound | 'solos' | 'all', number>> = {};
for (const g of GENRES) {
  count[g] = { solos: 0, all: 0, pinch: 0, natural: 0, dive: 0, feedback: 0, scrape: 0 };
  for (let i = 0; i < N; i++) {
    const writer = WRITERS[i % 3];
    const off = build(g, i, writer), on = build(g, i, writer, 'on');
    const at = `${g} ${i} (${writer})`;
    if (off.length !== on.length) { fail(`${at}: the switch changed the number of sections`); continue; }
    on.forEach((sec, k) => {
      const o = off[k];
      const hits = sec.guitar2 as GuitarHit[];
      // the same song, but for the marks
      const rest = (x: any) => JSON.stringify({ ...x, guitar2: undefined, notes: undefined });
      if (rest(sec) !== rest(o)) fail(`${at}: section ${k} changed beyond the lead's marks`);
      if (JSON.stringify(hits.map(strip)) !== JSON.stringify((o.guitar2 as GuitarHit[]).map(strip))) fail(`${at}: section ${k}: notes changed`);
      if ((o.guitar2 as GuitarHit[]).some(marked)) fail(`${at}: section ${k}: marks with the switch off`);
      const lead = sec.section?.solo || sec.section?.lead;
      if (!lead) { if (hits.some(marked)) fail(`${at}: section ${k}: marks outside a solo or lead break`); return; }
      if (!hits.length) return;
      count[g].solos++;
      const order = hits.slice().sort((a, b) => a.step - b.step);
      const first = order[0], last = order[order.length - 1];
      const n = { pinch: 0, natural: 0, dive: 0, feedback: 0, scrape: 0 };
      const sound = sec.section?.sound?.guitar2 as string | undefined;
      const driven = sound !== 'electric-clean' && sound !== 'acoustic' && sound !== 'piano';
      for (const h of hits) {
        if (!driven && (h.harm === 'pinch' || h.feedback || h.scrape)) fail(`${at}: a pinch, feedback or scrape on ${sound}`);
        // (not its length: a later step can cut a note short, e.g. at a section's end)
        const heldOne = h.notes.length === 1 && !h.mute && !h.trill && !h.tremolo;
        if (h.harm === 'pinch') { n.pinch++; if (!heldOne) fail(`${at}: a pinch on a note that isn't held at ${h.step}`); }
        if (h.harm === 'natural') {
          n.natural++;
          // (a planned solo's last note carries into the next section with the bar: a late bend or a let-down on it is that)
          const carried = h === last && !h.bend;
          if (!heldOne || h.bend || (!carried && (h.unbend || h.lateBend)) || !HARMONIC_NOTES.has(h.notes[0] - (carried ? h.lateBend ?? 0 : 0))) fail(`${at}: a natural harmonic that can't be one at ${h.step} (${h.notes[0]})`);
        }
        if (h.dive) { n.dive++; if (h.mute || h.trill || h.tremolo || ![1, 2, 5, 7, 12, 24].includes(h.dive)) fail(`${at}: a dive of ${h.dive} on a note that can't take it at ${h.step}`); }
        if (h.feedback) { n.feedback++; if ((h !== last && (h.notes.length !== 1 || h.len < 12)) || ![12, 19].includes(h.feedback)) fail(`${at}: feedback not on the last note or a long one`); }
        if (h.scrape) {
          n.scrape++;
          const k = order.indexOf(h), before = k > 0 ? h.step - (order[k - 1].step + order[k - 1].len) : Infinity;
          if (!sec.section?.solo || ![4, 8].includes(h.scrape) || (h !== first && before < h.scrape)) fail(`${at}: a scrape not into the solo or a phrase after a rest`);
        }
      }
      if ((Object.keys(n) as LeadSound[]).some((s) => n[s] > MOST[s])) fail(`${at}: too many in one solo ${JSON.stringify(n)}`);
      for (const s of Object.keys(n) as LeadSound[]) { count[g][s] += n[s] ? 1 : 0; count[g].all += n[s]; }
    });
    // the same seed, the same marks
    if (i < 6 && JSON.stringify(build(g, i, writer, 'on').map((x) => x.guitar2)) !== JSON.stringify(on.map((x) => x.guitar2))) fail(`${at}: not the same twice`);
  }
}

// solos with each sound, by genre
console.log('genre      solos  pinch natural  dive feedback scrape  a solo  (share of solos with it; sounds a solo)');
for (const g of GENRES) {
  const c = count[g], p = (k: LeadSound) => `${Math.round((100 * c[k]) / Math.max(1, c.solos))}%`.padStart(6);
  console.log(`${g.padEnd(10)} ${String(c.solos).padStart(5)} ${p('pinch')} ${p('natural').padStart(7)} ${p('dive')} ${p('feedback').padStart(8)} ${p('scrape')}  ${(c.all / Math.max(1, c.solos)).toFixed(1).padStart(6)}`);
}
const share = (g: string, k: LeadSound) => count[g][k] / Math.max(1, count[g].solos);
if (share('metal', 'pinch') <= share('pop', 'pinch')) fail('metal does not pinch more than pop');
if (share('metal', 'dive') <= share('pop', 'dive')) fail('metal does not dive more than pop');
for (const k of ['pinch', 'natural', 'dive', 'feedback', 'scrape'] as LeadSound[]) if (!GENRES.some((g) => count[g][k])) fail(`${k}: never used`);

console.log(bad ? `${bad} problem(s)` : 'lead guitar sounds: all good');
process.exit(bad ? 1 : 0);
