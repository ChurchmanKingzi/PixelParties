import { MAP_H, MAP_W, TPS, type Team } from './constants';
import { Rng } from './rng';
import type {
  Area, EdgeDir, Module, Player, Projectile, SimEvent, Unit, Wall,
} from './types';
import { K_CORE, K_EMPTY, K_TOWER } from './types';

export const N_CELLS = MAP_W * MAP_H;
export const ci = (x: number, y: number) => y * MAP_W + x;
export const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

export type Phase = 'loadout' | 'build' | 'battle' | 'pause' | 'over';

export class World {
  rng: Rng;
  seed: number;
  tick = 0;
  nextId = 1;
  phase: Phase = 'loadout';

  // Raster
  kind = new Uint8Array(N_CELLS);
  owner = new Int8Array(N_CELLS).fill(-1);
  mod = new Int32Array(N_CELLS);
  rubble = new Uint8Array(N_CELLS);
  blocked = new Uint8Array(N_CELLS);
  wallE: (Wall | null)[] = new Array(N_CELLS).fill(null);
  wallS: (Wall | null)[] = new Array(N_CELLS).fill(null);
  modules = new Map<number, Module>();
  walls = new Map<number, Wall>();
  coreMod: [number, number] = [0, 0];

  // Dynamik
  units: Unit[] = [];
  byId = new Map<number, Unit>();
  projectiles: Projectile[] = [];
  areas: Area[] = [];
  events: SimEvent[] = [];
  buckets: number[][] = Array.from({ length: N_CELLS }, () => []);

  players: [Player, Player];
  conquest: [number, number] = [0, 0];
  /** Stand der Eroberung je verteidigter Kammer: Eindringlinge drin, gesperrt (durch wen), Rate in %/s */
  conqInfo: { n: number; locked: boolean; lockedBy: string; rate: number; state: number; milestone: number }[] = [
    { n: 0, locked: false, lockedBy: '', rate: 0, state: 0, milestone: 0 }, { n: 0, locked: false, lockedBy: '', rate: 0, state: 0, milestone: 0 },
  ];
  winner: Team | -1 | null = null;
  winType: '' | 'core' | 'conquest' | 'time' | 'draw' = '';

  // Zeitplan
  battleTick = 0; // Ticks der laufenden Schlacht (ohne Pausen)
  waveNo = 0; // gespawnte Wellen
  waveInCycle = 0; // Wellen, die in diesem Kampfabschnitt schon gespawnt sind
  nextWaveTick = 0;
  pauseNo = 0;
  /** Aufholstufe je Spieler, beim Zeitstopp festgehalten (catchup.ts) */
  aidLevel: [number, number] = [0, 0];
  spawnQueue: { team: Team; entry: number; at: number; wave: number }[] = [];
  citizenTimer: [number, number] = [0, 0];
  pendingPause = false;
  pauseReadyAt = 0;
  stats = {
    kills: [0, 0], deaths: [0, 0], civKilled: [0, 0], dmgStruct: [0, 0], dmgUnits: [0, 0], shots: [0, 0],
    retreats: [0, 0], healed: [0, 0], wallsBroken: [0, 0], modulesLost: [0, 0],
  };
  madness = 0;
  /** Befehlsprotokoll (für Replays) */
  log: unknown[] = [];

  constructor(seed: number, players: [Player, Player]) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.players = players;
  }

  get time(): number {
    return this.tick / TPS;
  }
  get battleTime(): number {
    return this.battleTick / TPS;
  }
  id(): number {
    return this.nextId++;
  }
  emit(e: SimEvent) {
    this.events.push(e);
  }
  feed(msg: string, team: Team | -1 = -1) {
    this.events.push({ t: 'feed', msg, team });
  }

  // ---- Kanten
  edgeAt(x: number, y: number, dir: EdgeDir): Wall | null {
    if (!inMap(x, y)) return null;
    return dir === 'E' ? this.wallE[ci(x, y)] : this.wallS[ci(x, y)];
  }
  /** Kante zwischen zwei orthogonal benachbarten Zellen */
  edgeBetween(ax: number, ay: number, bx: number, by: number): Wall | null {
    if (bx > ax) return this.wallE[ci(ax, ay)];
    if (bx < ax) return this.wallE[ci(bx, ay)];
    if (by > ay) return this.wallS[ci(ax, ay)];
    return this.wallS[ci(ax, by)];
  }
  setEdge(x: number, y: number, dir: EdgeDir, w: Wall | null) {
    if (dir === 'E') this.wallE[ci(x, y)] = w;
    else this.wallS[ci(x, y)] = w;
  }

  // ---- Zellen
  moduleAt(x: number, y: number): Module | undefined {
    if (!inMap(x, y)) return undefined;
    const id = this.mod[ci(x, y)];
    return id ? this.modules.get(id) : undefined;
  }
  /** Zelle ist für Bodeneinheiten massiv (lebender Turm, Kern, Teich) */
  solid(x: number, y: number): boolean {
    if (!inMap(x, y)) return true;
    const i = ci(x, y);
    if (this.blocked[i]) return true;
    const k = this.kind[i];
    if (k === K_TOWER || k === K_CORE) {
      const m = this.modules.get(this.mod[i]);
      return !(m && m.destroyed);
    }
    return false;
  }
  isOwned(x: number, y: number, team: Team): boolean {
    return inMap(x, y) && this.owner[ci(x, y)] === team && this.kind[ci(x, y)] !== K_EMPTY;
  }

  // ---- Einheiten
  unit(id: number): Unit | undefined {
    return this.byId.get(id);
  }
  rebuildBuckets() {
    for (const b of this.buckets) b.length = 0;
    for (const u of this.units) {
      if (u.dead) continue;
      const cx = Math.min(MAP_W - 1, Math.max(0, Math.floor(u.x)));
      const cy = Math.min(MAP_H - 1, Math.max(0, Math.floor(u.y)));
      this.buckets[ci(cx, cy)].push(u.id);
    }
  }
  /** Einheiten im Kreis (Mittelpunkt, Radius in Zellen) */
  near(x: number, y: number, r: number, f?: (u: Unit) => boolean): Unit[] {
    const out: Unit[] = [];
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(MAP_W - 1, Math.floor(x + r));
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(MAP_H - 1, Math.floor(y + r));
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (const id of this.buckets[ci(cx, cy)]) {
          const u = this.byId.get(id);
          if (!u || u.dead) continue;
          const dx = u.x - x, dy = u.y - y;
          if (dx * dx + dy * dy <= r2 && (!f || f(u))) out.push(u);
        }
      }
    }
    return out;
  }
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}
