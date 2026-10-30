// The recipe lab page (recipe-lab.html, PC only: npm run recipe-lab; docs/RECIPE-LAB.md). The lick library
// (src/recipes/licks.json) to browse, write as tab, mark (job in a solo, genres, moods, energy, credit) and hear
// over a jam, then save straight into the repo through the dev server (vite.config.ts). Live licks are the ones
// the app plays: their notes are locked here, so the songs can't change by accident; a draft copy can be changed.

import '../audio/live';
import bundled from '../recipes/licks.json';
import { Engine } from '../audio/engine';
import type { ChordInstrumentId } from '../audio/instruments';
import { buildIdea, planSong, withSheet } from '../generator';
import { GENRE_LABEL, type Genre } from '../genres';
import type { GenOptions, GuitarHit, Idea, Seeds, SheetCell } from '../idea';
import { MINORISH } from '../parts/guitar2';
import { type LibLick, type LickFit, type PlacedNote, lickFit, placeLibLick, placedHit } from '../parts/licks';
import type { LickKind } from '../players/lead';
import { type Fingered, OPEN, MAX_FRET, factsOf, finger, guessOf, lift, semiFromTab, tabRoot } from '../recipes/facts';
import {
  GENRES, type LibNote, type LickEntry, type LickFile, MOODS, ROLES, type Role, WHO, formatFile, parseNotes, problems, slug, spanOf, writeNotes,
} from '../recipes/library';
import { Rng } from '../rng';
import { MOOD_LABEL, type Mood } from '../tension';
import { NOTE_NAMES, QUALITIES, SCALES, chordName, chordPc, degreeChord, type Mode } from '../theory';
import { TUNINGS } from '../theory/fretboard';
import { PROGRESSIONS } from '../verse/verse';
import * as Tone from 'tone';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const mod = (n: number, m: number) => ((n % m) + m) % m;
const WHO_LABEL: Record<LickKind, string> = { sung: 'Melodic', blues: 'Bluesy', run: 'Shredder', simple: 'Raw', muted: 'Funky' };
const ROLE_LABEL: Record<string, string> = {
  phrase: 'sung phrase', 'lead-in': 'lead-in', tag: 'tag (after a lead-in)', fill: 'fill', build: 'build', ramp: 'ramp (climb into the peak)',
  peak: 'peak', release: 'release (after the peak)', ending: 'ending',
};

/* ---- the library */

const API = '/__recipes/licks';
let file: LickFile = bundled as LickFile;
let canSave = false;
let saved = new Map<string, string>();
let cur = 0;

const lick = () => file.licks[cur];
const isLive = () => lick().status === 'live';
const snapshot = () => { saved = new Map(file.licks.map((l) => [l.id, JSON.stringify(l)])); savedText = formatFile(file); };
let savedText = '';
const changed = (l: LickEntry) => saved.get(l.id) !== JSON.stringify(l);
const dirty = () => formatFile(file) !== savedText;

async function load() {
  try {
    const r = await fetch(API);
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) { file = await r.json(); canSave = true; }
  } catch { /* the built page: read only */ }
  snapshot();
}

function showSaved(msg?: string) {
  const s = $('saveState');
  const d = dirty();
  s.className = d ? 'dirty' : '';
  s.textContent = msg ?? (!canSave ? 'Read only (start it with npm run recipe-lab to save)' : d ? 'Not saved yet' : 'All saved');
  $<HTMLButtonElement>('save').disabled = !canSave || !d;
}

async function save() {
  if (!canSave || !dirty()) return;
  const p = problems(file);
  if (p.length) { showSaved('Can\'t save: ' + p[0]); return; }
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-recipe-lab': '1' }, body: JSON.stringify(file) });
    const out = await r.json();
    if (!r.ok) { showSaved('Can\'t save: ' + (out.problems?.[0] ?? r.statusText)); return; }
    snapshot();
    fillList();
    showSaved(`Saved ${out.count} licks to src/recipes/licks.json`);
    setTimeout(() => showSaved(), 2500);
  } catch (e) { showSaved('Can\'t save: ' + (e as Error).message); }
}

function touched() { showSaved(); refreshListItem(); }

/* ---- the list */

const listEl = $('list');
WHO.forEach((w) => $<HTMLSelectElement>('fWho').add(new Option(WHO_LABEL[w], w)));
ROLES.forEach((r) => $<HTMLSelectElement>('fRole').add(new Option(ROLE_LABEL[r], r)));
const itemOf = new Map<LickEntry, HTMLButtonElement>();

function itemText(l: LickEntry, b: HTMLButtonElement) {
  b.innerHTML = '';
  const top = document.createElement('span');
  top.textContent = l.name;
  if (l.status === 'draft') top.insertAdjacentHTML('beforeend', '<span class="badge draft">draft</span>');
  if (changed(l)) top.insertAdjacentHTML('beforeend', '<span class="badge dirty">changed</span>');
  const sm = document.createElement('small');
  sm.textContent = `${l.speed} · ${l.q === 'any' ? 'any chord' : l.q === 'min' ? 'minor' : 'major'} · ${l.role?.length ? l.role.join(', ') : 'not marked'}${l.credit ? ' · ' + l.credit : ''}`;
  b.append(top, sm);
  b.classList.toggle('on', l === lick());
}

