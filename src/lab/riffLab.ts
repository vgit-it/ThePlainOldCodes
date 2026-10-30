// The riff lab page (riff-lab.html, not linked): pick a key and a jam, write a dozen riffs with the riff writer
// (src/parts/riffwriter.ts), tap one to hear it over drums and bass that follow it, keep the ones you like.
// The jam is a real riff-genre idea from the generator with the key, mode, chords and tuning set; the riff
// replaces its guitar, and the drums and bass are written to it the way a riff genre's are. Docs: docs/RIFF-LAB.md.

import '../audio/live';
import * as Tone from 'tone';
import { Engine } from '../audio/engine';
import type { ChordInstrumentId } from '../audio/instruments';
import type { RiffStyle } from '../genres';
import { buildIdea, planSong, withSheet } from '../generator';
import type { GenOptions, GuitarHit, Idea, Seeds, SheetCell } from '../idea';
import { generateRiffBass } from '../parts/bass';
import { generateHeavyDrums } from '../parts/heavyDrums';
import { FEELS, FEEL_ORDER, type RiffFeel, type RiffFollow, type RiffInfo, type RiffRegister, STYLE_LABEL, WRITTEN_STYLES, type WrittenRiff, type WrittenStyle, writeRiff } from '../parts/riffwriter';
import { pickRiffPlayer, playRiffPart } from '../players/rhythm';
import { Rng } from '../rng';
import { NOTE_NAMES, SCALES, chordName, degreeChord, type Mode } from '../theory';
import { TUNINGS } from '../theory/fretboard';
import { PROGRESSIONS } from '../verse/verse';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const mod = (n: number, m: number) => ((n % m) + m) % m;
const DEGREE = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
/** A pitch of the riff by name; a note below the root has an arrow. */
const degName = (d: number) => (d === 12 ? '8ve' : DEGREE[mod(d, 12)] + (d < 0 ? '↓' : ''));

/* ---- the controls */

const keySel = $<HTMLSelectElement>('key');
const modeSel = $<HTMLSelectElement>('mode');
const progSel = $<HTMLSelectElement>('prog');
const genreSel = $<HTMLSelectElement>('genre');
const tuningSel = $<HTMLSelectElement>('tuning');
const styleSel = $<HTMLSelectElement>('style');
const style2Sel = $<HTMLSelectElement>('style2');
const feelSel = $<HTMLSelectElement>('feel');
const followSel = $<HTMLSelectElement>('follow');
const registerSel = $<HTMLSelectElement>('register');
const triesSel = $<HTMLSelectElement>('tries');
const bpmInput = $<HTMLInputElement>('bpm');

NOTE_NAMES.forEach((n, i) => keySel.add(new Option(n, String(i), i === 4, i === 4)));
(Object.keys(SCALES) as Mode[]).forEach((m) => modeSel.add(new Option(m, m, m === 'minor', m === 'minor')));
tuningSel.add(new Option('The genre\'s own', ''));
Object.values(TUNINGS).forEach((t) => tuningSel.add(new Option(t.name, t.id)));
styleSel.add(new Option('Auto (the genre\'s own mix)', ''));
style2Sel.add(new Option('Same', ''));
for (const s of WRITTEN_STYLES) { styleSel.add(new Option(STYLE_LABEL[s], s)); style2Sel.add(new Option(STYLE_LABEL[s], s)); }
feelSel.add(new Option('Auto (by the genre)', ''));
FEEL_ORDER.forEach((f) => feelSel.add(new Option(FEELS[f].label, f)));

function fillProgs() {
  progSel.innerHTML = '';
  progSel.add(new Option('One chord (the easiest to hear a riff on)', '-1'));
  PROGRESSIONS[modeSel.value as Mode].forEach((p, i) => progSel.add(new Option(p.name, String(i))));
}

/* ---- the jam */

let bandSeed = 'riff-jam';
let seeds: Seeds = seedsOf(bandSeed);
function seedsOf(s: string): Seeds { return { song: s, chords: s, drums: s, strum: s, bass: s, guitar2: s }; }

