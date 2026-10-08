// Browser-Teil des Audio-Selbsttests (wird von tools/audiotest.mjs per esbuild gebündelt und in Chromium geladen).
// Rendert SFX, Musik und die Engine per OfflineAudioContext und misst Pegel, Spitzen, Spektrum und Übergänge.

import { AudioEngine, DEFAULT_VOLUME, MAX_VOICES, applyVolumes, audio, buildGraph, type VolumeState } from '../src/audio/audio';
import { META, SFX_NAMES, startSfx, type SfxName } from '../src/audio/sfx';
import { MusicPlayer, type MusicMood } from '../src/audio/music';
import { getAfterglow, getPiece, type Mood, type Piece } from '../src/audio/compose';
import { mulberry32 } from '../src/audio/rng';
import { createAudioControls } from '../src/audio/controls';
import { UNITS } from '../src/sim/data';
import type { SimEvent } from '../src/sim/types';

const SR = 44100;
type Chan = [Float32Array, Float32Array];

const mkCtx = (sec: number, sr = SR) => new OfflineAudioContext(2, Math.ceil(sec * sr), sr);
async function render(ac: OfflineAudioContext): Promise<Chan> {
  const b = await ac.startRendering();
  return [b.getChannelData(0), b.getChannelData(1)];
}
const db = (x: number) => 20 * Math.log10(Math.max(1e-9, x));

// ---------------------------------------------------------------- Analyse

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const BAND_EDGES = Array.from({ length: 17 }, (_, i) => 40 * Math.pow(16000 / 40, i / 16));

/** Spektrum eines Mono-Ausschnitts: Schwerpunkt, Tiefanteil, Bandenergien */
function spectrum(mono: Float32Array, start: number, n: number, sr: number) {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = mono[start + i] ?? 0;
    re[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  fft(re, im);
  const half = n / 2;
  const df = sr / n;
  let tot = 0, wsum = 0, low = 0, high = 0, mid = 0, hf = 0;
  const bands = new Array(16).fill(0);
  for (let k = 1; k < half; k++) {
    const f = k * df;
    const e = re[k] * re[k] + im[k] * im[k];
    tot += e; wsum += e * f;
    if (f < 250) low += e;
    else if (f <= 4000) mid += e;
    if (f > 4000) high += e;
    if (f > 1500) hf += e;
    for (let b = 0; b < 16; b++) if (f >= BAND_EDGES[b] && f < BAND_EDGES[b + 1]) { bands[b] += e; break; }
  }
  return { centroid: tot > 0 ? wsum / tot : 0, lowFrac: tot > 0 ? low / tot : 0, midFrac: tot > 0 ? mid / tot : 0, highFrac: tot > 0 ? high / tot : 0, hfDb: 10 * Math.log10(hf / (n * n) + 1e-20), bands: bands.map((b) => 10 * Math.log10(b / (tot || 1) + 1e-12)) };
}

interface Metrics {
  peakDb: number;
  rmsDb: number;
  winMaxDb: number;
  winMinDb: number;
  dc: number;
  nan: boolean;
  startAbs: number;
  endAbs: number;
  tailMs: number;
  centroid: number;
  lowFrac: number;
  midFrac: number;
  highFrac: number;
  hfDb: number;
  jump: number;
  bands: number[];
  seconds: number;
}

/** Metriken über [from, to) Sekunden; to = Ende */
function analyze(ch: Chan, sr: number, from = 0, to?: number): Metrics {
  const [L, R] = ch;
  const a = Math.floor(from * sr), b = Math.min(L.length, Math.floor((to ?? L.length / sr) * sr));
  const n = b - a;
  let peak = 0, sum = 0, dc = 0, nan = false, jump = 0;
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l = L[a + i], r = R[a + i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) nan = true;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sum += 0.5 * (l * l + r * r);
    dc += 0.5 * (l + r);
    mono[i] = 0.5 * (l + r);
    if (i > 0) jump = Math.max(jump, Math.abs(l - L[a + i - 1]), Math.abs(r - R[a + i - 1]));
  }
  // Fensterpegel (50 ms)
  const w = Math.floor(sr * 0.05);
  let wMax = -200, wMin = 200, lastLoud = 0;
  for (let i = 0; i + w <= n; i += w) {
    let s = 0;
    for (let j = 0; j < w; j++) s += mono[i + j] * mono[i + j];
    const d = db(Math.sqrt(s / w));
    wMax = Math.max(wMax, d); wMin = Math.min(wMin, d);
    if (d > -60) lastLoud = i + w;
  }
  // Spektrum aus dem lautesten Abschnitt der ersten Sekunden (32768 Samples)
  const N = 32768;
  let best = 0, bestE = -1;
  for (let i = 0; i + N <= n && i < sr * 20; i += N / 2) {
    let e = 0;
    for (let j = 0; j < N; j += 4) e += mono[i + j] * mono[i + j];
    if (e > bestE) { bestE = e; best = i; }
  }
  const sp = spectrum(mono, best, Math.min(N, 1 << Math.floor(Math.log2(Math.max(256, n)))), sr);
  return {
    peakDb: db(peak), rmsDb: db(Math.sqrt(sum / Math.max(1, n))), winMaxDb: wMax, winMinDb: wMin, dc: dc / Math.max(1, n), nan,
    startAbs: Math.max(Math.abs(L[a]), Math.abs(R[a]), Math.abs(L[a + 1]), Math.abs(R[a + 1])),
    endAbs: Math.max(Math.abs(L[b - 1]), Math.abs(R[b - 1])),
    tailMs: (lastLoud / sr) * 1000, centroid: sp.centroid, lowFrac: sp.lowFrac, midFrac: sp.midFrac, highFrac: sp.highFrac, hfDb: sp.hfDb, jump, bands: sp.bands, seconds: n / sr,
  };
}

