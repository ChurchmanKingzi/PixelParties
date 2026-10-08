// Audio-Schicht von Bastion Blasters: Singleton `audio`.
// Reine Synthese zur Laufzeit (Web Audio API), keine Dateien. Ohne AudioContext sind alle Methoden No-Ops.
// Die Sim wird nie berührt: hier werden nur SimEvents gelesen; Zufall kommt aus dem Audio-Modul selbst.

import type { SimEvent } from '../sim/types';
import { UNITS } from '../sim/data';
import { MusicPlayer, type MusicMood } from './music';
import { META, SFX_NAMES, startSfx, type SfxName } from './sfx';
import { hash32 } from './rng';
import { clamp, reverbIR, type Voice } from './synth';

export type { MusicMood } from './music';
export type UiSound = 'click' | 'hover' | 'card' | 'play' | 'invalid' | 'rotate' | 'tab' | 'toggle' | 'confirm' | 'cancel' | 'pause' | 'speed' | 'draw' | 'reroll';
export type VolumePart = 'master' | 'music' | 'sfx';
export interface VolumeState { master: number; music: number; sfx: number; muted: boolean }

export const STORAGE_KEY = 'bb.audio';
export const DEFAULT_VOLUME: VolumeState = { master: 0.8, music: 0.35, sfx: 0.7, muted: false };
export const MAX_VOICES = 24;
/** Vorlauf beim Planen von Stimmen (s), damit der Start nie in der Vergangenheit liegt */
const LEAD = 0.004;
export const MAP_W = 56;
export const MAP_H = 28;

/** Grundpegel der Musik gegenüber den SFX (Feinabgleich der Mischung) */
export const MUSIC_TRIM = 1.15;

/** Lautstärkekurve der Schieberegler (0..1 -> Verstärkung) */
export const taper = (v: number): number => Math.pow(clamp(v, 0, 1), 1.5);

// ---------------------------------------------------------------- Master-Kette (auch für Offline-Tests)

export interface Graph {
  ac: BaseAudioContext;
  musicBus: GainNode;
  sfxBus: GainNode;
  /** Hall-Eingänge: getrennte Sends, damit die Regler auch den Hallanteil skalieren */
  sfxRevIn: GainNode;
  musRevIn: GainNode;
  pre: GainNode;
  comp: DynamicsCompressorNode;
  master: GainNode;
  nodes: AudioNode[];
}

/** Weiche Begrenzung: linear bis 0.6, danach sanft gegen ~0.92 (Eingang wird bei +-1 abgeschnitten) */
function softClipCurve(): Float32Array<ArrayBuffer> {
  const n = 2049;
  const c = new Float32Array(n);
  const k = 0.6, room = 0.4;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    c[i] = Math.sign(x) * (a <= k ? a : k + room * Math.tanh((a - k) / room));
  }
  return c;
}

/**
 * Baut: Musik-/SFX-Bus -> Vorstufe -> Kompressor -> Soft-Clip -> Master -> Ausgang.
 * Der Hall (generierte Impulsantwort) hängt über zwei Sends an der Vorstufe.
 */
export function buildGraph(ac: BaseAudioContext): Graph {
  const nodes: AudioNode[] = [];
  const mk = <T extends AudioNode>(n: T): T => { nodes.push(n); return n; };
  const musicBus = mk(ac.createGain());
  const sfxBus = mk(ac.createGain());
  const pre = mk(ac.createGain());
  pre.gain.value = 1.3;
  const comp = mk(ac.createDynamicsCompressor());
  comp.threshold.value = -16;
  comp.knee.value = 14;
  comp.ratio.value = 5;
  comp.attack.value = 0.005;
  comp.release.value = 0.2;
  const clip = mk(ac.createWaveShaper());
  clip.curve = softClipCurve();
  clip.oversample = '2x';
  const master = mk(ac.createGain());
  const conv = mk(ac.createConvolver());
  conv.buffer = reverbIR(ac);
  const sfxRevIn = mk(ac.createGain());
  const musRevIn = mk(ac.createGain());
  const revOut = mk(ac.createGain());
  revOut.gain.value = 0.55;
  sfxBus.connect(pre);
  musicBus.connect(pre);
  sfxRevIn.connect(conv);
  musRevIn.connect(conv);
  conv.connect(revOut);
  revOut.connect(pre);
  pre.connect(comp);
  comp.connect(clip);
  clip.connect(master);
  master.connect(ac.destination);
  return { ac, musicBus, sfxBus, sfxRevIn, musRevIn, pre, comp, master, nodes };
}