function fillList() {
  listEl.innerHTML = '';
  itemOf.clear();
  const q = $<HTMLInputElement>('q').value.trim().toLowerCase();
  const fw = $<HTMLSelectElement>('fWho').value, fr = $<HTMLSelectElement>('fRole').value, fs = $<HTMLSelectElement>('fStatus').value;
  const shown = file.licks.filter((l) => (!q || `${l.name} ${l.credit ?? ''} ${l.about ?? ''}`.toLowerCase().includes(q))
    && (!fw || l.who.includes(fw as LickKind)) && (!fs || l.status === fs)
    && (!fr || (fr === '-' ? !l.role?.length : l.role?.includes(fr as Role))));
  for (const w of WHO) {
    const ls = shown.filter((l) => l.who[0] === w);
    if (!ls.length) continue;
    const h = document.createElement('h3'); h.textContent = `${WHO_LABEL[w]} (${ls.length})`; listEl.append(h);
    for (const l of ls) {
      const b = document.createElement('button');
      itemText(l, b);
      b.onclick = () => select(file.licks.indexOf(l));
      itemOf.set(l, b);
      listEl.append(b);
    }
  }
  if (!shown.length) listEl.insertAdjacentHTML('beforeend', '<p class="hint">Nothing matches.</p>');
  listEl.style.maxHeight = `calc(100vh - ${listEl.getBoundingClientRect().top + 24}px)`;
}

function refreshListItem() { const b = itemOf.get(lick()); if (b) itemText(lick(), b); }

/* ---- one lick */

let notes: LibNote[] = [];
let sel = -1;
let fing: { base: number; at: Fingered[] } | null = null;
let base = 0;
const keySel = $<HTMLSelectElement>('key');
NOTE_NAMES.forEach((n, i) => keySel.add(new Option(n, String(i), i === 9, i === 9)));
const key = () => Number(keySel.value);

function select(i: number) {
  if (i < 0 || i >= file.licks.length) return;
  itemOf.get(lick())?.classList.remove('on');
  cur = i;
  itemOf.get(lick())?.classList.add('on');
  sel = -1;
  notes = parseNotes(lick().notes);
  fing = null;
  refinger();
  // a minor lick over a minor jam, a major one over a major jam
  const minorJam = MINORISH.includes(modeSel.value as Mode);
  if (lick().q === 'maj' && minorJam) { modeSel.value = 'major'; fillProgs(); }
  if (lick().q === 'min' && !minorJam) { modeSel.value = 'minor'; fillProgs(); }
  showLick();
  take++;
  refresh(true);
}

function refinger() {
  fing = finger(notes, tabRoot(key()), fing?.base);
  base = fing?.base ?? tabRoot(key());
}

function showLick() {
  const l = lick(), live = isLive();
  $('lock').hidden = !live;
  for (const id of ['name', 'who1', 'who2', 'speed', 'qq', 'text']) $<HTMLInputElement>(id).disabled = live;
  $<HTMLButtonElement>('refinger').disabled = live;
  $<HTMLButtonElement>('del').disabled = live;
  $<HTMLInputElement>('name').value = l.name;
  $<HTMLSelectElement>('who1').value = l.who[0];
  $<HTMLSelectElement>('who2').value = l.who[1] ?? '';
  $<HTMLSelectElement>('speed').value = l.speed;
  $<HTMLSelectElement>('qq').value = l.q;
  $('idLine').textContent = `id ${l.id} · ${l.status}${l.source ? ' · ' + l.source : ''}`;
  $<HTMLTextAreaElement>('text').value = l.notes;
  $('textErr').textContent = '';
  for (const k of ['credit', 'source', 'about'] as const) $<HTMLInputElement>(k).value = l[k] ?? '';
  drawTab();
  showNote();
  showMarks();
  showFacts();
}

/** The notes changed (from the tab or the note panel): written back to the lick, everything redrawn. */
function notesChanged(keepSel?: LibNote) {
  notes.sort((a, b) => a.pos - b.pos);
  if (keepSel) sel = notes.indexOf(keepSel);
  lick().notes = writeNotes(notes);
  refinger();
  $<HTMLTextAreaElement>('text').value = lick().notes;
  $('textErr').textContent = '';
  drawTab();
  showNote();
  showMarks();
  showFacts();
  touched();
  refresh(false);
}

/** Every note keeps the string it's drawn on from now on (so an edit doesn't move the others around). */
function pinStrings() { if (fing) notes.forEach((n, i) => { n.str ??= fing!.at[i].str; }); }