// ---------------------------------------------------------------- WAV

function toWavB64(ch: Chan, sr: number, from = 0, to?: number): string {
  const a = Math.floor(from * sr), b = Math.min(ch[0].length, Math.floor((to ?? ch[0].length / sr) * sr));
  const n = b - a;
  const buf = new ArrayBuffer(44 + n * 4);
  const dv = new DataView(buf);
  const wr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); wr(8, 'WAVE'); wr(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); wr(36, 'data'); dv.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, ch[0][a + i])) * 32767, true);
    dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, ch[1][a + i])) * 32767, true);
  }
  const u8 = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---------------------------------------------------------------- SFX

const MAXV: VolumeState = { master: 1, music: 1, sfx: 1, muted: false };

/** Ein SFX allein, mit Master-Kette. vol = Stimmenpegel (1 = Rezeptpegel). */
async function renderSfx(name: SfxName, v: VolumeState, vol = 1, size = 1, seconds = 3.4) {
  const ac = mkCtx(seconds);
  const g = buildGraph(ac);
  applyVolumes(g, v, 0, 0);
  const t0 = 0.1;
  startSfx(ac, g.sfxBus, g.sfxRevIn, name, t0, { gain: vol, size, seed: 4242 });
  const ch = await render(ac);
  return { ch, t0 };
}

async function sfxTable() {
  const rows: Record<string, unknown>[] = [];
  const prints: { name: string; bands: number[]; tail: number; centroid: number }[] = [];
  for (const name of SFX_NAMES) {
    const maxed = await renderSfx(name, MAXV, 1);
    const def = await renderSfx(name, DEFAULT_VOLUME, 1);
    const m = analyze(maxed.ch, SR, maxed.t0);
    const d = analyze(def.ch, SR, def.t0);
    const startAbs = Math.max(Math.abs(maxed.ch[0][Math.floor(maxed.t0 * SR)]), Math.abs(maxed.ch[0][Math.floor(maxed.t0 * SR) + 1]));
    rows.push({
      name, peakMax: m.peakDb, peakDef: d.peakDb, rms: m.winMaxDb, tailMs: m.tailMs, centroid: m.centroid, low: m.lowFrac, mid: m.midFrac, high: m.highFrac,
      dc: m.dc, nan: m.nan, start: startAbs, end: m.endAbs, jump: m.jump, prio: META[name].prio,
    });
    prints.push({ name, bands: m.bands, tail: m.tailMs, centroid: m.centroid });
  }
  return { rows, prints };
}

// ---------------------------------------------------------------- Musik

