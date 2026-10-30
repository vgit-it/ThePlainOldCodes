// "Keep playing with the screen off" (docs/BACKGROUND.md). Android only, behind a switch.
// Android pauses a page's sound when the screen locks, unless the page is playing a media file. So while
// the band plays (and the switch is on) the page also loops a near-silent file, shows a lock-screen player
// (play / stop), and schedules notes further ahead while the page is hidden.

import * as Tone from 'tone';
import type { Engine } from '../audio/engine';
import { isAndroidAgent, silentWav } from '../audio/silence';
import { $ } from './dom';

const KEY = 'mig.background';

export interface BackgroundHooks {
  engine: Engine;
  /** Start / stop the band (what the Play button does). */
  play: () => Promise<void>;
  stop: () => void;
  /** What the lock screen shows. */
  title: () => string;
}

/** Wires the switch. Returns what main.ts calls whenever the band starts or stops. */
export function setupBackground(h: BackgroundHooks): { setPlaying: (on: boolean) => void } {
  if (!isAndroidAgent(navigator.userAgent) || !('mediaSession' in navigator)) return { setPlaying() {} };

  const row = $('bgrow');
  const box = $<HTMLInputElement>('bgswitch');
  row.hidden = false;
  let on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked: off */ }
  box.checked = on;

  let playing = false;
  let audio: HTMLAudioElement | null = null;
  const session = navigator.mediaSession;

  const quiet = () => {
    if (audio) return audio;
    audio = new Audio(URL.createObjectURL(new Blob([silentWav() as BlobPart], { type: 'audio/wav' })));
    audio.loop = true;
    // the phone paused our sound (a call, another player): the band stops too
    audio.addEventListener('pause', () => { if (on && playing) h.stop(); });
    return audio;
  };

  const sync = () => {
    h.engine.setBackground(on && document.hidden);
    if (!on) {
      audio?.pause();
      session.playbackState = 'none';
      return;
    }
    if (playing) {
      quiet().play().catch(() => { /* the phone said no: plays on while the screen is on */ });
      session.metadata = new MediaMetadata({ title: h.title(), artist: 'Plain Old Codes', album: 'The Plain Old Codes' });
      session.playbackState = 'playing';
    } else {
      audio?.pause();
      session.playbackState = 'paused';
    }
  };

  // the lock-screen buttons
  try {
    session.setActionHandler('play', () => { void h.play(); });
    session.setActionHandler('pause', () => { h.stop(); });
    session.setActionHandler('stop', () => { h.stop(); });
  } catch { /* an action this phone doesn't know */ }

  box.onchange = () => {
    on = box.checked;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
    sync();
  };

  document.addEventListener('visibilitychange', () => {
    h.engine.setBackground(on && document.hidden);
    // back on the page: wake the sound if the phone put it to sleep meanwhile
    if (!document.hidden && playing) {
      const ctx = Tone.getContext();
      if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    }
  });

  return { setPlaying(now) { playing = now; sync(); } };
}