/** A note's string and fret changed: its written note follows (a bend stays a bend from the new fret). */
function setFret(n: LibNote, str: number, fret: number): boolean {
  if (fret < 0 || fret > MAX_FRET) return false;
  n.str = str;
  n.semi = semiFromTab(str, fret, base, lift(n));
  return true;
}

function editSel(f: (n: LibNote, at: Fingered) => boolean | void) {
  if (isLive() || sel < 0 || !fing) return;
  pinStrings();
  const n = notes[sel];
  if (f(n, fing.at[sel]) === false) return;
  notesChanged(n);
}

/* ---- the tab */

const svg = $('tab') as unknown as SVGSVGElement;
const tabBox = $('tabBox');
const W = 28, PAD = 34, TOP = 26, GAP = 24;
const NS = 'http://www.w3.org/2000/svg';
const yOf = (str: number) => TOP + (str - 1) * GAP;
const xOf = (step: number) => PAD + step * W;
let playLine: SVGLineElement | null = null;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element = svg): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent.append(e);
  return e;
}

function label(n: LibNote, at: Fingered, prev: LibNote | undefined, low: boolean): string {
  const f = low ? at.lowFret! : at.fret;
  const bendHere = n.dyad === undefined || low;
  let s = n.dead ? 'x' : String(f);
  if (bendHere && n.bend) s += `b${f + n.bend}` + (n.unbend ? `r${f + n.bend - n.unbend}` : '');
  else if (bendHere && n.unbend) s = `pb${f + n.unbend}r${f}`;
  if (low) return s;
  const up = !prev || n.semi >= prev.semi;
  if (n.art === 'legato' && prev) s = (up ? 'h' : 'p') + s;
  if (n.art === 'slide') s = (up ? '/' : '\\') + s;
  if (n.harm === 'natural') s = `<${s}>`;
  if (n.harm === 'pinch') s += ' PH';
  if (n.rake) s = 'rk ' + s;
  if (n.scrape) s = 'sc ' + s;
  if (n.feedback) s += ' fb';
  if (n.dive) s += ` dv${n.dive}`;
  if (n.trill) s += ` tr${n.trill}`;
  if (n.tremolo) s += ' ≡';
  if (n.vib) s += '~';
  return s;
}

function drawTab() {
  svg.innerHTML = '';
  const span = notes.length ? spanOf(notes) : 0;
  const steps = Math.max(32, Math.ceil((span + 6) / 16) * 16);
  const w = xOf(steps) + 10, h = yOf(6) + 20;
  svg.setAttribute('width', String(w)); svg.setAttribute('height', String(h));
  for (let i = 0; i <= steps; i++) {
    if (i % 4) continue;
    el('line', { x1: xOf(i), x2: xOf(i), y1: TOP - 8, y2: yOf(6) + 8, class: i % 16 ? 'beat' : 'bar' });
    if (i < steps) { const t = el('text', { x: xOf(i) + W / 2, y: 9, class: 'num' }); t.textContent = i % 16 ? String((i % 16) / 4 + 1) : `bar ${i / 16 + 1}`; }
  }
  ['e', 'B', 'G', 'D', 'A', 'E'].forEach((s, i) => {
    el('line', { x1: PAD - 4, x2: xOf(steps), y1: yOf(i + 1), y2: yOf(i + 1), class: 'str' });
    const t = el('text', { x: 14, y: yOf(i + 1), class: 'num' }); t.textContent = s;
  });
  // the places to click to add a note
  if (!isLive()) {
    for (let str = 1; str <= 6; str++) for (let i = 0; i < steps; i++) {
      const r = el('rect', { x: xOf(i), y: yOf(str) - GAP / 2, width: W, height: GAP, class: 'hit' });
      r.addEventListener('click', () => addNote(str, i));
    }
  }
  if (fing) {
    notes.forEach((n, i) => {
      const at = fing!.at[i];
      const g = el('g', { class: `note${n.out ? ' out' : ''}${i === sel ? ' sel' : ''}` });
      const x = xOf(n.pos) + W / 2;
      const one = (str: number, low: boolean) => {
        const y = yOf(str);
        el('line', { x1: x, x2: Math.max(x, xOf(n.pos + n.len) - 5), y1: y, y2: y, class: 'tail' }, g);
        const txt = label(n, at, notes[i - 1], low);
        const bw = Math.max(18, txt.length * 7.4 + 8);
        el('rect', { x: x - bw / 2, y: y - 9, width: bw, height: 18, rx: 5, class: 'chip' }, g);
        el('text', { x, y }, g).textContent = txt;
      };
      one(at.str, false);
      if (at.lowStr) one(at.lowStr, true);
      g.addEventListener('click', (e) => { e.stopPropagation(); sel = i; drawTab(); showNote(); tabBox.focus(); });
    });
  } else if (notes.length) {
    el('text', { x: xOf(4), y: yOf(3), class: 'num' }).textContent = 'can\'t be fingered in this key';
  }
  playLine = el('line', { x1: -10, x2: -10, y1: TOP - 10, y2: yOf(6) + 10, class: 'play' });
}

