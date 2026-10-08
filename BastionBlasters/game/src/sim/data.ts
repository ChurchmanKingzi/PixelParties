import raw from '../data/cards.gen.json';
import type { BuildingDef, UnitDef } from './types';

export const UNITS = raw.units as unknown as Record<string, UnitDef>;
export const BUILDINGS = raw.buildings as unknown as Record<string, BuildingDef>;

export const UNIT_IDS = Object.keys(UNITS);
export const BUILDING_IDS = Object.keys(BUILDINGS);
export const ALL_IDS = [...BUILDING_IDS, ...UNIT_IDS];

export function isBuilding(id: string): boolean {
  return id in BUILDINGS;
}
export function unitDef(id: string): UnitDef {
  const d = UNITS[id];
  if (!d) throw new Error('unknown unit ' + id);
  return d;
}
export function buildingDef(id: string): BuildingDef {
  const d = BUILDINGS[id];
  if (!d) throw new Error('unknown building ' + id);
  return d;
}
export function cardName(id: string): string {
  return (UNITS[id] ?? BUILDINGS[id])?.name ?? id;
}
export function cardTier(id: string): number {
  return (UNITS[id] ?? BUILDINGS[id])?.tier ?? 1;
}

/** Freischalt-Raum je Linie */
export const LINE_ROOM: Record<string, string> = {
  Weapons: 'BF-01', Arcane: 'BF-02', Beast: 'BF-03', Tech: 'BF-04', Crypt: 'BF-05',
  Frost: 'BF-06', Flora: 'BF-07', Air: 'BF-08', Blessing: 'BF-09', Chaos: 'BF-10',
};
export const ROOM_LINE: Record<string, string> = Object.fromEntries(Object.entries(LINE_ROOM).map(([l, r]) => [r, l]));

export function flammable(def: BuildingDef): boolean {
  return /Leicht-Entflammbar/.test(def.tags);
}

/** Karten, die nie gezogen werden (Mauerwerk ist eine Referenzkarte) */
export const NEVER_DRAWN = new Set(['BS-01']);

// Zusatzeinheiten ohne Karte (Beschwörungen); nicht in UNIT_IDS
UNITS['HORNET'] = {
  id: 'HORNET', name: 'Hornet', nameDe: 'Hornisse', cat: 'defender', line: 'Basic', tier: 1, soll: 0, nachschub: 0, hp: 12, armor: 'flesh',
  speed: 2.2, rules: '', talent: '', flavor: '', effectText: '', talentText: '', dmg: 4, dtype: 'W', interval: 0.8, range: 1.1, hits: 1,
  zone: 'gate', structFactor: 0,
};
