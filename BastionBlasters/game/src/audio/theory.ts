// Kleiner Musik-Baukasten: Tonleitern, Akkorde, Stimmführung, Motive und deren Variationen.
// Alles rein berechnend (keine Audio-Objekte), damit Stücke ohne AudioContext erzeugt und getestet werden können.

import type { InstId } from './instruments';

export const MODE = {
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
} as const;

export interface Key {
  /** MIDI-Note der Tonika */
  tonic: number;
  mode: readonly number[];
}

/** Stufenindex (kann negativ sein oder über die Oktave hinausgehen) -> MIDI-Note */
export function scaleMidi(k: Key, idx: number): number {
  const o = Math.floor(idx / 7);
  const d = ((idx % 7) + 7) % 7;
  return k.tonic + 12 * o + k.mode[d];
}

export type Quality = 'maj' | 'min' | 'dim' | 'sus2' | 'sus4' | 'maj7' | 'm7' | 'dom7' | 'add9' | 'm9' | 'maj9';
const QUAL: Record<Quality, number[]> = {
  maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], sus2: [0, 2, 7], sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14],
};

export interface Chord {
  /** Halbtöne über der Tonika */
  r: number;
  q: Quality;
}
export const chord = (r: number, q: Quality): Chord => ({ r, q });

/** Tonhöhenklassen des Akkords relativ zur Tonika */
export function chordPcs(c: Chord): number[] {
  return QUAL[c.q].map((i) => (c.r + i) % 12);
}

/** Ist die Stufe idx ein Akkordton? */
export function isChordIdx(k: Key, c: Chord, idx: number): boolean {
  const d = ((idx % 7) + 7) % 7;
  return chordPcs(c).includes(k.mode[d] % 12);
}

/** Nächster Akkordton (in Stufen) um idx herum */
export function nearestChordIdx(k: Key, c: Chord, idx: number): number {
  for (const dd of [0, 1, -1, 2, -2, 3, -3]) if (isChordIdx(k, c, idx + dd)) return idx + dd;
  return idx;
}

/** Note in den Bereich [lo, lo+12) falten */
export function fold(m: number, lo: number): number {
  let x = m;
  while (x < lo) x += 12;
  while (x >= lo + 12) x -= 12;
  return x;
}

/** Wurzelton des Akkords im Bassbereich [lo, lo+12) */
export function rootMidi(k: Key, c: Chord, lo: number): number {
  return fold(k.tonic + c.r, lo);
}

/** Akkordstimmen in der Nähe von prev (Stimmführung): Umkehrung mit geringster Bewegung, Tiefstes >= lo */
export function voicing(k: Key, c: Chord, lo: number, n = 3, prev?: number[]): number[] {
  const ivs = QUAL[c.q].slice(0, n).map((i) => i % 12);
  const base = rootMidi(k, c, lo);
  let best: number[] = [];
  let bestCost = Infinity;
  for (let inv = 0; inv < ivs.length; inv++) {
    const notes: number[] = [];
    for (let j = 0; j < ivs.length; j++) {
      let m = base + ivs[(j + inv) % ivs.length];
      if (j + inv >= ivs.length) m += 12;
      notes.push(m);
    }
    notes.sort((a, b) => a - b);
    // Umkehrungen so legen, dass das tiefste >= lo bleibt
    while (notes[0] < lo) for (let j = 0; j < notes.length; j++) notes[j] += 12;
    const cost = prev && prev.length
      ? Math.abs(avg(notes) - avg(prev)) * 2 + notes.reduce((s, m, j) => s + Math.abs(m - prev[Math.min(j, prev.length - 1)]), 0) * 0.2
      : avg(notes) - lo;
    if (cost < bestCost) { bestCost = cost; best = notes; }
  }
  return best;
}
const avg = (a: number[]): number => a.reduce((s, x) => s + x, 0) / a.length;

// ---------------------------------------------------------------- Partitur

export interface NoteEv {
  i: InstId;
  /** MIDI-Note (bei Schlagwerk: Tonhöhe der Trommel oder 0) */
  m: number;
  /** Dauer in 16teln */
  d: number;
  /** Anschlag 0..1 */
  v: number;
}

export class Score {
  readonly steps: NoteEv[][];
  constructor(readonly bars: number) {
    this.steps = Array.from({ length: bars * 16 }, () => []);
  }
  add(step: number, i: InstId, m: number, d: number, v: number): void {
    if (step < 0 || step >= this.steps.length) return;
    this.steps[step].push({ i, m, d, v: Math.max(0, Math.min(1, v)) });
  }
  /** Schlagwerk-Treffer */
  hit(step: number, i: InstId, v: number, m = 0): void {
    this.add(step, i, m, 1, v);
  }
}

// ---------------------------------------------------------------- Motive

export interface MNote {
  /** Schritt relativ zum Phrasenbeginn */
  s: number;
  d: number;
  /** Stufenindex */
  idx: number;
  v: number;
}

