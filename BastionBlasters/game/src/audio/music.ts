// Musik-Wiedergabe: Lookahead-Scheduler auf AudioContext.currentTime, Ebenen (Layer) mit Überblendung.
// Läuft live per setInterval (~25 ms) oder im Test deterministisch über scheduleUntil() auf einem OfflineAudioContext.

import { DEFAULT_MIX, INST, type InstId, type MixCfg } from './instruments';
import { getPiece, type Mood, type Piece } from './compose';
import { Rack, clamp, mtof } from './synth';

export type MusicMood = Mood | 'off';

export interface MusicEnv {
  ac: BaseAudioContext;
  /** Ziel der Musik (Musik-Bus) */
  dest: AudioNode;
  /** Hall-Eingang (optional) */
  reverb: AudioNode | null;
  rng?: () => number;
}

const TICK_MS = 25;
const FADE_S = 1.5;
const FADE_FAST_S = 0.45;
const STINGER_FADE_IN_S = 0.05;
const DRUMS = new Set<InstId>(['kick', 'snare', 'hat', 'ohat', 'shaker', 'wood', 'tom', 'cym', 'clap']);

const FADE_N = 48;
const FADE_IN = new Float32Array(FADE_N);
const FADE_OUT = new Float32Array(FADE_N);
for (let i = 0; i < FADE_N; i++) {
  const x = i / (FADE_N - 1);
  FADE_IN[i] = Math.sin((x * Math.PI) / 2);
  FADE_OUT[i] = Math.cos((x * Math.PI) / 2);
}

interface Bus {
  inp: GainNode;
  nodes: AudioNode[];
}

class Layer {
  piece: Piece;
  idx = 0;
  nextTime: number;
  readonly out: GainNode;
  /** Ende der Einblendung (Audio-Zeit); davor darf nicht ausgeblendet werden */
  fadeEnd: number;
  /** Zeitpunkt, an dem die Ebene stumm ist und entsorgt werden kann; null = lebt */
  dieAt: number | null = null;
  /** ab hier ist die Ebene ausgeblendet (keine Noten mehr nötig) */
  muteAt = Infinity;
  finished = false;
  private readonly sum: GainNode;
  private readonly lp: BiquadFilterNode;
  private readonly echoIn: GainNode;
  private readonly delay: DelayNode;
  private readonly echoLp: BiquadFilterNode;
  private readonly fb: GainNode;
  private readonly echoOut: GainNode;
  private readonly buses = new Map<InstId, Bus>();
  private readonly nodes: AudioNode[] = [];

  constructor(private readonly env: MusicEnv, dest: AudioNode, piece: Piece, start: number, fadeIn: number) {
    const ac = env.ac;
    this.piece = piece;
    this.nextTime = start;
    this.out = ac.createGain();
    this.out.gain.value = 0;
    this.sum = ac.createGain();
    this.lp = ac.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.Q.value = 0.5;
    this.sum.connect(this.lp);
    this.lp.connect(this.out);
    this.out.connect(dest);
    // Echo-Zweig (Feedback-Delay mit Tiefpass in der Rückkopplung)
    this.echoIn = ac.createGain();
    this.delay = ac.createDelay(2);
    this.echoLp = ac.createBiquadFilter();
    this.echoLp.type = 'lowpass';
    this.fb = ac.createGain();
    this.echoOut = ac.createGain();
    this.echoIn.connect(this.delay);
    this.delay.connect(this.echoLp);
    this.echoLp.connect(this.fb);
    this.fb.connect(this.delay);
    this.delay.connect(this.echoOut);
    this.echoOut.connect(this.sum);
    this.nodes.push(this.out, this.sum, this.lp, this.echoIn, this.delay, this.echoLp, this.fb, this.echoOut);
    this.configure(piece, 1, start);
    const T = Math.max(0.03, fadeIn);
    this.out.gain.setValueCurveAtTime(FADE_IN, start, T);
    this.fadeEnd = start + T;
  }

  /** Stück (neu) einstellen: Helligkeit, Echo, Instrumentenpegel */
  configure(piece: Piece, tempoScale: number, at: number) {
    this.piece = piece;
    this.lp.frequency.setValueAtTime(clamp(piece.bright, 800, 18000), at);
    this.setTempo(tempoScale, at);
    this.fb.gain.setValueAtTime(piece.echoFb, at);
    this.echoLp.frequency.setValueAtTime(piece.echoLp, at);
    for (const [inst, bus] of this.buses) this.applyMix(inst, bus);
  }

