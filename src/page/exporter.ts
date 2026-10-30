// Export: the idea, or the whole track in track mode (MIDI straight away; audio rendered offline first).

import type { MixPart } from '../audio/mixer';
import { type Rendered, encodeMp3, encodeWav, isSilent, renderAudio, zipFiles } from '../export/audio';
import { exportBaseName, toMidi } from '../export/midi';
import { $ } from './dom';
import type { PageContext } from './context';

type ExportKind = 'midi' | 'mp3' | 'wav' | 'stems';
interface ExportFile { bytes: Uint8Array; name: string; type: string }

const STEM_NAMES: Record<MixPart, string> = {
  vocal: 'vocal', backing: 'backing-vocals', chords: 'rhythm-guitar', guitar2: 'guitar-2', bass: 'bass', drums: 'drums', keys: 'piano', pad: 'pad', strings: 'strings', perc: 'percussion',
};

/** Wire the export buttons. Returns buildExport (for the console in dev). */
export function setupExport(ctx: PageContext) {
  const { engine } = ctx;
  const exportButtons = ['ex-mp3', 'ex-wav', 'ex-stems', 'ex-midi'].map((id) => $<HTMLButtonElement>(id));
  let exporting = false;

  /** Build an export file (no download): MIDI straight away, audio rendered offline first. */
  async function buildExport(kind: ExportKind, progress: (msg: string) => void = () => {}): Promise<ExportFile | null> {
    const idea = ctx.idea();
    if (!idea) return null;
    const track = ctx.track();
    const list = track ? track.sections : [idea];
    const base = exportBaseName(idea, !!track);
    if (kind === 'midi') {
      const bytes = toMidi(list, {
        timbre: engine.vocalTimbre,
        chordIdFor: (i) => engine.chordIdFor(i), guitar2IdFor: (i) => engine.guitar2IdFor(i),
        keysFor: (i) => engine.layerFor(i, 'keys'), padFor: (i) => engine.layerFor(i, 'pad'),
        stringsFor: (i) => engine.layerFor(i, 'strings'), percFor: (i) => engine.layerFor(i, 'perc'),
        vocal: engine.vocal, backing: engine.backingVocal,
      });
      return { bytes, name: `${base}.mid`, type: 'audio/midi' };
    }
    const t0 = performance.now();
    let pct = -1;
    // a percentage when the browser reports progress, otherwise the time so far
    const tick = setInterval(() => {
      if (pct < 0) progress(`Rendering audio… ${Math.round((performance.now() - t0) / 1000)} s`);
    }, 500);
    progress('Rendering audio…');
    let r: Rendered;
    try {
      // real amps: the electric guitars (and a driven bass) first (those already prepared while playing are reused)
      const prepared = await engine.prepareFor(list, (p) => {
        pct = Math.round(p * 100);
        progress(`Preparing real amps… ${pct}%`);
      });
      pct = -1;
      r = await renderAudio(list, engine.settings(), kind === 'stems', (p) => {
        pct = Math.round(p * 100);
        progress(`Rendering audio… ${pct}%`);
      }, prepared);
    } finally {
      clearInterval(tick);
    }
    if (kind === 'wav') return { bytes: encodeWav(r.mix, r.sampleRate), name: `${base}.wav`, type: 'audio/wav' };
    if (kind === 'mp3') {
      const bytes = await encodeMp3(r.mix, r.sampleRate, 320, (p) => progress(`Encoding MP3… ${Math.round(p * 100)}%`));
      return { bytes, name: `${base}.mp3`, type: 'audio/mpeg' };
    }
    progress('Packing stems…');
    const files: Record<string, Uint8Array> = { [`${base}-mix.wav`]: encodeWav(r.mix, r.sampleRate) };
    for (const [part, chs] of Object.entries(r.stems!) as [MixPart, Float32Array[]][]) {
      if (!isSilent(chs)) files[`${base}-${STEM_NAMES[part]}.wav`] = encodeWav(chs, r.sampleRate);
    }
    return { bytes: await zipFiles(files), name: `${base}-stems.zip`, type: 'application/zip' };
  }

  function download(f: ExportFile) {
    const url = URL.createObjectURL(new Blob([new Uint8Array(f.bytes)], { type: f.type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function exportFile(kind: ExportKind) {
    if (exporting || !ctx.idea()) return;
    exporting = true;
    exportButtons.forEach((b) => { b.disabled = true; });
    // rendering takes the computer's full attention: stop playback first
    if (kind !== 'midi' && engine.playing) { engine.stop(); ctx.setPlaying(false); }
    const t0 = performance.now();
    try {
      const f = await buildExport(kind, ctx.setStatus);
      if (f) {
        download(f);
        const mb = f.bytes.length / 1048576;
        const secs = Math.round((performance.now() - t0) / 1000);
        ctx.setStatus(`Saved ${f.name} (${mb < 1 ? `${Math.max(1, Math.round(mb * 1024))} KB` : `${mb.toFixed(1)} MB`}${kind === 'midi' ? '' : `, made in ${secs} s`})`);
      }
    } catch (e) {
      ctx.setStatus(`Couldn't export: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      exporting = false;
      exportButtons.forEach((b) => { b.disabled = false; });
      setTimeout(() => { if (!exporting) ctx.setStatus(''); }, 6000);
    }
  }

  $('ex-mp3').onclick = () => exportFile('mp3');
  $('ex-wav').onclick = () => exportFile('wav');
  $('ex-stems').onclick = () => exportFile('stems');
  $('ex-midi').onclick = () => exportFile('midi');

  return buildExport;
}
