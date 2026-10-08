// Glossar im Spiel: Begriffe im Text, Statusnamen und Kartenbilder erklären sich beim Überfahren selbst.
// Quelle: daten/keywords.json (über tools/build_game_data.py), Begriffsfelder der Kartenbilder aus art/cards.py.

import KW from '../data/keywords.gen.json';
import HOT from '../data/hotspots.gen.json';
import { BUILDINGS, UNITS } from '../sim/data';
import { assetUrl, el } from './dom';

export interface Keyword { en: string; kind: string; def: string; forms?: string[]; duration?: string; abbr?: string }
interface Spot { t: string; k: string; x: number; y: number; w: number; h: number }

const TERMS = KW as Keyword[];
const HOTSPOTS = HOT as Record<string, Spot[]>;

const byKey = new Map<string, Keyword>();
const byLower = new Map<string, Keyword[]>();
for (const k of TERMS) {
  byKey.set(`${k.en}|${k.kind}`, k);
  for (const f of [k.en, ...(k.forms ?? [])]) {
    for (const suf of ['', 's', 'es']) {
      const key = (f + suf).toLowerCase();
      const arr = byLower.get(key) ?? [];
      if (!arr.includes(k)) arr.push(k);
      byLower.set(key, arr);
    }
  }
}

/** Begriff zu einer Schreibweise (beliebige Groß-/Kleinschreibung, Mehrzahl erlaubt) */
export function kwFind(name: string, kind?: string): Keyword | undefined {
  const c = byLower.get(name.trim().toLowerCase());
  if (!c) return undefined;
  return kind ? c.find((k) => k.kind === kind) ?? c[0] : c[0];
}

/** Statusnamen der Simulation -> Glossarbegriff */
const STATUS_TERM: Record<string, string> = {
  shortCircuit: 'Shorted', runeSkin: 'Rune Skin', slow: 'Chilled', hardened: 'Hardened', haste: 'Spurred', sated: 'Fed', strong: 'Hardened',
  tough: 'Hardened', triumph: 'Blessed', guarded: 'Blessed', marked: 'Target Marker', berserk: 'Last Stand',
};
export function kwStatus(id: string): Keyword | undefined {
  return kwFind(STATUS_TERM[id] ?? id, 'status') ?? kwFind(STATUS_TERM[id] ?? id);
}

/** Begriff als Span mit Erklärung beim Überfahren */
export function kwSpan(text: string, k: Keyword | undefined, cls = 'kw'): HTMLElement {
  const s = el('span', { class: k ? cls : '' }, text);
  if (k) s.dataset.kw = `${k.en}|${k.kind}`;
  return s;
}

// ------------------------------------------------------------------ Fließtext

let re: RegExp | null = null;
function termRegex(): RegExp {
  if (re) return re;
  const forms = new Set<string>();
  for (const k of TERMS) for (const f of [k.en, ...(k.forms ?? [])]) if (/^[A-Z]/.test(f) && f.length > 2) forms.add(f);
  const alts = [...forms].sort((a, b) => b.length - a.length).map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (f.includes(' ') || !/[se]$/.test(f) ? '(?:s|es)?' : ''));
  re = new RegExp(`(?<![\\w−-])(?:${alts.join('|')})(?!\\w)`, 'g');
  return re;
}

