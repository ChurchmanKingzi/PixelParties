// Konstanten und Tabellen der Simulation (alle Werte sind Startwerte zum Tunen, GDD "⚙")

export const CELL = 32;
export const MAP_W = 56;
export const MAP_H = 28;
export const TPS = 30;
export const DT = 1 / TPS;

export type Team = 0 | 1;

/** Baugrund je Spieler: [x0, x1) x [y0, y1) in Zellen */
export const PLOT = [
  { x0: 2, y0: 6, x1: 18, y1: 22 },
  { x0: 38, y0: 6, x1: 54, y1: 22 },
] as const;

/**
 * Layout je Bastion (Spieler 1 links, Spieler 2 gespiegelt):
 * Kernhof 6 x 6 hinten im Baugrund, davon geht ein Zufahrtsgang (1 Zelle breit) nach vorn bis zum Haupttor.
 * Vor und neben dem Kernhof ist viel freier Baugrund für Räume, Türme und Hof-Erweiterungen (Labyrinthe).
 */
export const YARD_START = [
  { x0: 4, y0: 11, x1: 10, y1: 17 },
  { x0: 46, y0: 11, x1: 52, y1: 17 },
] as const;
export const CORE_CELLS = [
  { x0: 6, y0: 13 },
  { x0: 48, y0: 13 },
] as const;
/** Kernkammer = Kern + Ring von einer Zelle (4 x 4) */
export const CHAMBER = [
  { x0: 5, y0: 12, x1: 9, y1: 16 },
  { x0: 47, y0: 12, x1: 51, y1: 16 },
] as const;
/** Haupttor: Kante rechts (P1) bzw. links (P2) von der Zelle (x, y) */
export const GATE_CELL = [
  { x: 17, y: 13, dir: 'E' as const },
  { x: 38, y: 13, dir: 'W' as const },
] as const;
/** Zufahrtsgang vom Kernhof zum Tor: Zeile y, Zellen von x0 bis x1 (einschließlich) */
export const APPROACH = [
  { y: 13, x0: 10, x1: 17 },
  { y: 13, x0: 38, x1: 45 },
] as const;

export const CORE_HP = 5000;
export const CORE_REGEN = 2;
export const MASONRY_HP = 300;
export const GATE_HP = 500;
export const CITIZEN_HP = 25;
export const CITIZEN_START = 4;
export const CITIZEN_LIMIT_BASE = 4;
export const CITIZEN_LIMIT_PER_HOME = 3;
export const CITIZEN_REGEN_S = 5;

export const WAVE_GAP_S = 40;
/** Wellen je Kampfabschnitt: 2 vor dem ersten Zeitstopp, danach jedes Mal eine mehr (die Abschnitte werden immer länger) */
export const SEGMENT_WAVES_BASE = 2;
export const SEGMENT_WAVES_STEP = 1;
export const SEGMENT_WAVES_MAX = 9;
export function wavesPerSegment(pauseNo: number): number {
  return Math.min(SEGMENT_WAVES_MAX, SEGMENT_WAVES_BASE + SEGMENT_WAVES_STEP * Math.max(0, pauseNo));
}
export const SPAWN_STAGGER_S = 0.4;
export const UNIT_LIMIT = 40;
export const BUILD_TIME_S = 120;
export const PAUSE_TIME_S = 25;
export const YARD_START_CELLS = 16;
export const YARD_PER_PAUSE = 6;

export const RETREAT_HP = 0.5;
export const HEAL_TO_HP = 0.9;
export const QUEUE_MAX_S = 6;
export const BERSERK_DMG = 1.15;

/** Eroberung der Kernkammer: je Eindringling in der Kammer (höchstens 6) so viele Prozent pro Sekunde; ohne Eindringlinge verfällt sie */
export const CONQUEST_PER_UNIT = 1.5;
export const CONQUEST_MAX_UNITS = 6;
export const CONQUEST_DECAY = 3;

export const MADNESS_START_S = 11 * 60;
export const MADNESS_END_S = 16 * 60;