function addNote(str: number, step: number) {
  if (isLive()) return;
  pinStrings();
  const ref = sel >= 0 && fing ? fing.at[sel] : fing?.at[fing.at.length - 1];
  let fret = ref ? ref.fret + (OPEN[6 - ref.str] - OPEN[6 - str]) : 5;
  if (fret < 0 || fret > MAX_FRET) fret = ref?.fret ?? 5;
  const len = sel >= 0 ? notes[sel].len : 2;
  const n: LibNote = { pos: step, semi: 0, len, str };
  setFret(n, str, Math.max(0, Math.min(MAX_FRET, fret)));
  notes.push(n);
  notesChanged(n);
  tabBox.focus();
}

let digits = '', digitAt = 0;
tabBox.addEventListener('keydown', (e) => {
  if (sel < 0 || isLive()) return;
  const k = e.key;
  if (/^\d$/.test(k)) {
    const now = performance.now();
    digits = now - digitAt < 800 && digits.length === 1 && Number(digits + k) <= MAX_FRET ? digits + k : k;
    digitAt = now;
    editSel((x, at) => setFret(x, at.str, Number(digits)));
  } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
    const d = (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 4 : 1);
    editSel((x) => { if (x.pos + d < 0) return false; x.pos += d; });
  } else if ((k === 'ArrowUp' || k === 'ArrowDown') && e.altKey) {
    editSel((x, at) => {
      const s = at.str + (k === 'ArrowUp' ? -1 : 1);
      if (s < 1 || s > 6) return false;
      return setFret(x, s, at.fret + OPEN[6 - at.str] - OPEN[6 - s]);
    });
  } else if (k === 'ArrowUp' || k === 'ArrowDown') {
    editSel((x, at) => setFret(x, at.str, at.fret + (k === 'ArrowUp' ? 1 : -1)));
  } else if (k === '[' || k === ']') {
    const d = (k === '[' ? -1 : 1) * (e.shiftKey ? 4 : 1);
    editSel((x) => { if (x.len + d < 1) return false; x.len += d; });
  } else if (k === 'Delete' || k === 'Backspace') {
    if (notes.length < 2) return;
    pinStrings();
    notes.splice(sel, 1);
    sel = -1;
    notesChanged();
  } else if (k === 'Escape') { sel = -1; drawTab(); showNote(); } else return;
  e.preventDefault();
});

/* ---- the picked note */

const noteCtl = ['nStr', 'nFret', 'nLen', 'nBend', 'nPb', 'nDown', 'nDyad', 'nTrill', 'nLeg', 'nSlide', 'nVib', 'nDead', 'nRake', 'nTrem', 'nOut', 'nHarm', 'nDive', 'nFb', 'nScrape'];
const val = (id: string) => $<HTMLInputElement>(id);

function showNote() {
  const on = sel >= 0 && !!fing;
  $('noteNone').hidden = on;
  for (const id of noteCtl) { val(id).closest('label')!.hidden = !on; val(id).disabled = isLive(); }
  if (!on) return;
  const n = notes[sel], at = fing!.at[sel];
  val('nStr').value = String(at.str);
  val('nFret').value = String(at.fret);
  val('nLen').value = String(n.len);
  val('nBend').value = String(n.bend ?? 0);
  val('nPb').value = String(n.bend ? 0 : n.unbend ?? 0);
  val('nDown').checked = !!(n.bend && n.unbend);
  val('nDyad').value = n.dyad === undefined ? '' : String(n.dyad);
  val('nTrill').value = String(n.trill ?? 0);
  val('nLeg').checked = n.art === 'legato';
  val('nSlide').checked = n.art === 'slide';
  val('nVib').checked = !!n.vib;
  val('nDead').checked = !!n.dead;
  val('nRake').checked = !!n.rake;
  val('nTrem').checked = !!n.tremolo;
  val('nOut').checked = !!n.out;
  val('nHarm').value = n.harm ?? '';
  val('nDive').value = String(n.dive ?? 0);
  val('nFb').value = String(n.feedback ?? 0);
  val('nScrape').value = String(n.scrape ?? 0);
}

const opt = <K extends keyof LibNote>(n: LibNote, k: K, v: LibNote[K] | undefined) => { if (v === undefined || v === 0 || v === false) delete n[k]; else n[k] = v; };

