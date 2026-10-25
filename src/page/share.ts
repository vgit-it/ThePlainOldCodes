// The shareable link: the address always holds the current idea (and track), and the buttons that use it.

import type { LayerSettings } from '../audio/engine';
import type { TimbreChoice, VocalChoice } from '../audio/singer';
import type { GenOptions, Seeds } from '../idea';
import type { TrackOptions } from '../track';
import { $ } from './dom';
import type { PageContext } from './context';

export interface Shared { o: GenOptions; s: Seeds; t?: TrackOptions; l?: LayerSettings; v?: VocalChoice; b?: VocalChoice; w?: TimbreChoice }

/** Open a shared link: what the address holds, or null (no link, or one that doesn't open). */
export function readLink(): Shared | null {
  try {
    const h = location.hash.slice(1);
    if (!h) return null;
    const d = JSON.parse(decodeURIComponent(atob(h))) as Shared;
    return d.o && d.s?.song ? d : null;
  } catch {
    return null;
  }
}

/** Keep the address current, and wire the link buttons. Returns the function that refreshes the address. */
export function setupShare(ctx: PageContext) {
  const { engine } = ctx;

  function updateLink() {
    const idea = ctx.idea();
    if (!idea) return;
    const track = ctx.track();
    const layers = engine.layerSettings;
    const data: Shared = { o: idea.opts, s: idea.seeds, ...(track ? { t: track.opts } : {}), ...(Object.keys(layers).length ? { l: layers } : {}), ...(engine.vocal !== 'off' ? { v: engine.vocal } : {}), ...(engine.vocal !== 'off' && engine.backingVocal !== 'auto' ? { b: engine.backingVocal } : {}), ...(engine.vocal !== 'off' && engine.vocalTimbre !== 'auto' ? { w: engine.vocalTimbre } : {}) };
    try {
      history.replaceState(null, '', `#${btoa(encodeURIComponent(JSON.stringify(data)))}`);
    } catch { /* history blocked: no link */ }
  }

  $('copylink').onclick = async () => {
    updateLink();
    try {
      await navigator.clipboard.writeText(location.href);
      ctx.setStatus('Link copied: it opens this exact idea (and track).');
    } catch {
      ctx.setStatus('Copy the address from the address bar to share this idea.');
    }
    setTimeout(() => ctx.setStatus(''), 3000);
  };

  // the band view plays this same song (idea, track, parts and singer travel in the link)
  $('openband').onclick = () => {
    updateLink();
    const url = new URL('band.html', location.href);
    url.searchParams.set('art', '');
    url.hash = location.hash;
    window.open(url, '_blank');
  };

  return updateLink;
}