export type DType = 'W' | 'F' | 'E' | 'B' | 'G' | 'A';
export type Armor = 'flesh' | 'plate' | 'spirit' | 'bone' | 'pudding';
export type Material = 'wood' | 'stone' | 'metal' | 'crystal' | 'organic' | 'pudding' | 'ice';

/** Schaden gegen Bauteil-Material (GDD 7.3) */
export const MAT_MULT: Record<DType, Record<Material, number>> = {
  W: { wood: 1.0, stone: 0.9, metal: 0.8, crystal: 1.2, organic: 1.0, pudding: 0.5, ice: 1.1 },
  F: { wood: 1.5, stone: 0.7, metal: 0.9, crystal: 0.8, organic: 1.5, pudding: 1.3, ice: 1.8 },
  E: { wood: 0.9, stone: 1.1, metal: 1.2, crystal: 0.9, organic: 1.0, pudding: 0.8, ice: 0.3 },
  B: { wood: 1.0, stone: 0.8, metal: 1.5, crystal: 1.0, organic: 0.7, pudding: 0.6, ice: 0.9 },
  G: { wood: 0.6, stone: 0.9, metal: 1.4, crystal: 0.7, organic: 1.6, pudding: 1.0, ice: 0.7 },
  A: { wood: 1.0, stone: 1.0, metal: 0.9, crystal: 0.6, organic: 1.0, pudding: 1.0, ice: 1.0 },
};

/** Schaden gegen Rüstungsklasse der Einheiten (GDD 7.3) */
export const ARMOR_MULT: Record<DType, Record<Armor, number>> = {
  W: { flesh: 1.0, plate: 0.7, spirit: 0.4, bone: 1.2, pudding: 0.6 },
  F: { flesh: 1.0, plate: 0.9, spirit: 0.8, bone: 0.9, pudding: 1.4 },
  E: { flesh: 1.0, plate: 1.0, spirit: 0.8, bone: 0.8, pudding: 1.2 },
  B: { flesh: 1.0, plate: 1.3, spirit: 0.8, bone: 0.7, pudding: 1.0 },
  G: { flesh: 1.2, plate: 0.5, spirit: 0.0, bone: 0.0, pudding: 0.8 },
  A: { flesh: 1.0, plate: 1.0, spirit: 1.4, bone: 1.2, pudding: 1.0 },
};

export const RANK_XP = [0, 50, 140, 300, 540, 900];
export const RANK_NAMES = ['Recruit', 'Private', 'Veteran', 'Elite', 'Hero', 'Legend'];

/** Gewichte je Tier (I..IV) für Ziehungen */
export function tierWeights(draw: number): [number, number, number, number] {
  // draw 0 = Loadout, 1.. = Pause
  if (draw <= 0) return [70, 30, 0, 0];
  if (draw <= 2) return [40, 50, 10, 0];
  if (draw <= 4) return [15, 50, 30, 5];
  if (draw <= 6) return [5, 35, 50, 10];
  return [0, 20, 55, 25];
}

export const ZONES = ['gate', 'middle', 'core'] as const;
export type Zone = (typeof ZONES)[number];
export const PRIORITIES = ['surgeon', 'breaker', 'coreHunt', 'weaponHunter', 'scatterer'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  surgeon: 'Surgeon',
  breaker: 'Breaker',
  coreHunt: 'Core Hunt',
  weaponHunter: 'Weapon Hunter',
  scatterer: 'Scatterer',
};
export const ZONE_LABEL: Record<Zone, string> = { gate: 'Gate', middle: 'Middle', core: 'Core Chamber' };

export const STATUS_DEFAULT_S: Record<string, number> = {
  burning: 5, chilled: 4, frozen: 3, slimed: 4, poisoned: 6, stunned: 2, confused: 3, feared: 3, rooted: 2,
  frogged: 4, dancing: 2, blinded: 8, blessed: 15, fed: 40, spurred: 40, wet: 20, marked: 8, floating: 3,
};
