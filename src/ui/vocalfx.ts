// The Vocal effects card: each effect on or off, its variety and how much. Changes are heard at once.

import type { Engine } from '../audio/engine';
import { FX_DEFS, type VocalFxState, cleanFxState, defaultFxState, fxAnyOn } from '../audio/vocalfx';

export interface VocalFxPanel {
  /** Show what the engine has (after opening a shared link). */
  sync(): void;
}

/** `onChange`: an effect changed (the link follows). */
export function buildVocalFxPanel(root: HTMLElement, engine: Engine, onChange: () => void): VocalFxPanel {
  root.innerHTML = `
    <div class="fxhead">
      <h2>Vocal effects</h2>
      <label class="fxback" title="Put the same effects on the backing singer"><input type="checkbox" id="fx-backing"> Backing too</label>
      <button class="small" id="fx-off" title="Switch every effect off">All off</button>
    </div>
    <div class="fxrows" id="fx-rows"></div>
    <p class="hint">Switch them on while the song plays. Effects stack in this order, top to bottom; echo and reverb are added after.</p>`;
  const rows = root.querySelector<HTMLElement>('#fx-rows')!;
  const back = root.querySelector<HTMLInputElement>('#fx-backing')!;
  const off = root.querySelector<HTMLButtonElement>('#fx-off')!;

  let state: VocalFxState = cleanFxState(engine.vocalFx);
  const push = () => { engine.setVocalFx(cleanFxState(state)); off.disabled = !fxAnyOn(state); onChange(); };

  const els = FX_DEFS.map((d) => {
    const row = document.createElement('div');
    row.className = 'fxrow';
    row.title = d.hint;
    row.innerHTML = `
      <button class="fxon" aria-pressed="false">${d.label}</button>
      ${d.kinds.length ? `<select aria-label="${d.label} type">${d.kinds.map((k) => `<option value="${k.id}">${k.label}</option>`).join('')}</select>` : '<span></span>'}
      <input type="range" min="0" max="100" aria-label="${d.label} amount">`;
    rows.appendChild(row);
    const btn = row.querySelector('button')!;
    const sel = row.querySelector('select');
    const amt = row.querySelector('input')!;
    btn.onclick = () => { state.fx[d.id].on = !state.fx[d.id].on; show(); push(); };
    if (sel) sel.onchange = () => { state.fx[d.id].kind = sel.value; push(); };
    amt.oninput = () => { state.fx[d.id].amount = +amt.value; push(); };
    return { d, row, btn, sel, amt };
  });

  const show = () => {
    for (const { d, row, btn, sel, amt } of els) {
      const s = state.fx[d.id];
      row.classList.toggle('on', s.on);
      btn.classList.toggle('on', s.on);
      btn.setAttribute('aria-pressed', String(s.on));
      if (sel) sel.value = s.kind;
      amt.value = String(s.amount);
    }
    back.checked = state.backing;
    off.disabled = !fxAnyOn(state);
  };
  back.onchange = () => { state.backing = back.checked; push(); };
  off.onclick = () => {
    const fresh = defaultFxState();
    // (the amounts and varieties are kept; only the switches go off)
    for (const d of FX_DEFS) state.fx[d.id].on = fresh.fx[d.id].on;
    show();
    push();
  };

  show();
  return { sync() { state = cleanFxState(engine.vocalFx); show(); } };
}
