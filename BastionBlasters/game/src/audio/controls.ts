// Kleine Audio-Bedienung für die Kopfleiste: Mute-Knopf + Popover mit Reglern (Master, Music, SFX).
// Stil über die CSS-Variablen aus index.html (--panel, --panel2, --ink, --line, --accent ...) und ein
// eigenes <style> mit eindeutigen Klassen `bbau-*`; index.html bleibt unberührt.

import { audio, type VolumePart, type VolumeState } from './audio';

const NS = 'http://www.w3.org/2000/svg';

const CSS = `
.bbau-wrap { position: relative; display: inline-flex; align-items: center; }
.bbau-btn { font: inherit; color: var(--ink); background: var(--panel2); border: 2px solid var(--line); padding: 4px 8px; border-radius: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; min-width: 36px; line-height: 1; }
.bbau-btn:hover:not(:disabled) { background: var(--accent); color: #fff; }
.bbau-btn:focus-visible { outline: 2px solid var(--gold, var(--accent)); outline-offset: 1px; }
.bbau-btn.bbau-muted { color: var(--muted); }
.bbau-btn svg { width: 16px; height: 16px; display: block; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: square; stroke-linejoin: miter; }
.bbau-btn svg .bbau-fill { fill: currentColor; stroke: none; }
.bbau-pop { position: absolute; top: 100%; right: 0; padding-top: 6px; z-index: 60; display: none; }
.bbau-wrap:hover .bbau-pop, .bbau-wrap.bbau-open .bbau-pop, .bbau-wrap.bbau-focus .bbau-pop { display: block; }
.bbau-card { background: var(--panel); color: var(--ink); border: 2px solid var(--line); box-shadow: 3px 3px 0 var(--line); padding: 8px 10px; width: 200px; display: flex; flex-direction: column; gap: 6px; font: 700 11px/1.3 ui-monospace, "Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
.bbau-row { display: grid; grid-template-columns: 54px 1fr 30px; gap: 6px; align-items: center; }
.bbau-row label { color: var(--muted); text-transform: uppercase; letter-spacing: .06em; font-size: 10px; }
.bbau-row input[type=range] { width: 100%; min-width: 0; height: 18px; margin: 0; padding: 0; border: 0; background: transparent; accent-color: var(--accent); cursor: pointer; }
.bbau-val { text-align: right; color: var(--muted); font-size: 10px; }
.bbau-hint { color: var(--muted); font-size: 10px; border-top: 2px solid var(--line); padding-top: 5px; }
`;

function ensureStyle(): void {
  if (typeof document === 'undefined' || document.getElementById('bbau-style')) return;
  const st = document.createElement('style');
  st.id = 'bbau-style';
  st.textContent = CSS;
  document.head.appendChild(st);
}

function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e as SVGElement;
}

/** Lautsprecher-Symbol: Körper, Wellen je nach Pegel, Kreuz bei Stumm */
function buildIcon(muted: boolean, level: number): SVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' });
  svg.appendChild(svgEl('path', { class: 'bbau-fill', d: 'M1 6h3l4-3.5v11L4 10H1z' }));
  if (muted) {
    svg.appendChild(svgEl('path', { d: 'M10.5 5.5l4.5 5M15 5.5l-4.5 5' }));
  } else {
    if (level > 0.02) svg.appendChild(svgEl('path', { d: 'M10.5 5.5a3.5 3.5 0 0 1 0 5' }));
    if (level > 0.45) svg.appendChild(svgEl('path', { d: 'M12.5 3.5a6.5 6.5 0 0 1 0 9' }));
  }
  return svg;
}