/** Text in Teile zerlegen: bekannte Begriffe (großgeschrieben, wie in den Kartentexten) werden zu Spans mit Tooltip */
export function kwText(text: string): (Node | string)[] {
  const r = termRegex();
  r.lastIndex = 0;
  const out: (Node | string)[] = [];
  let pos = 0;
  for (let m = r.exec(text); m; m = r.exec(text)) {
    if (m.index > pos) out.push(text.slice(pos, m.index));
    const k = kwFind(m[0]);
    out.push(k ? kwSpan(m[0], k) : m[0]);
    pos = m.index + m[0].length;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

// ------------------------------------------------------------------ Tooltips

let tip: HTMLElement | null = null;

function ensureTip(): HTMLElement {
  if (!tip) {
    tip = el('div', { id: 'kwtip' });
    document.body.append(tip);
  }
  return tip;
}

function fill(k: Keyword): HTMLElement[] {
  return [
    el('div', { class: 'kt-h' }, el('b', {}, k.en), el('span', { class: 'kt-k' }, k.kind.replace('_', ' '))),
    el('div', { class: 'kt-d' }, k.def),
    k.duration ? el('div', { class: 'kt-t' }, `Duration: ${k.duration}`) : null,
  ].filter(Boolean) as HTMLElement[];
}

function placeNear(t: HTMLElement, cx: number, cy: number) {
  const pad = 12;
  const w = t.offsetWidth, h = t.offsetHeight;
  let x = cx + 16, y = cy + 18;
  if (x + w > innerWidth - pad) x = cx - w - 14;
  if (y + h > innerHeight - pad) y = cy - h - 14;
  t.style.left = Math.max(pad, x) + 'px';
  t.style.top = Math.max(pad, y) + 'px';
}

/** einmal beim Start: Tooltips für alle Elemente mit data-kw */
export function installKeywordTips() {
  const find = (e: Event) => (e.target as Element | null)?.closest?.('[data-kw]') as HTMLElement | null;
  document.addEventListener('mouseover', (e) => {
    const t = find(e);
    if (!t) return;
    const k = byKey.get(t.dataset.kw ?? '');
    if (!k) return;
    const box = ensureTip();
    box.replaceChildren(...fill(k));
    box.style.display = 'block';
    placeNear(box, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
  });
  document.addEventListener('mousemove', (e) => {
    if (tip && tip.style.display === 'block' && find(e)) placeNear(tip, e.clientX, e.clientY);
  });
  document.addEventListener('mouseout', (e) => {
    const t = find(e);
    if (t && tip && !(e.relatedTarget as Element | null)?.closest?.('[data-kw]')) tip.style.display = 'none';
  });
}

// ------------------------------------------------------------------ Große Kartenvorschau

let cardTip: HTMLElement | null = null;
let showTimer = 0;
let hideTimer = 0;
let current = '';

function hideCardTip() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  current = '';
  if (cardTip) cardTip.style.display = 'none';
  if (tip) tip.style.display = 'none';
}

/** Begriffe einer Karte in Reihenfolge des ersten Auftretens */
export function cardKeywords(id: string): Keyword[] {
  const seen = new Set<string>();
  const out: Keyword[] = [];
  for (const s of HOTSPOTS[id] ?? []) {
    const k = byKey.get(`${s.t}|${s.k}`);
    if (k && !seen.has(`${k.en}|${k.kind}`)) { seen.add(`${k.en}|${k.kind}`); out.push(k); }
  }
  return out;
}

function showCardTip(id: string, anchor: HTMLElement, side: 'above' | 'side') {
  const kws = cardKeywords(id);
  const vw = innerWidth, vh = innerHeight;
  const r = anchor.getBoundingClientRect();
  const colW = kws.length ? 270 : 0;
  const gap = side === 'above' ? 82 : 10; // Handkarten wachsen beim Überfahren nach oben
  // Größe: möglichst 2x (320 x 448), sonst so groß wie der Platz erlaubt
  let s = 2;
  const room = side === 'above' ? r.top - gap - 8 : vh - 16;
  if (room < 224 * s) s = Math.max(1.25, room / 224);
  const cw = 160 * s, ch = 224 * s;
  if (!cardTip) {
    cardTip = el('div', { id: 'cardtip', onmouseenter: () => clearTimeout(hideTimer), onmouseleave: hideCardTip });
    document.body.append(cardTip);
  }
  const box = cardTip;
  const img = el('img', { src: assetUrl(`cards/${id}.png`), alt: '', draggable: false });
  const face = el('div', { class: 'ct-face', style: `width:${cw}px;height:${ch}px` }, img);
  for (const sp of HOTSPOTS[id] ?? []) {
    const k = byKey.get(`${sp.t}|${sp.k}`);
    if (!k) continue;
    const h = el('div', { class: 'hs', style: `left:${sp.x * s}px;top:${sp.y * s}px;width:${sp.w * s}px;height:${sp.h * s}px` });
    h.dataset.kw = `${k.en}|${k.kind}`;
    face.append(h);
  }
  const kids: HTMLElement[] = [face];
  if (kws.length) {
    kids.push(el('div', { class: 'ct-kw', style: `width:${colW}px;max-height:${ch}px` },
      el('h4', {}, 'Keywords'),
      ...kws.map((k) => el('div', { class: 'ct-k' },
        el('b', {}, k.en), k.duration ? el('span', { class: 'kt-t' }, ` ${k.duration}`) : null,
        el('div', {}, k.def)))));
  }
  box.replaceChildren(...kids);
  box.style.display = 'flex';
  const w = cw + (kws.length ? colW + 8 : 0);
  let x: number, y: number;
  if (side === 'above') {
    x = r.left + r.width / 2 - cw / 2;
    y = r.top - gap - ch;
  } else {
    x = r.right + gap;
    if (x + w > vw - 8) x = r.left - gap - w;
    y = r.top + r.height / 2 - ch / 2;
  }
  x = Math.max(8, Math.min(vw - w - 8, x));
  y = Math.max(8, Math.min(vh - ch - 8, y));
  box.style.left = x + 'px';
  box.style.top = y + 'px';
}

/** Kartenbild erhält die große Vorschau mit erklärten Begriffen beim Überfahren */
export function attachCardTip(node: HTMLElement, id: string, side: 'above' | 'side' = 'side') {
  node.addEventListener('mouseenter', () => {
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    showTimer = window.setTimeout(() => { current = id; showCardTip(id, node, side); }, current === id ? 0 : 90);
  });
  node.addEventListener('mouseleave', () => {
    clearTimeout(showTimer);
    hideTimer = window.setTimeout(hideCardTip, 260);
  });
  node.addEventListener('pointerdown', () => hideCardTip());
}

export function closeCardTip() { hideCardTip(); }

/** Hilfstext: Name der Karte (für Listen) */
export function cardName(id: string): string {
  return (UNITS[id] ?? BUILDINGS[id])?.name ?? id;
}
