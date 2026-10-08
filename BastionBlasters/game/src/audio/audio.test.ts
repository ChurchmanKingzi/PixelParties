// Tests der Audio-Schicht ohne AudioContext (Node): nichts darf werfen, reine Logik (Rate-Limit, Stücke, Speicher) stimmt.
// Die Klangmessungen (OfflineAudioContext in Chromium) liegen in tools/audiotest.mjs.

import { afterEach, describe, expect, it } from 'vitest';
import { AudioEngine, DEFAULT_VOLUME, RATE, RateGate, STORAGE_KEY, audio, taper, type UiSound } from './audio';
import { getAfterglow, getPiece, type Mood } from './compose';
import { SFX_NAMES } from './sfx';
import { mulberry32 } from './rng';
import type { SimEvent } from '../sim/types';

const ALL_EVENTS: SimEvent[] = [
  { t: 'shot', x0: 10, y0: 10, x1: 20, y1: 10, fly: 30, vis: 'stone', team: 0, cid: 'UA-01' },
  { t: 'shot', x0: 10, y0: 10, x1: 20, y1: 10, fly: 6, vis: 'arrow', team: 1, cid: 'BT-01' },
  { t: 'shot', x0: 10, y0: 10, x1: 20, y1: 10, fly: 5, vis: 'unbekannt', team: 1, cid: 'gibtsnicht' },
  { t: 'impact', x: 20, y: 10, r: 1.5, vis: 'fire' },
  { t: 'impact', x: 20, y: 10, r: 1, vis: 'dome' },
  { t: 'hit', x: 5, y: 5, dmg: 12, team: 0 },
  { t: 'death', x: 5, y: 5, cid: 'US-01', team: 1, cat: 'citizen' },
  { t: 'death', x: 5, y: 5, cid: 'US-01', team: 1, cat: 'assault' },
  { t: 'rank', x: 5, y: 5, id: 1, rank: 2, cid: 'US-01', team: 0 },
  { t: 'text', x: 5, y: 5, text: 'foresight', color: '#fff' },
  { t: 'heal', x: 5, y: 5 },
  { t: 'break', x: 5, y: 5, what: 'core' },
  { t: 'feed', msg: 'Wave 4', team: -1 },
  { t: 'feed', msg: 'The gate is broken!', team: 0 },
  { t: 'spawn', x: 5, y: 5, cid: 'US-01' },
  { t: 'fx', x: 5, y: 5, name: 'Hornet' },
  { t: 'fx', x: 5, y: 5, name: 'irgendwas' },
];
const UI: UiSound[] = ['click', 'hover', 'card', 'play', 'invalid', 'rotate', 'tab', 'toggle', 'confirm', 'cancel', 'pause', 'speed', 'draw', 'reroll'];
const MOODS = ['menu', 'build', 'battle', 'pause', 'victory', 'defeat', 'off'] as const;

describe('ohne AudioContext', () => {
  it('Singleton: alle Methoden sind No-Ops und werfen nicht', () => {
    expect(() => {
      audio.unlock();
      for (const e of ALL_EVENTS) audio.onEvent(e);
      for (const u of UI) audio.ui(u);
      for (const m of MOODS) audio.setMood(m);
      for (const s of [0, 1, 2, 4, 8]) audio.setSpeed(s);
      audio.setListener(10, 10);
      audio.setListener(Number.NaN, 5);
      audio.setViewer(0);
      audio.setVolume('master', 0.5);
      audio.setVolume('music', Number.NaN);
      audio.setMuted(true);
      audio.toggleMute();
      const off = audio.onChange(() => {});
      off();
    }).not.toThrow();
    expect(audio.volume.master).toBe(0.5);
    expect(audio.stats.played).toBe(0);
  });

  it('window ohne AudioContext, kaputter Speicher: kein Fehler', () => {
    const g = globalThis as Record<string, unknown>;
    const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    g.window = {};
    try {
      const eng = new AudioEngine();
      expect(() => {
        eng.unlock();
        eng.setVolume('sfx', 0.2);
        eng.toggleMute();
        for (const e of ALL_EVENTS) eng.onEvent(e);
        eng.ui('click');
      }).not.toThrow();
      expect(eng.volume.sfx).toBe(0.2);
    } finally {
      delete g.window;
      if (had) Object.defineProperty(globalThis, 'localStorage', had);
      else delete g.localStorage;
    }
  });
});