for (const id of noteCtl) val(id).addEventListener('change', () => editSel((n, at) => {
  // the fret the note is played at stays put while its techniques change
  const str = Number(val('nStr').value), fret = Number(val('nFret').value);
  const len = Number(val('nLen').value);
  if (!(len >= 1)) return false;
  n.len = Math.round(len);
  const bend = Number(val('nBend').value), pb = Number(val('nPb').value);
  opt(n, 'bend', bend);
  opt(n, 'unbend', bend ? (val('nDown').checked ? bend : 0) : pb);
  const dy = val('nDyad').value;
  if (dy === '') delete n.dyad; else n.dyad = Number(dy);
  if (n.dyad === 0 && !n.bend) n.bend = 2;
  opt(n, 'trill', Number(val('nTrill').value));
  opt(n, 'art', val('nLeg').checked ? 'legato' : val('nSlide').checked ? 'slide' : undefined);
  opt(n, 'vib', val('nVib').checked);
  opt(n, 'dead', val('nDead').checked);
  opt(n, 'rake', val('nRake').checked);
  opt(n, 'tremolo', val('nTrem').checked);
  opt(n, 'out', val('nOut').checked);
  opt(n, 'harm', (val('nHarm').value || undefined) as LibNote['harm']);
  opt(n, 'dive', Number(val('nDive').value));
  opt(n, 'feedback', Number(val('nFb').value));
  opt(n, 'scrape', Number(val('nScrape').value));
  const moved = str !== at.str ? at.fret + OPEN[6 - at.str] - OPEN[6 - str] : fret;
  return setFret(n, str, str !== at.str && id === 'nStr' ? moved : fret);
}));
// hammer and slide are one or the other
val('nLeg').addEventListener('input', () => { if (val('nLeg').checked) val('nSlide').checked = false; });
val('nSlide').addEventListener('input', () => { if (val('nSlide').checked) val('nLeg').checked = false; });

$<HTMLTextAreaElement>('text').addEventListener('input', (e) => {
  const t = (e.target as HTMLTextAreaElement).value;
  try {
    const ns = parseNotes(t);
    const p = problems({ about: '', licks: [{ ...lick(), notes: t }] });
    if (p.length) throw new Error(p[0].replace(/^lick 1 \([^)]*\): /, ''));
    notes = ns;
    sel = -1;
    lick().notes = writeNotes(notes);
    refinger();
    $('textErr').textContent = '';
    drawTab(); showNote(); showMarks(); showFacts(); touched(); refresh(false);
  } catch (err) { $('textErr').textContent = (err as Error).message; }
});
$('text').addEventListener('blur', () => { if (!$('textErr').textContent) $<HTMLTextAreaElement>('text').value = lick().notes; });

$('refinger').onclick = () => {
  notes.forEach((n) => delete n.str);
  fing = null;
  notesChanged();
};
keySel.addEventListener('change', () => { fing = null; refinger(); drawTab(); showNote(); refresh(false); });

/* ---- name, player, speed, chord */

const who1 = $<HTMLSelectElement>('who1'), who2 = $<HTMLSelectElement>('who2');
WHO.forEach((w) => { who1.add(new Option(WHO_LABEL[w], w)); who2.add(new Option(WHO_LABEL[w], w)); });

function uniqueId(s: string, self?: LickEntry) {
  let id = slug(s), k = 2;
  while (file.licks.some((l) => l !== self && l.id === id)) id = `${slug(s)}-${k++}`;
  return id;
}

$('name').addEventListener('input', () => {
  const l = lick();
  l.name = $<HTMLInputElement>('name').value;
  if (l.status === 'draft' && l.name.trim()) l.id = uniqueId(l.name, l);
  $('idLine').textContent = `id ${l.id} · ${l.status}${l.source ? ' · ' + l.source : ''}`;
  touched();
});
const whoChanged = () => {
  const w = [who1.value, who2.value].filter((x, i, a) => x && a.indexOf(x) === i) as LickKind[];
  lick().who = w;
  showMarks(); touched(); refresh(false);
};
who1.addEventListener('change', whoChanged);
who2.addEventListener('change', whoChanged);
$('speed').addEventListener('change', () => { lick().speed = $<HTMLSelectElement>('speed').value as LickEntry['speed']; showMarks(); touched(); });
$('qq').addEventListener('change', () => { lick().q = $<HTMLSelectElement>('qq').value as LickEntry['q']; showMarks(); showFacts(); touched(); refresh(false); });

$('dup').onclick = () => {
  const l = lick();
  const c: LickEntry = JSON.parse(JSON.stringify(l));
  c.status = 'draft';
  c.name = `${l.name} (my version)`;
  c.id = uniqueId(c.name);
  file.licks.splice(cur + 1, 0, c);
  fillList();
  select(cur + 1);
  touched();
};
$('new').onclick = () => {
  const who = ($<HTMLSelectElement>('fWho').value || lick()?.who[0] || 'sung') as LickKind;
  const l: LickEntry = { id: uniqueId('new lick'), name: 'new lick', status: 'draft', who: [who], speed: 'mid', q: 'any', notes: '0:7:4 4:5:4 8:0:8:v', source: 'own idea' };
  file.licks.push(l);
  $<HTMLSelectElement>('fStatus').value = '';
  $<HTMLInputElement>('q').value = '';
  fillList();
  select(file.licks.length - 1);
  touched();
  $<HTMLInputElement>('name').select();
};
$('del').onclick = () => {
  if (isLive() || !confirm(`Delete the draft "${lick().name}"? (Not gone from the file until you save.)`)) return;
  file.licks.splice(cur, 1);
  fillList();
  select(Math.max(0, cur - 1));
  touched();
};