function stepSec(p: Piece) { return 60 / p.bpm / 4; }

interface MusicEvent { t: number; mood?: MusicMood; speed?: number }

/** Rendert Musik chunkweise (wie live: Noten werden nur kurz vorausgeplant, beendete Knoten räumen sich ab) */
async function renderMusic(mood: MusicMood, seconds: number, v: VolumeState, evs: MusicEvent[] = [], sr = SR) {
  const ac = mkCtx(seconds, sr);
  const g = buildGraph(ac);
  applyVolumes(g, v, 0, 0);
  const pl = new MusicPlayer({ ac, dest: g.musicBus, reverb: g.musRevIn, rng: mulberry32(7) });
  pl.setMood(mood, 0);
  const todo = [...evs].sort((a, b) => a.t - b.t);
  const CH = 2;
  const step = (t: number) => {
    while (todo.length && todo[0].t < t + CH + 0.5) {
      const e = todo.shift() as MusicEvent;
      pl.scheduleUntil(e.t);
      if (e.mood !== undefined) pl.setMood(e.mood, e.t);
      if (e.speed !== undefined) pl.setSpeed(e.speed, e.t);
    }
    pl.scheduleUntil(t + CH + 0.5);
  };
  step(0);
  for (let t = CH; t < seconds; t += CH) {
    ac.suspend(t).then(() => { step(t); void ac.resume(); });
  }
  return render(ac);
}

async function musicTable() {
  const out: Record<string, unknown>[] = [];
  const wav: Record<string, string> = {};
  const moods: { id: string; mood: MusicMood; piece: Piece }[] = [
    { id: 'menu', mood: 'menu', piece: getPiece('menu') },
    { id: 'build', mood: 'build', piece: getPiece('build') },
    { id: 'battle', mood: 'battle', piece: getPiece('battle') },
    { id: 'pause', mood: 'pause', piece: getPiece('pause') },
    { id: 'victory', mood: 'victory', piece: getPiece('victory') },
    { id: 'defeat', mood: 'defeat', piece: getPiece('defeat') },
  ];
  for (const m of moods) {
    const p = m.piece;
    const bars = p.bars;
    const loopSec = (p.length - p.loopStart) * stepSec(p);
    const total = p.length * stepSec(p);
    // 8 s Ausschnitt bei Standardpegel und bei Maximalpegel
    const def = await renderMusic(m.mood, 8.5, DEFAULT_VOLUME);
    const max = await renderMusic(m.mood, 8.5, MAXV);
    const a = analyze(def, SR, 0.3, 8.3);
    const b = analyze(max, SR, 0.3, 8.3);
    const head = analyze(max, SR, 0, 0.3);
    // Volllänge (einschließlich Schleifennaht) bei Maximalpegel für Spitzen und Abschnittsverlauf
    const fullLen = p.loop ? Math.min(150, total + Math.min(12, loopSec)) : total + 3;
    const full = await renderMusic(m.mood, fullLen, MAXV);
    const f = analyze(full, SR, 0.2);
    // Abschnittsverlauf in 8-Takt-Blöcken
    const secLen = stepSec(p) * 16 * 8;
    const sections: { t: number; rms: number; cent: number }[] = [];
    for (let t = 0; t + secLen <= fullLen && sections.length < 8; t += secLen) {
      const s = analyze(full, SR, t, t + secLen);
      sections.push({ t, rms: s.rmsDb, cent: s.centroid });
    }
    // Schleifennaht: Sprungmaß um die Wiederholung
    let seam = 0;
    if (p.loop && total + 4 < fullLen) {
      const t = total;
      const sm = analyze(full, SR, t - 0.05, t + 0.05);
      seam = sm.jump;
    }
    out.push({
      id: m.id, bpm: p.bpm, bars, loopBars: (p.length - p.loopStart) / 16, totalSec: total, rmsDef: a.rmsDb, peakDef: a.peakDb, rmsMax: b.rmsDb, peakMax: b.peakDb,
      fullPeak: f.peakDb, fullRmsMin: f.winMinDb, centroid: a.centroid, low: a.lowFrac, dc: a.dc, nan: a.nan || f.nan || b.nan, start: head.startAbs,
      endAbs: f.endAbs, jump: f.jump, seam, sections: sections.map((s) => `${s.rms.toFixed(1)}/${Math.round(s.cent)}`).join(' '),
    });
    wav[m.id] = toWavB64(def, SR, 0.0, 8.5);
    if (m.id === 'battle') wav['battle_long'] = toWavB64(await renderMusic('battle', 32, DEFAULT_VOLUME), SR);
    if (m.id === 'menu') wav['menu_long'] = toWavB64(await renderMusic('menu', 28, DEFAULT_VOLUME), SR);
  }
  // Ausklänge
  for (const kind of ['win', 'lose'] as const) {
    const p = getAfterglow(kind);
    const ch = await renderMusic(kind === 'win' ? 'victory' : 'defeat', 12, DEFAULT_VOLUME);
    const stSec = (kind === 'win' ? 32 : 24) * stepSec(getPiece(kind === 'win' ? 'victory' : 'defeat'));
    const a = analyze(ch, SR, 0, stSec + 0.5);
    const b = analyze(ch, SR, stSec + 2, 11.5);
    out.push({
      id: 'afterglow-' + kind, bpm: p.bpm, bars: p.bars, loopBars: p.bars, totalSec: p.length * stepSec(p), rmsDef: b.rmsDb, peakDef: b.peakDb, rmsMax: a.rmsDb, peakMax: a.peakDb,
      fullPeak: a.peakDb, fullRmsMin: b.winMinDb, centroid: b.centroid, low: b.lowFrac, dc: b.dc, nan: a.nan || b.nan, start: a.startAbs, endAbs: b.endAbs, jump: b.jump, seam: 0,
      sections: `stinger ${stSec.toFixed(2)} s: ${a.rmsDb.toFixed(1)} dB / afterglow ${b.rmsDb.toFixed(1)} dB`,
    });
    wav['stinger_' + kind] = toWavB64(ch, SR, 0, 12);
  }
  return { rows: out, wav };
}