const engine = new Engine();
let jam: Idea | null = null;
let jamKey = '';
/** The chord of each bar, for the picture. */
let barChords: string[] = [];

function buildJam(): Idea {
  const mode = modeSel.value as Mode;
  const key = Number(keySel.value);
  const p = Number(progSel.value);
  const degrees = p < 0 ? [0] : PROGRESSIONS[mode][p].degrees;
  const chords = degrees.map((d) => degreeChord(SCALES[mode], d));
  // a chord every 2 bars (the progression looped to fill 8 bars)
  const sheet: SheetCell[] = [];
  for (let b = 0; b < 8; b++) { const c = chords[Math.floor(b / 2) % chords.length]; sheet.push([c.root, c.q], [c.root, c.q]); }
  const opts: GenOptions = { genre: genreSel.value as GenOptions['genre'], meter: '4/4', weirdness: 0, bpm: Number(bpmInput.value), key, mode, chords: sheet };
  const song = planSong(new Rng(seeds.song), opts);
  if (tuningSel.value) song.tuning = TUNINGS[tuningSel.value];
  const idea = buildIdea(opts, seeds, song, withSheet(opts, seeds, song));
  idea.guitar2 = [];
  barChords = Array.from({ length: 8 }, (_, b) => chordName(key, idea.chords.timeline[idea.chords.chordIdx[b * 16]].chord));
  return idea;
}

/** The riff goes in as the idea's guitar; the drums and bass are written to it, and the riff player plays it (accents, a hand that drifts). */
function applyRiff(idea: Idea, w: WrittenRiff) {
  const { song } = idea;
  // (the drums read the riff's style for each half: cymbals, half-time, how the kick locks)
  const [h0, h1] = w.info.halves;
  song.sections = [...new Array<RiffStyle>(4).fill(h0.style), ...new Array<RiffStyle>(4).fill(h1.style)];
  idea.drums = generateHeavyDrums(new Rng(`${seeds.drums}-riff`), song, w.part);
  const { bass, lens } = generateRiffBass(song, idea.chords, idea.drums, w.part);
  idea.bass = bass;
  idea.bassLen = lens;
  idea.guitar = w.part.hits.map((h) => ({ ...h }));
  const band = `${seeds.song}-band`;
  playRiffPart(idea, pickRiffPlayer(band, song.genre), band, new Rng(`${seeds.strum}-rhythm`));
}

/* ---- the riffs */

/** The seeds on the list, and the riff written from each with the jam and the writer's options now. */
let seedList: string[] = [];
let riffs: (WrittenRiff | null)[] = [];
let current = -1;

const newSeed = () => Math.random().toString(36).slice(2, 8);
/** What a riff is, in words: its styles, and the single-note feel if it has one. */
function titleOf(i: RiffInfo): string {
  const [a, b] = i.halves;
  const styles = a.style === b.style ? STYLE_LABEL[a.style] : `${STYLE_LABEL[a.style]} → ${STYLE_LABEL[b.style]}`;
  return i.feel ? `${styles} · ${FEELS[i.feel].label}` : styles;
}
/** The pitches of both halves, by name. */
const pitchesOf = (i: RiffInfo) => i.halves.map((h) => h.pitches.map(degName).join(' ')).join(' | ');

const riffOptions = () => ({
  styles: styleSel.value ? [styleSel.value as WrittenStyle, (style2Sel.value || styleSel.value) as WrittenStyle] as [WrittenStyle, WrittenStyle] : undefined,
  feel: (feelSel.value || undefined) as RiffFeel | undefined,
  follow: followSel.value as RiffFollow,
  register: (registerSel.value || undefined) as RiffRegister | undefined,
  tries: Number(triesSel.value),
});

function writeAll() {
  if (!jam) return;
  const o = riffOptions();
  const { song, chords } = jam;
  riffs = seedList.map((s) => writeRiff(s, song, chords, o));
  renderList();
}

