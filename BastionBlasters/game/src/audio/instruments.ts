// Musik-Instrumente: jede Funktion spielt eine Note auf einem Rack (Frequenz f in Hz, Dauer in Sekunden, Anschlag 0..1).
// Weiche Chiptune-Klänge: Rechteck/Dreieck/Säge mit Tiefpass, gezupfter Bass, Schlagwerk aus Rauschen und Sinus.

import type { Rack } from './synth';

export type InstId =
  | 'kick' | 'snare' | 'hat' | 'ohat' | 'shaker' | 'wood' | 'tom' | 'cym' | 'timp' | 'clap'
  | 'chip' | 'pluck' | 'bell' | 'pad' | 'bass' | 'tbass' | 'stab' | 'arp' | 'brass' | 'whistle' | 'organ' | 'sigh';

export type NoteFn = (r: Rack, f: number, dur: number, v: number) => void;

export const INST: Record<InstId, NoteFn> = {
  // ---------------- Schlagwerk (f wird nur bei Tom/Holzblock/Pauke als Tonhöhe genutzt)
  kick: (r, _f, _d, v) => {
    r.tone({ f: 155, f2: 46, glide: 0.11, dur: 0.3, g: 0.8 * v });
    r.tone({ type: 'triangle', f: 310, f2: 100, glide: 0.07, dur: 0.12, g: 0.18 * v });
    r.noise({ filt: 'bandpass', f: [2500, 1200], q: 1, dur: 0.012, g: 0.2 * v, a: 0.001 });
  },
  snare: (r, _f, _d, v) => {
    r.noise({ filt: 'bandpass', f: 1900, q: 0.7, dur: 0.17, g: 0.85 * v, a: 0.001 });
    r.tone({ type: 'triangle', f: 200, f2: 150, dur: 0.1, g: 0.4 * v });
    r.noise({ filt: 'highpass', f: 5200, dur: 0.07, g: 0.14 * v, a: 0.001 });
  },
  hat: (r, _f, _d, v) => {
    r.noise({ filt: 'highpass', f: 7500, dur: 0.035, g: 0.3 * v, a: 0.001 });
  },
  ohat: (r, _f, _d, v) => {
    r.noise({ filt: 'highpass', f: 6500, dur: 0.22, g: 0.18 * v, a: 0.002 });
  },
  shaker: (r, _f, _d, v) => {
    r.noise({ filt: 'bandpass', f: 6500, q: 1.2, dur: 0.065, g: 0.2 * v, a: 0.014 });
  },
  wood: (r, f, _d, v) => {
    const b = f > 0 ? f : 800;
    r.tone({ f: b, f2: b * 0.85, dur: 0.07, g: 0.5 * v, a: 0.001 });
    r.tone({ type: 'triangle', f: b * 1.5, dur: 0.035, g: 0.2 * v, a: 0.001 });
    r.noise({ filt: 'bandpass', f: b * 1.6, q: 3, dur: 0.02, g: 0.12 * v, a: 0.001 });
  },
  tom: (r, f, _d, v) => {
    const b = f > 0 ? f : 120;
    r.tone({ f: b * 1.25, f2: b * 0.7, glide: 0.18, dur: 0.3, g: 0.75 * v });
    r.noise({ filt: 'bandpass', f: 900, q: 1, dur: 0.04, g: 0.15 * v, a: 0.001 });
  },
  cym: (r, _f, d, v) => {
    r.noise({ filt: 'highpass', f: 5200, dur: Math.max(0.6, d), g: 0.24 * v, a: 0.002 });
    r.noise({ filt: 'bandpass', f: 9000, q: 1.5, dur: Math.max(0.5, d * 0.7), g: 0.12 * v, a: 0.002 });
  },
  timp: (r, f, d, v) => {
    const b = f > 0 ? f : 98;
    r.tone({ f: b * 1.18, f2: b, glide: 0.06, dur: Math.max(0.5, d), g: 0.8 * v });
    r.tone({ f: b * 2.02, dur: 0.25, g: 0.1 * v, a: 0.002 });
    r.noise({ filt: 'lowpass', f: 450, dur: 0.12, g: 0.3 * v, a: 0.002 });
  },
  clap: (r, _f, _d, v) => {
    for (let i = 0; i < 3; i++) r.noise({ filt: 'bandpass', f: 1500, q: 1.1, dur: 0.012, g: 0.4 * v, at: i * 0.011, a: 0.001 });
    r.noise({ filt: 'bandpass', f: 1400, q: 0.9, dur: 0.12, g: 0.3 * v, at: 0.033, a: 0.001 });
  },

  // ---------------- Melodie und Begleitung
  /** Chiptune-Lead: Rechteck + schmale Pulswelle, weicher Tiefpass, spätes Vibrato */
  chip: (r, f, d, v) => {
    const o = { dur: d, a: 0.006, d: 0.08, s: 0.62, r: 0.07, lp: 3200 as number | [number, number], q: 0.8 };
    r.tone({ ...o, type: 'square', f, g: 0.4 * v, vib: d > 0.3 ? [5.5, 10, 0.2] : undefined });
    r.tone({ ...o, type: 'pulse', duty: 0.25, f, g: 0.28 * v, det: 6 });
  },
  /** gezupfte Melodie: Dreieck, Tiefpass fällt (hell -> dunkel) */
  pluck: (r, f, d, v) => {
    const dur = Math.min(1.1, 0.35 + d * 0.5);
    r.tone({ type: 'triangle', f, dur, g: 0.75 * v, lp: [Math.min(9000, 2200 + 3500 * v + f * 1.5), Math.max(500, f * 1.3)], lpT: 0.28, a: 0.003 });
    r.tone({ f: f * 2, dur: 0.18, g: 0.1 * v, a: 0.002 });
  },
  /** Glockenspiel/Spieluhr: Sinus mit unharmonischen Obertönen */
  bell: (r, f, d, v) => {
    const dur = Math.min(1.8, 0.7 + d * 0.3);
    r.tone({ f, dur, g: 0.45 * v, a: 0.002 });
    r.tone({ f: f * 2.01, dur: dur * 0.5, g: 0.13 * v, a: 0.002 });
    r.tone({ f: f * 4.07, dur: dur * 0.22, g: 0.04 * v, a: 0.002 });
    r.noise({ filt: 'highpass', f: 6000, dur: 0.02, g: 0.05 * v, a: 0.001 });
  },
  /** Flächenklang: zwei verstimmte Sägezähne + Dreieck, langsamer Einsatz, dunkler Tiefpass */
  pad: (r, f, d, v) => {
    const o = { dur: d, a: Math.min(0.6, d * 0.3), d: 0.4, s: 0.85, r: Math.min(1.1, 0.4 + d * 0.15), lp: [520, 1500] as [number, number], lpT: Math.min(1.2, d * 0.5), q: 0.5 };
    r.tone({ ...o, type: 'sawtooth', f, g: 0.1 * v, det: -9 });
    r.tone({ ...o, type: 'sawtooth', f, g: 0.1 * v, det: 9 });
    r.tone({ ...o, type: 'triangle', f: f * 0.5, g: 0.14 * v });
  },
  /** gezupfter Bass (Kampf): Säge mit fallendem Tiefpass + Sub-Sinus */
  bass: (r, f, d, v) => {
    const dur = Math.min(0.5, d + 0.08);
    r.tone({ type: 'sawtooth', f, dur, g: 0.3 * v, lp: [1100, 240], lpT: 0.13, q: 1.4, a: 0.004 });
    r.tone({ f, dur, g: 0.28 * v, a: 0.004 });
  },
  /** weicher Dreieck-Bass (Aufbau, Menü, Pause) */
  tbass: (r, f, d, v) => {
    r.tone({ type: 'triangle', f, dur: d, g: 0.42 * v, a: 0.012, d: 0.08, s: 0.75, r: 0.09, lp: 1100 });
    r.tone({ f, dur: d, g: 0.12 * v, a: 0.012, d: 0.08, s: 0.75, r: 0.09 });
  },
  /** kurzer Akkordstoß */
  stab: (r, f, d, v) => {
    r.tone({ type: 'square', f, dur: Math.min(0.24, d + 0.05), g: 0.2 * v, lp: [3400, 1100], lpT: 0.12, a: 0.003 });
  },
  /** Arpeggio-Ton: Dreieck + Pulswelle, kurz */
  arp: (r, f, _d, v) => {
    r.tone({ type: 'triangle', f, dur: 0.28, g: 0.6 * v, lp: [4200, 1500], lpT: 0.2, a: 0.003 });
    r.tone({ type: 'pulse', duty: 0.25, f, dur: 0.14, g: 0.14 * v, lp: 3000, a: 0.003 });
  },
  /** Blech: zwei verstimmte Sägezähne, Tiefpass öffnet im Anschlag */
  brass: (r, f, d, v) => {
    const o = { dur: d, a: 0.035, d: 0.1, s: 0.78, r: 0.12, lp: [700, 2800] as [number, number], lpT: 0.11, q: 0.9 };
    r.tone({ ...o, type: 'sawtooth', f, g: 0.24 * v, det: -6, vib: d > 0.5 ? [5.2, 14, 0.25] : undefined });
    r.tone({ ...o, type: 'sawtooth', f, g: 0.24 * v, det: 6 });
  },
  /** Pfeifen (Aufbau-Melodie): Sinus mit Vibrato */
  whistle: (r, f, d, v) => {
    r.tone({ f, dur: d, g: 0.4 * v, a: 0.03, d: 0.05, s: 0.85, r: 0.08, vib: [5.5, 16, 0.12] });
    r.tone({ f: f * 2, dur: d, g: 0.04 * v, a: 0.03, d: 0.05, s: 0.85, r: 0.08 });
  },
  /** Begleit-Orgel (Aufbau): Rechteck, dunkel */
  organ: (r, f, d, v) => {
    r.tone({ type: 'square', f, dur: Math.min(d, 0.4), g: 0.17 * v, a: 0.008, d: 0.04, s: 0.9, r: 0.05, lp: 1700 });
    r.tone({ f: f * 2, dur: Math.min(d, 0.4), g: 0.06 * v, a: 0.008, d: 0.04, s: 0.9, r: 0.05 });
  },
  /** Niederlage: gedämpftes Blech, Tiefpass schließt sich ("seufzt") */
  sigh: (r, f, d, v) => {
    const o = { dur: d, a: 0.08, d: 0.2, s: 0.7, r: 0.4, lp: [2400, 380] as [number, number], lpT: d + 0.3, q: 1 };
    r.tone({ ...o, type: 'sawtooth', f, g: 0.2 * v, det: -8, vib: [4.8, 22, 0.3] });
    r.tone({ ...o, type: 'sawtooth', f, g: 0.2 * v, det: 8 });
  },
};