/** Übergänge: Überblendung, Stinger, Pause-Dämpfung -- Sprungmaß und Pegelverlauf */
async function transitionTests() {
  const res: Record<string, unknown>[] = [];
  const cases: { id: string; from: MusicMood; to: MusicMood; at: number; len: number }[] = [
    { id: 'menu->battle', from: 'menu', to: 'battle', at: 5, len: 11 },
    { id: 'build->battle', from: 'build', to: 'battle', at: 6, len: 12 },
    { id: 'battle->pause', from: 'battle', to: 'pause', at: 6, len: 12 },
    { id: 'pause->battle', from: 'pause', to: 'battle', at: 6, len: 12 },
    { id: 'battle->victory', from: 'battle', to: 'victory', at: 6, len: 16 },
    { id: 'battle->defeat', from: 'battle', to: 'defeat', at: 6, len: 16 },
    { id: 'battle->off', from: 'battle', to: 'off', at: 6, len: 10 },
  ];
  for (const c of cases) {
    const ch = await renderMusic(c.from, c.len, MAXV, [{ t: c.at, mood: c.to }]);
    const around = analyze(ch, SR, c.at - 0.3, c.at + 2.2);
    const base = analyze(ch, SR, 1, c.at - 0.3);
    const rmsBefore = analyze(ch, SR, c.at - 1.5, c.at - 0.1).rmsDb;
    const rmsAfter = analyze(ch, SR, c.len - 3, c.len - 0.2).rmsDb;
    res.push({ id: c.id, jumpAround: around.jump, jumpBase: base.jump, peak: around.peakDb, rmsBefore, rmsAfter, nan: around.nan });
  }
  // Pause (Tempo 0) dämpft statt aus
  const open = await renderMusic('battle', 12, MAXV);
  const muff = await renderMusic('battle', 12, MAXV, [{ t: 6, speed: 0 }]);
  const a = analyze(open, SR, 8, 11.5), b = analyze(muff, SR, 8, 11.5);
  res.push({ id: 'speed0-muffle', centroidOpen: a.centroid, centroidMuffled: b.centroid, hfOpen: a.hfDb, hfMuffled: b.hfDb, rmsOpen: a.rmsDb, rmsMuffled: b.rmsDb, jumpAround: b.jump, nan: b.nan });
  return res;
}