/* ---- picture */

const canvas = $<HTMLCanvasElement>('roll');
let hitsNow: GuitarHit[] = [];
let playG = -1;
function draw() {
  const dpr = devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const ink = getComputedStyle(document.body).color, accent = css.getPropertyValue('--accent'), muted = css.getPropertyValue('--muted');
  const top = 26, total = 128, sw = w / total;
  const ms = hitsNow.flatMap((x) => x.notes);
  const lo = (ms.length ? Math.min(...ms) : 40) - 2, hi = (ms.length ? Math.max(...ms) : 60) + 3;
  const nh = (h - top) / (hi - lo + 1);
  g.font = '12px system-ui'; g.textBaseline = 'middle';
  for (let b = 0; b < 8; b++) {
    g.fillStyle = muted; g.globalAlpha = 0.35; g.fillRect(b * 16 * sw, top, 1, h - top);
    g.globalAlpha = 1; g.fillStyle = ink;
    if (barChords[b] && barChords[b] !== barChords[b - 1]) g.fillText(barChords[b], b * 16 * sw + 5, 12);
  }
  for (const x of hitsNow) {
    const on = playG >= x.step && playG < x.step + x.len;
    // a palm mute is drawn fainter, a ghost note fainter still
    g.globalAlpha = x.mute === 'dead' ? 0.3 : x.mute === 'palm' ? 0.6 : 1;
    x.notes.forEach((m) => {
      g.fillStyle = on ? ink : accent;
      g.fillRect(x.step * sw + 1, top + (hi - m) * nh, Math.max(2, x.len * sw - 2), nh - 1);
    });
    g.globalAlpha = 1;
  }
  if (playG >= 0) { g.fillStyle = ink; g.globalAlpha = 0.5; g.fillRect(playG * sw, top, 1.5, h - top); g.globalAlpha = 1; }
}
addEventListener('resize', draw);

/* ---- putting it together */

const status = $('status');
const playBtn = $<HTMLButtonElement>('play');
const realBtn = $<HTMLButtonElement>('real');
const realHint = $('realHint');
let preparing = false;

/** Show the riff chosen: written into the jam, set on the engine, drawn. */
function show() {
  const w = riffs[current];
  if (!jam || !w) {
    hitsNow = [];
    draw();
    $('info').textContent = riffs.length && current >= 0 ? 'The writer can\'t write this one (4/4 riff songs only).' : 'Tap a riff below.';
    return;
  }
  applyRiff(jam, w);
  engine.setIdea(jam, true);
  hitsNow = jam.guitar ?? [];
  draw();
  const i = w.info;
  const forms = i.halves.map((h) => h.form).join(' | ');
  const perBar = i.halves.map((h) => h.perBar).join(' | ');
  $('info').textContent = `${titleOf(i)} · form ${forms} · pitches ${pitchesOf(i)} · hits a bar ${perBar} · ends with ${i.halves[1].turn} · seed ${seedList[current]}`;
  showReal();
}

function update(rebuild: boolean) {
  const k = [keySel.value, modeSel.value, progSel.value, genreSel.value, tuningSel.value, bpmInput.value, bandSeed].join('|');
  if (rebuild || !jam || k !== jamKey) { jam = buildJam(); jamKey = k; }
  writeAll();
  current = Math.min(current, riffs.length - 1);
  show();
}

function showReal() {
  if (!jam) return;
  const st = engine.realStateFor([jam]);
  realBtn.textContent = preparing ? 'Preparing… tap to cancel' : engine.realAmpsOn && st === 'ready' ? 'Real sound on · tap to go back' : 'Prepare real sound';
  realHint.textContent = st === 'failed' ? 'Real amps can\'t run here; the simple amp plays.'
    : engine.realAmpsOn && st !== 'ready' ? 'Riff changed since: prepare again for the real sound.'
    : 'Runs the guitar and bass through the real amps. Redo it after you pick another riff.';
}