/* ---- the marks */

type ListKey = 'role' | 'genres' | 'moods';

function chips(id: string, k: ListKey, options: readonly string[], words: (o: string) => string, guess: string[]) {
  const box = $(id);
  box.innerHTML = '';
  const l = lick();
  const marked = l[k] as string[] | undefined;
  for (const o of options) {
    const b = document.createElement('button');
    b.textContent = words(o);
    if (marked?.length ? marked.includes(o) : false) b.classList.add('on');
    else if (!marked?.length && guess.includes(o)) b.classList.add('guess');
    b.onclick = () => {
      const now = [...(marked?.length ? marked : guess)];
      const i = now.indexOf(o);
      if (i >= 0) now.splice(i, 1); else now.push(o);
      const ordered = options.filter((x) => now.includes(x));
      if (ordered.length) (l[k] as string[]) = ordered; else delete l[k];
      showMarks(); touched();
    };
    box.append(b);
  }
}

function showMarks() {
  const l = lick(), g = guessOf(l);
  chips('cRole', 'role', ROLES, (o) => o, g.role);
  chips('cGenres', 'genres', GENRES, (o) => GENRE_LABEL[o as Genre], g.genres);
  chips('cMoods', 'moods', MOODS, (o) => MOOD_LABEL[o as Mood], g.moods);
  const box = $('cEnergy');
  box.innerHTML = '';
  for (let e = 1; e <= 5; e++) {
    const b = document.createElement('button');
    b.textContent = ['', '1 calm', '2', '3', '4', '5 wild'][e];
    if (l.energy === e) b.classList.add('on'); else if (l.energy === undefined && g.energy === e) b.classList.add('guess');
    b.onclick = () => { if (l.energy === e) delete l.energy; else l.energy = e; showMarks(); touched(); };
    box.append(b);
  }
}

$('keep').onclick = () => {
  const l = lick(), g = guessOf(l);
  if (!l.role?.length && g.role.length) l.role = g.role;
  if (!l.genres?.length && g.genres.length) l.genres = g.genres;
  if (!l.moods?.length && g.moods.length) l.moods = g.moods;
  l.energy ??= g.energy;
  showMarks(); touched();
};
for (const k of ['credit', 'source', 'about'] as const) {
  $(k).addEventListener('input', () => {
    const v = $<HTMLInputElement>(k).value;
    if (v.trim()) lick()[k] = v; else delete lick()[k];
    touched();
  });
}

function showFacts() {
  const f = factsOf(lick());
  const cells: [string, string][] = [
    ['Length', `${f.length} 16ths (${(f.length / 4).toFixed(f.length % 4 ? 2 : 0)} beats)`],
    ['Notes', `${f.count} · ${f.perBeat.toFixed(1)} a beat`],
    ['Range', `${f.range} half steps`],
    ['Shape', `${f.contour}, biggest jump ${f.maxLeap}`],
    ['Starts on', `${f.starts}${f.offBeat ? ', off the beat' : ''}`],
    ['Ends on', `${f.ends}${f.strongEnd ? ' (strong)' : ''}`],
    ['Techniques', f.techniques.join(', ') || 'none'],
    ['Outside the key', f.outNotes ? `${f.outNotes} note${f.outNotes > 1 ? 's' : ''} (meant)` : 'none'],
  ];
  $('facts').innerHTML = '';
  for (const [k, v] of cells) { const d = document.createElement('div'); d.innerHTML = `<span>${k}</span>`; d.append(v); $('facts').append(d); }
}

/* ---- the jam (as the lick lab: a real idea with the key, mode and chords set) */

const modeSel = $<HTMLSelectElement>('mode');
const progSel = $<HTMLSelectElement>('prog');
(Object.keys(SCALES) as Mode[]).forEach((m) => modeSel.add(new Option(m, m, m === 'minor', m === 'minor')));
function fillProgs() {
  progSel.innerHTML = '';
  progSel.add(new Option('One chord', '-1'));
  PROGRESSIONS[modeSel.value as Mode].forEach((p, i) => progSel.add(new Option(p.name, String(i))));
}

let bandSeed = 'jam';
const seedsOf = (s: string): Seeds => ({ song: s, chords: s, drums: s, strum: s, bass: s, guitar2: s });
const engine = new Engine();
let jam: Idea | null = null;
let jamKey = '';
let take = 1;
/** Where each placed lick starts in the jam, and its first note's place in the lick (for the playhead on the tab). */
let places: { at: number; p0: number; len: number }[] = [];