// ---------------------------------------------------------------- Stem-Analyse (Mischungsverhältnis)

const GROUPS: Record<string, string[]> = {
  drums: ['kick', 'snare', 'hat', 'ohat', 'shaker', 'wood', 'tom', 'cym', 'timp', 'clap'],
  bass: ['bass', 'tbass'],
  harmony: ['pad', 'stab', 'organ'],
  lead: ['chip', 'pluck', 'whistle', 'brass', 'sigh'],
  sparkle: ['bell', 'arp'],
};

/** Pegel und Frequenzverteilung je Instrumentengruppe in einem Taktfenster (Standardlautstärke) */
async function stems(mood: Mood, fromBar: number, bars: number) {
  const p = getPiece(mood);
  const saved = { steps: p.steps, length: p.length, loopStart: p.loopStart };
  const rows: Record<string, unknown>[] = [];
  const sec = bars * 16 * stepSec(p);
  const win = p.steps.slice(fromBar * 16, (fromBar + bars) * 16);
  const run = async (keep: string[] | null) => {
    p.steps = keep ? win.map((st) => st.filter((e) => keep.includes(e.i))) : win;
    p.length = p.steps.length;
    p.loopStart = 0;
    const ch = await renderMusic(mood, sec, DEFAULT_VOLUME);
    p.steps = saved.steps; p.length = saved.length; p.loopStart = saved.loopStart;
    return analyze(ch, SR, 1, sec - 0.2);
  };
  try {
    const all = await run(null);
    rows.push({ group: 'ALL', rms: all.rmsDb, peak: all.peakDb, low: all.lowFrac, mid: all.midFrac, high: all.highFrac, cent: all.centroid });
    for (const [k, v] of Object.entries(GROUPS)) {
      const m = await run(v);
      rows.push({ group: k, rms: m.rmsDb, peak: m.peakDb, low: m.lowFrac, mid: m.midFrac, high: m.highFrac, cent: m.centroid });
    }
  } finally {
    p.steps = saved.steps; p.length = saved.length; p.loopStart = saved.loopStart;
  }
  return rows;
}

// ---------------------------------------------------------------- Engine-Test (Offline, gesteuerte Uhr)

const VIS_ART = ['stone', 'fire', 'bolt', 'poison', 'arcane', 'ink', 'bat', 'bomb', 'icicle', 'meteor', 'goblin'];
const VIS_UNIT = ['stone', 'fire', 'ice', 'bolt', 'poison', 'arcane', 'arrow', 'flame'];
const VIS_TOWER = ['arrow', 'goo', 'ice', 'arcane', 'bolt', 'fish'];
const ART_IDS = Object.values(UNITS).filter((u) => u.cat === 'artillery').map((u) => u.id);
const UNIT_IDS = Object.values(UNITS).filter((u) => u.cat !== 'artillery').map((u) => u.id);

function randomEvent(r: () => number): SimEvent {
  const x = 2 + r() * 52, y = 6 + r() * 16;
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
  const team = (r() < 0.5 ? 0 : 1) as 0 | 1;
  const p = r();
  if (p < 0.5) return { t: 'hit', x, y, dmg: Math.round(1 + Math.pow(r(), 3) * 200), team };
  if (p < 0.62) {
    const k = r();
    if (k < 0.45) return { t: 'shot', x0: x, y0: y, x1: x + 8, y1: y, fly: 30, vis: pick(VIS_ART), team, cid: pick(ART_IDS) };
    if (k < 0.7) return { t: 'shot', x0: x, y0: y, x1: x + 6, y1: y, fly: 6, vis: pick(VIS_TOWER), team, cid: 'BT-0' + (1 + Math.floor(r() * 8)) };
    return { t: 'shot', x0: x, y0: y, x1: x + 3, y1: y, fly: 5, vis: pick(VIS_UNIT), team, cid: pick(UNIT_IDS) };
  }
  if (p < 0.76) return { t: 'impact', x, y, r: 0.5 + r() * 2, vis: pick([...VIS_ART, 'dome', 'dust']) };
  if (p < 0.82) return { t: 'death', x, y, cid: pick(UNIT_IDS), team, cat: pick(['artillery', 'assault', 'defender', 'civilian', 'citizen']) };
  if (p < 0.85) return { t: 'spawn', x, y, cid: pick(UNIT_IDS) };
  if (p < 0.88) return { t: 'heal', x, y };
  if (p < 0.92) return { t: 'fx', x, y, name: pick(['puff', 'revive', 'flame', 'bones', 'dirt', 'spark', 'Citizen', 'Hornet']) };
  if (p < 0.945) return { t: 'break', x, y, what: pick(['wall', 'gate', 'module', 'core']) };
  if (p < 0.955) return { t: 'rank', x, y, id: 1, rank: 1 + Math.floor(r() * 5), cid: 'US-01', team };
  if (p < 0.975) return { t: 'text', x, y, text: pick(['dodge', 'caught!', 'reflected!', 'berserk', 'CHOMP', 'foresight', 'copy!']), color: '#fff' };
  return { t: 'feed', msg: pick(['Wave 3', 'The gate is broken!', 'Shield dome breaks', 'A wall segment is breached', 'Player 1 wins by conquest']), team: -1 };
}

