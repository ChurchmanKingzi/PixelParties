// Synthese-Bausteine: Rauschen, Impulsantwort, Hüllkurven und die Klassen Rack/Voice.
// Alles nimmt einen beliebigen BaseAudioContext und ein Ziel-AudioNode entgegen (Dependency Injection),
// damit dieselben Stimmen live (AudioContext) und im Test (OfflineAudioContext) laufen.

import { mulberry32 } from './rng';

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
/** Frequenz absichern: endlich und im hörbaren/stabilen Bereich */
const fz = (v: number): number => (Number.isFinite(v) ? clamp(v, 5, 20000) : 440);

// ---------------------------------------------------------------- gemeinsame Ressourcen je Kontext

type NoiseColor = 'white' | 'pink' | 'brown';

interface Shared {
  noise: Record<NoiseColor, AudioBuffer>;
  ir: AudioBuffer | null;
  pulses: Map<number, PeriodicWave>;
}
const SHARED = new WeakMap<BaseAudioContext, Shared>();

function makeNoise(ac: BaseAudioContext, kind: NoiseColor): AudioBuffer {
  const sr = ac.sampleRate;
  const len = Math.floor(sr * 2);
  const fade = 2048;
  const buf = ac.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const r = mulberry32(kind === 'white' ? 1234567 : kind === 'pink' ? 7654321 : 424242);
  // len + fade Samples erzeugen, damit die Schleifennaht stetig überblendet werden kann
  const e = new Float32Array(len + fade);
  if (kind === 'white') {
    for (let i = 0; i < e.length; i++) e[i] = r() * 2 - 1;
  } else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < e.length; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      e[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
  } else {
    let y = 0;
    for (let i = 0; i < e.length; i++) { y = (y + 0.02 * (r() * 2 - 1)) / 1.02; e[i] = y; }
  }
  for (let i = 0; i < len; i++) {
    if (i < fade) { const w = i / fade; out[i] = e[i] * w + e[len + i] * (1 - w); } else out[i] = e[i];
  }
  // auf Effektivwert 0.35 normieren (Spitzen hart begrenzen)
  let s = 0;
  for (let i = 0; i < len; i++) s += out[i] * out[i];
  const k = 0.35 / Math.sqrt(s / len || 1);
  for (let i = 0; i < len; i++) out[i] = clamp(out[i] * k, -1, 1);
  return buf;
}

/** Synthetische Raum-Impulsantwort (Stereo): abklingendes, nach hinten dunkler werdendes Rauschen plus frühe Reflexionen */
function makeIR(ac: BaseAudioContext, seconds: number): AudioBuffer {
  const sr = ac.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ac.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const r = mulberry32(9001 + c * 77);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 3.7);
      const a = lerp(0.8, 0.1, Math.min(1, t / 1.1));
      lp += a * ((r() * 2 - 1) - lp);
      d[i] = lp * env * (t < 0.006 ? t / 0.006 : 1);
    }
    for (const ms of [9, 14, 21, 29, 38, 47, 61]) {
      const idx = Math.floor((ms + c * 3) * 0.001 * sr);
      if (idx < len) d[idx] += (r() > 0.5 ? 1 : -1) * (0.55 - ms * 0.006);
    }
    const tail = Math.floor(sr * 0.12);
    for (let i = 0; i < tail; i++) d[len - 1 - i] *= i / tail;
  }
  return buf;
}

function shared(ac: BaseAudioContext): Shared {
  let s = SHARED.get(ac);
  if (!s) {
    s = { noise: { white: makeNoise(ac, 'white'), pink: makeNoise(ac, 'pink'), brown: makeNoise(ac, 'brown') }, ir: null, pulses: new Map() };
    SHARED.set(ac, s);
  }
  return s;
}

export function reverbIR(ac: BaseAudioContext, seconds = 1.8): AudioBuffer {
  const s = shared(ac);
  if (!s.ir) s.ir = makeIR(ac, seconds);
  return s.ir;
}

/** Pulswelle mit gegebenem Tastverhältnis (0.5 = Rechteck); gecacht je Kontext */
export function pulseWave(ac: BaseAudioContext, duty: number): PeriodicWave {
  const s = shared(ac);
  const key = Math.round(duty * 100);
  let w = s.pulses.get(key);
  if (!w) {
    const n = 40;
    const re = new Float32Array(n + 1), im = new Float32Array(n + 1);
    for (let k = 1; k <= n; k++) {
      re[k] = Math.sin(2 * k * Math.PI * duty) / (k * Math.PI);
      im[k] = (1 - Math.cos(2 * k * Math.PI * duty)) / (k * Math.PI);
    }
    w = ac.createPeriodicWave(re, im);
    s.pulses.set(key, w);
  }
  return w;
}

// ---------------------------------------------------------------- Hüllkurven

