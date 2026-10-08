// Generative Stücke: je Stimmung ein Aufbau aus Abschnitten (A/B/Variation/Bruch) mit festem Seed.
// Rein berechnend -- liefert Piece-Daten (Noten je 16tel-Schritt), die music.ts planmäßig abspielt.

import type { InstId, MixCfg } from './instruments';
import { mulberry32 } from './rng';
import {
  MODE, Score, cadence, chord, harmonize, invert, makeMotif, nearestChordIdx, ornament, realize, rootMidi, scaleMidi, voicing,
  type Chord, type Key, type MNote, type Motif, type NoteEv,
} from './theory';

export type Mood = 'menu' | 'build' | 'battle' | 'pause' | 'victory' | 'defeat';

export interface Piece {
  id: string;
  bpm: number;
  /** Verzögerung der Achtel-Nachschläge als Bruchteil eines 16tels (0 = gerade) */
  swing: number;
  bars: number;
  steps: NoteEv[][];
  /** Länge in 16tel-Schritten (bei Stingern kürzer als die Partitur) */
  length: number;
  /** Sprungziel beim Wiederholen */
  loopStart: number;
  loop: boolean;
  mix: Partial<Record<InstId, Partial<MixCfg>>>;
  echoSteps: number;
  echoFb: number;
  echoLp: number;
  /** Grundhelligkeit der Schiene (Tiefpass in Hz) */
  bright: number;
  /** Folgestück nach dem Ende (Stinger -> Ausklang) */
  next?: () => Piece;
}

// ---------------------------------------------------------------- gemeinsame Helfer

interface Section {
  name: string;
  bars: number;
  chords: Chord[];
  i0: number;
  i1: number;
}

interface Phrase {
  m: number;
  op: 'orig' | 'seq' | 'inv' | 'orn' | 'cad' | 'half';
  shift?: number;
}

const SECTION_START = (secs: Section[]): number[] => {
  const out: number[] = [];
  let b = 0;
  for (const s of secs) { out.push(b); b += s.bars; }
  return out;
};

/** Index der Stufe mit dem Wurzelton des Akkords nahe `near` */
function rootIdx(k: Key, c: Chord, near: number): number {
  let best = nearestChordIdx(k, c, near);
  let bd = Infinity;
  for (let i = near - 5; i <= near + 5; i++) {
    const d = ((i % 7) + 7) % 7;
    if (k.mode[d] % 12 === c.r % 12 && Math.abs(i - near) < bd) { bd = Math.abs(i - near); best = i; }
  }
  return best;
}