async function engineStress(speed: number, perSec: number, seconds: number) {
  const ac = mkCtx(seconds + 4);
  let clockT = 0;
  const eng = new AudioEngine({ context: ac, clock: () => clockT, storage: false, rng: mulberry32(99) });
  eng.setSpeed(speed);
  eng.setMood('battle');
  const r = mulberry32(1234);
  let maxActive = 0;
  const dtEv = 1 / perSec;
  const n = Math.floor(seconds * perSec);
  for (let i = 0; i < n; i++) {
    clockT = 0.05 + i * dtEv;
    eng.onEvent(randomEvent(r));
    maxActive = Math.max(maxActive, eng.stats.active);
  }
  clockT = seconds;
  eng.internals.music?.scheduleUntil(seconds + 1);
  const ch = await render(ac);
  const st = eng.stats;
  const m = analyze(ch, SR, 0.5, seconds);
  return { speed, perSec, played: st.played, dropped: st.dropped, stolen: st.stolen, errors: st.errors, maxActive, peakDb: m.peakDb, rmsDb: m.rmsDb, nan: m.nan, jump: m.jump };
}

async function engineVariants() {
  const out = [];
  for (const [speed, perSec] of [[1, 40], [1, 300], [8, 300], [8, 1200]] as [number, number][]) out.push(await engineStress(speed, perSec, 12));
  return out;
}

/** Zeigt, dass die Engine bei gleicher Ereignisfolge mit höherem Tempo leiser (SFX allein, ohne Musik) spielt */
async function speedLoudness() {
  const out = [];
  for (const speed of [1, 2, 4, 8]) {
    const ac = mkCtx(8);
    let clockT = 0;
    const eng = new AudioEngine({ context: ac, clock: () => clockT, storage: false, rng: mulberry32(5) });
    eng.setSpeed(speed);
    const r = mulberry32(77);
    for (let i = 0; i < 120; i++) {
      clockT = 0.1 + i * 0.05;
      eng.onEvent({ t: 'impact', x: 20 + r() * 16, y: 14, r: 1.2, vis: 'stone' });
      eng.onEvent({ t: 'hit', x: 20 + r() * 16, y: 14, dmg: 20, team: 0 });
    }
    const ch = await render(ac);
    const m = analyze(ch, SR, 0.5, 6);
    out.push({ speed, rmsDb: m.rmsDb, peakDb: m.peakDb, played: eng.stats.played, dropped: eng.stats.dropped });
  }
  return out;
}

/** Räumliche Wirkung: Pan und Dämpfung nach Weltposition */
async function spatialTest() {
  const out = [];
  for (const x of [2, 14, 28, 42, 54]) {
    const ac = mkCtx(2);
    let clockT = 0;
    const eng = new AudioEngine({ context: ac, clock: () => clockT, storage: false, rng: mulberry32(8) });
    clockT = 0.1;
    eng.onEvent({ t: 'impact', x, y: 14, r: 1.2, vis: 'stone' });
    const [L, R] = await render(ac);
    const m = analyze([L, R], SR, 0.05, 1.6);
    let el = 0, er = 0;
    for (let i = 0; i < L.length; i++) { el += L[i] * L[i]; er += R[i] * R[i]; }
    out.push({ x, panDb: db(Math.sqrt(er)) - db(Math.sqrt(el)), peakDb: m.peakDb, centroid: m.centroid });
  }
  return out;
}