  setTempo(tempoScale: number, at: number) {
    const stepDur = 60 / (this.piece.bpm * tempoScale) / 4;
    this.delay.delayTime.setTargetAtTime(clamp(this.piece.echoSteps * stepDur, 0.02, 1.9), at, 0.15);
  }

  private mixOf(inst: InstId): MixCfg {
    return { ...DEFAULT_MIX[inst], ...this.piece.mix[inst] };
  }

  private applyMix(inst: InstId, bus: Bus) {
    const m = this.mixOf(inst);
    const [g, pan, echo, rv] = bus.nodes as [GainNode, AudioNode, GainNode, GainNode | undefined];
    g.gain.value = m.g;
    if ('pan' in pan) (pan as StereoPannerNode).pan.value = m.pan;
    echo.gain.value = m.echo;
    if (rv) rv.gain.value = m.rv;
  }

  bus(inst: InstId): GainNode {
    let b = this.buses.get(inst);
    if (!b) {
      const ac = this.env.ac;
      const g = ac.createGain();
      const pan = typeof ac.createStereoPanner === 'function' ? ac.createStereoPanner() : ac.createGain();
      g.connect(pan);
      pan.connect(this.sum);
      const echo = ac.createGain();
      g.connect(echo);
      echo.connect(this.echoIn);
      const list: AudioNode[] = [g, pan, echo];
      if (this.env.reverb) {
        const rv = ac.createGain();
        g.connect(rv);
        rv.connect(this.env.reverb);
        list.push(rv);
      }
      b = { inp: g, nodes: list };
      this.buses.set(inst, b);
      this.nodes.push(...list);
      this.applyMix(inst, b);
    }
    return b.inp;
  }

  /** Geplante Ausblendung (gleichförmig, ohne Sprünge) */
  fadeOut(at: number, T: number) {
    if (this.dieAt !== null) return;
    const t = Math.max(at, this.fadeEnd);
    const curve = FADE_OUT;
    this.out.gain.setValueCurveAtTime(curve, t, Math.max(0.03, T));
    this.muteAt = t + Math.max(0.03, T);
    this.dieAt = this.muteAt + 0.4;
  }

  dispose() {
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* schon getrennt */ } }
    this.nodes.length = 0;
    this.buses.clear();
    this.finished = true;
  }
}

export class MusicPlayer {
  private layers: Layer[] = [];
  private cur: Layer | null = null;
  mood: MusicMood = 'off';
  private timer: ReturnType<typeof setInterval> | null = null;
  private tempo = 1;
  private speed = 1;
  private readonly input: GainNode;
  private readonly muffle: BiquadFilterNode;
  private readonly rng: () => number;

  constructor(private readonly env: MusicEnv) {
    const ac = env.ac;
    this.rng = env.rng ?? Math.random;
    this.input = ac.createGain();
    this.muffle = ac.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 18000;
    this.muffle.Q.value = 0.6;
    this.input.connect(this.muffle);
    this.muffle.connect(env.dest);
  }

  private now(): number {
    return this.env.ac.currentTime;
  }

  /** Stimmung wechseln (Überblendung); at = Audio-Zeit des Wechsels (Standard: jetzt) */
  setMood(mood: MusicMood, at?: number): void {
    if (mood === this.mood) return;
    const t = Math.max(at ?? this.now(), this.now()) + 0.02;
    const stinger = mood === 'victory' || mood === 'defeat';
    const old = this.cur;
    this.mood = mood;
    if (old) old.fadeOut(t, stinger || mood === 'off' ? FADE_FAST_S : FADE_S);
    this.cur = null;
    if (mood === 'off') return;
    const piece = getPiece(mood);
    const layer = new Layer(this.env, this.input, piece, t, stinger ? STINGER_FADE_IN_S : FADE_S);
    layer.setTempo(this.tempoFor(piece), t);
    this.cur = layer;
    this.layers.push(layer);
    this.applyMuffle(t);
  }

  /** Tempo-Kopplung nur im Kampfstück */
  private tempoFor(piece: Piece): number {
    return piece.id === 'battle' ? this.tempo : 1;
  }

