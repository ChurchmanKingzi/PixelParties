import type { Armor, DType, Material, Priority, Team, Zone } from './constants';

// ---------------------------------------------------------------- Kartendaten (aus cards.gen.json)

export type UnitCat = 'artillery' | 'assault' | 'defender' | 'civilian';
export type Doctrine = 'hunter' | 'breaker' | 'conqueror' | 'looter' | 'sprenger';
export type Trajectory = 'flat' | 'arc' | 'vertical' | 'pierce' | 'under' | 'scatter' | 'air';

export interface UnitDef {
  id: string;
  name: string;
  nameDe: string;
  cat: UnitCat;
  line: string;
  tier: number;
  soll: number;
  nachschub: number;
  hp: number;
  armor: Armor;
  speed: number;
  rules: string;
  talent: string;
  flavor: string;
  effectText: string;
  talentText: string;
  // Nahkampf / Fernkampf
  dmg?: number;
  dtype?: DType | 'R';
  interval?: number;
  range?: number;
  hits?: number;
  cone?: number;
  area?: number;
  doctrine?: Doctrine;
  zone?: Zone;
  structFactor?: number;
  // Artillerie
  gp?: number | 'air';
  traj?: Trajectory;
  reach?: number;
  count?: number;
  structDmg?: number;
  personDmg?: number;
  splash?: number;
}

export type BuildKind = 'room' | 'yard' | 'tower' | 'wall' | 'gate';

export interface BuildingDef {
  id: string;
  name: string;
  nameDe: string;
  group: string;
  tier: number;
  kind: BuildKind;
  cols: number;
  rows: number;
  material: Material;
  hp: number;
  posts: number;
  gunSlots: number;
  rules: string;
  flavor: string;
  effectText: string;
  tags: string;
  lineUnlock?: string;
}

export type CardDef = (UnitDef & { cat: UnitCat }) | (BuildingDef & { cat: 'building' });

// ---------------------------------------------------------------- Status

export type StatusId =
  | 'burning' | 'chilled' | 'frozen' | 'slimed' | 'poisoned' | 'stunned' | 'confused' | 'feared' | 'rooted'
  | 'frogged' | 'dancing' | 'blinded' | 'blessed' | 'hardened' | 'fed' | 'spurred' | 'wet' | 'marked'
  | 'floating' | 'guarded' | 'swallowed' | 'berserk' | 'shortCircuit' | 'slow' | 'haste' | 'strong' | 'tough' | 'triumph' | 'sated' | 'runeSkin';

export interface Status {
  id: StatusId;
  until: number; // Tick
  power: number;
  src: number;
}

export interface Mods {
  speed: number;
  atkSpeed: number;
  dmgTaken: number;
  dmgDealt: number;
  maxHp: number;
  canMove: boolean;
  canAct: boolean;
  canAttack: boolean;
}

// ---------------------------------------------------------------- Raster, Bauteile

export type CellKind = 0 | 1 | 2 | 3 | 4; // leer, Hof, Raum, Turm, Kern
export const K_EMPTY = 0, K_YARD = 1, K_ROOM = 2, K_TOWER = 3, K_CORE = 4;

export type EdgeDir = 'E' | 'S';
export type WallVariant = 'stone' | 'pudding' | 'armor' | 'ward';

export interface Wall {
  id: number;
  owner: Team;
  x: number;
  y: number;
  dir: EdgeDir;
  hp: number;
  maxHp: number;
  material: Material;
  variant: WallVariant;
  gate: boolean;
  door: boolean;
  burning: number;
  portcullis?: boolean;
  /** Tick, bis zu dem das Fallgatter unten ist */
  closedUntil?: number;
}

export interface GunSlot {
  x: number;
  y: number;
  unit: number; // Einheiten-ID oder 0
  air: boolean;
}

export interface Module {
  id: number;
  owner: Team;
  card: string;
  kind: 'room' | 'yard' | 'tower' | 'core';
  cells: number[];
  x0: number;
  y0: number;
  cols: number;
  rows: number;
  hp: number;
  maxHp: number;
  material: Material;
  destroyed: boolean;
  star: number;
  buildEnd: number; // Tick, bis zu dem es "im Bau" ist
  posts: number;
  staffed: number; // besetzte Posten (berechnet)
  door: { x: number; y: number; dir: 'N' | 'S' | 'E' | 'W' } | null;
  slots: GunSlot[];
  burning: number; // Tick, bis zu dem es brennt
  frozen: number;
  shortCircuit: number;
  s: Record<string, number>; // Laufzeit-Zustand der Effekte
}

