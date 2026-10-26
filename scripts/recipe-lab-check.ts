// Checks the lick library and the recipe lab's helpers (docs/RECIPE-LAB.md): the file is valid and written the way
// the lab writes it, every lick's notes read back the same, the app's live licks are exactly the file's live ones in
// order, every lick can be fingered as tab in every key and the tab gives back the same notes, and the facts and
// guesses are sound.
//   npm run recipe-lab-check
import { readFileSync } from 'node:fs';
import { LIBRARY } from '../src/parts/licks';
import { MAX_FRET, factsOf, finger, guessOf, lift, semiFromTab, tabRoot } from '../src/recipes/facts';
import { GENRES, type LickFile, MOODS, ROLES, WHO, formatFile, parseNotes, problems, spanOf, writeNotes } from '../src/recipes/library';

let bad = 0;
const fail = (m: string) => { bad++; console.log('FAIL ' + m); };

const text = readFileSync('src/recipes/licks.json', 'utf8').replace(/\r\n/g, '\n');
const file = JSON.parse(text) as LickFile;

// the file
for (const p of problems(file)) fail(p);
if (formatFile(file) !== text) fail('the file is not written the way the lab writes it (save it from the lab, or match formatFile)');
if (formatFile(JSON.parse(formatFile(file))) !== formatFile(file)) fail('writing the file twice changes it');

// the notes read back the same
for (const l of file.licks) {
  const ns = parseNotes(l.notes);
  if (JSON.stringify(parseNotes(writeNotes(ns))) !== JSON.stringify(ns)) fail(`${l.id}: the notes don't read back the same`);
}

// the app plays the live ones, in file order, as written
const live = file.licks.filter((l) => l.status === 'live');
if (LIBRARY.length !== live.length) fail(`the app has ${LIBRARY.length} licks, the file ${live.length} live ones`);
live.forEach((l, i) => {
  const a = LIBRARY[i];
  if (!a || a.name !== l.name || JSON.stringify(a.who) !== JSON.stringify(l.who) || a.speed !== l.speed || a.q !== l.q
    || JSON.stringify(a.notes) !== JSON.stringify(parseNotes(l.notes)) || a.span !== spanOf(a.notes)) fail(`${l.id}: the app's copy differs`);
});

// tab: every lick in every key, and the tab gives back the notes
let fingered = 0;
for (const l of file.licks) {
  const ns = parseNotes(l.notes);
  for (let key = 0; key < 12; key++) {
    const f = finger(ns, tabRoot(key));
    if (!f) { fail(`${l.id}: can't be fingered over ${key}`); continue; }
    fingered++;
    f.at.forEach((at, i) => {
      const n = ns[i];
      if (at.fret < 0 || at.fret > MAX_FRET || at.str < 1 || at.str > 6) fail(`${l.id}: note ${i + 1} off the neck`);
      if (n.dyad !== undefined && (at.lowStr === undefined || at.lowStr <= at.str)) fail(`${l.id}: note ${i + 1}'s double-stop isn't on a lower string`);
      if (semiFromTab(at.str, at.fret, f.base, lift(n)) !== n.semi) fail(`${l.id}: note ${i + 1} reads back from the tab as another note`);
    });
  }
}

// facts and guesses
const roles: Record<string, number> = {};
for (const l of file.licks) {
  const f = factsOf(l), g = guessOf(l);
  if (!(f.length > 0 && f.count > 0 && Number.isFinite(f.perBeat) && f.range >= 0)) fail(`${l.id}: odd facts`);
  if (!g.role.length || g.role.some((r) => !ROLES.includes(r))) fail(`${l.id}: odd job guess ${g.role}`);
  if (g.genres.some((x) => !(GENRES as readonly string[]).includes(x)) || g.moods.some((x) => !(MOODS as readonly string[]).includes(x))) fail(`${l.id}: odd genre or mood guess`);
  if (!(g.energy >= 1 && g.energy <= 5)) fail(`${l.id}: energy guess ${g.energy}`);
  for (const r of l.role?.length ? l.role : g.role) roles[r] = (roles[r] ?? 0) + 1;
}
// a guess has to be a guess: every job but the rare ones is guessed for something
for (const r of ['phrase', 'fill', 'ramp', 'peak']) if (!roles[r]) fail(`no lick is guessed or marked as ${r}`);

const by = WHO.map((w) => `${w} ${file.licks.filter((l) => l.who[0] === w).length}`).join(', ');
const marked = file.licks.filter((l) => l.role?.length).length;
console.log(`${file.licks.length} licks (${live.length} live, ${file.licks.length - live.length} draft): ${by}`);
console.log(`jobs marked on ${marked}; marked or guessed: ${Object.entries(roles).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`fingered in all 12 keys: ${fingered} of ${file.licks.length * 12}`);
console.log(bad ? `${bad} problems` : 'all good');
process.exit(bad ? 1 : 0);