export function createAudioControls(): HTMLElement {
  ensureStyle();
  const wrap = document.createElement('span');
  wrap.className = 'bbau-wrap';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bbau-btn';
  btn.title = 'Sound (M)';
  btn.setAttribute('aria-label', 'Sound on/off');
  btn.setAttribute('aria-haspopup', 'true');

  const pop = document.createElement('div');
  pop.className = 'bbau-pop';
  const card = document.createElement('div');
  card.className = 'bbau-card';
  pop.appendChild(card);

  const parts: [VolumePart, string][] = [['master', 'Master'], ['music', 'Music'], ['sfx', 'SFX']];
  const inputs = new Map<VolumePart, HTMLInputElement>();
  const values = new Map<VolumePart, HTMLSpanElement>();
  for (const [part, label] of parts) {
    const row = document.createElement('div');
    row.className = 'bbau-row';
    const lb = document.createElement('label');
    lb.textContent = label;
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = '0';
    inp.max = '100';
    inp.step = '1';
    inp.id = 'bbau-' + part;
    lb.htmlFor = inp.id;
    inp.setAttribute('aria-label', label + ' volume');
    const val = document.createElement('span');
    val.className = 'bbau-val';
    inp.addEventListener('input', () => {
      audio.unlock();
      audio.setVolume(part, Number(inp.value) / 100);
    });
    // Rückmeldung: beim Loslassen des SFX-Reglers kurz einen Klang
    inp.addEventListener('change', () => { if (part !== 'music') audio.ui('click'); });
    row.append(lb, inp, val);
    card.appendChild(row);
    inputs.set(part, inp);
    values.set(part, val);
  }
  const hint = document.createElement('div');
  hint.className = 'bbau-hint';
  hint.textContent = 'Click: mute (M)';
  card.appendChild(hint);

  wrap.append(btn, pop);

  let wasConnected = false;
  let lastKey = '';
  const sync = (v: VolumeState) => {
    if (wrap.isConnected) wasConnected = true;
    else if (wasConnected) { off(); return; }
    for (const [part] of parts) {
      const inp = inputs.get(part) as HTMLInputElement;
      const pct = String(Math.round(v[part] * 100));
      if (document.activeElement !== inp && inp.value !== pct) inp.value = pct;
      (values.get(part) as HTMLSpanElement).textContent = pct;
    }
    const level = v.master * Math.max(v.music, v.sfx);
    const key = `${v.muted ? 1 : 0}:${level > 0.45 ? 2 : level > 0.02 ? 1 : 0}`;
    if (key !== lastKey) {
      lastKey = key;
      btn.replaceChildren(buildIcon(v.muted, level));
    }
    btn.classList.toggle('bbau-muted', v.muted);
    btn.setAttribute('aria-pressed', v.muted ? 'true' : 'false');
  };
  const off = audio.onChange(sync);
  sync(audio.volume);

  // Popover fest öffnen: Rechtsklick, Langklick (Touch), Tastaturfokus
  const setOpen = (open: boolean) => {
    wrap.classList.toggle('bbau-open', open);
    if (open) place();
  };
  const setFocusOpen = (open: boolean) => {
    wrap.classList.toggle('bbau-focus', open);
    if (open) place();
  };
  const place = () => {
    pop.style.right = '0';
    pop.style.left = 'auto';
    const r = card.getBoundingClientRect();
    if (r.left < 4) { pop.style.right = 'auto'; pop.style.left = '0'; }
  };
  wrap.addEventListener('mouseenter', place);

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressed = false;
  btn.addEventListener('pointerdown', (e) => {
    audio.unlock();
    longPressed = false;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      pressTimer = setTimeout(() => { longPressed = true; setOpen(!wrap.classList.contains('bbau-open')); }, 500);
    }
  });
  const cancelPress = () => { if (pressTimer !== null) { clearTimeout(pressTimer); pressTimer = null; } };
  btn.addEventListener('pointerup', cancelPress);
  btn.addEventListener('pointerleave', cancelPress);
  btn.addEventListener('pointercancel', cancelPress);
  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    audio.unlock();
    setOpen(!wrap.classList.contains('bbau-open'));
  });
  btn.addEventListener('click', () => {
    if (longPressed) { longPressed = false; return; }
    audio.unlock();
    audio.toggleMute();
    if (!audio.volume.muted) audio.ui('toggle');
  });

  wrap.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement;
    try { if (t.matches(':focus-visible')) setFocusOpen(true); } catch { /* alter Browser ohne :focus-visible */ }
  });
  wrap.addEventListener('focusout', (e) => {
    const next = (e as FocusEvent).relatedTarget as Node | null;
    if (!next || !wrap.contains(next)) wrap.classList.remove('bbau-focus');
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { wrap.classList.remove('bbau-open', 'bbau-focus'); btn.focus(); }
  });
  // Klick außerhalb schließt das festgestellte Popover
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target as Node)) wrap.classList.remove('bbau-open', 'bbau-focus');
  });

  return wrap;
}