describe('Lautstärke und Speicher', () => {
  const g = globalThis as Record<string, unknown>;
  afterEach(() => { delete g.localStorage; });

  it('Standardwerte', () => {
    const eng = new AudioEngine({ storage: false });
    expect(eng.volume).toEqual({ master: 0.8, music: 0.35, sfx: 0.7, muted: false });
    expect(DEFAULT_VOLUME.music).toBe(0.35);
  });

  it('lädt und speichert unter bb.audio, begrenzt Werte', () => {
    const store = new Map<string, string>([[STORAGE_KEY, JSON.stringify({ master: 3, music: -1, sfx: 'x', muted: true })]]);
    g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    const eng = new AudioEngine();
    expect(eng.volume).toEqual({ master: 1, music: 0, sfx: 0.7, muted: true });
    const seen: boolean[] = [];
    eng.onChange((v) => seen.push(v.muted));
    eng.toggleMute();
    expect(seen).toEqual([false]);
    expect(JSON.parse(store.get(STORAGE_KEY) as string).muted).toBe(false);
  });

  it('kaputte Daten fallen auf Standard zurück', () => {
    g.localStorage = { getItem: () => '{kaputt', setItem: () => { throw new Error('voll'); } };
    const eng = new AudioEngine();
    expect(eng.volume).toEqual(DEFAULT_VOLUME);
    expect(() => eng.setVolume('master', 0.1)).not.toThrow();
  });

  it('Regler-Kurve ist monoton und begrenzt', () => {
    expect(taper(0)).toBe(0);
    expect(taper(1)).toBe(1);
    expect(taper(0.5)).toBeLessThan(0.5);
    expect(taper(2)).toBe(1);
  });
});

describe('Rate-Limit', () => {
  it('gleiche Art innerhalb von 40 ms nur einmal', () => {
    const g = new RateGate();
    expect(g.allow('hit', 'hit', 1.0)).toBe(true);
    expect(g.allow('hit', 'hit', 1.02)).toBe(false);
    expect(g.allow('hit', 'hit', 1.05)).toBe(true);
  });

  it('Treffer höchstens ~12 pro Sekunde, bei hohem Tempo weniger', () => {
    const g = new RateGate();
    let n = 0;
    for (let i = 0; i < 1000; i++) if (g.allow('hit', 'k' + i, i * 0.0009)) n++;
    expect(n).toBeLessThanOrEqual(RATE.hit.perSec);
    const g2 = new RateGate();
    let m = 0;
    for (let i = 0; i < 1000; i++) if (g2.allow('hit', 'k' + i, i * 0.0009, 0.4)) m++;
    expect(m).toBeLessThan(n);
  });
});

describe('Stücke', () => {
  const loops: Mood[] = ['menu', 'build', 'battle', 'pause'];
  it('mindestens 32 Takte, Noten im sinnvollen Bereich, Schleifen enden nicht im Nichts', () => {
    for (const m of loops) {
      const p = getPiece(m);
      expect(p.bars - p.loopStart / 16).toBeGreaterThanOrEqual(32);
      expect(p.loop).toBe(true);
      expect(p.steps.length).toBe(p.bars * 16);
      let notes = 0;
      for (const st of p.steps) for (const e of st) {
        notes++;
        expect(Number.isFinite(e.m) && Number.isFinite(e.v) && e.d > 0).toBe(true);
        expect(e.v).toBeGreaterThanOrEqual(0);
        expect(e.v).toBeLessThanOrEqual(1);
        if (e.m > 0 && !['kick', 'snare', 'hat', 'ohat', 'shaker', 'wood', 'tom', 'cym', 'clap'].includes(e.i)) {
          expect(e.m).toBeGreaterThanOrEqual(24);
          expect(e.m).toBeLessThanOrEqual(108);
        }
      }
      expect(notes).toBeGreaterThan(p.bars * 4);
    }
  });

  it('Stinger 3-5 s mit Ausklang von mindestens 32 Takten', () => {
    for (const [m, kind] of [['victory', 'win'], ['defeat', 'lose']] as const) {
      const p = getPiece(m);
      const sec = (p.length * 60) / p.bpm / 4;
      expect(sec).toBeGreaterThanOrEqual(3);
      expect(sec).toBeLessThanOrEqual(5);
      expect(p.loop).toBe(false);
      const next = p.next?.();
      expect(next?.id).toBe(getAfterglow(kind).id);
      expect(next?.bars).toBeGreaterThanOrEqual(32);
    }
  });

  it('Stücke sind deterministisch (fester Seed)', () => {
    const a = JSON.stringify(getPiece('battle').steps);
    const b = JSON.stringify(getPiece('battle').steps);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(1000);
  });
});

describe('SFX-Bibliothek', () => {
  it('enthält je Familie eigene Abschuss- und Einschlagsklänge', () => {
    const shots = SFX_NAMES.filter((n) => n.startsWith('shot.'));
    const imps = SFX_NAMES.filter((n) => n.startsWith('imp.'));
    expect(shots.length).toBeGreaterThanOrEqual(15);
    expect(imps.length).toBeGreaterThanOrEqual(10);
    for (const u of UI) expect(SFX_NAMES).toContain('ui.' + u);
  });

  it('PRNG ist stabil', () => {
    const r = mulberry32(5);
    const a = [r(), r(), r()];
    const r2 = mulberry32(5);
    expect([r2(), r2(), r2()]).toEqual(a);
  });
});