realBtn.onclick = async () => {
  if (!jam) return;
  if (preparing) { engine.setRealAmps(false); return; }
  if (engine.realAmpsOn && engine.realStateFor([jam]) === 'ready') { engine.setRealAmps(false); showReal(); return; }
  if (engine.playing) { engine.stop(); setPlaying(false); }
  preparing = true;
  await engine.prepareRealAmps([jam], (p) => { realBtn.textContent = `Preparing… ${Math.round(p * 100)}% · tap to cancel`; });
  preparing = false;
  showReal();
};

function setPlaying(on: boolean) { playBtn.textContent = on ? 'Stop' : 'Play'; }

async function play() {
  if (!jam) return;
  if (engine.playing) { engine.stop(); setPlaying(false); return; }
  if (current < 0) select(0, false);
  await engine.start();
  setPlaying(true);
}
playBtn.onclick = play;
$('reroll').onclick = () => { bandSeed = newSeed(); seeds = seedsOf(bandSeed); update(true); };

engine.onStatus = (m) => { status.textContent = m; };
engine.onStep = (_i, _idx, g, time) => {
  const delay = Math.max(0, (time - Tone.getContext().now()) * 1000);
  setTimeout(() => { if (engine.playing) { playG = g; draw(); } }, delay);
};
engine.onStop = () => { playG = -1; draw(); setPlaying(false); };

/* ---- the list, and the keepers */

const listEl = $('list');
const keepEl = $('keepers');

/** Everything that makes this riff again: the jam, the writer's options and the seed. */
interface Keeper { id: string; seed: string; key: number; mode: string; prog: string; genre: string; tuning: string; bpm: number; style: string; style2: string; feel: string; follow: string; register: string; tries: number; band: string; label: string }
let keepers: Keeper[] = [];
try { keepers = JSON.parse(localStorage.getItem('riff-lab-keepers') ?? '[]'); } catch { keepers = []; }
const saveKeepers = () => { try { localStorage.setItem('riff-lab-keepers', JSON.stringify(keepers)); } catch { /* no storage here: kept for this visit only */ } };

function keeperOf(i: number): Keeper {
  const w = riffs[i]!;
  const k = { seed: seedList[i], key: Number(keySel.value), mode: modeSel.value, prog: progSel.value, genre: genreSel.value, tuning: tuningSel.value, bpm: Number(bpmInput.value), style: styleSel.value, style2: style2Sel.value, feel: feelSel.value, follow: followSel.value, register: registerSel.value, tries: Number(triesSel.value), band: bandSeed };
  return { ...k, id: JSON.stringify(k), label: `${NOTE_NAMES[k.key]} ${k.mode} · ${titleOf(w.info)} · ${pitchesOf(w.info)}` };
}

function renderList() {
  listEl.innerHTML = '';
  riffs.forEach((w, i) => {
    const row = document.createElement('div');
    row.className = 'item';
    const pick = document.createElement('button');
    pick.className = 'pick' + (i === current ? ' on' : '');
    const text = document.createElement('span');
    const title = document.createElement('span');
    const sub = document.createElement('small');
    sub.className = 'mono';
    if (w) {
      const [a, b] = w.info.halves;
      title.textContent = `${titleOf(w.info)} · ${pitchesOf(w.info)}`;
      sub.textContent = a.style === b.style ? `${a.grid} · ${a.form} · ${a.perBar} a bar` : `${a.grid} → ${b.grid}`;
    } else { title.textContent = 'Can\'t write this one'; }
    text.append(title, sub);
    const score = document.createElement('small');
    score.className = 'score';
    score.textContent = w ? `${w.info.score.toFixed(1)}` : '';
    pick.append(text, score);
    pick.onclick = () => select(i, true);
    const heart = document.createElement('button');
    heart.className = 'heart' + (w && keepers.some((k) => k.id === keeperOf(i).id) ? ' on' : '');
    heart.textContent = heart.classList.contains('on') ? '♥' : '♡';
    heart.disabled = !w;
    heart.title = 'Keep this riff';
    heart.onclick = () => {
      const k = keeperOf(i);
      keepers = keepers.some((x) => x.id === k.id) ? keepers.filter((x) => x.id !== k.id) : [...keepers, k];
      saveKeepers();
      renderList();
      renderKeepers();
    };
    row.append(pick, heart);
    listEl.append(row);
  });
}