  /** Pause (Tempo 0): Musik dumpfer statt aus; im Zeitstopp-Stück nur leicht */
  private applyMuffle(at: number) {
    const closed = this.speed <= 0;
    const cutoff = !closed ? 18000 : this.mood === 'pause' ? 2800 : 650;
    this.muffle.frequency.setTargetAtTime(cutoff, at, closed ? 0.18 : 0.3);
  }

  /** Spielgeschwindigkeit: leichte Tempo-/Klangkopplung; 0 = Pause (dumpf statt aus) */
  setSpeed(mult: number, at?: number): void {
    const t = at ?? this.now();
    this.speed = mult;
    this.tempo = mult <= 0 ? 0.9 : 1 + 0.04 * Math.log2(Math.max(1, mult));
    this.applyMuffle(t);
    for (const l of this.layers) if (l.dieAt === null) l.setTempo(this.tempoFor(l.piece), t);
  }

  get currentSpeed(): number {
    return this.speed;
  }

  /** Alle Ebenen bis zur Audio-Zeit `until` mit Noten füllen */
  scheduleUntil(until: number): void {
    const ac = this.env.ac;
    const now = ac.currentTime;
    for (const layer of this.layers) {
      if (layer.finished) continue;
      let guard = 0;
      while (!layer.finished && layer.nextTime < until && guard++ < 4000) {
        if (layer.nextTime >= layer.muteAt) { layer.finished = true; break; }
        const piece = layer.piece;
        const tempo = this.tempoFor(piece);
        const stepDur = 60 / (piece.bpm * tempo) / 4;
        // Nachholen: wenn der Scheduler (z. B. Hintergrund-Tab) zu spät dran ist, Schritte überspringen statt Salven zu spielen
        if (layer.nextTime < now - 0.12) {
          const skip = Math.floor((now + 0.05 - layer.nextTime) / stepDur);
          layer.nextTime += skip * stepDur;
          layer.idx = this.wrap(layer, layer.idx + skip);
          if (layer.finished) break;
        }
        const evs = piece.steps[layer.idx];
        if (evs && evs.length) {
          const t = layer.nextTime + (layer.idx % 4 === 2 ? piece.swing * stepDur : 0);
          if (t >= now - 0.005) this.playStep(layer, evs, t, stepDur);
        }
        layer.nextTime += stepDur;
        layer.idx = this.wrap(layer, layer.idx + 1);
      }
    }
  }

  /** Schrittindex nach Stückende: Folgestück, Schleife oder Ende */
  private wrap(layer: Layer, idx: number): number {
    const piece = layer.piece;
    if (idx < piece.length) return idx;
    if (piece.next) {
      const nxt = piece.next();
      layer.configure(nxt, this.tempoFor(nxt), layer.nextTime);
      return Math.max(0, idx - piece.length);
    }
    if (piece.loop) return piece.loopStart + ((idx - piece.length) % Math.max(1, piece.length - piece.loopStart));
    layer.finished = true;
    return piece.length;
  }

  private playStep(layer: Layer, evs: Piece['steps'][number], t: number, stepDur: number) {
    const ac = this.env.ac;
    for (const ev of evs) {
      const fn = INST[ev.i];
      if (!fn) continue;
      const f = DRUMS.has(ev.i) ? ev.m : ev.m > 0 ? mtof(ev.m) : 0;
      if (!DRUMS.has(ev.i) && f <= 0 && ev.i !== 'timp') continue;
      const rack = new Rack(ac, layer.bus(ev.i), t, 1, this.rng);
      fn(rack, f, ev.d * stepDur, ev.v * (0.94 + 0.12 * this.rng()));
    }
  }

  /** Live-Betrieb: Timer starten */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  tick(): void {
    const ac = this.env.ac;
    const hidden = typeof document !== 'undefined' && document.hidden;
    this.scheduleUntil(ac.currentTime + (hidden ? 1.6 : 0.25));
    const now = ac.currentTime;
    if (this.layers.some((l) => l.dieAt !== null && now > l.dieAt)) {
      this.layers = this.layers.filter((l) => {
        if (l.dieAt !== null && now > l.dieAt) { l.dispose(); return false; }
        return true;
      });
    }
  }

  get layerCount(): number {
    return this.layers.length;
  }

  /** Alles beenden und freigeben */
  dispose(): void {
    this.stop();
    for (const l of this.layers) l.dispose();
    this.layers = [];
    this.cur = null;
    try { this.input.disconnect(); this.muffle.disconnect(); } catch { /* ignorieren */ }
  }
}