/** Melodie über einen Abschnitt (2-Takt-Phrasen) setzen */
function addLead(
  sc: Score, k: Key, inst: InstId, startBar: number, chords: Chord[], motifs: Motif[], plan: Phrase[],
  o: { lo: number; hi: number; center: number; vel: number; oct?: number; harm?: InstId; rng: () => number },
): void {
  for (let p = 0; p < plan.length; p++) {
    const ph = plan[p];
    const cs = [chords[p * 2], chords[p * 2 + 1] ?? chords[p * 2]];
    let mo = motifs[ph.m % motifs.length];
    if (ph.op === 'inv') mo = invert(mo);
    if (ph.op === 'orn') mo = ornament(o.rng, mo);
    const near = o.center + (ph.shift ?? 0);
    const start = nearestChordIdx(k, cs[0], near);
    let notes: MNote[] = realize(k, mo, start, cs, o.lo, o.hi, o.vel);
    if (ph.op === 'cad') notes = cadence(notes, rootIdx(k, cs[1], o.center - 1), 32);
    if (ph.op === 'half') notes = cadence(notes, nearestChordIdx(k, cs[1], o.center + 1), 32);
    const base = (startBar + p * 2) * 16;
    for (const n of notes) {
      sc.add(base + n.s, inst, scaleMidi(k, n.idx) + (o.oct ?? 0) * 12, n.d, n.v);
    }
    if (o.harm) {
      for (const n of harmonize(k, notes, cs)) sc.add(base + n.s, o.harm, scaleMidi(k, n.idx) + (o.oct ?? 0) * 12, n.d, n.v);
    }
  }
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function intensityAt(secs: Section[], bar: number): { sec: number; local: number; i: number } {
  let b = 0;
  for (let s = 0; s < secs.length; s++) {
    if (bar < b + secs[s].bars) {
      const local = bar - b;
      return { sec: s, local, i: lerp(secs[s].i0, secs[s].i1, secs[s].bars > 1 ? local / (secs[s].bars - 1) : 0) };
    }
    b += secs[s].bars;
  }
  return { sec: secs.length - 1, local: 0, i: secs[secs.length - 1].i1 };
}

function makePiece(id: string, sc: Score, p: Partial<Piece> & { bpm: number }): Piece {
  return {
    id, swing: 0, bars: sc.bars, steps: sc.steps, length: sc.steps.length, loopStart: 0, loop: true, mix: {},
    echoSteps: 3, echoFb: 0.35, echoLp: 2800, bright: 12000, ...p,
  };
}

// ---------------------------------------------------------------- Kampf: D-dorisch, 138 BPM, Marsch, steigende Spannung

function composeBattle(): Piece {
  const rng = mulberry32(0xba771e01);
  const key: Key = { tonic: 62, mode: MODE.dorian };
  const Dm = chord(0, 'min'), Em = chord(2, 'min'), F = chord(3, 'maj'), G = chord(5, 'maj'), Am = chord(7, 'min'), C = chord(10, 'maj');
  const secs: Section[] = [
    { name: 'A', bars: 8, chords: [Dm, C, Dm, G, Dm, C, G, Am], i0: 0.3, i1: 0.45 },
    { name: 'A2', bars: 8, chords: [Dm, F, C, G, Dm, F, G, Am], i0: 0.45, i1: 0.6 },
    { name: 'B', bars: 8, chords: [F, C, G, Am, F, C, G, Dm], i0: 0.6, i1: 0.78 },
    { name: 'A3', bars: 8, chords: [Dm, C, Dm, G, Dm, F, G, Am], i0: 0.7, i1: 0.85 },
    { name: 'B2', bars: 8, chords: [F, C, G, Am, F, C, Am, G], i0: 0.85, i1: 1.0 },
    { name: 'BR', bars: 4, chords: [Am, Am, Em, G], i0: 0.22, i1: 0.22 },
    { name: 'BU', bars: 4, chords: [Dm, Dm, G, Am], i0: 0.45, i1: 1.0 },
  ];
  const total = secs.reduce((s, x) => s + x.bars, 0);
  const sc = new Score(total);
  const starts = SECTION_START(secs);

  const rhythmsA = [[0, 3, 6, 8, 10, 12, 16, 19, 22, 24, 28], [0, 2, 4, 8, 12, 14, 16, 20, 22, 24, 28], [0, 4, 6, 8, 12, 16, 18, 20, 24, 26, 28, 30]];
  const rhythmsB = [[0, 3, 6, 10, 12, 14, 16, 20, 24, 26, 28, 30], [0, 2, 3, 4, 8, 12, 16, 18, 19, 20, 24, 28]];
  const stA = { repeat: 0.24, leap: 1.0, rise: 0.3 };
  const motA = rhythmsA.map((r) => makeMotif(rng, r, 32, stA));
  const motB = rhythmsB.map((r) => makeMotif(rng, r, 32, { repeat: 0.1, leap: 1.6, rise: 0.8 }));
  const planA: Phrase[] = [{ m: 0, op: 'orig' }, { m: 0, op: 'seq', shift: 1 }, { m: 1, op: 'orig' }, { m: 0, op: 'half' }];
  const planA2: Phrase[] = [{ m: 0, op: 'orn' }, { m: 0, op: 'seq', shift: 2 }, { m: 2, op: 'orig' }, { m: 1, op: 'cad' }];
  const planA3: Phrase[] = [{ m: 0, op: 'orig', shift: 2 }, { m: 0, op: 'seq', shift: 3 }, { m: 2, op: 'inv', shift: 2 }, { m: 1, op: 'half' }];
  const planB: Phrase[] = [{ m: 0, op: 'orig' }, { m: 0, op: 'seq', shift: 1 }, { m: 1, op: 'orig' }, { m: 1, op: 'cad' }];
  const planB2: Phrase[] = [{ m: 0, op: 'orn', shift: 1 }, { m: 0, op: 'seq', shift: 3 }, { m: 1, op: 'orn' }, { m: 1, op: 'cad' }];
  // Leads
  addLead(sc, key, 'chip', starts[0], secs[0].chords, motA, planA, { lo: 3, hi: 13, center: 7, vel: 0.78, rng });
  addLead(sc, key, 'chip', starts[1], secs[1].chords, motA, planA2, { lo: 3, hi: 13, center: 8, vel: 0.82, rng });
  addLead(sc, key, 'brass', starts[2], secs[2].chords, motB, planB, { lo: 4, hi: 14, center: 9, vel: 0.85, rng, harm: 'brass' });
  addLead(sc, key, 'chip', starts[3], secs[3].chords, motA, planA3, { lo: 4, hi: 15, center: 8, vel: 0.88, rng, harm: 'chip' });
  addLead(sc, key, 'brass', starts[4], secs[4].chords, motB, planB2, { lo: 4, hi: 15, center: 10, vel: 0.95, rng, harm: 'brass' });

  const pulse: string[][] = [
    ['r', 'r', 'o', 'r', 'r', 'o', 'f', 'r'],
    ['r', 'r', 'o', 'r', 'r', 'f', 'o', 'f'],
  ];
  let prevVoice: number[] | undefined;
  for (let bar = 0; bar < total; bar++) {
    const { sec, local, i } = intensityAt(secs, bar);
    const S = secs[sec];
    const ch = S.chords[local % S.chords.length];
    const b0 = bar * 16;
    const isBreak = S.name === 'BR';
    const isBuild = S.name === 'BU';
    const root = rootMidi(key, ch, 36);
    // Bass: Achtel-Puls (Bruch: lange Töne)
    if (isBreak) {
      sc.add(b0, 'tbass', root, 14, 0.55);
    } else {
      const pat = pulse[(local % 4) === 3 ? 1 : 0];
      pat.forEach((t, j) => {
        const m = t === 'r' ? root : t === 'o' ? root + 12 : root + 7;
        sc.add(b0 + j * 2, 'bass', m, 1.7, 0.5 + 0.35 * i + (j % 4 === 0 ? 0.1 : 0));
      });
    }
    // Akkordflächen im Bruch und in den B-Teilen
    prevVoice = voicing(key, ch, 52, 3, prevVoice);
    if (isBreak || S.name === 'B' || S.name === 'B2') for (const m of prevVoice) sc.add(b0, 'pad', m, 16, isBreak ? 0.7 : 0.4);
    // Akkordstöße auf den Nachschlägen
    if (i >= 0.5 && !isBreak) {
      const vo = voicing(key, ch, 57, 3, undefined);
      const st = i < 0.7 ? [6, 14] : [2, 6, 10, 14];
      for (const s of st) for (const m of vo) sc.add(b0 + s, 'stab', m, 1.5, 0.4 + 0.2 * i);
    }
    // Arpeggio-Sechzehntel in der heißen Phase
    if (i >= 0.72 && !isBreak && (S.name === 'A3' || S.name === 'B2' || isBuild)) {
      const vo = voicing(key, ch, 62, 3, undefined);
      const order = [0, 1, 2, 1];
      for (let s = 0; s < 16; s++) sc.add(b0 + s, 'arp', vo[order[s % 4]] + (s % 8 >= 4 ? 12 : 0), 1, 0.3 + 0.18 * i);
    }
    // Schlagwerk
    const kicks = isBreak ? [] : i >= 0.8 ? [0, 4, 8, 12] : i >= 0.5 ? (bar % 2 ? [0, 8, 11] : [0, 8, 10]) : [0, 8];
    for (const s of kicks) sc.hit(b0 + s, 'kick', 0.75 + 0.2 * i);
    if (!isBreak) {
      sc.hit(b0 + 4, 'snare', 0.7 + 0.25 * i);
      sc.hit(b0 + 12, 'snare', 0.7 + 0.25 * i);
      if (i >= 0.55) sc.hit(b0 + 15, 'snare', 0.22);
      for (let s = 0; s < 16; s += 2) sc.hit(b0 + s, 'hat', (s % 4 === 2 ? 0.5 : 0.34) + 0.15 * i);
      if (i >= 0.55) for (let s = 1; s < 16; s += 2) sc.hit(b0 + s, 'hat', 0.16 + 0.08 * i);
      if (bar % 2 === 1) sc.hit(b0 + 14, 'ohat', 0.4);
    } else {
      sc.hit(b0, 'timp', 0.7, 38);
      sc.hit(b0 + 8, 'timp', 0.5, 38);
      if (local === 3) for (let s = 12; s < 16; s++) sc.hit(b0 + s, 'snare', 0.15 + (s - 12) * 0.1);
    }
    // Becken zum Abschnittsbeginn und zum Neubeginn der Schleife
    if (local === 0) sc.hit(b0, 'cym', 0.55 + 0.25 * i);
    // Fill im letzten Takt der Abschnitte
    if (local === S.bars - 1 && !isBreak) {
      if (isBuild) {
        for (let s = 0; s < 16; s++) sc.hit(b0 + s, 'snare', 0.25 + 0.75 * (s / 15));
        for (const [s, p] of [[10, 220], [12, 180], [13, 150], [14, 120], [15, 95]] as [number, number][]) sc.hit(b0 + s, 'tom', 0.8, p);
      } else {
        [[10, 200], [11, 170], [12, 150], [13, 130], [14, 110], [15, 90]].forEach(([s, p]) => sc.hit(b0 + s, 'tom', 0.65, p));
      }
    } else if (isBuild && local === 2) {
      for (let s = 0; s < 16; s += 2) sc.hit(b0 + s, 'snare', 0.3 + 0.2 * (s / 15));
    }
  }
  return makePiece('battle', sc, {
    bpm: 138, swing: 0, loopStart: 0, echoSteps: 3, echoFb: 0.3, echoLp: 2800, bright: 13000,
    mix: { chip: { g: 0.95, pan: 0.12 }, brass: { g: 1, pan: -0.08 }, stab: { g: 0.9 }, arp: { g: 0.9 }, bass: { g: 1 }, kick: { g: 1 } },
  });
}

// ---------------------------------------------------------------- Menü: G-lydisch, 100 BPM, Zupfmelodie

function composeMenu(): Piece {
  const rng = mulberry32(0x5e17a001);
  const key: Key = { tonic: 67, mode: MODE.lydian };
  const G = chord(0, 'maj7'), A = chord(2, 'maj'), Bm = chord(4, 'm7'), D = chord(7, 'maj'), Em = chord(9, 'm7');
  const secs: Section[] = [
    { name: 'I', bars: 4, chords: [G, D, Em, A], i0: 0.2, i1: 0.3 },
    { name: 'A', bars: 8, chords: [G, A, G, D, Em, A, Bm, D], i0: 0.4, i1: 0.5 },
    { name: 'B', bars: 8, chords: [Em, Bm, G, A, Em, D, A, D], i0: 0.55, i1: 0.7 },
    { name: 'A2', bars: 8, chords: [G, A, G, D, Em, A, D, G], i0: 0.6, i1: 0.7 },
    { name: 'C', bars: 8, chords: [Bm, Em, A, D, Bm, Em, A, A], i0: 0.35, i1: 0.45 },
  ];
  const total = secs.reduce((s, x) => s + x.bars, 0);
  const sc = new Score(total);
  const starts = SECTION_START(secs);
  const rh = [[0, 4, 6, 8, 12, 16, 20, 22, 24], [0, 3, 6, 8, 10, 12, 16, 19, 22, 24, 28], [0, 2, 4, 8, 12, 16, 18, 20, 24, 28], [0, 6, 8, 12, 16, 22, 24, 28]];
  const st = { repeat: 0.1, leap: 1.2, rise: 0.5 };
  const mot = rh.map((r) => makeMotif(rng, r, 32, st));
  const planA: Phrase[] = [{ m: 0, op: 'orig' }, { m: 0, op: 'seq', shift: 1 }, { m: 1, op: 'orig' }, { m: 0, op: 'half' }];
  const planB: Phrase[] = [{ m: 2, op: 'orig' }, { m: 2, op: 'seq', shift: 2 }, { m: 3, op: 'orig' }, { m: 3, op: 'half' }];
  const planA2: Phrase[] = [{ m: 0, op: 'orn' }, { m: 0, op: 'seq', shift: 2 }, { m: 1, op: 'orn' }, { m: 0, op: 'cad' }];
  const planC: Phrase[] = [{ m: 3, op: 'orig', shift: 2 }, { m: 3, op: 'inv', shift: 2 }, { m: 2, op: 'orig', shift: 1 }, { m: 3, op: 'half' }];
  addLead(sc, key, 'pluck', starts[1], secs[1].chords, mot, planA, { lo: 0, hi: 11, center: 5, vel: 0.8, rng });
  addLead(sc, key, 'pluck', starts[2], secs[2].chords, mot, planB, { lo: 1, hi: 12, center: 7, vel: 0.85, rng, harm: 'pluck' });
  addLead(sc, key, 'pluck', starts[3], secs[3].chords, mot, planA2, { lo: 1, hi: 12, center: 6, vel: 0.85, rng, harm: 'bell' });
  addLead(sc, key, 'bell', starts[4], secs[4].chords, mot, planC, { lo: 3, hi: 14, center: 9, vel: 0.7, rng, oct: 0 });

  let prev: number[] | undefined;
  for (let bar = 0; bar < total; bar++) {
    const { sec, local, i } = intensityAt(secs, bar);
    const S = secs[sec];
    const ch = S.chords[local % S.chords.length];
    const b0 = bar * 16;
    const root = rootMidi(key, ch, 43);
    prev = voicing(key, ch, 55, 4, prev);
    for (const m of prev) sc.add(b0, 'pad', m, 16, 0.5 + 0.2 * i);
    // Arpeggio (Achtel, auf-ab)
    const vo = voicing(key, ch, 60, 4, undefined);
    const ord = [0, 1, 2, 3, 2, 1, 2, 1];
    for (let j = 0; j < 8; j++) {
      if (S.name === 'C' && j % 2 === 1) continue;
      sc.add(b0 + j * 2, 'arp', vo[ord[j] % vo.length], 1, 0.25 + 0.25 * i);
    }
    // Bass: Zupfbass auf 1 und 3, Quint-Auftakt
    sc.add(b0, 'tbass', root, 5, 0.6);
    sc.add(b0 + 8, 'tbass', root + 7, 4, 0.5);
    if (local % 2 === 1) sc.add(b0 + 14, 'tbass', root + 12, 2, 0.4);
    // Glitzern auf der Taktzwei der Phrasen
    if (local % 2 === 0) sc.add(b0, 'bell', fold12(key.tonic + ch.r + 24, 84), 8, 0.35);
    // Schlagwerk
    if (S.name !== 'I') for (const s of [2, 6, 10, 14]) sc.hit(b0 + s, 'shaker', 0.3 + 0.1 * i);
    if (S.name === 'B' || S.name === 'A2') {
      sc.hit(b0, 'kick', 0.5);
      sc.hit(b0 + 8, 'kick', 0.4);
      sc.hit(b0 + 4, 'wood', 0.35, 900);
      sc.hit(b0 + 12, 'wood', 0.3, 760);
    }
    if (local === 0 && S.name !== 'I') sc.hit(b0, 'cym', 0.25);
  }
  return makePiece('menu', sc, {
    bpm: 100, swing: 0, loopStart: 4 * 16, echoSteps: 3, echoFb: 0.38, echoLp: 2600, bright: 9500,
    mix: { pluck: { g: 1, pan: 0.15 }, arp: { g: 0.9, pan: -0.3 }, pad: { g: 0.9 }, tbass: { g: 0.95 } },
  });
}

/** MIDI-Note in den Bereich [lo, lo+12) legen */
function fold12(m: number, lo: number): number {
  let x = m;
  while (x < lo) x += 12;
  while (x >= lo + 12) x -= 12;
  return x;
}

// ---------------------------------------------------------------- Aufbau: A-mixolydisch, 106 BPM, hüpfender Shuffle

function composeBuild(): Piece {
  const rng = mulberry32(0xb17d0a01);
  const key: Key = { tonic: 69, mode: MODE.mixolydian };
  const A = chord(0, 'maj'), G = chord(10, 'maj'), D = chord(5, 'maj'), Em = chord(7, 'min'), Fsm = chord(9, 'min'), Bm = chord(2, 'min');
  const secs: Section[] = [
    { name: 'A', bars: 8, chords: [A, G, D, A, A, G, D, Em], i0: 0.4, i1: 0.5 },
    { name: 'A2', bars: 8, chords: [A, G, D, A, A, G, D, Em], i0: 0.5, i1: 0.6 },
    { name: 'B', bars: 8, chords: [Fsm, D, A, G, Fsm, D, G, A], i0: 0.6, i1: 0.75 },
    { name: 'A3', bars: 8, chords: [A, G, D, A, A, G, D, A], i0: 0.65, i1: 0.75 },
    { name: 'C', bars: 8, chords: [D, A, G, D, Bm, Fsm, G, A], i0: 0.35, i1: 0.45 },
  ];
  const total = secs.reduce((s, x) => s + x.bars, 0);
  const sc = new Score(total);
  const starts = SECTION_START(secs);
  const rh = [[0, 2, 4, 6, 8, 12, 16, 18, 20, 24, 26, 28], [0, 4, 8, 10, 12, 16, 20, 24, 26, 28], [0, 3, 4, 8, 11, 12, 16, 19, 20, 24, 28]];
  const mot = rh.map((r) => makeMotif(rng, r, 32, { repeat: 0.16, leap: 0.9, rise: 0.4 }));
  const planA: Phrase[] = [{ m: 0, op: 'orig' }, { m: 0, op: 'seq', shift: 1 }, { m: 1, op: 'orig' }, { m: 0, op: 'half' }];
  const planA2: Phrase[] = [{ m: 0, op: 'orn' }, { m: 0, op: 'seq', shift: 2 }, { m: 2, op: 'orig' }, { m: 1, op: 'cad' }];
  const planB: Phrase[] = [{ m: 1, op: 'orig', shift: 1 }, { m: 1, op: 'seq', shift: 2 }, { m: 2, op: 'orig', shift: 1 }, { m: 2, op: 'half' }];
  const planA3: Phrase[] = [{ m: 0, op: 'orig', shift: 2 }, { m: 0, op: 'seq', shift: 3 }, { m: 2, op: 'orn', shift: 1 }, { m: 1, op: 'cad' }];
  const planC: Phrase[] = [{ m: 2, op: 'orig' }, { m: 2, op: 'inv' }, { m: 0, op: 'orig' }, { m: 1, op: 'half' }];
  addLead(sc, key, 'whistle', starts[0], secs[0].chords, mot, planA, { lo: 0, hi: 10, center: 5, vel: 0.8, rng });
  addLead(sc, key, 'whistle', starts[1], secs[1].chords, mot, planA2, { lo: 0, hi: 10, center: 5, vel: 0.85, rng, harm: 'organ' });
  addLead(sc, key, 'whistle', starts[2], secs[2].chords, mot, planB, { lo: 1, hi: 11, center: 7, vel: 0.9, rng, harm: 'bell' });
  addLead(sc, key, 'whistle', starts[3], secs[3].chords, mot, planA3, { lo: 1, hi: 11, center: 7, vel: 0.9, rng, harm: 'organ' });
  addLead(sc, key, 'bell', starts[4], secs[4].chords, mot, planC, { lo: 3, hi: 13, center: 8, vel: 0.7, rng });

  for (let bar = 0; bar < total; bar++) {
    const { sec, local, i } = intensityAt(secs, bar);
    const S = secs[sec];
    const ch = S.chords[local % S.chords.length];
    const next = S.chords[(local + 1) % S.chords.length];
    const b0 = bar * 16;
    const root = rootMidi(key, ch, 36);
    const third = ch.q === 'min' ? 3 : 4;
    const nextRoot = rootMidi(key, next, 36);
    // gehender Bass: Grundton, Terz, Quinte, Anlauf zum nächsten Akkord
    const approach = nextRoot > root + 2 ? nextRoot - 1 : nextRoot < root - 2 ? nextRoot + 1 : root + 7;
    [root, root + third, root + 7, approach].forEach((m, j) => sc.add(b0 + j * 4, 'tbass', m, 3.4, 0.55 + (j === 0 ? 0.1 : 0)));
    // Orgel auf den Nachschlägen (mit Shuffle)
    const vo = voicing(key, ch, 57, 3, undefined);
    for (const s of [2, 6, 10, 14]) for (const m of vo) sc.add(b0 + s, 'organ', m, 2, 0.3 + 0.15 * i);
    // Holzblöcke und Schlag
    sc.hit(b0 + 4, 'wood', 0.5, 900);
    sc.hit(b0 + 12, 'wood', 0.45, 780);
    sc.hit(b0, 'kick', 0.5);
    sc.hit(b0 + 8, 'kick', 0.4);
    for (const s of [2, 6, 10, 14]) sc.hit(b0 + s, 'shaker', 0.28 + 0.1 * i);
    if (S.name === 'B' || S.name === 'A3') { sc.hit(b0 + 4, 'clap', 0.35); sc.hit(b0 + 12, 'clap', 0.35); }
    if (local === 0) sc.hit(b0, 'cym', 0.25);
    // kleine Hammer-Auftakte am Phrasenende
    if (local % 4 === 3) { sc.hit(b0 + 13, 'wood', 0.35, 1100); sc.hit(b0 + 15, 'wood', 0.4, 1250); }
  }
  return makePiece('build', sc, {
    bpm: 106, swing: 0.6, loopStart: 0, echoSteps: 3, echoFb: 0.3, echoLp: 2500, bright: 10000,
    mix: { whistle: { g: 0.95 }, tbass: { g: 1 }, organ: { g: 0.9 } },
  });
}

// ---------------------------------------------------------------- Pause (Zeitstopp): D-lydisch, 66 BPM, schwebend

function composePause(): Piece {
  const rng = mulberry32(0x7a5e0001);
  const key: Key = { tonic: 62, mode: MODE.lydian };
  const Dmaj7 = chord(0, 'maj7'), A = chord(7, 'maj'), Bm7 = chord(9, 'm7'), E = chord(2, 'add9'), F = chord(4, 'm7');
  const seq = [Dmaj7, A, Bm7, E, F, E, Dmaj7, A, Bm7, A, Dmaj7, E, F, Bm7, E, Dmaj7];
  const total = seq.length * 2;
  const sc = new Score(total);
  let prev: number[] | undefined;
  seq.forEach((ch, c) => {
    const b0 = c * 32;
    prev = voicing(key, ch, 50, 4, prev);
    for (const m of prev) sc.add(b0, 'pad', m, 34, 0.55);
    sc.add(b0, 'tbass', rootMidi(key, ch, 38), 26, 0.4);
    // Glockenspiel: wenige, lang klingende Töne aus Akkord- und Skalentönen
    const pool: number[] = [];
    for (let idx = 7; idx <= 15; idx++) {
      const nm = scaleMidi(key, nearestChordIdx(key, ch, idx));
      if (!pool.includes(nm)) pool.push(nm);
    }
    const slots = [0, 3, 6, 10, 14, 18, 22, 26, 29].filter(() => rng() < 0.45);
    let last = pool[Math.floor(pool.length / 2)];
    for (const s of slots) {
      const cand = pool[Math.floor(rng() * pool.length)];
      last = Math.abs(cand - last) > 9 ? last + Math.sign(cand - last) * 4 : cand;
      sc.add(b0 + s, 'bell', Math.max(74, Math.min(95, last)), 6, 0.42 + rng() * 0.2);
    }
    // alle vier Akkorde ein aufsteigender Schimmer
    if (c % 4 === 3) {
      const vo = voicing(key, ch, 74, 4, undefined);
      vo.concat(vo.map((m) => m + 12)).forEach((m, j) => sc.add(b0 + 18 + j * 2, 'bell', Math.min(m, 100), 4, 0.3 - j * 0.015));
    }
  });
  return makePiece('pause', sc, {
    bpm: 66, swing: 0, loopStart: 0, echoSteps: 6, echoFb: 0.45, echoLp: 2400, bright: 6000,
    mix: { pad: { g: 0.85, rv: 0.45 }, bell: { g: 0.9, echo: 0.5, rv: 0.5 }, tbass: { g: 0.9 } },
  });
}

// ---------------------------------------------------------------- Stinger

function composeVictoryStinger(): Piece {
  const sc = new Score(2);
  const br = (s: number, m: number, d: number, v: number) => sc.add(s, 'brass', m, d, v);
  // Fanfare: C-Dur-Aufstieg, dann gehaltener Schlussakkord
  [67, 72, 76, 79].forEach((m, j) => br(j * 2, m, 1.8, 0.85));
  [84].forEach((m) => br(8, m, 7, 1.0));
  [76, 79].forEach((m) => br(8, m, 7, 0.65));
  sc.add(8, 'tbass', 48, 7, 0.7);
  [0, 4, 8].forEach((s) => sc.hit(s, 'timp', 0.9, 48));
  for (let s = 10; s < 16; s++) sc.hit(s, 'timp', 0.45 + (s - 10) * 0.09, 55);
  // Schlussakkord
  [72, 76, 79, 84].forEach((m) => br(16, m, 14, 0.95));
  sc.add(16, 'tbass', 48, 14, 0.8);
  sc.add(16, 'tbass', 36, 14, 0.7);
  sc.hit(16, 'timp', 1, 36);
  sc.hit(16, 'cym', 0.9);
  [72, 76, 79, 84, 88, 91].forEach((m, j) => sc.add(18 + j * 2, 'bell', m + 12, 4, 0.45 - j * 0.04));
  for (const m of [60, 64, 67, 72]) sc.add(16, 'pad', m, 20, 0.7);
  return makePiece('victory', sc, { bpm: 120, length: 32, loop: false, echoSteps: 3, echoFb: 0.3, echoLp: 3000, bright: 14000, next: () => composeAfterglow('win'),
    mix: { brass: { g: 1, rv: 0.25 }, bell: { g: 0.9, rv: 0.4 }, timp: { g: 1 } } });
}

function composeDefeatStinger(): Piece {
  const sc = new Score(2);
  // Seufzer: absteigende Linie in a-Moll mit schließendem Filter
  sc.add(0, 'sigh', 76, 3.6, 0.85);
  sc.add(4, 'sigh', 74, 3.6, 0.85);
  sc.add(8, 'sigh', 72, 3.6, 0.85);
  sc.add(12, 'sigh', 69, 11, 0.9);
  for (const m of [45, 52, 57, 60]) sc.add(0, 'pad', m, 24, 0.8);
  sc.hit(0, 'timp', 0.9, 45);
  sc.hit(12, 'timp', 0.7, 40);
  sc.add(16, 'bell', 72, 5, 0.3);
  sc.add(20, 'bell', 69, 5, 0.25);
  return makePiece('defeat', sc, { bpm: 84, length: 24, loop: false, echoSteps: 3, echoFb: 0.35, echoLp: 1800, bright: 8000, next: () => composeAfterglow('lose'),
    mix: { sigh: { g: 1, rv: 0.4 }, pad: { g: 0.9, rv: 0.4 }, bell: { g: 0.9, rv: 0.5 } } });
}

/** Ruhiger Ausklang nach dem Stinger (Dur-Pentatonik bzw. Moll), 32 Takte, schleifenfähig */
function composeAfterglow(kind: 'win' | 'lose'): Piece {
  const win = kind === 'win';
  const rng = mulberry32(win ? 0xa11c0e01 : 0xd0e5ad01);
  const key: Key = win ? { tonic: 60, mode: MODE.ionian } : { tonic: 57, mode: MODE.aeolian };
  const seq: Chord[] = win
    ? [chord(0, 'maj7'), chord(9, 'm7'), chord(5, 'maj7'), chord(7, 'add9'), chord(0, 'maj7'), chord(9, 'm7'), chord(5, 'maj7'), chord(7, 'add9'),
       chord(5, 'maj7'), chord(7, 'add9'), chord(4, 'm7'), chord(9, 'm7'), chord(5, 'maj7'), chord(7, 'add9'), chord(0, 'maj7'), chord(0, 'maj9')]
    : [chord(0, 'm7'), chord(8, 'maj7'), chord(3, 'maj'), chord(10, 'maj'), chord(0, 'm7'), chord(8, 'maj7'), chord(3, 'maj'), chord(10, 'maj'),
       chord(8, 'maj7'), chord(10, 'maj'), chord(0, 'm7'), chord(7, 'min'), chord(8, 'maj7'), chord(10, 'maj'), chord(3, 'maj'), chord(0, 'm9')];
  const sc = new Score(seq.length * 2);
  const pent = win ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10];
  let prev: number[] | undefined;
  seq.forEach((ch, c) => {
    const b0 = c * 32;
    prev = voicing(key, ch, win ? 52 : 48, 4, prev);
    for (const m of prev) sc.add(b0, 'pad', m, 34, 0.5);
    sc.add(b0, 'tbass', rootMidi(key, ch, win ? 38 : 33), 28, 0.35);
    const base = key.tonic + (win ? 12 : 12);
    const pool: number[] = [];
    for (let o = 0; o < 2; o++) for (const p of pent) pool.push(base + 12 * o + p);
    const slots = win ? [0, 6, 12, 20, 24] : [0, 8, 16, 24];
    let ix = Math.floor(rng() * pool.length);
    for (const s of slots) {
      if (rng() < 0.2) continue;
      ix = Math.max(0, Math.min(pool.length - 1, ix + Math.floor(rng() * 5) - 2));
      sc.add(b0 + s, 'bell', pool[ix] + 12, 6, 0.38 + rng() * 0.15);
    }
    if (win && c >= 8) {
      const vo = voicing(key, ch, 64, 4, undefined);
      for (let j = 0; j < 4; j++) sc.add(b0 + 16 + j * 4, 'arp', vo[j % vo.length], 2, 0.22);
    }
  });
  return makePiece(win ? 'afterglow-win' : 'afterglow-lose', sc, {
    bpm: win ? 76 : 62, swing: 0, loopStart: 0, echoSteps: 6, echoFb: 0.42, echoLp: 2200, bright: win ? 7500 : 5000,
    mix: { pad: { g: 0.85, rv: 0.45 }, bell: { g: 0.85, echo: 0.45, rv: 0.5 }, tbass: { g: 0.9 } },
  });
}

// ---------------------------------------------------------------- Zugriff

const CACHE = new Map<string, Piece>();
const BUILDERS: Record<Mood, () => Piece> = {
  menu: composeMenu, build: composeBuild, battle: composeBattle, pause: composePause, victory: composeVictoryStinger, defeat: composeDefeatStinger,
};

export function getPiece(mood: Mood): Piece {
  let p = CACHE.get(mood);
  if (!p) { p = BUILDERS[mood](); CACHE.set(mood, p); }
  return p;
}

/** Ausklang direkt (z. B. für Tests) */
export function getAfterglow(kind: 'win' | 'lose'): Piece {
  const key = 'afterglow-' + kind;
  let p = CACHE.get(key);
  if (!p) { p = composeAfterglow(kind); CACHE.set(key, p); }
  return p;
}