/** ADSR auf einem AudioParam; Start und Ende liegen immer bei 0 (kein Knacken). Rückgabe: Endzeit. */
export function adsr(p: AudioParam, t: number, peak: number, dur: number, a: number, d: number, s: number, r: number): number {
  const tA = t + a;
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, tA);
  const sLevel = Math.max(peak * s, 1e-4);
  const tD = Math.min(tA + d, t + dur);
  if (tD > tA) p.exponentialRampToValueAtTime(sLevel, tD);
  if (t + dur > tD) p.setValueAtTime(sLevel, t + dur);
  const tR = Math.max(t + dur, tD) + Math.max(0.004, r);
  p.exponentialRampToValueAtTime(1e-4, tR);
  p.linearRampToValueAtTime(0, tR + 0.006);
  return tR + 0.006;
}

function sweep(p: AudioParam, v: number | [number, number], t: number, T: number) {
  if (Array.isArray(v)) {
    p.setValueAtTime(fz(v[0]), t);
    p.exponentialRampToValueAtTime(fz(v[1]), t + Math.max(0.004, T));
  } else p.setValueAtTime(fz(v), t);
}

// ---------------------------------------------------------------- Rack: Bausteine ohne Raumklang-Kette

export interface ToneOpts {
  type?: OscillatorType | 'pulse';
  duty?: number;
  f: number;
  f2?: number;
  /** Dauer des Tonhöhenverlaufs (s), Standard = dur */
  glide?: number;
  lin?: boolean;
  at?: number;
  /** Dauer: bei Perkussion (ohne s) die Abklingzeit, mit s die Haltezeit vor dem Release */
  dur: number;
  a?: number;
  d?: number;
  s?: number;
  r?: number;
  g?: number;
  lp?: number | [number, number];
  lpT?: number;
  hp?: number;
  bp?: number | [number, number];
  q?: number;
  /** [Rate Hz, Tiefe Cent, Einsatzverzögerung s] */
  vib?: [number, number, number?];
  det?: number;
}

export interface NoiseOpts {
  color?: NoiseColor;
  at?: number;
  dur: number;
  a?: number;
  d?: number;
  s?: number;
  r?: number;
  g?: number;
  filt?: BiquadFilterType;
  f?: number | [number, number];
  fT?: number;
  q?: number;
}

export class Rack {
  protected nodes: AudioNode[] = [];
  protected srcs: (OscillatorNode | AudioBufferSourceNode)[] = [];
  protected pending = 0;
  protected endAt = 0;
  protected finished = false;

  constructor(readonly ac: BaseAudioContext, protected out: AudioNode, readonly t0: number, readonly ts = 1, readonly rng: () => number = Math.random) {}

  private track<T extends AudioNode>(n: T): T { this.nodes.push(n); return n; }

  private env(g: GainNode, t: number, dur: number, o: { a?: number; d?: number; s?: number; r?: number; g?: number }): number {
    const peak = o.g ?? 1;
    if (o.s === undefined) {
      const a = Math.max(0.002, Math.min(o.a ?? 0.003, dur * 0.5));
      return adsr(g.gain, t, peak, dur, a, dur - a, 0.001, 0.012);
    }
    const a = Math.max(0.002, (o.a ?? 0.01) * this.ts);
    return adsr(g.gain, t, peak, dur, a, (o.d ?? 0.05) * this.ts, o.s, (o.r ?? 0.05) * this.ts);
  }

  tone(o: ToneOpts): void {
    const ac = this.ac;
    const t = this.t0 + (o.at ?? 0) * this.ts;
    const dur = Math.max(0.012, o.dur * this.ts);
    const osc = this.track(ac.createOscillator());
    if (o.type === 'pulse') osc.setPeriodicWave(pulseWave(ac, o.duty ?? 0.25));
    else osc.type = o.type ?? 'sine';
    const f1 = fz(o.f);
    osc.frequency.setValueAtTime(f1, t);
    if (o.f2 !== undefined && fz(o.f2) !== f1) {
      const gT = t + Math.max(0.005, (o.glide ?? o.dur) * this.ts);
      if (o.lin) osc.frequency.linearRampToValueAtTime(fz(o.f2), gT);
      else osc.frequency.exponentialRampToValueAtTime(fz(o.f2), gT);
    }
    if (o.det) osc.detune.value = o.det;
    const g = this.track(ac.createGain());
    const end = this.env(g, t, dur, o);
    let node: AudioNode = osc;
    const chain = (f: BiquadFilterNode) => { node.connect(f); node = f; };
    if (o.hp) { const f = this.track(ac.createBiquadFilter()); f.type = 'highpass'; f.frequency.value = fz(o.hp); f.Q.value = 0.7; chain(f); }
    if (o.bp !== undefined) {
      const f = this.track(ac.createBiquadFilter()); f.type = 'bandpass'; f.Q.value = o.q ?? 1;
      sweep(f.frequency, o.bp, t, (o.lpT ?? o.dur) * this.ts); chain(f);
    }
    if (o.lp !== undefined) {
      const f = this.track(ac.createBiquadFilter()); f.type = 'lowpass'; f.Q.value = o.q ?? 0.7;
      sweep(f.frequency, o.lp, t, (o.lpT ?? o.dur) * this.ts); chain(f);
    }
    node.connect(g);
    g.connect(this.out);
    if (o.vib) {
      const lfo = this.track(ac.createOscillator());
      lfo.frequency.value = o.vib[0];
      const lg = this.track(ac.createGain());
      const del = (o.vib[2] ?? 0) * this.ts;
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + del);
      lg.gain.linearRampToValueAtTime(o.vib[1], t + del + 0.12);
      lfo.connect(lg);
      lg.connect(osc.detune);
      lfo.start(t);
      lfo.stop(end + 0.02);
    }
    this.run(osc, t, end);
  }

  noise(o: NoiseOpts): void {
    const ac = this.ac;
    const t = this.t0 + (o.at ?? 0) * this.ts;
    const dur = Math.max(0.012, o.dur * this.ts);
    const src = this.track(ac.createBufferSource());
    src.buffer = shared(ac).noise[o.color ?? 'white'];
    src.loop = true;
    const g = this.track(ac.createGain());
    const end = this.env(g, t, dur, o);
    if (o.f !== undefined) {
      const f = this.track(ac.createBiquadFilter());
      f.type = o.filt ?? 'bandpass';
      f.Q.value = o.q ?? 0.8;
      sweep(f.frequency, o.f, t, (o.fT ?? o.dur) * this.ts);
      src.connect(f);
      f.connect(g);
    } else src.connect(g);
    g.connect(this.out);
    this.run(src, t, end, this.rng() * 1.7);
  }

  private run(src: OscillatorNode | AudioBufferSourceNode, t: number, end: number, offset?: number) {
    this.pending++;
    this.srcs.push(src);
    src.onended = () => { this.pending--; if (this.pending <= 0) this.finish(); };
    if (offset === undefined) src.start(t);
    else (src as AudioBufferSourceNode).start(t, offset);
    src.stop(end + 0.02);
    this.endAt = Math.max(this.endAt, end + 0.02);
  }

  /** Alle eigenen Knoten trennen (idempotent) */
  protected finish(): void {
    if (this.finished) return;
    this.finished = true;
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* schon getrennt */ } }
    this.nodes.length = 0;
    this.srcs.length = 0;
  }
}