export interface Motif {
  on: number[];
  du: number[];
  /** Stufenabstand zur vorherigen Note */
  iv: number[];
}

export interface MotifStyle {
  /** Gewicht für Tonwiederholung */
  repeat: number;
  /** Gewicht für Sprünge >= 3 Stufen */
  leap: number;
  /** -1 fallend, 0 neutral, +1 steigend (Gesamttendenz der ersten Hälfte) */
  rise: number;
}

/** Zufallsmotiv zu einem Rhythmus (Onsets in 16teln, span = Länge des Fensters) */
export function makeMotif(rng: () => number, onsets: number[], span: number, st: MotifStyle): Motif {
  const on = [...onsets].sort((a, b) => a - b);
  const du = on.map((o, j) => Math.min(8, (j + 1 < on.length ? on[j + 1] : span) - o));
  const iv: number[] = [0];
  for (let j = 1; j < on.length; j++) {
    const pos = j / on.length;
    const bias = (pos < 0.5 ? st.rise : -st.rise) * 0.5;
    const w: [number, number][] = [
      [0, st.repeat], [1, 0.22 + bias], [-1, 0.22 - bias], [2, 0.14 + bias * 0.6], [-2, 0.14 - bias * 0.6],
      [3, 0.04 * st.leap], [-3, 0.04 * st.leap], [4, 0.02 * st.leap], [-4, 0.02 * st.leap],
    ];
    let tot = 0;
    for (const x of w) tot += Math.max(0.001, x[1]);
    let r = rng() * tot;
    let pick = 0;
    for (const x of w) { r -= Math.max(0.001, x[1]); if (r <= 0) { pick = x[0]; break; } }
    iv.push(pick);
  }
  return { on, du, iv };
}

/** Motiv gegen die Akkorde (je Takt einer) in Noten umsetzen; starke Zählzeiten rasten auf Akkordtöne ein */
export function realize(k: Key, m: Motif, start: number, chords: Chord[], lo: number, hi: number, vel: number): MNote[] {
  const out: MNote[] = [];
  let cur = start;
  for (let j = 0; j < m.on.length; j++) {
    if (j > 0) cur += m.iv[j];
    if (cur > hi) cur = hi - (cur - hi);
    if (cur < lo) cur = lo + (lo - cur);
    cur = Math.max(lo, Math.min(hi, cur));
    const strong = m.on[j] % 4 === 0 && m.du[j] >= 2;
    const ch = chords[Math.min(chords.length - 1, Math.floor(m.on[j] / 16))];
    if (strong) cur = Math.max(lo, Math.min(hi, nearestChordIdx(k, ch, cur)));
    out.push({ s: m.on[j], d: m.du[j], idx: cur, v: vel * (m.on[j] % 4 === 0 ? 1 : 0.84) });
  }
  return out;
}

export const invert = (m: Motif): Motif => ({ on: m.on, du: m.du, iv: m.iv.map((x) => -x) });

/** Verzierung: lange Noten teilen und eine Nebennote einfügen */
export function ornament(rng: () => number, m: Motif): Motif {
  const on: number[] = [], du: number[] = [], iv: number[] = [];
  let carry = 0;
  for (let j = 0; j < m.on.length; j++) {
    if (m.du[j] >= 4 && j < m.on.length - 1 && rng() < 0.7) {
      const h = Math.floor(m.du[j] / 2);
      on.push(m.on[j]); du.push(h); iv.push(m.iv[j] - carry); carry = 0;
      const step = rng() < 0.5 ? 1 : -1;
      on.push(m.on[j] + h); du.push(m.du[j] - h); iv.push(step);
      carry = step;
    } else {
      on.push(m.on[j]); du.push(m.du[j]); iv.push(m.iv[j] - carry); carry = 0;
    }
  }
  // Intervalle nach dem Einfügen: die Note nach der Nebennote kehrt in die Ausgangslage zurück
  return { on, du, iv };
}

/** Schluss: letzte Note auf Zielstufe zwingen, langer Wert */
export function cadence(notes: MNote[], target: number, span: number): MNote[] {
  if (!notes.length) return notes;
  const out = notes.map((n) => ({ ...n }));
  const last = out[out.length - 1];
  last.idx = target;
  last.d = Math.max(last.d, Math.min(8, span - last.s));
  return out;
}

/** Terzparallele (Stufen unter der Melodie) auf starken Zählzeiten */
export function harmonize(k: Key, notes: MNote[], chords: Chord[], below = 2): MNote[] {
  const out: MNote[] = [];
  for (const n of notes) {
    if (n.s % 4 !== 0 && n.d < 3) continue;
    const ch = chords[Math.min(chords.length - 1, Math.floor(n.s / 16))];
    out.push({ ...n, idx: nearestChordIdx(k, ch, n.idx - below), v: n.v * 0.7 });
  }
  return out;
}