/** Lautstärken auf die Kette anwenden; tc = Zeitkonstante der Glättung (0 = sofort) */
export function applyVolumes(g: Graph, v: VolumeState, at: number, tc = 0.03): void {
  const set = (p: AudioParam, val: number) => { if (tc > 0) p.setTargetAtTime(val, at, tc); else p.setValueAtTime(val, at); };
  set(g.master.gain, v.muted ? 0 : taper(v.master));
  set(g.musicBus.gain, taper(v.music) * MUSIC_TRIM);
  set(g.sfxBus.gain, taper(v.sfx));
  set(g.sfxRevIn.gain, taper(v.sfx));
  set(g.musRevIn.gain, taper(v.music) * MUSIC_TRIM);
}

// ---------------------------------------------------------------- Rate-Limit

export type RateCat = 'hit' | 'shot' | 'imp' | 'death' | 'brk' | 'rank' | 'heal' | 'spawn' | 'fx' | 'text' | 'feed' | 'ui';
interface RateCfg { perSec: number; gap: number }
export const RATE: Record<RateCat, RateCfg> = {
  hit: { perSec: 12, gap: 0.04 },
  shot: { perSec: 14, gap: 0.04 },
  imp: { perSec: 14, gap: 0.04 },
  death: { perSec: 9, gap: 0.05 },
  brk: { perSec: 6, gap: 0.08 },
  rank: { perSec: 4, gap: 0.15 },
  heal: { perSec: 4, gap: 0.12 },
  spawn: { perSec: 5, gap: 0.08 },
  fx: { perSec: 6, gap: 0.06 },
  text: { perSec: 3, gap: 0.15 },
  feed: { perSec: 3, gap: 0.2 },
  ui: { perSec: 30, gap: 0.025 },
};

/** Begrenzt Klang-Auslösungen: gleiche Art nur im Mindestabstand, je Kategorie nur N pro Sekunde */
export class RateGate {
  private last = new Map<string, number>();
  private recent = new Map<RateCat, number[]>();

  /**
   * @param rateScale 1 = normal, < 1 senkt die Obergrenzen (hohes Spieltempo)
   * @param boost Faktor für die Kategorie-Obergrenze (wichtige Ereignisse dürfen etwas mehr)
   */
  allow(cat: RateCat, key: string, now: number, rateScale = 1, boost = 1): boolean {
    const cfg = RATE[cat];
    const l = this.last.get(key);
    if (l !== undefined && now - l < cfg.gap / Math.max(0.2, rateScale) && now >= l) return false;
    let arr = this.recent.get(cat);
    if (!arr) { arr = []; this.recent.set(cat, arr); }
    while (arr.length && now - arr[0] > 1) arr.shift();
    if (arr.length >= Math.max(1, Math.round(cfg.perSec * rateScale * boost))) return false;
    arr.push(now);
    this.last.set(key, now);
    return true;
  }

  reset(): void {
    this.last.clear();
    this.recent.clear();
  }
}

// ---------------------------------------------------------------- Engine

export interface EngineOptions {
  /** Kontext von außen (Test: OfflineAudioContext). Dann gibt es kein unlock() und keine Timer. */
  context?: BaseAudioContext;
  /** Zeitquelle (Test); Standard ac.currentTime */
  clock?: () => number;
  /** localStorage nutzen (Standard ja) */
  storage?: boolean;
  /** PRNG (Test); Standard Math.random */
  rng?: () => number;
}

export interface EngineStats {
  played: number;
  dropped: number;
  stolen: number;
  errors: number;
  active: number;
  /** Schnappschuss je Name */
  byName: Record<string, number>;
}

interface Spatial { pan: number; gain: number; lp: number; wet: number }
const CENTER: Spatial = { pan: 0, gain: 1, lp: 20000, wet: 1 };