// ---------------------------------------------------------------- Voice: Rack mit Pan/Tiefpass/Raumsend

export interface VoiceOpts {
  /** Gesamtpegel der Stimme (inkl. Lautstärke nach Wichtigkeit, Entfernung, Tempo) */
  gain?: number;
  /** Stereo-Position -1..1 */
  pan?: number;
  /** Tiefpass-Grenzfrequenz (Entfernungsdämpfung), >= 17000 = aus */
  lp?: number;
  /** Anteil, der in den Hall geschickt wird (0..1) */
  wet?: number;
  /** Zeitskalierung der Hüllkurven (< 1 = kürzer, bei hoher Spielgeschwindigkeit) */
  ts?: number;
  prio?: number;
  rng?: () => number;
}

export class Voice extends Rack {
  prio: number;
  key = '';
  killed = false;
  done = false;
  onDone: ((v: Voice) => void) | null = null;
  private head: GainNode;
  private chain: AudioNode[] = [];

  constructor(ac: BaseAudioContext, dest: AudioNode, reverb: AudioNode | null, t0: number, o: VoiceOpts = {}) {
    super(ac, ac.createGain(), t0, o.ts ?? 1, o.rng ?? Math.random);
    this.prio = o.prio ?? 1;
    this.head = this.out as GainNode;
    this.head.gain.value = Number.isFinite(o.gain) ? (o.gain as number) : 1;
    this.chain.push(this.head);
    let node: AudioNode = this.head;
    if (o.lp !== undefined && o.lp < 17000) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = Math.max(300, o.lp);
      f.Q.value = 0.5;
      node.connect(f); node = f; this.chain.push(f);
    }
    if (o.pan !== undefined && Math.abs(o.pan) > 0.02 && typeof ac.createStereoPanner === 'function') {
      const p = ac.createStereoPanner();
      p.pan.value = clamp(o.pan, -1, 1);
      node.connect(p); node = p; this.chain.push(p);
    }
    node.connect(dest);
    const wet = o.wet ?? 0;
    if (reverb && wet > 0.01) {
      const w = ac.createGain();
      w.gain.value = wet;
      node.connect(w); w.connect(reverb); this.chain.push(w);
    }
  }

  /** Voraussichtliches Ende (Audio-Zeit) */
  get end(): number { return this.endAt; }

  /** Schnell ausblenden und beenden (Stimmenklau) */
  kill(at: number): void {
    if (this.killed || this.done) return;
    this.killed = true;
    try {
      this.head.gain.cancelScheduledValues(at);
      this.head.gain.setTargetAtTime(0, at, 0.008);
    } catch { /* ignorieren */ }
    this.endAt = Math.min(this.endAt, at + 0.08);
    for (const s of this.srcs) { try { s.stop(at + 0.06); } catch { /* ignorieren */ } }
  }

  /** Sofort alles trennen (Notfall-Aufräumen, z. B. bei hängendem Kontext) */
  destroy(): void {
    this.finish();
  }

  protected override finish(): void {
    if (this.done) return;
    super.finish();
    this.done = true;
    for (const n of this.chain) { try { n.disconnect(); } catch { /* schon getrennt */ } }
    this.chain.length = 0;
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb(this);
  }
}
