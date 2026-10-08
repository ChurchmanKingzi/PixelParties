// SFX-Rezepte: jede Funktion baut einen Klang aus Oszillatoren und Rauschen auf einer Voice.
// Namen: shot.* (Abschuss je Familie), imp.* (Einschlag je Familie), death.*, break.*, ui.* usw.
// Neue Klänge: Rezept in SFX eintragen (und ggf. in META Wichtigkeit/Hall setzen) -- mehr nicht.

import { Voice, type VoiceOpts } from './synth';
import { mulberry32 } from './rng';

export interface SfxParams {
  /** Größe/Wucht, 1 = normal (Einschlagradius, Schaden, Geschütz-Kaliber) */
  s: number;
  /** Tonhöhenfaktor, 1 = normal */
  k: number;
  /** Zufall 0..1 (nur für Variation) */
  r: () => number;
  /** Zufällige Variante 0..3 */
  v: number;
}
export type Recipe = (v: Voice, p: SfxParams) => void;

const rr = (p: SfxParams, a: number, b: number): number => a + (b - a) * p.r();

// ---------------------------------------------------------------- kleine Bausteine

/** Sinus-Wumms mit Tonhöhenabfall */
const thump = (v: Voice, f: number, f2: number, dur: number, g: number, at = 0, glide?: number) => {
  const gl = glide ?? dur * 0.6;
  v.tone({ f, f2, dur, g, at, glide: gl });
  // Oberton-Schicht, damit der Schlag auch auf kleinen Lautsprechern (ohne Tiefbass) trägt
  v.tone({ type: 'triangle', f: f * 2, f2: f2 * 2, dur: dur * 0.6, g: g * 0.38, at, glide: gl * 0.8 });
};
/** Rauschstoß mit fallendem Tiefpass */
const puff = (v: Voice, f0: number, f1: number, dur: number, g: number, at = 0, color: 'white' | 'pink' | 'brown' = 'white') =>
  v.noise({ color, filt: 'lowpass', f: [f0, f1], dur, g, at, q: 0.6, a: 0.004 });
/** Knack: kurzer Hochpass-Impuls */
const crack = (v: Voice, g: number, at = 0, f = 3000, dur = 0.03) => v.noise({ filt: 'highpass', f, dur, g, at, a: 0.001 });
/** Steinchen/Holzklack: schmalbandiger Tick */
const clack = (v: Voice, f: number, at: number, g: number, dur = 0.035, q = 4) => v.noise({ filt: 'bandpass', f: [f * 1.2, f * 0.8], q, dur, g, at, a: 0.001 });
/** Glasig klingender Ton mit Teiltönen */
const bellTone = (v: Voice, f: number, dur: number, g: number, at = 0) => {
  v.tone({ f, dur, g, at, a: 0.002 });
  v.tone({ f: f * 2.756, dur: dur * 0.55, g: g * 0.45, at, a: 0.002 });
  v.tone({ f: f * 5.4, dur: dur * 0.3, g: g * 0.2, at, a: 0.002 });
};
/** Blubberblase: kurzer Sinus nach oben */
const bubble = (v: Voice, f: number, at: number, g: number) => v.tone({ f, f2: f * 1.9, dur: 0.07, g, at, a: 0.004 });
/** Triangel-Ton für Melodisches (kurz, weich) */
const note = (v: Voice, f: number, dur: number, g: number, at = 0, lp = 3500) =>
  v.tone({ type: 'triangle', f, dur, g, at, lp, a: 0.004 });

// ---------------------------------------------------------------- Rezepte