/** Sound-Sets als WAV (Beleg): Abschüsse+Einschläge, Rest */
async function sfxSetWav(names: SfxName[], gap: number) {
  const total = names.length * gap + 3;
  const ac = mkCtx(total);
  const g = buildGraph(ac);
  applyVolumes(g, DEFAULT_VOLUME, 0, 0);
  names.forEach((n, i) => {
    const pan = Math.sin(i * 1.7) * 0.6;
    startSfx(ac, g.sfxBus, g.sfxRevIn, n, 0.2 + i * gap, { gain: 0.7, pan, wet: META[n].wet, seed: 1000 + i });
  });
  const ch = await render(ac);
  return toWavB64(ch, SR);
}

// ---------------------------------------------------------------- Live-Test (echter AudioContext in Chromium)

async function liveTest() {
  const res: Record<string, unknown> = {};
  const errs: string[] = [];
  const eng = new AudioEngine({ storage: false });
  try {
    eng.setMood('menu');
    eng.setSpeed(1);
    eng.onEvent({ t: 'hit', x: 10, y: 10, dmg: 5, team: 0 });
    eng.ui('click');
    res.beforeUnlockStats = eng.stats.played;
    eng.unlock();
    await new Promise((r) => setTimeout(r, 300));
    const g = eng.internals.graph;
    if (!g) throw new Error('kein Graph nach unlock()');
    const ac = g.ac as AudioContext;
    res.state = ac.state;
    res.sampleRate = ac.sampleRate;
    const an = ac.createAnalyser();
    an.fftSize = 2048;
    g.master.connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = 0, rmsMax = 0;
    const sample = () => {
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (const v of buf) { s += v * v; peak = Math.max(peak, Math.abs(v)); }
      rmsMax = Math.max(rmsMax, Math.sqrt(s / buf.length));
    };
    const iv = setInterval(sample, 20);
    const cap: { avg: number; peak: number; under: number }[] = [];
    const rc = (ac as unknown as { renderCapacity?: { addEventListener: (t: string, f: (e: { averageLoad: number; peakLoad: number; underrunRatio: number }) => void) => void; start: (o: { updateInterval: number }) => void; stop: () => void } }).renderCapacity;
    if (rc) {
      rc.addEventListener('update', (e) => cap.push({ avg: e.averageLoad, peak: e.peakLoad, under: e.underrunRatio }));
      rc.start({ updateInterval: 0.5 });
    }
    await new Promise((r) => setTimeout(r, 1500));
    res.musicMenuRmsDb = db(rmsMax);
    // Stimmungen wechseln
    eng.setMood('battle');
    await new Promise((r) => setTimeout(r, 800));
    eng.setSpeed(8);
    // Unwetter aus Ereignissen
    const r = mulberry32(31337);
    let maxActive = 0;
    for (let i = 0; i < 900; i++) {
      eng.onEvent(randomEvent(r));
      maxActive = Math.max(maxActive, eng.stats.active);
      if (i % 30 === 0) await new Promise((rr) => setTimeout(rr, 20));
    }
    res.maxActive = maxActive;
    res.afterStorm = eng.stats;
    eng.setSpeed(1);
    for (const u of ['click', 'hover', 'card', 'play', 'invalid', 'rotate', 'tab', 'toggle', 'confirm', 'cancel', 'pause', 'speed', 'draw', 'reroll'] as const) eng.ui(u);
    eng.setMood('pause');
    await new Promise((r) => setTimeout(r, 1200));
    eng.setMood('victory');
    await new Promise((r) => setTimeout(r, 6500));
    eng.setMood('menu');
    await new Promise((r) => setTimeout(r, 4000));
    clearInterval(iv);
    if (rc) {
      rc.stop();
      res.load = cap.length
        ? { n: cap.length, avgMean: cap.reduce((a, c) => a + c.avg, 0) / cap.length, peakMax: Math.max(...cap.map((c) => c.peak)), underrun: Math.max(...cap.map((c) => c.under)) }
        : 'keine Updates';
    } else res.load = 'renderCapacity nicht verfügbar';
    res.peakDb = db(peak);
    res.activeAfterQuiet = eng.stats.active;
    res.layersAfterSwitches = eng.internals.music?.layerCount;
    // Stumm schalten
    eng.setMuted(true);
    const before = eng.stats.played;
    eng.onEvent({ t: 'break', x: 10, y: 10, what: 'core' });
    res.mutedPlayed = eng.stats.played - before;
    eng.setMuted(false);
    res.maxVoices = MAX_VOICES;
  } catch (e) {
    errs.push(String(e instanceof Error ? e.stack : e));
  }
  res.errors = errs;
  return res;
}

