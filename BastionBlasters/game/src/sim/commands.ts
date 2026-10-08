// Befehle der Spieler (Mensch und Bot): Karten spielen, Hof erweitern, Kontingent einstellen

import { type Priority, type Team, type Zone } from './constants';
import {
  checkRoom, checkTower, checkWallCard, checkYardBuilding, findOwnModule, placeGateCard, placeRoom, placeTower, placeWallCard,
  placeYardBuilding, placeYardCell, removeModule, upgradeModule, rebuildWalls,
} from './bastion';
import { BUILDINGS, UNITS, isBuilding } from './data';
import { poolCap, poolOf, poolUsed } from './bfx';
import type { EdgeDir } from './types';
import type { World } from './world';
import { TPS } from './constants';

export type Cmd =
  | { t: 'play'; p: Team; card: string; x?: number; y?: number; rot?: number; edge?: { x: number; y: number; dir: EdgeDir }; replace?: number; upgrade?: boolean }
  | { t: 'yard'; p: Team; x: number; y: number }
  | { t: 'zone'; p: Team; idx: number; zone: Zone }
  | { t: 'prio'; p: Team; idx: number; prio: Priority }
  | { t: 'pickup'; p: Team; moduleId: number }
  | { t: 'rebuild'; p: Team; moduleId: number }
  | { t: 'ready'; p: Team };

export type Res = { ok: true } | { ok: false; reason: string };
const fail = (reason: string): Res => ({ ok: false, reason });

function consume(world: World, p: Team, card: string) {
  const pl = world.players[p];
  const i = pl.kept.indexOf(card);
  if (i >= 0) pl.kept.splice(i, 1);
  pl.played.push(card);
  if (!pl.owned.includes(card)) pl.owned.push(card);
}

/** 3 s Bauzeit nach dem Auftauen, halbe HP; im Erstaufbau sofort fertig */
function buildEnd(world: World): number {
  return world.phase === 'pause' ? world.tick + 3 * TPS : 0;
}
function markBuilding(world: World, m: { buildEnd: number; hp: number; maxHp: number; s: Record<string, number> } | null) {
  if (!m || m.buildEnd <= 0) return;
  m.hp = m.maxHp * 0.5;
  m.s.half = 1;
  void world;
}

export function applyCmd(world: World, c: Cmd): Res {
  world.log.push(c);
  const pl = world.players[c.p];
  if (world.phase !== 'build' && world.phase !== 'pause' && c.t !== 'ready') return fail('Not in a building phase');
  switch (c.t) {
    case 'ready': pl.ready = true; return { ok: true };
    case 'yard': return placeYardCell(world, c.p, c.x, c.y) ? { ok: true } : fail('Cannot place a courtyard cell there');
    case 'zone': { const e = pl.contingent[c.idx]; if (!e) return fail('No such entry'); e.zone = c.zone; return { ok: true }; }
    case 'prio': { const e = pl.contingent[c.idx]; if (!e) return fail('No such entry'); e.prio = c.prio; return { ok: true }; }
    case 'pickup': {
      if (world.phase !== 'pause' && world.phase !== 'build') return fail('Not now');
      if (pl.moveBudget <= 0 && world.phase === 'pause') return fail('You may move only one building per pause');
      const m = world.modules.get(c.moduleId);
      if (!m || m.owner !== c.p) return fail('Not yours');
      if (m.destroyed) return fail('A ruin cannot be picked up: rebuild it for free (time stop) or build over it');
      const card = removeModule(world, c.p, c.moduleId);
      if (!card) return fail(m.kind === 'core' ? 'Cannot pick that up' : 'Other rooms connect through it — pick those up first');
      if (world.phase === 'pause') pl.moveBudget--;
      pl.kept.push(card);
      const i = pl.played.indexOf(card);
      if (i >= 0) pl.played.splice(i, 1);
      return { ok: true };
    }
    case 'rebuild': {
      if (world.phase !== 'pause') return fail('Ruins can be rebuilt during a time stop');
      const m = world.modules.get(c.moduleId);
      if (!m || m.owner !== c.p || !m.destroyed || m.kind === 'core') return fail('That is not a ruin of yours');
      if (pl.rebuilds <= 0) return fail('No free rebuilds left (you get them when you are behind)');
      pl.rebuilds--;
      m.destroyed = false;
      m.burning = 0;
      m.hp = m.maxHp * 0.5;
      m.s.half = 1;
      m.buildEnd = world.tick + 3 * TPS;
      for (const cell of m.cells) world.rubble[cell] = 0;
      rebuildWalls(world, c.p);
      world.feed(`P${c.p + 1} rebuilds ${m.card === 'CORE' ? 'the core' : BUILDINGS[m.card]?.name ?? 'a building'} for free`, c.p);
      return { ok: true };
    }
    case 'play': {
      const card = c.card;
      if (!pl.kept.includes(card)) return fail('Card is not in your hand');
      if (isBuilding(card)) return playBuilding(world, c, card);
      return playTroop(world, c, card);
    }
  }
}