interface PlayOpts {
  x?: number;
  y?: number;
  vol: number;
  size?: number;
  pitch?: number;
  boost?: number;
  ui?: boolean;
  prioAdd?: number;
  delay?: number;
  team?: number;
}

type AudioCtor = new (o?: AudioContextOptions) => AudioContext;

const UI_VOL: Record<UiSound, number> = {
  click: 0.75, hover: 0.5, card: 0.7, play: 0.85, invalid: 0.75, rotate: 0.6, tab: 0.6, toggle: 0.65, confirm: 0.8, cancel: 0.7,
  pause: 0.8, speed: 0.6, draw: 0.7, reroll: 0.75,
};

export class AudioEngine {
  private ac: BaseAudioContext | null = null;
  private g: Graph | null = null;
  private music: MusicPlayer | null = null;
  private vol: VolumeState = { ...DEFAULT_VOLUME };
  private subs = new Set<(v: VolumeState) => void>();
  private mood: MusicMood = 'off';
  private speed = 1;
  private lx = MAP_W / 2;
  private ly = MAP_H / 2;
  private viewer: number | null = null;
  private voices: Voice[] = [];
  private gate = new RateGate();
  private dead = false;
  private readonly testMode: boolean;
  private readonly clock?: () => number;
  private rand: () => number;
  private readonly useStorage: boolean;
  private counters = { played: 0, dropped: 0, stolen: 0, errors: 0 };
  private byName: Record<string, number> = {};

  constructor(opts: EngineOptions = {}) {
    this.testMode = !!opts.context;
    this.clock = opts.clock;
    this.rand = opts.rng ?? Math.random;
    this.useStorage = opts.storage !== false;
    if (this.useStorage) this.load();
    if (opts.context) this.attach(opts.context);
  }

  // ---------------------------------------------------------------- Kontext

  private attach(ac: BaseAudioContext): void {
    this.ac = ac;
    this.g = buildGraph(ac);
    applyVolumes(this.g, this.vol, this.now(), 0);
    this.music = new MusicPlayer({ ac, dest: this.g.musicBus, reverb: this.g.musRevIn, rng: this.rand });
    this.music.setSpeed(this.speed);
    if (this.mood !== 'off') this.music.setMood(this.mood);
    if (!this.testMode) this.music.start();
  }