/** Singleton-Smoke-Test: alle Ereignisarten ohne Kontext (vor unlock) */
function singletonSmoke() {
  const r = mulberry32(5);
  for (let i = 0; i < 300; i++) audio.onEvent(randomEvent(r));
  return { ok: true, vol: audio.volume };
}

/** Kopfleisten-Attrappe mit den CSS-Variablen aus index.html, darin der Audio-Knopf */
function controlsSetup(dark: boolean) {
  audio.setVolume('master', DEFAULT_VOLUME.master);
  audio.setVolume('music', DEFAULT_VOLUME.music);
  audio.setVolume('sfx', DEFAULT_VOLUME.sfx);
  audio.setMuted(false);
  document.body.replaceChildren();
  document.head.querySelectorAll('style:not(#bbau-style)').forEach((e) => e.remove());
  const st = document.createElement('style');
  const light = '--bg:#efe6d2;--panel:#f8f1e0;--panel2:#e6dbc2;--ink:#2a2118;--muted:#6b5d48;--line:#3a2e20;--accent:#b5412f;--gold:#d6a21e';
  const darkV = '--bg:#17131f;--panel:#251e33;--panel2:#30283f;--ink:#f1e8d6;--muted:#a99bbd;--line:#0d0a14;--accent:#ef6a52;--gold:#f0c04a';
  st.textContent = `:root{${dark ? darkV : light}} body{margin:0;background:var(--bg);color:var(--ink);font:700 12px/1.35 ui-monospace,Consolas,monospace}
button,select,input{font:inherit;color:var(--ink);background:var(--panel2);border:2px solid var(--line);padding:4px 8px;border-radius:0;cursor:pointer}
button:hover:not(:disabled){background:var(--accent);color:#fff}
#top{display:flex;gap:12px;align-items:center;padding:6px 12px;background:var(--panel);border-bottom:2px solid var(--line);width:560px}.sp{flex:1}`;
  document.head.append(st);
  const top = document.createElement('header');
  top.id = 'top';
  const mk = (t: string) => { const b = document.createElement('button'); b.textContent = t; return b; };
  const sp = document.createElement('span');
  sp.className = 'sp';
  top.append(mk('fit'), sp, mk('menu'), createAudioControls(), mk('1x'));
  document.body.append(top);
  return true;
}
function controlsState() {
  const btn = document.querySelector('.bbau-btn') as HTMLButtonElement | null;
  const pop = document.querySelector('.bbau-pop') as HTMLElement | null;
  const wrap = document.querySelector('.bbau-wrap') as HTMLElement | null;
  return {
    exists: !!btn,
    title: btn?.title,
    pressed: btn?.getAttribute('aria-pressed'),
    popDisplay: pop ? getComputedStyle(pop).display : null,
    open: wrap?.classList.contains('bbau-open') ?? false,
    sliders: Array.from(document.querySelectorAll('.bbau-row input')).map((i) => (i as HTMLInputElement).value),
    volume: audio.volume,
    svgPaths: btn ? btn.querySelectorAll('path').length : 0,
  };
}

(window as unknown as { BBT: unknown }).BBT = {
  controlsSetup, controlsState, stems, sfxTable, musicTable, transitionTests, engineVariants, speedLoudness, spatialTest, sfxSetWav, liveTest, singletonSmoke,
  sfxNames: SFX_NAMES, version: 1,
};
export type { Mood };