function playBuilding(world: World, c: Extract<Cmd, { t: 'play' }>, card: string): Res {
  const def = BUILDINGS[card];
  const p = c.p;
  if (c.upgrade) {
    const ex = findOwnModule(world, p, card);
    if (!ex) return fail('Nothing to upgrade');
    if (!upgradeModule(world, p, card)) return fail('Already at maximum rank');
    consume(world, p, card);
    return { ok: true };
  }
  const be = buildEnd(world);
  switch (def.kind) {
    case 'room': {
      const r = checkRoom(world, p, card, c.x ?? 0, c.y ?? 0, c.rot ?? 0);
      if (!r.ok) return fail(r.reason);
      const m = placeRoom(world, p, card, c.x!, c.y!, c.rot ?? 0, be);
      markBuilding(world, m);
      break;
    }
    case 'yard': {
      const r = checkYardBuilding(world, p, card, c.x ?? 0, c.y ?? 0, c.rot ?? 0);
      if (!r.ok) return fail(r.reason);
      markBuilding(world, placeYardBuilding(world, p, card, c.x!, c.y!, c.rot ?? 0, be));
      break;
    }
    case 'tower': {
      const r = checkTower(world, p, card, c.x ?? 0, c.y ?? 0);
      if (!r.ok) return fail(r.reason);
      markBuilding(world, placeTower(world, p, card, c.x!, c.y!, be));
      break;
    }
    case 'wall': {
      if (!c.edge) return fail('Click a wall segment');
      const r = checkWallCard(world, p, card, c.edge.x, c.edge.y, c.edge.dir);
      if (!r.ok) return fail(r.reason);
      placeWallCard(world, p, card, c.edge.x, c.edge.y, c.edge.dir);
      break;
    }
    case 'gate': {
      if (!placeGateCard(world, p, card)) return fail('No gate to replace');
      break;
    }
  }
  consume(world, p, card);
  rebuildWalls(world, p);
  return { ok: true };
}

function playTroop(world: World, c: Extract<Cmd, { t: 'play' }>, card: string): Res {
  const p = c.p;
  const pl = world.players[p];
  const def = UNITS[card];
  const pool = poolOf(card);
  pl.slotsMax = poolCap(world, p, 'combat');
  const existing = pl.contingent.findIndex((e) => e.card === card);
  if (existing >= 0) {
    const e = pl.contingent[existing];
    if (e.star >= 3) return fail('Already at maximum rank');
    e.star++;
    consume(world, p, card);
    return { ok: true };
  }
  if (poolUsed(world, p, pool) < poolCap(world, p, pool)) {
    pl.contingent.push({ card, star: 1, zone: def.zone ?? 'middle', prio: defaultPrio(card), alive: [] });
    consume(world, p, card);
    return { ok: true };
  }
  const kind = pool === 'civ' ? 'civilian' : 'combat';
  const target = c.replace === undefined ? undefined : pl.contingent[c.replace];
  if (!target) return fail(`All ${kind} slots are full: choose a ${kind} entry to replace`);
  if (poolOf(target.card) !== pool) return fail(`Choose a ${kind} entry to replace (civilians and combat troops have separate slots)`);
  pl.contingent[c.replace!] = { card, star: 1, zone: def.zone ?? 'middle', prio: defaultPrio(card), alive: [] };
  consume(world, p, card);
  return { ok: true };
}

export function defaultPrio(card: string): Priority {
  const d = UNITS[card];
  if (!d) return 'surgeon';
  return 'surgeon';
}
