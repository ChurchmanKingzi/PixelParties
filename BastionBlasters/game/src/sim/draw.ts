// Karten ziehen: Loadout (10 ziehen, 7 behalten) und frische Hand je Zeitstopp (5 ziehen, 3 behalten)

import { tierWeights, type Team } from './constants';
import { BUILDINGS, NEVER_DRAWN, UNITS, LINE_ROOM, isBuilding } from './data';
import { buildingImpl } from './impl';
import { aidOf } from './catchup';
import type { World } from './world';

const BY_TIER: string[][] = [[], [], [], []];
for (const id of [...Object.keys(BUILDINGS), ...Object.keys(UNITS)]) {
  if (NEVER_DRAWN.has(id) || id === 'HORNET') continue;
  const t = (UNITS[id] ?? BUILDINGS[id]).tier;
  BY_TIER[Math.max(0, Math.min(3, t - 1))].push(id);
}

function hasRoom(world: World, team: Team, room: string): boolean {
  for (const m of world.modules.values()) if (m.owner === team && m.card === room && !m.destroyed) return true;
  return false;
}

function lineFactor(world: World, team: Team, id: string, extraRooms: string[] = []): number {
  const u = UNITS[id];
  if (!u || u.line === 'Basic') return 1;
  const room = LINE_ROOM[u.line];
  if (!room) return 1;
  return hasRoom(world, team, room) || extraRooms.includes(room) ? 2 : 0.5;
}

function pickOne(world: World, team: Team, drawIdx: number, forced?: (id: string) => boolean): string {
  const p = world.players[team];
  if (!forced && p.owned.length && world.rng.chance(0.2)) return world.rng.pick(p.owned); // "Bekannte Gesichter"
  const tw = tierWeights(drawIdx);
  for (let tries = 0; tries < 50; tries++) {
    const tier = world.rng.weighted([0, 1, 2, 3], (i) => tw[i]) ?? 0;
    const pool = forced ? BY_TIER[tier].filter(forced) : BY_TIER[tier];
    if (!pool.length) continue;
    const id = world.rng.weighted(pool, (c) => lineFactor(world, team, c));
    if (id) return id;
  }
  const all = BY_TIER.flat().filter(forced ?? (() => true));
  return world.rng.pick(all);
}

const isHealBuilding = (id: string) => BUILDINGS[id]?.group === 'Healing';
const isPlatform = (id: string) => BUILDINGS[id]?.group === 'Platforms' && (BUILDINGS[id].gunSlots > 0);

function loadoutOk(world: World, team: Team, hand: string[]): boolean {
  const b = hand.filter(isBuilding);
  if (b.length < 3) return false;
  if (!hand.some(isHealBuilding) || !hand.some(isPlatform)) return false;
  for (const cat of ['artillery', 'assault', 'defender', 'civilian']) if (!hand.some((id) => UNITS[id]?.cat === cat)) return false;
  const rooms = hand.filter((id) => id.startsWith('BF-'));
  for (const id of hand) {
    const u = UNITS[id];
    if (!u || u.line === 'Basic') continue;
    const room = LINE_ROOM[u.line];
    if (room && !rooms.includes(room)) return false;
  }
  void world; void team;
  return true;
}

export function drawLoadout(world: World, team: Team): string[] {
  for (let tries = 0; tries < 400; tries++) {
    const hand: string[] = [];
    for (let i = 0; i < 10; i++) hand.push(pickOne(world, team, 0));
    if (loadoutOk(world, team, hand)) return hand;
  }
  // Fallback: Pflichtkarten setzen
  const hand: string[] = [];
  const need: ((id: string) => boolean)[] = [isHealBuilding, isPlatform, (id) => UNITS[id]?.cat === 'artillery' && UNITS[id].line === 'Basic',
    (id) => UNITS[id]?.cat === 'assault' && UNITS[id].line === 'Basic', (id) => UNITS[id]?.cat === 'defender' && UNITS[id].line === 'Basic',
    (id) => UNITS[id]?.cat === 'civilian' && UNITS[id].line === 'Basic'];
  for (const f of need) hand.push(pickOne(world, team, 0, f));
  while (hand.length < 10) hand.push(pickOne(world, team, 0, (id) => isBuilding(id) || UNITS[id].line === 'Basic'));
  return hand;
}

/** Frische Hand für den Zeitstopp: mindestens 1 Bau-Karte und 1 Truppe */
export function drawPause(world: World, team: Team, n = 5): string[] {
  const idx = world.pauseNo + aidOf(world, team).tier; // Rückstand: Ziehgewichte, als wäre das Spiel weiter
  const hand: string[] = [];
  for (let i = 0; i < n; i++) hand.push(pickOne(world, team, idx));
  if (!hand.some(isBuilding)) hand[n - 1] = pickOne(world, team, idx, isBuilding);
  if (!hand.some((id) => !isBuilding(id))) hand[0] = pickOne(world, team, idx, (id) => !isBuilding(id));
  return hand;
}

// ------------------------------------------------------------------ Fundament

/** Kostenlose Zusatzkarten zum Start: viel Baumaterial für Räume, Fallen und Türme, damit ein echtes Labyrinth entsteht */
export const FOUNDATION = { rooms: 7, traps: 2, towers: 2, free: 1 };
const TRAP_IDS = ['BS-05', 'BS-06', 'BS-08', 'BA-03'];

/** Zusatzkarten für den Erstaufbau (nur Bauteile, Tier I und II, ohne doppelte Karten und ohne Karten der Loadout-Hand) */
export function drawFoundation(world: World, team: Team, taken: string[]): string[] {
  const out: string[] = [];
  const used = new Set<string>(taken);
  const usable = (id: string) => !used.has(id) && buildingImpl(id) !== 'stats';
  const pool = (pred: (id: string) => boolean) => BY_TIER.flat().filter((id) => isBuilding(id) && BUILDINGS[id].tier <= 2 && usable(id) && pred(id));
  const pickFrom = (ids: string[]): void => {
    if (!ids.length) return;
    const id = world.rng.weighted(ids, (c) => 1 + (BUILDINGS[c].tier === 1 ? 0.5 : 0)) ?? ids[0];
    out.push(id);
    used.add(id);
  };
  void team;
  for (let i = 0; i < FOUNDATION.traps; i++) pickFrom(pool((id) => TRAP_IDS.includes(id)));
  for (let i = 0; i < FOUNDATION.towers; i++) pickFrom(pool((id) => BUILDINGS[id].kind === 'tower' && BUILDINGS[id].group === 'Turrets'));
  for (let i = 0; i < FOUNDATION.rooms; i++) pickFrom(pool((id) => BUILDINGS[id].kind === 'room'));
  for (let i = 0; i < FOUNDATION.free; i++) pickFrom(pool((id) => ['room', 'yard', 'tower'].includes(BUILDINGS[id].kind)));
  return out;
}