function renderKeepers() {
  keepEl.innerHTML = '';
  if (!keepers.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'None yet. Tap the heart on a riff you like.'; keepEl.append(p); return; }
  for (const k of keepers) {
    const row = document.createElement('div');
    row.className = 'item';
    const b = document.createElement('button');
    b.className = 'pick';
    const t = document.createElement('span');
    t.textContent = k.label;
    const s = document.createElement('small');
    s.textContent = `seed ${k.seed}`;
    b.append(t, s);
    b.onclick = () => load(k);
    const x = document.createElement('button');
    x.className = 'heart';
    x.textContent = '✕';
    x.onclick = () => { keepers = keepers.filter((y) => y.id !== k.id); saveKeepers(); renderList(); renderKeepers(); };
    row.append(b, x);
    keepEl.append(row);
  }
}

/** Set everything back as it was when the riff was kept, and write it. */
function load(k: Keeper) {
  keySel.value = String(k.key);
  modeSel.value = k.mode;
  fillProgs();
  progSel.value = k.prog;
  genreSel.value = k.genre;
  tuningSel.value = k.tuning;
  bpmInput.value = String(k.bpm);
  styleSel.value = k.style ?? '';
  style2Sel.value = k.style2 ?? '';
  feelSel.value = k.feel;
  followSel.value = k.follow;
  registerSel.value = k.register;
  triesSel.value = String(k.tries);
  bandSeed = k.band;
  seeds = seedsOf(bandSeed);
  seedList = [k.seed];
  current = 0;
  update(true);
}

function select(i: number, autoplay: boolean) {
  current = i;
  listEl.querySelectorAll('.pick').forEach((b, j) => b.classList.toggle('on', j === i));
  show();
  if (autoplay && !engine.playing && !playBtn.disabled) void play();
}

function writeNew(list: string[]) {
  seedList = list;
  current = -1;
  update(false);
}

$('write').onclick = () => writeNew(Array.from({ length: 12 }, newSeed));
$('seedGo').onclick = () => { const s = $<HTMLInputElement>('seed').value.trim(); if (s) { writeNew([s]); select(0, true); } };
$('copyKeep').onclick = async () => {
  try { await navigator.clipboard.writeText(keepers.map((k) => JSON.stringify(k)).join('\n')); status.textContent = `Copied ${keepers.length}.`; } catch { status.textContent = 'Copying isn\'t allowed here.'; }
};
$('clearKeep').onclick = () => { keepers = []; saveKeepers(); renderList(); renderKeepers(); };

for (const el of [keySel, genreSel, tuningSel, bpmInput, progSel]) el.addEventListener('change', () => update(false));
modeSel.addEventListener('change', () => { fillProgs(); update(true); });
for (const el of [styleSel, style2Sel, feelSel, followSel, registerSel, triesSel]) el.addEventListener('change', () => { style2Sel.disabled = !styleSel.value; update(false); });
style2Sel.disabled = true;
$('amp').addEventListener('change', () => engine.setChordInstrument($<HTMLSelectElement>('amp').value as ChordInstrumentId));
const levels = () => {
  engine.setVolume('chords', Number($<HTMLInputElement>('vGuitar').value));
  for (const p of ['drums', 'bass'] as const) engine.setVolume(p, Number($<HTMLInputElement>('vBand').value));
};
$('vGuitar').addEventListener('input', levels);
$('vBand').addEventListener('input', levels);

fillProgs();
renderKeepers();
engine.setChordInstrument('electric-dist');
levels();
writeNew(Array.from({ length: 12 }, newSeed));
void engine.loadCore().then(() => { playBtn.disabled = false; status.textContent = ''; });