function buildJam(): Idea {
  const mode = modeSel.value as Mode;
  const p = Number(progSel.value);
  const degrees = p < 0 ? [0] : PROGRESSIONS[mode][p].degrees;
  const chords = degrees.map((d) => degreeChord(SCALES[mode], d));
  const sheet: SheetCell[] = [];
  for (let b = 0; b < 8; b++) { const c = chords[Math.floor(b / 2) % chords.length]; sheet.push([c.root, c.q], [c.root, c.q]); }
  const opts: GenOptions = { genre: $<HTMLSelectElement>('genre').value as 'rock', meter: '4/4', weirdness: 0, bpm: Number($<HTMLInputElement>('bpm').value), key: key(), mode, chords: sheet };
  const seeds = seedsOf(bandSeed);
  const song = planSong(new Rng(seeds.song), opts);
  const idea = buildIdea(opts, seeds, song, withSheet(opts, seeds, song));
  idea.guitar2 = [];
  return idea;
}

const LO = 62, HI = 81;
const NOTE = (m: number) => NOTE_NAMES[mod(m, 12)];

/** Why the app would skip the lick here (its fit rules, as placeLibLick applies them), checked at one octave. */
function whyNot(l: LibLick, fit: LickFit, at: number, b: number, songKey: number): string[] {
  const out = new Set<string>();
  const p0 = l.notes[0].pos;
  const c = fit.chordAt(at);
  const qs = QUALITIES[c.q] as readonly number[];
  const minor = qs.includes(3) && !qs.includes(4);
  const cn = chordName(songKey, c);
  if (l.q !== 'any' && (l.q === 'min') !== minor) out.add(`a ${l.q === 'min' ? 'minor' : 'major'} lick, over ${cn}`);
  l.notes.forEach((n, i) => {
    const g = at + n.pos - p0, m = b + n.semi;
    const here = n.dyad !== undefined ? [m, m - n.dyad] : [m];
    for (const x of here) if (!n.out && !n.dead && !fit.inKey(x) && !fit.isTone(x, g)) out.add(`${NOTE(x)} isn't in the key (tick "outside the key" if it's meant)`);
    if (n.len >= 4 && !n.tremolo && !n.trill && fit.rubs(m - (n.unbend ?? 0), g)) out.add(`the held ${NOTE(m - (n.unbend ?? 0))} rubs against ${chordName(songKey, fit.chordAt(g))}`);
    if (i === l.notes.length - 1 && !fit.isTone(m - (n.unbend ?? 0), g)) out.add(`it ends on ${NOTE(m - (n.unbend ?? 0))}, not a note of ${chordName(songKey, fit.chordAt(g))}`);
  });
  return [...out];
}

/** The lick as written, over the chord's root near the last note: what's played when the app would skip it. */
function asWritten(l: LibLick, fit: LickFit, end: number, prev: number, songKey: number): { notes: PlacedNote[]; at: number; base: number } {
  const p0 = l.notes[0].pos;
  let at = end - (l.span - p0);
  at = Math.max(0, at - mod(at, 2));
  const root = chordPc(songKey, fit.chordAt(at));
  let b = root + 48;
  for (let x = root + 36; x <= HI; x += 12) if (Math.abs(x + l.notes[0].semi - prev) < Math.abs(b + l.notes[0].semi - prev)) b = x;
  const notes = l.notes.map((n, i) => ({
    step: at + n.pos - p0, midi: b + n.semi, len: i === l.notes.length - 1 ? Math.max(n.len, end - (at + n.pos - p0)) : n.len, vel: n.dead ? 0.55 : 0.85,
    bend: n.bend ?? 0, unbend: n.unbend, art: n.art ?? (i === 0 ? ('pick' as const) : undefined), dyad: n.dyad, trill: n.trill, tremolo: n.tremolo,
    rake: n.rake ? 2 : undefined, dead: n.dead, vib: n.vib && n.len >= 4 ? 24 : undefined,
    harm: n.harm, dive: n.dive, feedback: n.feedback, scrape: n.scrape,
  }));
  return { notes, at, base: b };
}

function lead(idea: Idea): { hits: GuitarHit[]; info: string } {
  const { song, chords } = idea;
  const e = lick();
  const ns = parseNotes(e.notes);
  const l: LibLick = { who: e.who, speed: e.speed, q: e.q, name: e.name, notes: ns, span: spanOf(ns) };
  const rng = new Rng(`lick-${take}`);
  const fit = lickFit(song, chords, null);
  const t = TUNINGS.standard;
  const len = l.span - ns[0].pos;
  const slot = len <= 32 ? 32 : 64;
  const hits: GuitarHit[] = [];
  const skipped: string[] = [];
  let prev = 60 + mod(song.key - 60, 12) + 7, ok = 0;
  places = [];
  for (let s = 0; s < 128 / slot; s++) {
    const start = s * slot, end = start + (len <= 16 ? 16 : len <= 32 ? 32 : 64);
    let placed = placeLibLick(rng, fit, song.key, l, end, LO, HI, prev, 'any', e.who[0], 0.85);
    if (placed) ok++;
    else {
      const w = asWritten(l, fit, end, prev, song.key);
      const why = whyNot(l, fit, w.at, w.base, song.key);
      skipped.push(`over ${chordName(song.key, fit.chordAt(w.at))}: ${why[0] ?? 'no octave in the lead range fits'}`);
      placed = w.notes;
    }
    places.push({ at: placed[0].step, p0: ns[0].pos, len });
    prev = placed[placed.length - 1].midi;
    for (const n of placed) hits.push(placedHit(n, t, 9, false));
  }
  const n = 128 / slot;
  const info = ok === n ? `Plays ${n} times, placed as the app places it (fits every chord).`
    : `The app would skip it ${n - ok} of ${n} times (played as written here). ${[...new Set(skipped)].slice(0, 3).join(' · ')}`;
  return { hits, info };
}