export const SFX = {
  // ------------------------------------------------ Abschüsse
  'shot.cannon': (v, p) => {
    const k = p.k, s = p.s;
    thump(v, 165 * k, 52 * k, 0.2 + 0.1 * s, 0.8, 0, 0.12);
    v.noise({ filt: 'bandpass', f: [1100, 380], q: 0.9, dur: 0.16 + 0.06 * s, g: 0.55 });
    crack(v, 0.3, 0, 2800, 0.025);
    v.noise({ color: 'brown', filt: 'lowpass', f: 420, dur: 0.3 + 0.15 * s, g: 0.3, a: 0.01 });
  },
  'shot.catapult': (v, p) => {
    const k = p.k, s = p.s;
    v.noise({ filt: 'bandpass', f: [2600, 800], q: 2.5, dur: 0.08, g: 1.0, a: 0.001 }); // Holzschlag
    v.tone({ type: 'triangle', f: 330 * k, f2: 150 * k, dur: 0.34, g: 0.6, lp: 2400 }); // Arm schwingt aus
    thump(v, 105 * k, 58 * k, 0.2 + 0.06 * s, 0.4);
    v.tone({ f: 520 * k, f2: 230 * k, dur: 0.24, at: 0.03, g: 0.3, vib: [26, 90] }); // Federboing
    v.noise({ filt: 'bandpass', f: [500, 1700], q: 1.5, a: 0.06, dur: 0.3, g: 0.16, at: 0.05 }); // Seilschwung
  },
  'shot.lob': (v, p) => {
    thump(v, 100 * p.k, 58 * p.k, 0.24, 0.6);
    puff(v, 1400, 300, 0.12, 0.3);
    v.noise({ filt: 'bandpass', f: [400, 2600], q: 2, a: 0.14, dur: 0.7, g: 0.24, at: 0.04 }); // steigt auf
    v.tone({ f: 500 * p.k, f2: 1500 * p.k, dur: 0.55, g: 0.06, a: 0.1, at: 0.05, lp: 3000 });
  },
  'shot.ballista': (v, p) => {
    const k = p.k;
    v.tone({ f: 540 * k, f2: 250 * k, dur: 0.3, g: 0.4, a: 0.001, vib: [30, 40] }); // Sehne
    v.tone({ f: 1080 * k, f2: 500 * k, dur: 0.15, g: 0.15, a: 0.001 });
    v.noise({ filt: 'bandpass', f: [3800, 1500], q: 1.6, dur: 0.12, g: 0.28, at: 0.01 }); // Pfeilzischen
    clack(v, 1300, 0, 0.4, 0.03, 3);
    thump(v, 120 * k, 70 * k, 0.1, 0.3);
  },
  'shot.dig': (v, p) => {
    thump(v, 70 * p.k, 34 * p.k, 0.4, 0.7);
    v.noise({ color: 'brown', filt: 'lowpass', f: [380, 140], dur: 0.75, g: 0.7, a: 0.03 });
    for (let i = 0; i < 4; i++) clack(v, rr(p, 500, 1200), 0.05 + i * 0.07 + rr(p, 0, 0.03), 0.16, 0.04, 2);
  },
  'shot.fire': (v, p) => {
    const k = p.k;
    thump(v, 120 * k, 55 * k, 0.28, 0.5);
    v.noise({ filt: 'bandpass', f: [500, 2600], q: 0.9, a: 0.03, dur: 0.38 + 0.1 * p.s, g: 0.5 }); // Fauchen
    v.noise({ filt: 'highpass', f: 3500, a: 0.02, dur: 0.25, g: 0.12 });
    for (let i = 0; i < 3; i++) crack(v, 0.12, 0.1 + i * 0.07 + rr(p, 0, 0.03), 2400, 0.012);
  },
  'shot.flame': (v, p) => {
    v.noise({ filt: 'bandpass', f: [900, 2300], q: 0.7, a: 0.025, dur: 0.24, g: 0.42 });
    thump(v, 85 * p.k, 60 * p.k, 0.2, 0.22);
    crack(v, 0.08, 0.08, 3000, 0.012);
  },
  'shot.bolt': (v, p) => {
    const k = p.k;
    v.tone({ type: 'sawtooth', f: 1900 * k, f2: 280 * k, dur: 0.13, g: 0.3, lp: 5000, a: 0.001 });
    v.tone({ type: 'square', f: 118 * k, dur: 0.16, g: 0.16, lp: 900 });
    crack(v, 0.38, 0, 4000, 0.06);
    clack(v, 3500, 0.06, 0.2, 0.012, 2);
    clack(v, 2600, 0.09, 0.18, 0.012, 2);
  },
  'shot.poison': (v, p) => {
    const k = p.k;
    v.tone({ f: 230 * k, f2: 700 * k, dur: 0.14, g: 0.5, a: 0.005 }); // Blup
    bubble(v, rr(p, 380, 520) * k, 0.1, 0.22);
    bubble(v, rr(p, 520, 700) * k, 0.16, 0.18);
    v.noise({ filt: 'bandpass', f: [3200, 2400], q: 1, dur: 0.18, g: 0.14, at: 0.05 });
    thump(v, 110 * k, 60 * k, 0.12, 0.3);
  },
  'shot.arcane': (v, p) => {
    const k = p.k;
    v.tone({ f: 880 * k, f2: 1760 * k, dur: 0.22, g: 0.3, a: 0.005 });
    v.tone({ f: 1320 * k, f2: 2640 * k, dur: 0.24, g: 0.18, at: 0.03, a: 0.005 });
    bellTone(v, 1568 * k, 0.4, 0.1, 0.06);
    v.noise({ filt: 'highpass', f: 5500, a: 0.03, dur: 0.22, g: 0.08 });
  },
  'shot.ink': (v, p) => {
    const k = p.k;
    thump(v, 200 * k, 85 * k, 0.2, 0.6);
    v.noise({ filt: 'bandpass', f: [3000, 600], q: 1.4, dur: 0.2, g: 0.4 });
    v.tone({ f: 400 * k, f2: 950 * k, dur: 0.09, g: 0.25, at: 0.05, a: 0.004 });
  },
  'shot.bat': (v, p) => {
    for (let i = 0; i < 5; i++) {
      v.tone({ type: 'triangle', f: rr(p, 2300, 3100) * p.k, f2: rr(p, 1500, 1900) * p.k, dur: 0.06, g: 0.13, at: i * 0.045 + rr(p, 0, 0.012) });
    }
    v.noise({ filt: 'bandpass', f: 1800, q: 1.5, dur: 0.24, g: 0.2, a: 0.01 });
    thump(v, 300 * p.k, 140 * p.k, 0.09, 0.3);
  },
  'shot.bomb': (v, p) => {
    const k = p.k;
    v.tone({ f: 170 * k, f2: 440 * k, dur: 0.11, g: 0.45, a: 0.004 }); // Ploink
    thump(v, 95 * k, 60 * k, 0.15, 0.35, 0.02);
    v.noise({ filt: 'highpass', f: 5000, a: 0.01, dur: 0.36, g: 0.18, at: 0.05 }); // Lunte zischt
    clack(v, 2500, 0.1, 0.12, 0.012, 2);
    clack(v, 3100, 0.16, 0.1, 0.012, 2);
  },
  'shot.icicle': (v, p) => {
    const k = p.k;
    thump(v, 125 * k, 70 * k, 0.2, 0.5);
    v.tone({ f: 2200 * k, f2: 3300 * k, dur: 0.26, g: 0.12, a: 0.02 });
    v.tone({ f: 3300 * k, f2: 4400 * k, dur: 0.22, g: 0.08, a: 0.03 });
    v.noise({ filt: 'bandpass', f: [600, 3200], q: 2, a: 0.1, dur: 0.5, g: 0.2, at: 0.03 });
    v.noise({ filt: 'highpass', f: 6000, a: 0.08, dur: 0.3, g: 0.1, at: 0.05 });
  },
  'shot.ice': (v, p) => {
    const k = p.k;
    v.tone({ f: 3200 * k, f2: 2200 * k, dur: 0.12, g: 0.22, a: 0.002 });
    v.tone({ f: 4800 * k, f2: 3600 * k, dur: 0.08, g: 0.12, a: 0.002 });
    v.noise({ filt: 'highpass', f: 6500, dur: 0.1, g: 0.14 });
    thump(v, 180 * k, 100 * k, 0.07, 0.2);
  },
  'shot.meteor': (v, p) => {
    const k = p.k;
    thump(v, 80 * k, 160 * k, 0.55, 0.4); // steigt
    v.noise({ filt: 'bandpass', f: [250, 2600], q: 1.2, a: 0.2, dur: 0.8, g: 0.3 });
    for (let i = 0; i < 4; i++) {
      v.tone({ f: (1100 + i * 220) * k, f2: (2400 + i * 330) * k, dur: 0.42, g: 0.05, at: 0.1 + i * 0.07, a: 0.05 });
    }
    puff(v, 1800, 250, 0.2, 0.3);
  },
  'shot.goblin': (v, p) => {
    const k = p.k;
    thump(v, 140 * k, 60 * k, 0.2, 0.6);
    puff(v, 2400, 500, 0.12, 0.3);
    // "Wheee!": kleine Kobold-Stimme, steigt auf
    v.tone({ type: 'sawtooth', f: 520 * k, f2: 1250 * k, dur: 0.34, g: 0.2, a: 0.02, at: 0.06, lp: 2600, vib: [11, 70, 0.1] });
    v.tone({ type: 'square', f: 1040 * k, f2: 2500 * k, dur: 0.3, g: 0.04, a: 0.02, at: 0.06, lp: 3000 });
  },
  'shot.arrow': (v, p) => {
    const k = p.k;
    v.tone({ f: 600 * k, f2: 280 * k, dur: 0.12, g: 0.28, a: 0.001 });
    v.noise({ filt: 'bandpass', f: [3600, 1500], q: 1.5, dur: 0.1, g: 0.2, at: 0.01 });
    v.tone({ type: 'triangle', f: 1250 * k, dur: 0.025, g: 0.1, a: 0.001 });
  },
  'shot.goo': (v, p) => {
    const k = p.k;
    thump(v, 250 * k, 110 * k, 0.15, 0.5);
    v.noise({ filt: 'bandpass', f: [1500, 500], q: 1.2, dur: 0.13, g: 0.24 });
    v.tone({ f: 600 * k, f2: 300 * k, dur: 0.07, g: 0.2, at: 0.04 });
  },
  'shot.fish': (v, p) => {
    const k = p.k;
    v.tone({ f: 200 * k, f2: 720 * k, dur: 0.13, g: 0.4, a: 0.005 });
    v.tone({ type: 'triangle', f: 350 * k, f2: 1050 * k, dur: 0.1, g: 0.2, at: 0.03, a: 0.004 });
    v.noise({ filt: 'bandpass', f: 2000, q: 1.5, dur: 0.08, g: 0.15, at: 0.06 }); // Flosse klatscht
  },

  // ------------------------------------------------ Einschläge
  'hit': (v, p) => {
    const s = p.s, k = p.k;
    v.tone({ type: 'triangle', f: 250 * k * (1.2 - s * 0.5), f2: 110 * k, dur: 0.05 + 0.05 * s, g: 0.4, a: 0.001 });
    v.noise({ filt: 'bandpass', f: [rr(p, 1700, 2300), 800], q: 0.9, dur: 0.04 + 0.03 * s, g: 0.3 + 0.2 * s, a: 0.001 });
    if (s > 0.55) thump(v, 120 * k, 62 * k, 0.1 + 0.08 * s, 0.35 * s);
  },
  'imp.stone': (v, p) => {
    const s = p.s, k = p.k;
    thump(v, 88 * k / (0.8 + 0.3 * s), 38 * k, 0.26 + 0.22 * s, 0.72);
    puff(v, 1700, 200, 0.18 + 0.1 * s, 0.42);
    v.noise({ color: 'brown', filt: 'lowpass', f: [800, 120], dur: 0.35 + 0.25 * s, g: 0.35, a: 0.01 });
    for (let i = 0; i < 3; i++) clack(v, rr(p, 700, 2000), 0.06 + i * 0.08 + rr(p, 0, 0.04), 0.14 * s + 0.05, 0.03);
  },
  'imp.dust': (v, p) => {
    puff(v, 1300, 300, 0.12, 0.2);
    thump(v, 115 * p.k, 70 * p.k, 0.08, 0.16);
  },
  'imp.fire': (v, p) => {
    const s = p.s, k = p.k;
    thump(v, 76 * k / (0.8 + 0.3 * s), 30 * k, 0.4 + 0.2 * s, 0.75);
    v.noise({ filt: 'bandpass', f: [2800, 350], q: 0.9, a: 0.01, dur: 0.5 + 0.15 * s, g: 0.5 });
    puff(v, 4200, 400, 0.12, 0.4);
    for (let i = 0; i < 5; i++) crack(v, 0.1, 0.1 + i * 0.07 + rr(p, 0, 0.05), 2200, 0.012);
  },
  'imp.bolt': (v, p) => {
    const k = p.k, s = p.s;
    crack(v, 0.8, 0, 3500, 0.05);
    v.tone({ type: 'sawtooth', f: 2400 * k, f2: 180 * k, dur: 0.14, g: 0.28, lp: 5200, a: 0.001 });
    thump(v, 150 * k / (0.8 + 0.3 * s), 58 * k, 0.16, 0.55);
    v.noise({ filt: 'bandpass', f: 5200, q: 3, a: 0.02, dur: 0.28, g: 0.18, at: 0.03 }); // Zischen
    for (let i = 0; i < 3; i++) clack(v, rr(p, 2500, 4000), 0.08 + i * 0.05, 0.14, 0.012, 2);
  },
  'imp.poison': (v, p) => {
    const k = p.k;
    puff(v, 1500, 400, 0.12, 0.35); // Platscher
    thump(v, 140 * k, 70 * k, 0.1, 0.3);
    for (let i = 0; i < 6; i++) bubble(v, rr(p, 280, 780) * k, 0.05 + i * 0.06 + rr(p, 0, 0.04), 0.17);
    v.noise({ filt: 'highpass', f: 4200, a: 0.03, dur: 0.42, g: 0.1 });
  },
  'imp.arcane': (v, p) => {
    const k = p.k;
    const base = 1046 * k;
    v.tone({ f: 600 * k, f2: 2400 * k, dur: 0.14, g: 0.16, a: 0.004 });
    [1, 2.01, 3.02, 4.17].forEach((m, i) => v.tone({ f: base * m, dur: 0.65 - i * 0.1, g: 0.14 / (1 + i * 0.4), at: i * 0.018, a: 0.003 }));
    thump(v, 180 * k, 80 * k, 0.2, 0.2);
    v.noise({ filt: 'highpass', f: 6500, a: 0.02, dur: 0.3, g: 0.07 });
  },
  'imp.ice': (v, p) => {
    const k = p.k;
    for (let i = 0; i < 3; i++) v.noise({ filt: 'highpass', f: 4800, dur: 0.03 + 0.03 * i, g: 0.3 - i * 0.05, at: i * 0.035, a: 0.001 });
    for (let i = 0; i < 5; i++) v.tone({ f: rr(p, 2500, 5600) * k, dur: 0.25 + rr(p, 0, 0.15), g: 0.1, at: rr(p, 0, 0.12), a: 0.002 });
    clack(v, 900, 0.01, 0.3, 0.09, 1.5);
    thump(v, 160 * k, 90 * k, 0.1, 0.25);
  },
  'imp.meteor': (v, p) => {
    const s = p.s, k = p.k;
    crack(v, 0.55, 0, 3000, 0.08);
    thump(v, 58 * k, 20 * k, 1.5 + 0.3 * s, 1.0, 0, 0.9);
    v.noise({ color: 'brown', filt: 'lowpass', f: [700, 80], dur: 1.5 + 0.3 * s, g: 0.9, a: 0.01 });
    puff(v, 5000, 300, 0.5, 0.5);
    for (let i = 0; i < 6; i++) clack(v, rr(p, 400, 1800), 0.12 + i * 0.1 + rr(p, 0, 0.05), 0.12, 0.04, 2);
  },
  'imp.dome': (v, p) => {
    const k = p.k;
    bellTone(v, 784 * k, 1.1, 0.26);
    v.tone({ f: 330 * k, f2: 150 * k, dur: 0.14, g: 0.35, a: 0.002 }); // Prallen
    v.tone({ f: 520 * k, f2: 400 * k, dur: 0.5, g: 0.06, a: 0.05, vib: [6, 30] });
    clack(v, 2600, 0, 0.25, 0.03, 2);
  },
  'imp.bomb': (v, p) => {
    const s = p.s, k = p.k;
    crack(v, 0.65, 0, 2500, 0.04);
    puff(v, 6200, 400, 0.34 + 0.1 * s, 0.85);
    thump(v, 104 * k / (0.8 + 0.3 * s), 36 * k, 0.32 + 0.1 * s, 0.85);
    v.noise({ color: 'brown', filt: 'lowpass', f: 300, dur: 0.5, g: 0.35, a: 0.02, at: 0.04 });
  },
  'imp.splat': (v, p) => {
    const k = p.k;
    v.noise({ filt: 'bandpass', f: [1300, 320], q: 1, dur: 0.2, g: 0.5, a: 0.002 });
    thump(v, 230 * k, 85 * k, 0.15, 0.4);
    bubble(v, rr(p, 300, 500) * k, 0.1, 0.16);
  },
  'imp.bat': (v, p) => {
    puff(v, 2800, 500, 0.1, 0.3);
    v.tone({ type: 'triangle', f: 950 * p.k, f2: 380 * p.k, dur: 0.13, g: 0.25 });
    thump(v, 160 * p.k, 90 * p.k, 0.08, 0.25);
  },
  'imp.goblin': (v, p) => {
    const k = p.k;
    thump(v, 92 * k, 46 * k, 0.22, 0.6);
    puff(v, 2000, 300, 0.12, 0.25);
    // Boing: federnde Tonhöhe
    v.tone({ type: 'triangle', f: 230 * k, f2: 140 * k, dur: 0.45, g: 0.3, a: 0.004, at: 0.08, vib: [13, 520], lp: 1800 });
  },

  // ------------------------------------------------ Tode (keine grafische Gewalt: Poof, Quieken, Klappern)
  'death.citizen': (v, p) => {
    const k = p.k;
    v.tone({ type: 'triangle', f: 1350 * k, f2: 430 * k, dur: 0.24, g: 0.3, a: 0.005, vib: [9, 90] });
    v.tone({ f: 2700 * k, f2: 860 * k, dur: 0.2, g: 0.06, a: 0.005 });
    clack(v, 2500, 0.23, 0.18, 0.02, 2);
    puff(v, 1800, 400, 0.08, 0.1, 0.23);
  },
  'death.civilian': (v, p) => {
    const k = p.k;
    // kläglich-komisch: drei absteigende Töne wie eine kleine Posaune, "wah-wah-waaah"
    const n = (f: number, f2: number, at: number, dur: number, vib = false) =>
      v.tone({ type: 'sawtooth', f: f * k, f2: f2 * k, dur, at, g: 0.2, a: 0.015, lp: [1700, 520], lpT: dur, q: 1.2, vib: vib ? [6, 40, 0.1] : undefined, s: 0.7, r: 0.06 });
    n(392, 370, 0, 0.14);
    n(330, 311, 0.17, 0.14);
    n(262, 208, 0.34, 0.34, true);
    puff(v, 2200, 400, 0.08, 0.15, 0.72);
  },
  'death.artillery': (v, p) => {
    clack(v, 2000, 0, 0.5, 0.05, 2);
    thump(v, 135 * p.k, 70 * p.k, 0.13, 0.5, 0.01);
    for (let i = 0; i < 3; i++) v.tone({ type: 'triangle', f: rr(p, 900, 1500) * p.k, dur: 0.05, g: 0.1, at: 0.08 + i * 0.06 });
    puff(v, 2500, 400, 0.3, 0.3, 0.04);
  },
  'death.assault': (v, p) => {
    v.tone({ f: 640 * p.k, f2: 150 * p.k, dur: 0.2, g: 0.36, a: 0.004 });
    puff(v, 3000, 500, 0.22, 0.3);
    v.tone({ f: 330 * p.k, dur: 0.03, g: 0.2, at: 0.2 });
  },
  'death.defender': (v, p) => {
    const k = p.k;
    v.tone({ type: 'triangle', f: 520 * k, dur: 0.22, g: 0.22, a: 0.002 });
    v.tone({ f: 780 * k, dur: 0.16, g: 0.1, a: 0.002 });
    thump(v, 110 * k, 60 * k, 0.12, 0.38, 0.02);
    puff(v, 2400, 400, 0.26, 0.28, 0.03);
  },
  'death.bones': (v, p) => {
    const n = 6 + Math.floor(p.r() * 3);
    for (let i = 0; i < n; i++) {
      const at = i * 0.035 + rr(p, 0, 0.02);
      clack(v, rr(p, 900, 2600), at, 0.95 - i * 0.05, 0.03, 3);
      v.tone({ type: 'triangle', f: rr(p, 500, 1100) * p.k, dur: 0.035, g: 0.14, at });
    }
    puff(v, 1500, 300, 0.12, 0.12, 0.02);
  },

  // ------------------------------------------------ Zerstörung
  'break.wall': (v, p) => {
    const k = p.k;
    puff(v, 3600, 280, 0.6, 0.75);
    thump(v, 84 * k, 36 * k, 0.45, 0.85);
    v.noise({ color: 'brown', filt: 'lowpass', f: [900, 150], dur: 0.7, g: 0.5, a: 0.01 });
    for (let i = 0; i < 8; i++) clack(v, rr(p, 600, 3000), 0.04 + i * 0.065 + rr(p, 0, 0.04), 0.3 - i * 0.02, 0.03, 3);
  },
  'break.gate': (v, p) => {
    const k = p.k;
    v.tone({ type: 'sawtooth', f: 150 * k, f2: 82 * k, dur: 0.38, g: 0.16, lp: 650, vib: [19, 120], a: 0.01 }); // Holz ächzt
    clack(v, 1600, 0.06, 0.7, 0.06, 1.5); // Krachen
    puff(v, 3200, 250, 0.55, 0.65, 0.05);
    thump(v, 76 * k, 33 * k, 0.5, 0.95, 0.05);
    v.tone({ type: 'triangle', f: 420 * k, dur: 0.6, g: 0.1, at: 0.1, a: 0.002 }); // Eisenbeschlag klirrt
    v.tone({ type: 'triangle', f: 633 * k, dur: 0.5, g: 0.07, at: 0.1, a: 0.002 });
    for (let i = 0; i < 7; i++) clack(v, rr(p, 500, 2500), 0.15 + i * 0.07 + rr(p, 0, 0.04), 0.22, 0.04, 3);
  },
  'break.module': (v, p) => {
    const k = p.k;
    puff(v, 4000, 200, 0.95, 0.8);
    thump(v, 70 * k, 30 * k, 0.8, 1.0);
    v.noise({ color: 'brown', filt: 'lowpass', f: [700, 90], dur: 1.2, g: 0.7, a: 0.02 });
    clack(v, 1400, 0, 0.5, 0.06, 1.5);
    for (let i = 0; i < 12; i++) clack(v, rr(p, 500, 3000), 0.05 + i * 0.07 + rr(p, 0, 0.05), 0.28 - i * 0.012, 0.035, 3);
  },
  'break.core': (v, p) => {
    const k = p.k;
    thump(v, 62 * k, 22 * k, 1.8, 1.0, 0, 1.2);
    v.noise({ color: 'brown', filt: 'lowpass', f: [900, 80], dur: 1.9, g: 0.9, a: 0.02 });
    puff(v, 5500, 250, 1.1, 0.7);
    crack(v, 0.5, 0, 3000, 0.08);
    // Kristall zerspringt
    for (let i = 0; i < 12; i++) v.tone({ f: rr(p, 1600, 6200) * k, dur: 0.5 + rr(p, 0, 0.6), g: 0.1, at: 0.05 + i * 0.07 + rr(p, 0, 0.05), a: 0.002 });
    v.noise({ filt: 'highpass', f: 4500, dur: 0.9, g: 0.2, a: 0.01 });
    for (let i = 0; i < 10; i++) clack(v, rr(p, 500, 2500), 0.1 + i * 0.1, 0.2, 0.04, 3);
  },

  // ------------------------------------------------ Sonstiges
  'rank': (v, p) => {
    const f = [523.25, 659.25, 783.99, 1046.5, 1318.5].map((x) => x * p.k);
    f.forEach((x, i) => {
      const last = i === f.length - 1;
      v.tone({ type: 'triangle', f: x, dur: last ? 0.5 : 0.1, g: 0.3, at: i * 0.075, a: 0.004, lp: 4500 });
      v.tone({ type: 'square', f: x, dur: last ? 0.35 : 0.08, g: 0.07, at: i * 0.075, a: 0.004, lp: 2600 });
    });
    bellTone(v, 2093 * p.k, 0.7, 0.07, 0.3);
  },
  'heal': (v, p) => {
    const k = p.k;
    [1318.5, 1760].forEach((x, i) => {
      v.tone({ f: x * k, dur: 0.36, g: 0.2, at: i * 0.09, a: 0.003 });
      v.tone({ f: x * 2 * k, dur: 0.16, g: 0.06, at: i * 0.09, a: 0.003 });
    });
  },
  'spawn': (v, p) => {
    puff(v, 1800, 500, 0.13, 0.2);
    v.tone({ f: 380 * p.k, f2: 720 * p.k, dur: 0.09, g: 0.12, at: 0.02, a: 0.004 });
  },
  'fx.puff': (v, p) => {
    puff(v, 1500, 400, 0.12, 0.18);
    thump(v, 280 * p.k, 160 * p.k, 0.07, 0.1);
  },
  'fx.revive': (v, p) => {
    const k = p.k;
    v.tone({ f: 440 * k, f2: 880 * k, dur: 0.42, g: 0.15, a: 0.03 });
    v.tone({ f: 660 * k, f2: 1320 * k, dur: 0.4, g: 0.1, a: 0.03, at: 0.05 });
    [784, 988, 1175].forEach((x, i) => note(v, x * k, 0.3, 0.12, 0.2 + i * 0.07));
  },
  'fx.flame': (v, p) => {
    v.noise({ filt: 'bandpass', f: [500, 1800], q: 0.8, a: 0.03, dur: 0.3, g: 0.32 });
    thump(v, 85 * p.k, 55 * p.k, 0.2, 0.2);
  },
  'fx.dirt': (v, p) => {
    thump(v, 105 * p.k, 60 * p.k, 0.14, 0.3);
    puff(v, 800, 250, 0.16, 0.28, 0, 'pink');
    clack(v, 700, 0.06, 0.1, 0.04, 2);
  },
  'fx.spark': (v, p) => {
    v.tone({ type: 'sawtooth', f: 3000 * p.k, f2: 900 * p.k, dur: 0.07, g: 0.15, lp: 4500, a: 0.001 });
    crack(v, 0.13, 0, 5000, 0.03);
  },
  'fx.squeak': (v, p) => {
    v.tone({ f: 1500 * p.k, f2: 2100 * p.k, dur: 0.06, g: 0.14, a: 0.004 });
    v.tone({ f: 1850 * p.k, f2: 1300 * p.k, dur: 0.07, g: 0.12, at: 0.06, a: 0.004 });
  },
  'fx.buzz': (v, p) => {
    v.tone({ type: 'sawtooth', f: 190 * p.k, dur: 0.26, g: 0.12, lp: 1500, vib: [85, 220], a: 0.02 });
    v.noise({ filt: 'bandpass', f: 1200, q: 3, dur: 0.22, g: 0.05, a: 0.02 });
  },

  // ------------------------------------------------ Schwebetexte
  'text.dodge': (v, p) => {
    v.noise({ filt: 'bandpass', f: [2600, 900], q: 1.1, dur: 0.1, g: 0.2, a: 0.01 });
    v.tone({ type: 'triangle', f: 720 * p.k, f2: 500 * p.k, dur: 0.07, g: 0.1 });
  },
  'text.catch': (v, p) => {
    clack(v, 1500, 0, 0.45, 0.045, 2);
    thump(v, 210 * p.k, 150 * p.k, 0.07, 0.4);
    note(v, 1318 * p.k, 0.12, 0.1, 0.05);
  },
  'text.reflect': (v, p) => {
    v.tone({ f: 2400 * p.k, f2: 1800 * p.k, dur: 0.12, g: 0.25, a: 0.002 });
    v.tone({ type: 'triangle', f: 600 * p.k, f2: 1200 * p.k, dur: 0.22, g: 0.2, at: 0.05, vib: [15, 200] });
    bellTone(v, 1760 * p.k, 0.35, 0.08, 0.02);
  },
  'text.berserk': (v, p) => {
    v.tone({ type: 'sawtooth', f: 92 * p.k, f2: 66 * p.k, dur: 0.36, g: 0.28, lp: 420, vib: [40, 180], a: 0.03 });
    v.noise({ color: 'pink', filt: 'bandpass', f: 520, q: 1.5, dur: 0.32, g: 0.22, a: 0.03 });
  },
  'text.chomp': (v, p) => {
    for (let i = 0; i < 2; i++) {
      v.noise({ filt: 'bandpass', f: [1300, 420], q: 1.4, dur: 0.07, g: 0.5, at: i * 0.11, a: 0.002 });
      thump(v, 150 * p.k, 80 * p.k, 0.1, 0.5, i * 0.11);
    }
  },
  'text.copy': (v, p) => {
    v.tone({ f: 600 * p.k, f2: 1200 * p.k, dur: 0.1, g: 0.2, a: 0.004 });
    v.tone({ f: 900 * p.k, f2: 1800 * p.k, dur: 0.12, g: 0.18, at: 0.08, a: 0.004 });
  },
  'text.chaos': (v, p) => {
    v.tone({ f: 420 * p.k, dur: 0.34, g: 0.16, a: 0.02, vib: [12, 700] });
    v.noise({ filt: 'bandpass', f: [900, 2200], q: 2, dur: 0.3, g: 0.08, a: 0.04 });
  },
  'text.pit': (v, p) => {
    v.tone({ f: 320 * p.k, f2: 100 * p.k, dur: 0.16, g: 0.3, a: 0.004 });
    thump(v, 90 * p.k, 50 * p.k, 0.12, 0.35, 0.15);
  },

  // ------------------------------------------------ Meldungen / Zeit
  'horn.wave': (v, p) => {
    // Wellenhorn: zwei Töne Quinte aufwärts, Sägezahn durch dunklen Tiefpass
    const k = p.k;
    const horn = (f: number, at: number, dur: number) => {
      v.tone({ type: 'sawtooth', f: f * k, dur, at, g: 0.2, a: 0.07, d: 0.15, s: 0.8, r: 0.35, lp: [500, 1500], lpT: 0.25, det: -7, vib: [5.2, 14, 0.25] });
      v.tone({ type: 'sawtooth', f: f * k, dur, at, g: 0.2, a: 0.07, d: 0.15, s: 0.8, r: 0.35, lp: [500, 1500], lpT: 0.25, det: 7 });
      v.tone({ f: f * 0.5 * k, dur, at, g: 0.22, a: 0.08, d: 0.1, s: 0.8, r: 0.3 });
    };
    horn(146.83, 0, 0.36);
    horn(220, 0.38, 0.75);
  },
  'alarm.gate': (v, p) => {
    bellTone(v, 392 * p.k, 0.7, 0.28);
    bellTone(v, 311 * p.k, 0.9, 0.28, 0.3);
  },
  'shield.break': (v, p) => {
    const k = p.k;
    v.tone({ f: 800 * k, f2: 120 * k, dur: 0.5, g: 0.35, a: 0.003 });
    v.noise({ filt: 'highpass', f: 4500, dur: 0.35, g: 0.3, a: 0.001 });
    for (let i = 0; i < 7; i++) v.tone({ f: rr(p, 1800, 6000) * k, dur: 0.4, g: 0.09, at: i * 0.045 + rr(p, 0, 0.03), a: 0.002 });
    thump(v, 120 * k, 50 * k, 0.3, 0.4);
  },
  'repair': (v, p) => {
    clack(v, 900, 0, 0.45, 0.05, 2); thump(v, 170 * p.k, 120 * p.k, 0.06, 0.3);
    clack(v, 1000, 0.12, 0.4, 0.05, 2); thump(v, 180 * p.k, 125 * p.k, 0.06, 0.3, 0.12);
    note(v, 784 * p.k, 0.14, 0.15, 0.24);
    note(v, 1175 * p.k, 0.3, 0.15, 0.32);
  },
  'wish': (v, p) => {
    [880, 988, 1175, 1319, 1568, 1760, 2093].forEach((x, i) => v.tone({ f: x * p.k, dur: 0.55, g: 0.12, at: i * 0.05, a: 0.003 }));
    v.noise({ filt: 'highpass', f: 7000, a: 0.05, dur: 0.4, g: 0.06, at: 0.1 });
  },
  'timestop': (v, p) => {
    v.tone({ f: 900 * p.k, f2: 110 * p.k, dur: 0.62, g: 0.33, a: 0.01 });
    v.noise({ filt: 'lowpass', f: [6000, 200], dur: 0.65, g: 0.28, a: 0.01 });
    for (let i = 0; i < 4; i++) clack(v, 3000 - i * 400, 0.1 + i * 0.1, 0.13, 0.015, 3); // Uhrtick
    thump(v, 72 * p.k, 40 * p.k, 0.4, 0.5, 0.55);
  },
  'timeresume': (v, p) => {
    v.tone({ f: 140 * p.k, f2: 920 * p.k, dur: 0.46, g: 0.28, a: 0.02 });
    v.noise({ filt: 'bandpass', f: [200, 5000], q: 0.8, dur: 0.46, g: 0.22, a: 0.35 });
    bellTone(v, 1568 * p.k, 0.5, 0.12, 0.46);
  },

  // ------------------------------------------------ Oberfläche (kurz, leise, angenehm)
  'ui.click': (v, p) => {
    v.tone({ type: 'triangle', f: 1250 * p.k, f2: 880 * p.k, dur: 0.055, g: 0.22, a: 0.002, lp: 5000 });
    crack(v, 0.08, 0, 4000, 0.012);
  },
  'ui.hover': (v, p) => {
    v.tone({ type: 'triangle', f: 1900 * p.k, dur: 0.03, g: 0.15, a: 0.003, lp: 5000 });
  },
  'ui.card': (v, p) => {
    v.noise({ filt: 'bandpass', f: [1700, 5200], q: 0.9, a: 0.015, dur: 0.1, g: 0.4 });
    v.tone({ type: 'triangle', f: 1000 * p.k, dur: 0.03, g: 0.08, at: 0.07 });
  },
  'ui.play': (v, p) => {
    // Klack (Holz/Stein) plus kleiner Aufwärtsakkord
    clack(v, 1100, 0, 0.5, 0.04, 3);
    thump(v, 185 * p.k, 105 * p.k, 0.1, 0.5);
    [523.25, 659.25, 783.99].forEach((x, i) => note(v, x * p.k, 0.24, 0.15, 0.06 + i * 0.05));
    note(v, 1046.5 * p.k, 0.3, 0.08, 0.21);
  },
  'ui.invalid': (v, p) => {
    v.tone({ type: 'square', f: 196 * p.k, f2: 150 * p.k, dur: 0.1, g: 0.22, lp: 700, a: 0.004 });
    v.tone({ type: 'square', f: 150 * p.k, f2: 104 * p.k, dur: 0.16, g: 0.22, at: 0.11, lp: 600, a: 0.004 });
  },
  'ui.rotate': (v, p) => {
    for (let i = 0; i < 3; i++) {
      clack(v, 2600, i * 0.032, 0.45, 0.015, 3);
      v.tone({ type: 'triangle', f: (560 + i * 70) * p.k, dur: 0.022, g: 0.12, at: i * 0.032 });
    }
  },
  'ui.tab': (v, p) => {
    v.tone({ type: 'triangle', f: 880 * p.k, f2: 1120 * p.k, dur: 0.055, g: 0.14, a: 0.003, lp: 4500 });
  },
  'ui.toggle': (v, p) => {
    v.tone({ f: 700 * p.k, dur: 0.04, g: 0.14, a: 0.003 });
    v.tone({ f: 1000 * p.k, dur: 0.05, g: 0.14, at: 0.05, a: 0.003 });
  },
  'ui.confirm': (v, p) => {
    note(v, 659.25 * p.k, 0.09, 0.2);
    note(v, 987.77 * p.k, 0.2, 0.2, 0.08);
    bellTone(v, 1975 * p.k, 0.3, 0.04, 0.1);
  },
  'ui.cancel': (v, p) => {
    note(v, 659.25 * p.k, 0.08, 0.18);
    note(v, 440 * p.k, 0.14, 0.18, 0.07);
  },
  'ui.pause': (v, p) => {
    v.tone({ f: 700 * p.k, f2: 180 * p.k, dur: 0.34, g: 0.24, a: 0.005, lp: 2500 });
    v.noise({ filt: 'bandpass', f: [3000, 300], q: 0.8, dur: 0.3, g: 0.1 });
    thump(v, 90 * p.k, 60 * p.k, 0.14, 0.3, 0.28);
  },
  'ui.speed': (v, p) => {
    v.tone({ type: 'triangle', f: 1400 * p.k, dur: 0.03, g: 0.12, a: 0.002 });
    v.tone({ type: 'triangle', f: 1900 * p.k, dur: 0.035, g: 0.12, at: 0.04, a: 0.002 });
    v.noise({ filt: 'bandpass', f: [1000, 3000], q: 1, dur: 0.1, g: 0.14, at: 0.01 });
  },
  'ui.draw': (v, p) => {
    v.noise({ filt: 'bandpass', f: [900, 3500], q: 0.9, a: 0.03, dur: 0.15, g: 0.45 });
    v.tone({ type: 'triangle', f: 1500 * p.k, f2: 2200 * p.k, dur: 0.06, g: 0.1, at: 0.1 });
  },
  'ui.reroll': (v, p) => {
    for (let i = 0; i < 5; i++) clack(v, rr(p, 1200, 3200), i * 0.035 + rr(p, 0, 0.01), 0.22, 0.02, 5);
    bellTone(v, 1760 * p.k, 0.4, 0.1, 0.22);
  },
} satisfies Record<string, Recipe>;