export interface Cell { x: number; y: number }

// ---------------------------------------------------------------- Einheiten

export type UState =
  | 'idle' | 'move' | 'attack' | 'flee' | 'retreat' | 'queue' | 'heal' | 'return' | 'dead' | 'burrow' | 'swallowed';

export interface Unit {
  id: number;
  team: Team;
  cid: string;
  cat: UnitCat | 'citizen';
  x: number;
  y: number;
  face: 1 | -1;
  hp: number;
  maxHp: number;
  baseHp: number;
  rank: number;
  xp: number;
  armor: Armor;
  cd: number; // Tick, ab dem der nächste Angriff möglich ist
  tgt: number; // Ziel-Einheit
  tstruct: { kind: 'wall' | 'module' | 'core'; id: number } | null;
  path: number[];
  pi: number;
  repath: number;
  goal: number;
  state: UState;
  st: Status[];
  mods: Mods;
  zone: Zone;
  prio: Priority;
  slot: { mod: number; idx: number; n: number } | null;
  born: number;
  wave: number;
  s: Record<string, number>;
  // Rückzug
  rt: { phase: 'none' | 'go' | 'wait' | 'heal'; src: number; since: number };
  berserk: boolean;
  invisible: boolean;
  flying: boolean;
  ghost: boolean;
  post: number; // Bürger: Modul-ID des Postens
  postIdx: number;
  home: number; // Kontingent-Eintrag
  star: number;
  lastHit: number;
  inCombat: number;
  dead: boolean;
  radius: number;
}

export interface Projectile {
  id: number;
  team: Team;
  kind: Trajectory | 'unit' | 'bolt';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  t1: number;
  src: number;
  cid: string;
  structDmg: number;
  personDmg: number;
  dtype: DType;
  splash: number;
  pierce: number;
  vis: string;
  spec: Record<string, number>;
  /** Flach: bereits berechnetes Treffer-Ziel */
  hit?: { kind: 'wall' | 'module' | 'core'; id: number };
}

export interface Area {
  id: number;
  team: Team; // betroffenes Team (die Gegner des Erzeugers)
  x: number;
  y: number;
  r: number;
  until: number;
  kind: 'cloud' | 'slush' | 'frost' | 'rain' | 'fire' | 'shadow' | 'net';
  dps: number;
  dtype: DType;
  status?: StatusId;
  statusDur?: number;
  src: number;
}

export type SimEvent =
  | { t: 'shot'; x0: number; y0: number; x1: number; y1: number; fly: number; vis: string; team: Team; cid: string }
  | { t: 'impact'; x: number; y: number; r: number; vis: string }
  | { t: 'hit'; x: number; y: number; dmg: number; team: Team }
  | { t: 'death'; x: number; y: number; cid: string; team: Team; cat: string }
  | { t: 'rank'; x: number; y: number; id: number; rank: number; cid: string; team: Team }
  | { t: 'text'; x: number; y: number; text: string; color: string }
  | { t: 'heal'; x: number; y: number }
  | { t: 'break'; x: number; y: number; what: string }
  | { t: 'feed'; msg: string; team: Team | -1 }
  | { t: 'spawn'; x: number; y: number; cid: string }
  | { t: 'fx'; x: number; y: number; name: string };

// ---------------------------------------------------------------- Kontingent

export interface ContingentEntry {
  card: string;
  star: number;
  zone: Zone;
  prio: Priority;
  alive: number[];
}

export interface Player {
  team: Team;
  isBot: boolean;
  hand: string[]; // gezogene Karten dieser Ziehung
  kept: string[]; // behaltene Karten, noch nicht gespielt
  played: string[]; // schon gespielte Karten dieser Pause
  keepCount: number;
  rerolls: number;
  mulligan: number;
  contingent: ContingentEntry[];
  slotsMax: number;
  yardBudget: number;
  moveBudget: number;
  ready: boolean;
  draws: number;
  coreSkillReady: boolean;
  /** Karten, die im Spiel sind (Bau + Truppe), für ★ und "bekannte Gesichter" */
  owned: string[];
  quota: number;
}