const playBtn = $<HTMLButtonElement>('play');
const realBtn = $<HTMLButtonElement>('real');
let preparing = false;

function refresh(rebuild: boolean) {
  if (!lick()) return;
  const k = [keySel.value, modeSel.value, progSel.value, $<HTMLSelectElement>('genre').value, $<HTMLInputElement>('bpm').value, bandSeed].join('|');
  if (rebuild || !jam || k !== jamKey) { jam = buildJam(); jamKey = k; }
  const p = lead(jam);
  jam.guitar2 = p.hits;
  engine.setIdea(jam, true);
  $('info').textContent = p.info;
  $('info').className = p.info.startsWith('Plays') ? 'hint' : 'hint warn';
  showReal();
}

function showReal() {
  if (!jam) return;
  const st = engine.realStateFor([jam]);
  realBtn.textContent = preparing ? 'Preparing… tap to cancel' : engine.realAmpsOn && st === 'ready' ? 'Real sound on · back to simple' : 'Prepare real sound';
}

realBtn.onclick = async () => {
  if (!jam) return;
  if (preparing) { engine.setRealAmps(false); return; }
  if (engine.realAmpsOn && engine.realStateFor([jam]) === 'ready') { engine.setRealAmps(false); showReal(); return; }
  if (engine.playing) { engine.stop(); playBtn.textContent = 'Play'; }
  preparing = true;
  await engine.prepareRealAmps([jam], (p) => { realBtn.textContent = `Preparing… ${Math.round(p * 100)}% · tap to cancel`; });
  preparing = false;
  showReal();
};

async function play() {
  if (!jam || playBtn.disabled) return;
  if (engine.playing) { engine.stop(); playBtn.textContent = 'Play'; return; }
  refresh(false);
  await engine.start();
  playBtn.textContent = 'Stop';
}
playBtn.onclick = play;
$('reroll').onclick = () => { bandSeed = Math.random().toString(36).slice(2, 7); refresh(true); };
engine.onStatus = (m) => { $('status').textContent = m; };
engine.onStep = (_i, _idx, g, time) => {
  const delay = Math.max(0, (time - Tone.getContext().now()) * 1000);
  setTimeout(() => {
    if (!engine.playing || !playLine) return;
    const p = places.find((x) => g >= x.at && g < x.at + x.len);
    const x = p ? xOf(g - p.at + p.p0) : -10;
    playLine.setAttribute('x1', String(x)); playLine.setAttribute('x2', String(x));
  }, delay);
};
engine.onStop = () => { playBtn.textContent = 'Play'; playLine?.setAttribute('x1', '-10'); playLine?.setAttribute('x2', '-10'); };

modeSel.addEventListener('change', () => { fillProgs(); refresh(true); });
for (const id of ['prog', 'genre', 'bpm']) $(id).addEventListener('change', () => refresh(true));
$('lead').addEventListener('change', () => engine.setGuitar2Instrument($<HTMLSelectElement>('lead').value as ChordInstrumentId));
const levels = () => {
  engine.setVolume('guitar2', Number($<HTMLInputElement>('vLead').value));
  for (const p of ['chords', 'drums', 'bass'] as const) engine.setVolume(p, Number($<HTMLInputElement>('vBand').value));
};
$('vLead').addEventListener('input', levels);
$('vBand').addEventListener('input', levels);

/* ---- keys, filters, start */

for (const id of ['q', 'fWho', 'fRole', 'fStatus']) $(id).addEventListener('input', fillList);
$('save').onclick = save;
addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); return; }
  const t = e.target as HTMLElement;
  if (e.key === ' ' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName)) { e.preventDefault(); void play(); }
});
addEventListener('beforeunload', (e) => { if (canSave && dirty()) e.preventDefault(); });

await load();
fillProgs();
engine.setGuitar2Instrument('electric-crunch');
engine.setChordInstrument('electric-clean');
levels();
fillList();
select(0);
showSaved();
void engine.loadCore().then(() => { playBtn.disabled = false; $('status').textContent = ''; });