export type SfxName = keyof typeof SFX;
export const SFX_NAMES = Object.keys(SFX) as SfxName[];

// ---------------------------------------------------------------- Metadaten: Wichtigkeit, Hall, Grundpegel

export interface SfxMeta {
  /** Stimmen-Priorität (hoch = bleibt bei vollem Polyphonie-Limit erhalten) */
  prio: number;
  /** Hallanteil 0..1 */
  wet: number;
  /** Grundpegel der Stimme */
  vol: number;
}

const m = (prio: number, wet: number, vol = 1): SfxMeta => ({ prio, wet, vol });

export const META: Record<SfxName, SfxMeta> = {
  'shot.cannon': m(3, 0.12), 'shot.catapult': m(3, 0.1), 'shot.lob': m(3, 0.12), 'shot.ballista': m(3, 0.08), 'shot.dig': m(3, 0.06),
  'shot.fire': m(3, 0.12), 'shot.flame': m(2, 0.05), 'shot.bolt': m(3, 0.12), 'shot.poison': m(3, 0.08), 'shot.arcane': m(3, 0.25),
  'shot.ink': m(3, 0.08), 'shot.bat': m(3, 0.08), 'shot.bomb': m(3, 0.1), 'shot.icicle': m(3, 0.2), 'shot.ice': m(2, 0.12),
  'shot.meteor': m(3, 0.25), 'shot.goblin': m(3, 0.1), 'shot.arrow': m(2, 0.05), 'shot.goo': m(2, 0.05), 'shot.fish': m(2, 0.05),
  'hit': m(1, 0.03),
  'imp.stone': m(4, 0.12), 'imp.dust': m(2, 0.05), 'imp.fire': m(4, 0.18), 'imp.bolt': m(4, 0.15), 'imp.poison': m(4, 0.1),
  'imp.arcane': m(4, 0.35), 'imp.ice': m(4, 0.2), 'imp.meteor': m(5, 0.3), 'imp.dome': m(4, 0.4), 'imp.bomb': m(4, 0.15),
  'imp.splat': m(3, 0.08), 'imp.bat': m(3, 0.06), 'imp.goblin': m(4, 0.1),
  'death.citizen': m(3, 0.1), 'death.civilian': m(4, 0.15), 'death.artillery': m(4, 0.12), 'death.assault': m(3, 0.1),
  'death.defender': m(3, 0.1), 'death.bones': m(3, 0.1),
  'break.wall': m(7, 0.22), 'break.gate': m(8, 0.25), 'break.module': m(8, 0.3), 'break.core': m(10, 0.5),
  'rank': m(6, 0.3), 'heal': m(1, 0.3), 'spawn': m(1, 0.05), 'fx.puff': m(1, 0.04), 'fx.revive': m(3, 0.35), 'fx.flame': m(1, 0.05),
  'fx.dirt': m(1, 0.04), 'fx.spark': m(1, 0.05), 'fx.squeak': m(1, 0.05), 'fx.buzz': m(1, 0.04),
  'text.dodge': m(1, 0.04), 'text.catch': m(2, 0.08), 'text.reflect': m(2, 0.2), 'text.berserk': m(2, 0.1), 'text.chomp': m(2, 0.05),
  'text.copy': m(1, 0.1), 'text.chaos': m(1, 0.15), 'text.pit': m(1, 0.05),
  'horn.wave': m(9, 0.4), 'alarm.gate': m(8, 0.3), 'shield.break': m(7, 0.3), 'repair': m(3, 0.15), 'wish': m(3, 0.5),
  'timestop': m(9, 0.4), 'timeresume': m(9, 0.35),
  'ui.click': m(9, 0.05), 'ui.hover': m(9, 0.02, 0.8), 'ui.card': m(9, 0.05), 'ui.play': m(9, 0.2), 'ui.invalid': m(9, 0.03),
  'ui.rotate': m(9, 0.03), 'ui.tab': m(9, 0.03), 'ui.toggle': m(9, 0.03), 'ui.confirm': m(9, 0.2), 'ui.cancel': m(9, 0.05),
  'ui.pause': m(9, 0.2), 'ui.speed': m(9, 0.03), 'ui.draw': m(9, 0.1), 'ui.reroll': m(9, 0.2),
};

// ---------------------------------------------------------------- Start einer Stimme

export interface SfxStart extends VoiceOpts {
  size?: number;
  pitch?: number;
  seed?: number;
}

/** Baut die Stimme für ein Rezept und startet sie zur Audio-Zeit t. Ohne Seed: Zufallsvariation, mit Seed: deterministisch. */
export function startSfx(ac: BaseAudioContext, dest: AudioNode, reverb: AudioNode | null, name: SfxName, t: number, o: SfxStart = {}): Voice {
  const meta = META[name];
  const rng = o.rng ?? (o.seed !== undefined ? mulberry32(o.seed) : Math.random);
  const voice = new Voice(ac, dest, reverb, t, {
    gain: (o.gain ?? 1) * meta.vol,
    pan: o.pan,
    lp: o.lp,
    wet: o.wet ?? meta.wet,
    ts: o.ts,
    prio: o.prio ?? meta.prio,
    rng,
  });
  voice.key = name;
  const jitter = 1 + (rng() - 0.5) * 0.06;
  SFX[name](voice, { s: o.size ?? 1, k: (o.pitch ?? 1) * jitter, r: rng, v: Math.floor(rng() * 4) });
  return voice;
}