  /** Nach der ersten Nutzergeste aufrufen (pointerdown/keydown); idempotent, setzt einen pausierten Kontext fort */
  unlock(): void {
    if (this.testMode || this.dead) return;
    try {
      if (!this.ac) {
        const w = globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
        const Ctor: AudioCtor | undefined = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctor) { this.dead = true; return; }
        this.attach(new Ctor({ latencyHint: 'interactive' }));
      }
      const ac = this.ac as AudioContext;
      if (ac.state !== 'running' && ac.state !== 'closed') {
        const p = ac.resume();
        if (p && typeof p.catch === 'function') p.catch(() => { /* Geste fehlte, nächster Versuch folgt */ });
      }
    } catch {
      this.dead = true;
    }
  }

  private now(): number {
    if (this.clock) return this.clock();
    return this.ac ? this.ac.currentTime : 0;
  }

  /** Läuft der Kontext und darf Schall entstehen? */
  private ok(): boolean {
    if (!this.g || !this.ac || this.dead) return false;
    if (this.vol.muted || this.vol.sfx < 0.003 || this.vol.master < 0.003) return false;
    return this.testMode || this.ac.state === 'running';
  }

  // ---------------------------------------------------------------- Lautstärke

  get volume(): VolumeState {
    return { ...this.vol };
  }

  setVolume(part: VolumePart, v: number): void {
    if (!Number.isFinite(v)) return;
    this.vol[part] = Math.round(clamp(v, 0, 1) * 1000) / 1000;
    this.commit();
  }

  setMuted(b: boolean): void {
    this.vol.muted = !!b;
    this.commit();
  }

  toggleMute(): void {
    this.setMuted(!this.vol.muted);
  }

  /** Abonniert Lautstärke-Änderungen; Rückgabe: Abmelde-Funktion */
  onChange(cb: (v: VolumeState) => void): () => void {
    this.subs.add(cb);
    return () => { this.subs.delete(cb); };
  }

  private commit(): void {
    if (this.g) {
      try { applyVolumes(this.g, this.vol, this.now()); } catch { this.counters.errors++; }
    }
    this.save();
    const snap = this.volume;
    for (const cb of [...this.subs]) { try { cb(snap); } catch { /* Abonnent kaputt, ignorieren */ } }
  }

  private load(): void {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as Partial<VolumeState>;
      for (const k of ['master', 'music', 'sfx'] as const) {
        const x = o[k];
        if (typeof x === 'number' && Number.isFinite(x)) this.vol[k] = clamp(x, 0, 1);
      }
      if (typeof o.muted === 'boolean') this.vol.muted = o.muted;
    } catch { /* kein Storage oder kaputte Daten: Standardwerte */ }
  }

  private save(): void {
    if (!this.useStorage) return;
    try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.vol)); } catch { /* ohne Storage weiter */ }
  }

  // ---------------------------------------------------------------- Zustand von außen

  setSpeed(mult: number): void {
    if (!Number.isFinite(mult)) return;
    this.speed = Math.max(0, mult);
    try { this.music?.setSpeed(this.speed); } catch { this.counters.errors++; }
  }

  setMood(m: MusicMood): void {
    if (m === this.mood) return;
    const prev = this.mood;
    this.mood = m;
    try {
      this.music?.setMood(m);
      // Zeitstopp: kurzer Übergangsklang beim Eintritt/Verlassen
      if (m === 'pause' && prev === 'battle') this.play('timestop', 'ui', 'timestop', { vol: 0.7, ui: true });
      else if (prev === 'pause' && m === 'battle') this.play('timeresume', 'ui', 'timeresume', { vol: 0.6, ui: true });
    } catch { this.counters.errors++; }
  }

  setListener(x: number, y: number): void {
    if (Number.isFinite(x)) this.lx = x;
    if (Number.isFinite(y)) this.ly = y;
  }

  /** Optional: eigenes Team des Spielers (eigene Ereignisse etwas lauter). null = neutral/Zuschauer. */
  setViewer(team: number | null): void {
    this.viewer = team === 0 || team === 1 ? team : null;
  }

  // ---------------------------------------------------------------- Stimmen

  private spatial(x?: number, y?: number): Spatial {
    if (x === undefined || !Number.isFinite(x)) return CENTER;
    const dx = x - this.lx;
    const dy = ((y !== undefined && Number.isFinite(y) ? y : this.ly) - this.ly) * 1.2;
    const d = Math.hypot(dx, dy);
    return {
      pan: clamp(dx / 20, -1, 1) * 0.85,
      gain: 1 / (1 + Math.pow(d / 34, 1.6)),
      lp: Math.max(1800, 18000 * Math.exp(-d / 38)),
      wet: 1 + d / 60,
    };
  }

  /** Lautheit bei hoher Spielgeschwindigkeit absenken */
  private speedGain(): number {
    return 1 / (1 + 0.1 * (Math.max(1, this.speed) - 1));
  }

  /** Obergrenzen der Auslösungen pro Sekunde sinken mit dem Tempo (viele Ereignisse pro Echtzeit-Sekunde) */
  private rateScale(): number {
    return Math.pow(Math.max(1, this.speed), -0.4);
  }

  /** Hüllkurven werden bei hohem Tempo kürzer (weniger Überlappung) */
  private timeScale(): number {
    return 1 / (1 + 0.08 * (Math.max(1, this.speed) - 1));
  }

  private liveCount(): number {
    let n = 0;
    for (const v of this.voices) if (!v.done && !v.killed) n++;
    return n;
  }

  private sweep(now: number): void {
    let dirty = false;
    for (const v of this.voices) {
      if (v.done) { dirty = true; continue; }
      if (now > v.end + 0.6) { v.destroy(); dirty = true; }
    }
    if (dirty) this.voices = this.voices.filter((v) => !v.done);
  }

  private makeRoom(prio: number, now: number): boolean {
    if (this.liveCount() < MAX_VOICES) return true;
    let victim: Voice | null = null;
    for (const v of this.voices) {
      if (v.done || v.killed) continue;
      if (!victim || v.prio < victim.prio || (v.prio === victim.prio && v.end < victim.end)) victim = v;
    }
    if (victim && victim.prio < prio) {
      victim.kill(now);
      this.counters.stolen++;
      return true;
    }
    return false;
  }

  private play(name: SfxName, cat: RateCat, key: string, o: PlayOpts): boolean {
    if (!this.ok()) return false;
    const g = this.g as Graph;
    const ac = g.ac;
    const now = this.now();
    const ui = !!o.ui;
    if (!this.gate.allow(cat, key, now, ui ? 1 : this.rateScale(), o.boost ?? 1)) { this.counters.dropped++; return false; }
    this.sweep(now);
    const meta = META[name];
    const prio = meta.prio + (o.prioAdd ?? 0);
    if (!this.makeRoom(prio, now)) { this.counters.dropped++; return false; }
    const sp = ui ? CENTER : this.spatial(o.x, o.y);
    let vol = o.vol;
    if (this.viewer !== null && o.team !== undefined && !ui) vol *= o.team === this.viewer ? 1.15 : 0.92;
    const gain = vol * sp.gain * (ui ? 1 : this.speedGain());
    if (gain < 0.012) { this.counters.dropped++; return false; }
    const v = startSfx(ac, g.sfxBus, g.sfxRevIn, name, now + LEAD + (o.delay ?? 0), {
      gain,
      pan: sp.pan,
      lp: sp.lp,
      wet: Math.min(0.8, meta.wet * sp.wet * (ui ? 1 : this.speedGain())),
      ts: ui ? 1 : this.timeScale(),
      size: o.size,
      pitch: o.pitch,
      prio,
      rng: this.rand,
    });
    this.voices.push(v);
    this.counters.played++;
    this.byName[name] = (this.byName[name] ?? 0) + 1;
    return true;
  }

  // ---------------------------------------------------------------- UI-Klänge

  ui(name: UiSound): void {
    if (!this.ok()) return;
    try {
      const n = ('ui.' + name) as SfxName;
      if (!SFX_NAMES.includes(n)) return;
      this.play(n, 'ui', n, { vol: UI_VOL[name] ?? 0.7, ui: true });
    } catch { this.counters.errors++; }
  }

  // ---------------------------------------------------------------- Sim-Ereignisse

  onEvent(e: SimEvent): void {
    if (!this.ok()) return;
    try {
      switch (e.t) {
        case 'shot': this.onShot(e); break;
        case 'impact': this.onImpact(e); break;
        case 'hit': this.onHit(e); break;
        case 'death': this.onDeath(e); break;
        case 'break': this.onBreak(e); break;
        case 'rank': this.play('rank', 'rank', 'rank', { x: e.x, y: e.y, vol: 0.62, team: e.team, pitch: 1 + (e.rank - 1) * 0.04, boost: 1.5 }); break;
        case 'heal': this.play('heal', 'heal', 'heal', { x: e.x, y: e.y, vol: 0.34 }); break;
        case 'spawn': this.play('spawn', 'spawn', 'spawn', { x: e.x, y: e.y, vol: 0.34 }); break;
        case 'fx': this.onFx(e); break;
        case 'text': this.onText(e); break;
        case 'feed': this.onFeed(e); break;
        default: break;
      }
    } catch {
      this.counters.errors++;
    }
  }

  /** kartenspezifische, feste Tonhöhen-Färbung (0.93..1.07) */
  private flavor(cid: string): number {
    return 0.93 + 0.14 * ((hash32(cid) % 100) / 100);
  }

  private onShot(e: Extract<SimEvent, { t: 'shot' }>): void {
    const def = UNITS[e.cid];
    const art = def?.cat === 'artillery';
    const tower = !def;
    const traj = art ? def.traj : undefined;
    let vol = art ? 0.6 : tower ? 0.4 : 0.22;
    let size = 1;
    let pitch = this.flavor(e.cid);
    let name: SfxName;
    switch (e.vis) {
      case 'stone':
        if (traj === 'flat') name = 'shot.cannon';
        else if (traj === 'pierce') {
          if (e.cid === 'UA-17') { name = 'shot.cannon'; size = 1.7; pitch *= 0.72; vol *= 1.1; } else name = 'shot.ballista';
        } else if (traj === 'arc') name = 'shot.catapult';
        else if (traj === 'vertical') name = 'shot.lob';
        else if (traj === 'under') name = 'shot.dig';
        else if (!art) { name = 'shot.cannon'; size = 0.4; pitch *= 1.7; }
        else name = e.fly > 30 ? 'shot.catapult' : 'shot.cannon';
        break;
      case 'fire': name = 'shot.fire'; size = art ? 1 : 0.6; break;
      case 'flame': name = 'shot.flame'; break;
      case 'bolt': name = 'shot.bolt'; break;
      case 'poison': name = 'shot.poison'; break;
      case 'arcane': name = 'shot.arcane'; break;
      case 'ink': name = 'shot.ink'; break;
      case 'bat': name = 'shot.bat'; break;
      case 'bomb': name = 'shot.bomb'; break;
      case 'icicle': name = 'shot.icicle'; break;
      case 'ice': name = 'shot.ice'; break;
      case 'meteor': name = 'shot.meteor'; break;
      case 'goblin': name = 'shot.goblin'; break;
      case 'arrow': name = 'shot.arrow'; break;
      case 'goo': name = 'shot.goo'; break;
      case 'fish': name = 'shot.fish'; break;
      default: name = 'shot.cannon'; size = 0.5; pitch *= 1.4; break;
    }
    // Familie als Schlüssel: gleiche Art innerhalb des Mindestabstands nur einmal
    this.play(name, 'shot', name, { x: e.x0, y: e.y0, vol, size, pitch, team: e.team });
  }

  private onImpact(e: Extract<SimEvent, { t: 'impact' }>): void {
    const r = Number.isFinite(e.r) ? e.r : 1;
    const size = clamp(0.6 + r * 0.45, 0.6, 1.8);
    const pitch = 1 / (0.85 + 0.15 * size);
    let name: SfxName;
    let vol = 0.62 * (0.8 + 0.2 * Math.min(1.6, r));
    switch (e.vis) {
      case 'stone': name = 'imp.stone'; break;
      case 'dust': name = 'imp.dust'; vol = 0.3; break;
      case 'fire': name = 'imp.fire'; break;
      case 'bolt': name = 'imp.bolt'; break;
      case 'poison': name = 'imp.poison'; break;
      case 'arcane': name = 'imp.arcane'; break;
      case 'ice': case 'icicle': name = 'imp.ice'; break;
      case 'meteor': name = 'imp.meteor'; vol = 0.85; break;
      case 'dome': name = 'imp.dome'; vol = 0.6; break;
      case 'bomb': name = 'imp.bomb'; break;
      case 'ink': case 'goo': name = 'imp.splat'; break;
      case 'bat': name = 'imp.bat'; break;
      case 'goblin': name = 'imp.goblin'; break;
      default: name = 'imp.stone'; break;
    }
    this.play(name, 'imp', name, { x: e.x, y: e.y, vol, size, pitch, boost: r >= 1.5 ? 1.4 : 1 });
  }

  private onHit(e: Extract<SimEvent, { t: 'hit' }>): void {
    const dmg = Math.max(1, e.dmg);
    const s = clamp(Math.log10(dmg + 1) / 2.2, 0.12, 1.1);
    this.play('hit', 'hit', 'hit', {
      x: e.x, y: e.y, vol: 0.2 + 0.4 * s, size: s, pitch: e.team === 0 ? 0.96 : 1.06, boost: dmg >= 40 ? 1.6 : 1, prioAdd: s > 0.7 ? 1 : 0, team: e.team,
    });
  }

  private onDeath(e: Extract<SimEvent, { t: 'death' }>): void {
    const bones = UNITS[e.cid]?.armor === 'bone';
    let name: SfxName;
    let vol = 0.5;
    if (e.cat === 'citizen') { name = 'death.citizen'; vol = 0.42; }
    else if (e.cat === 'civilian') { name = 'death.civilian'; vol = 0.5; }
    else if (bones) { name = 'death.bones'; vol = 0.45; }
    else if (e.cat === 'artillery') { name = 'death.artillery'; vol = 0.58; }
    else if (e.cat === 'defender') name = 'death.defender';
    else name = 'death.assault';
    this.play(name, 'death', name, { x: e.x, y: e.y, vol, pitch: this.flavor(e.cid), team: e.team });
  }

  private onBreak(e: Extract<SimEvent, { t: 'break' }>): void {
    const w = e.what;
    const name: SfxName = w === 'core' ? 'break.core' : w === 'module' ? 'break.module' : w === 'gate' ? 'break.gate' : 'break.wall';
    const vol = w === 'core' ? 1 : w === 'module' || w === 'gate' ? 0.9 : 0.8;
    this.play(name, 'brk', name, { x: e.x, y: e.y, vol, boost: 2 });
  }

  private onFx(e: Extract<SimEvent, { t: 'fx' }>): void {
    const o = { x: e.x, y: e.y, vol: 0.34 };
    switch (e.name) {
      case 'puff': this.play('fx.puff', 'fx', 'fx.puff', { ...o, vol: 0.3 }); break;
      case 'revive': this.play('fx.revive', 'fx', 'fx.revive', { ...o, vol: 0.5 }); break;
      case 'flame': this.play('fx.flame', 'fx', 'fx.flame', o); break;
      case 'bones': this.play('death.bones', 'fx', 'fx.bones', { ...o, vol: 0.3 }); break;
      case 'dirt': this.play('fx.dirt', 'fx', 'fx.dirt', o); break;
      case 'spark': this.play('fx.spark', 'fx', 'fx.spark', { ...o, vol: 0.3 }); break;
      case 'Citizen': this.play('fx.squeak', 'fx', 'fx.squeak', { ...o, vol: 0.3 }); break;
      case 'Hornet': this.play('fx.buzz', 'fx', 'fx.buzz', { ...o, vol: 0.3 }); break;
      default: break;
    }
  }

  private onText(e: Extract<SimEvent, { t: 'text' }>): void {
    const o = { x: e.x, y: e.y, vol: 0.4 };
    switch (e.text.toLowerCase()) {
      case 'dodge': this.play('text.dodge', 'text', 'text.dodge', o); break;
      case 'caught!': this.play('text.catch', 'text', 'text.catch', { ...o, vol: 0.5 }); break;
      case 'reflected!': this.play('text.reflect', 'text', 'text.reflect', { ...o, vol: 0.5 }); break;
      case 'berserk': this.play('text.berserk', 'text', 'text.berserk', o); break;
      case 'chomp': this.play('text.chomp', 'text', 'text.chomp', { ...o, vol: 0.5 }); break;
      case 'copy!': this.play('text.copy', 'text', 'text.copy', o); break;
      case 'transmutation': this.play('fx.revive', 'text', 'text.transmutation', { ...o, vol: 0.45 }); break;
      case 'chaos-born': this.play('text.chaos', 'text', 'text.chaos', o); break;
      case 'pit!': this.play('text.pit', 'text', 'text.pit', o); break;
      default: break; // 'foresight' u. a.: ignorieren
    }
  }

  private onFeed(e: Extract<SimEvent, { t: 'feed' }>): void {
    const m = e.msg;
    if (/^wave\b/i.test(m)) this.play('horn.wave', 'feed', 'horn', { vol: 0.62, ui: true });
    else if (/gate is broken/i.test(m)) {
      // Warnung nur für den betroffenen Spieler (bzw. alle, wenn kein Spieler festgelegt ist)
      if (this.viewer === null || e.team === this.viewer) this.play('alarm.gate', 'feed', 'alarm', { vol: 0.55, ui: true, delay: 0.3 });
    } else if (/shield dome breaks/i.test(m)) this.play('shield.break', 'feed', 'shield', { vol: 0.6, ui: true });
    else if (/rebuilt/i.test(m)) this.play('repair', 'feed', 'repair', { vol: 0.45, ui: true });
    else if (/wishing well/i.test(m)) this.play('wish', 'feed', 'wish', { vol: 0.5, ui: true });
  }

  // ---------------------------------------------------------------- Diagnose (Tests)

  get stats(): EngineStats {
    return { ...this.counters, active: this.liveCount(), byName: { ...this.byName } };
  }

  /** Für Tests: Zugriff auf Graph/Player */
  get internals(): { graph: Graph | null; music: MusicPlayer | null } {
    return { graph: this.g, music: this.music };
  }
}

/** Singleton der Anwendung */
export const audio = new AudioEngine();