// ---------------------------------------------------------------- Mischpult je Instrument

export interface MixCfg {
  /** Pegel */
  g: number;
  /** Stereo-Position */
  pan: number;
  /** Anteil in den Echo-Zweig des Stücks */
  echo: number;
  /** Anteil in den Hall */
  rv: number;
}

export const DEFAULT_MIX: Record<InstId, MixCfg> = {
  kick: { g: 1, pan: 0, echo: 0, rv: 0 },
  snare: { g: 0.8, pan: 0.05, echo: 0, rv: 0.12 },
  hat: { g: 0.8, pan: 0.25, echo: 0, rv: 0.03 },
  ohat: { g: 0.8, pan: 0.3, echo: 0, rv: 0.05 },
  shaker: { g: 0.9, pan: -0.3, echo: 0, rv: 0.03 },
  wood: { g: 0.8, pan: -0.35, echo: 0.05, rv: 0.05 },
  tom: { g: 0.9, pan: -0.15, echo: 0, rv: 0.1 },
  cym: { g: 0.7, pan: 0.15, echo: 0, rv: 0.2 },
  timp: { g: 0.9, pan: 0, echo: 0, rv: 0.2 },
  clap: { g: 0.8, pan: 0.15, echo: 0, rv: 0.15 },
  chip: { g: 1, pan: 0.1, echo: 0.22, rv: 0.08 },
  pluck: { g: 1, pan: 0.15, echo: 0.25, rv: 0.12 },
  bell: { g: 0.9, pan: -0.2, echo: 0.3, rv: 0.3 },
  pad: { g: 1, pan: 0, echo: 0, rv: 0.3 },
  bass: { g: 1, pan: 0, echo: 0, rv: 0 },
  tbass: { g: 1, pan: 0, echo: 0, rv: 0.02 },
  stab: { g: 1, pan: -0.3, echo: 0.1, rv: 0.06 },
  arp: { g: 1, pan: -0.25, echo: 0.3, rv: 0.1 },
  brass: { g: 1, pan: 0.05, echo: 0.1, rv: 0.15 },
  whistle: { g: 1, pan: 0.1, echo: 0.2, rv: 0.12 },
  organ: { g: 1, pan: -0.25, echo: 0.05, rv: 0.08 },
  sigh: { g: 1, pan: 0, echo: 0.1, rv: 0.3 },
};
