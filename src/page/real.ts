// The real sound button: the guitars through real amps and the singer's lines polished, prepared on request.

import { $ } from './dom';
import type { PageContext } from './context';

/** Wire the button. Returns showReal, which main.ts calls whenever the song or its parts change. */
export function setupReal(ctx: PageContext) {
  const { engine } = ctx;
  const realBtn = $<HTMLButtonElement>('realamps');
  const realHint = $('realhint');
  let preparing = false;
  // the real sound, prepared on request (all at once, so playback stays smooth), then used when playing:
  // the guitars through real amps, and the singer's lines polished (cleaned up, through a vocal chain)
  const realList = () => { const track = ctx.track(), idea = ctx.idea(); return track ? track.sections : idea ? [idea] : []; };
  function showReal() {
    if (preparing) return;
    const list = realList();
    const st = list.length ? engine.realStateFor(list) : 'none';
    const amps = list.length ? engine.ampStateFor(list) : 'none';
    const voice = list.length && engine.singsIn(list);
    const on = engine.realAmpsOn && st === 'ready';
    // what it does here: the amps (if this has driven guitars and they can run), the voice (if someone sings)
    const what = [amps !== 'none' && amps !== 'failed' ? 'guitars through real amps (Marshall, Fender for clean, a dUg for driven bass)' : '', voice ? 'the voice cleaned up and through a vocal chain (tube preamp, opto compressor)' : ''].filter(Boolean).join('; ');
    realBtn.disabled = st === 'none' || st === 'failed';
    realBtn.textContent = on ? 'Real sound on ✓' : st === 'todo' ? 'Prepare real sound' : st === 'ready' ? 'Use real sound' : 'Real sound';
    realHint.textContent = st === 'failed' ? 'Real amps can\'t run on this device.'
      : st === 'none' ? 'For electric guitars, driven bass and the singer (none in this one).'
      : on ? `On: ${what}. Tap to go back.`
      : st === 'ready' ? 'Prepared: tap to use it.'
      : engine.realAmpsOn ? 'Changed since: prepare again for the real sound.'
      : `Real sound: ${what}. Takes a moment, then plays smoothly.`;
  }
  engine.onRealChange = showReal;
  realBtn.onclick = async () => {
    // tap while preparing: cancel; tap when on: back to the simple sound
    if (preparing) { engine.setRealAmps(false); return; }
    const list = realList();
    if (!list.length) return;
    if (engine.realAmpsOn && engine.realStateFor(list) === 'ready') { engine.setRealAmps(false); return; }
    // preparing takes the computer's full attention: stop playback first
    if (engine.playing) { engine.stop(); ctx.setPlaying(false); }
    preparing = true;
    const label = (p: number) => { realBtn.textContent = `Preparing… ${Math.round(p * 100)}% · tap to cancel`; };
    label(0);
    realHint.textContent = 'Polishing the voice, and running the guitars through the amps, section by section.';
    const st = await engine.prepareRealAmps(list, label);
    preparing = false;
    showReal();
    if (st === 'ready' && engine.realAmpsOn) ctx.setStatus('Real sound ready — tap Play.');
    else if (st === 'failed') ctx.setStatus('Real amps didn\'t work here — playing the simple amp.');
  };

  return showReal;
}
