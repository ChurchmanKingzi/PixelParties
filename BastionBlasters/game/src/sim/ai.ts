// Verhalten der Einheiten pro Tick: Ziele, Bewegung, Rückzug, Wachzonen, Zivilisten, Bürger

import {
  CHAMBER, DT, GATE_CELL, MAP_W, MAP_H, QUEUE_MAX_S, RETREAT_HP, TPS, type DType, type Team, type Zone,
} from './constants';
import { UNITS } from './data';
import {
  artilleryStep, attackStruct, attackUnit, canHitUnit, enemyVisible, hurtModule, hurtWall, modCenter, wallMid,
} from './combat';
import { unitFx } from './fx';
import { findPath, wallBetween, crossCost, type Box, type NavOpts } from './nav';
import { findHealSource, releaseHeal } from './systems';
import type { Module, Unit, Wall } from './types';
import { K_YARD } from './types';
import {
  addStatus, canCross, cellOf, defOf, gainXp, hasStatus, healUnit, hurt, killUnit, moveBy, removeStatus, speedOf,
} from './units';
import { ci, dist, type World } from './world';

// ------------------------------------------------------------------ Hilfen

const mirrorX = (x: number) => MAP_W - x;

/** Ankerpunkte der Wachzonen (Weltkoordinaten): Tor = Ende des Zufahrtsgangs, Mitte = Gangmitte, Kern = Ostring der Kernkammer */
export function zoneAnchor(team: Team, zone: Zone): { x: number; y: number } {
  const p1 = { gate: { x: 16.5, y: 13.5 }, middle: { x: 12.5, y: 13.5 }, core: { x: 8.5, y: 14.0 } }[zone];
  return team === 0 ? p1 : { x: mirrorX(p1.x), y: p1.y };
}

/** Aufenthaltsort von Bürgern und Zivilisten: Streifen zwischen Kernkammer und Zufahrtsgang im Kernhof */
export function homeAnchor(team: Team): { x: number; y: number } {
  const p1 = { x: 9.5, y: 14.0 };
  return team === 0 ? p1 : { x: mirrorX(p1.x), y: p1.y };
}

/** Zufallsabweichung um einen Anker, aber nur auf begehbaren Zellen der eigenen Bastion (sonst der Anker selbst) */
export function jitterSpot(world: World, team: Team, a: { x: number; y: number }, jx: number, jy: number): { x: number; y: number } {
  for (let k = 0; k < 6; k++) {
    const x = a.x + world.rng.range(-jx, jx), y = a.y + world.rng.range(-jy, jy);
    if (world.isOwned(Math.floor(x), Math.floor(y), team) && !world.solid(Math.floor(x), Math.floor(y))) return { x, y };
  }
  return a;
}

/** Zielpunkt im eigenen Gelände; liegt er außerhalb oder in einer festen Zelle, bleibt der Ersatzpunkt */
export function walkSpot(world: World, team: Team, x: number, y: number, fallback: { x: number; y: number }): { x: number; y: number } {
  const cx = Math.floor(x), cy = Math.floor(y);
  return world.isOwned(cx, cy, team) && !world.solid(cx, cy) ? { x, y } : fallback;
}

export function chamberBox(team: Team): Box {
  const c = CHAMBER[team];
  return { x0: c.x0, y0: c.y0, x1: c.x1 - 1, y1: c.y1 - 1 };
}

export function inChamber(team: Team, x: number, y: number): boolean {
  const c = CHAMBER[team];
  return x >= c.x0 && x < c.x1 && y >= c.y0 && y < c.y1;
}

export function gateInner(team: Team): { x: number; y: number } {
  const g = GATE_CELL[team];
  return { x: g.x + 0.5, y: g.y + 0.5 };
}

function navOpts(world: World, u: Unit): NavOpts {
  const breaker = u.cat === 'assault';
  return { team: u.team, breakWalls: breaker, ghost: u.ghost };
}

function boxOfModule(m: Module, pad = 1): Box {
  return { x0: m.x0 - pad, y0: m.y0 - pad, x1: m.x0 + m.cols - 1 + pad, y1: m.y0 + m.rows - 1 + pad };
}

function goalKey(b: Box): number {
  return ((b.x0 * 64 + b.y0) * 64 + b.x1) * 64 + b.y1;
}

/** Pfad zu einem Zielkasten berechnen (mit Wiederholung in Abständen) */
function pathTo(world: World, u: Unit, goal: Box, every = 24): void {
  const key = goalKey(goal);
  if (u.goal === key && world.tick < u.repath && u.pi < u.path.length) return;
  u.goal = key;
  u.repath = world.tick + every + (u.id % 7);
  const p = findPath(world, u.x, u.y, goal, navOpts(world, u));
  u.path = p ?? [];
  u.pi = 0;
  u.s.noPath = p === null ? 1 : 0;
}

/** Entlang des Pfads bewegen. Liefert true, wenn die Einheit sich bewegen konnte. */
function walk(world: World, u: Unit, speedMul = 1): boolean {
  if (!u.mods.canMove) return false;
  const sp = speedOf(world, u) * speedMul * DT;
  while (u.pi < u.path.length) {
    const c = u.path[u.pi];
    const tx = (c % MAP_W) + 0.5, ty = Math.floor(c / MAP_W) + 0.5;
    const dx = tx - u.x, dy = ty - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.12) { u.pi++; continue; }
    const k = Math.min(1, sp / d);
    const ox = u.x, oy = u.y;
    moveBy(world, u, dx * k, dy * k);
    if (Math.abs(u.x - ox) + Math.abs(u.y - oy) < 1e-5) {
      u.s.stuck = (u.s.stuck ?? 0) + 1;
      if (u.s.stuck > 8) { u.path = []; u.pi = 0; u.repath = 0; u.s.stuck = 0; }
      return false;
    }
    u.s.stuck = 0;
    return true;
  }
  return false;
}

/** Direkt auf einen Punkt zu (Flieger, Geister im Freien) */
function flyTo(world: World, u: Unit, x: number, y: number, speedMul = 1) {
  if (!u.mods.canMove) return;
  const dx = x - u.x, dy = y - u.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.05) return;
  const k = Math.min(1, (speedOf(world, u) * speedMul * DT) / d);
  u.x += dx * k;
  u.y += dy * k;
  if (dx > 0.001) u.face = 1; else if (dx < -0.001) u.face = -1;
}

/** weiche Abstoßung gegen Gedränge */
function separate(world: World, u: Unit) {
  if (u.flying || u.state === 'burrow') return;
  let px = 0, py = 0;
  for (const o of world.near(u.x, u.y, 0.55)) {
    if (o.id === u.id || o.flying !== u.flying || o.state === 'burrow') continue;
    const dx = u.x - o.x, dy = u.y - o.y;
    const d = Math.hypot(dx, dy) || 0.01;
    const k = (0.5 - d) / 0.5;
    if (k <= 0) continue;
    const w = o.cat === 'artillery' || u.cat === 'artillery' ? 0 : k;
    px += (dx / d) * w;
    py += (dy / d) * w;
  }
  if (px || py) moveBy(world, u, px * 0.9 * DT * 1.5, py * 0.9 * DT * 1.5);
}

function inReach(world: World, u: Unit, t: Unit, range: number, melee: boolean): boolean {
  const d = dist(u.x, u.y, t.x, t.y);
  if (d > range + t.radius * 0.3 + 0.15) return false;
  if (melee && !u.flying && !u.ghost && wallBetween(world, u.x, u.y, t.x, t.y, u.team)) return false;
  return true;
}

// ------------------------------------------------------------------ Einstieg

export function unitStep(world: World, u: Unit) {
  if (u.dead) return;
  // Wiederauferstehung
  if (u.state === 'swallowed' && u.s.reviveAt) {
    if (world.tick >= u.s.reviveAt) {
      u.state = 'idle';
      u.s.reviveAt = 0;
      u.hp = Math.max(1, u.maxHp * (u.s.reviveFrac ?? 0.4));
      world.emit({ t: 'fx', x: u.x, y: u.y, name: 'revive' });
    }
    return;
  }
  if (u.state === 'swallowed') {
    if (u.s.spitAt && world.tick >= u.s.spitAt) {
      u.state = 'idle';
      u.s.spitAt = 0;
    }
    return;
  }
  if (u.s.lifeUntil && world.tick >= u.s.lifeUntil) { killUnit(world, u, null); return; }
  statusTick(world, u);
  if (u.dead) return;
  if (u.rank < 2 && u.cat !== 'citizen') gainXp(world, u, 0.4 * DT);
  const fx = unitFx(u.cid);
  if (fx.tick) fx.tick(world, u);
  if (!u.mods.canAct) return;
  if (hasStatus(u, 'feared') && u.cat !== 'artillery') { flee(world, u, u.s.fearX ?? u.x - 1, u.s.fearY ?? u.y); return; }
  if (hasStatus(u, 'confused') && u.cat !== 'artillery') { confusedMove(world, u); return; }
  switch (u.cat) {
    case 'artillery': artilleryStep(world, u); break;
    case 'assault': assaultStep(world, u); break;
    case 'defender': defenderStep(world, u); break;
    case 'civilian': civilianStep(world, u); break;
    case 'citizen': citizenStep(world, u); break;
  }
}

function statusTick(world: World, u: Unit) {
  for (const s of u.st) {
    if (s.id === 'burning') {
      if (world.tick % 10 === 0) hurt(world, u, 1.0, 'F', null, { noXp: true });
      if (hasStatus(u, 'wet')) removeStatus(u, 'burning');
    } else if (s.id === 'poisoned') {
      if (world.tick % 10 === 0) hurt(world, u, 4 / 3, 'G', null, { noXp: true, ignoreArmor: true });
    }
  }
}

function confusedMove(world: World, u: Unit) {
  if (world.tick % 15 === 0) { const a = world.rng.next() * Math.PI * 2; u.s.cdx = Math.cos(a); u.s.cdy = Math.sin(a); }
  moveBy(world, u, (u.s.cdx ?? 0) * speedOf(world, u) * DT, (u.s.cdy ?? 0) * speedOf(world, u) * DT);
}

function flee(world: World, u: Unit, fx: number, fy: number) {
  let dx = u.x - fx, dy = u.y - fy;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;
  moveBy(world, u, dx * speedOf(world, u) * 1.2 * DT, dy * speedOf(world, u) * 1.2 * DT);
}

// ------------------------------------------------------------------ Sturmtruppen

function enemyOf(team: Team): Team { return team === 0 ? 1 : 0; }

function unitWeight(u: Unit, o: Unit, doctrine: string): number {
  let w = 1;
  if (doctrine === 'hunter' || doctrine === 'looter') {
    if (o.cat === 'citizen' || o.cat === 'civilian') w = 0.55;
    else if (o.cat === 'artillery') w = 0.8;
    else if (o.cat === 'defender') w = 1.0;
    else w = 0.9;
  }
  const f = unitFx(o.cid);
  if (f.taunt) w *= 0.3;
  return w;
}

function pickEnemy(world: World, u: Unit, radius: number, doctrine: string): Unit | null {
  let best: Unit | null = null, bs = Infinity;
  const def = defOf(u)!;
  const ranged = (def.range ?? 1.1) > 1.3;
  for (const o of world.near(u.x, u.y, radius, (o) => o.team !== u.team && enemyVisible(o) && canHitUnit(u, o))) {
    if (!ranged && !u.flying && !u.ghost && wallBetween(world, u.x, u.y, o.x, o.y, u.team)) continue;
    let d = dist(u.x, u.y, o.x, o.y) * unitWeight(u, o, doctrine);
    const f = unitFx(o.cid);
    if (f.taunt && dist(u.x, u.y, o.x, o.y) <= f.taunt) d *= 0.2;
    if (d < bs) { bs = d; best = o; }
  }
  return best;
}

function lootModules(world: World, team: Team): Module[] {
  const out: Module[] = [];
  for (const m of world.modules.values()) {
    if (m.owner === team && !m.destroyed && (m.card === 'BC-06' || m.card === 'BC-01' || m.card === 'BW-09')) out.push(m);
  }
  return out;
}

function nearestModule(world: World, u: Unit, owner: Team, pred: (m: Module) => boolean): Module | undefined {
  let best: Module | undefined, bd = Infinity;
  for (const m of world.modules.values()) {
    if (m.owner !== owner || m.destroyed || m.kind === 'core' || !pred(m)) continue;
    const c = modCenter(m);
    const d = dist(u.x, u.y, c.x, c.y);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

function moduleDist(m: Module, x: number, y: number): number {
  let best = Infinity;
  for (const c of m.cells) {
    const cx = c % MAP_W, cy = Math.floor(c / MAP_W);
    const dx = Math.max(cx - x, 0, x - (cx + 1));
    const dy = Math.max(cy - y, 0, y - (cy + 1));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

function wallDist(w: Wall, x: number, y: number): number {
  const mid = wallMid(w);
  return dist(mid.x, mid.y, x, y);
}

export function assaultStep(world: World, u: Unit) {
  const def = defOf(u)!;
  const fx = unitFx(u.cid);
  const enemy = enemyOf(u.team);
  const doctrine = def.doctrine ?? 'hunter';
  // Eingegraben: unter Tage zum Auftauchpunkt
  if (u.state === 'burrow') {
    const bx = u.s.bx, by = u.s.by;
    flyTo(world, u, bx, by, 1.4);
    if (dist(u.x, u.y, bx, by) < 0.3) { u.state = 'idle'; u.flying = false; world.emit({ t: 'fx', x: u.x, y: u.y, name: 'dirt' }); }
    return;
  }
  separate(world, u);
  // Rückzug
  if (retreatLogic(world, u)) return;
  // Zielwahl (gestaffelt)
  if (u.tgt) {
    const t = world.byId.get(u.tgt);
    if (!t || t.dead || !enemyVisible(t) || !canHitUnit(u, t)) u.tgt = 0;
  }
  if (u.tstruct) {
    if (u.tstruct.kind === 'wall') { const w = world.walls.get(u.tstruct.id); if (!w || w.hp <= 0) { u.tstruct = null; u.repath = 0; } }
    else if (u.tstruct.kind === 'module') { const m = world.modules.get(u.tstruct.id); if (!m || m.destroyed) u.tstruct = null; }
  }
  if ((world.tick + u.id) % 8 === 0 || (!u.tgt && !u.tstruct && (world.tick + u.id) % 3 === 0)) retarget(world, u, def, doctrine);

  const melee = (def.range ?? 1.1) <= 1.3;
  const range = def.range ?? 1.1;

  // Sprenger zünden am Ziel
  if (doctrine === 'sprenger' && u.tstruct && u.tstruct.kind === 'module') {
    const m = world.modules.get(u.tstruct.id);
    if (m && moduleDist(m, u.x, u.y) < 1.1) {
      explode(world, u, def, m);
      return;
    }
  }

  if (u.tgt) {
    const t = world.byId.get(u.tgt)!;
    if (inReach(world, u, t, range, melee)) {
      if (world.tick >= u.cd && u.mods.canAttack) attackUnit(world, u, t);
      u.state = 'attack';
      if (!melee && dist(u.x, u.y, t.x, t.y) > range * 0.6) approachUnit(world, u, t);
      return;
    }
    approachUnit(world, u, t);
    return;
  }
  if (u.tstruct) {
    if (attackStructureStep(world, u, def, melee, range)) return;
  }
  // Marsch zum Ziel
  advance(world, u, def, doctrine);
}

function approachUnit(world: World, u: Unit, t: Unit) {
  u.state = 'move';
  if (u.flying) { flyTo(world, u, t.x, t.y); return; }
  const b: Box = { x0: Math.floor(t.x), y0: Math.floor(t.y), x1: Math.floor(t.x), y1: Math.floor(t.y) };
  pathTo(world, u, b, 14);
  if (!walk(world, u) && (u.path.length === 0 || u.pi >= u.path.length)) flyLike(world, u, t.x, t.y);
  checkBlockingWall(world, u);
}

function flyLike(world: World, u: Unit, x: number, y: number) {
  // Notfall: gerade auf das Ziel zu, soweit die Zellen es erlauben
  const dx = x - u.x, dy = y - u.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.05) return;
  const k = Math.min(1, (speedOf(world, u) * DT) / d);
  moveBy(world, u, dx * k, dy * k);
}

/** Ist der nächste Pfadschritt durch eine feindliche Mauer versperrt? Dann wird sie zum Ziel. */
function checkBlockingWall(world: World, u: Unit) {
  if (u.cat !== 'assault' || u.flying || u.ghost) return;
  if (u.pi >= u.path.length) return;
  const c = u.path[u.pi];
  const nx = c % MAP_W, ny = Math.floor(c / MAP_W);
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  if (cx === nx && cy === ny) return;
  // erster Schritt kann diagonal sein: prüfe die beteiligten Kanten
  const edges: (Wall | null)[] = [];
  if (nx !== cx && ny !== cy) {
    edges.push(world.edgeBetween(cx, cy, nx, cy), world.edgeBetween(nx, cy, nx, ny), world.edgeBetween(cx, cy, cx, ny), world.edgeBetween(cx, ny, nx, ny));
  } else edges.push(world.edgeBetween(cx, cy, nx, ny));
  for (const w of edges) {
    if (!w || w.door || w.hp <= 0) continue;
    if (w.gate && w.owner === u.team) continue;
    if (w.owner !== u.team) { u.tstruct = { kind: 'wall', id: w.id }; return; }
  }
}

function attackStructureStep(world: World, u: Unit, def: ReturnType<typeof defOf> & object, melee: boolean, range: number): boolean {
  const ts = u.tstruct!;
  let d: number, x: number, y: number;
  if (ts.kind === 'wall') {
    const w = world.walls.get(ts.id)!;
    const mid = wallMid(w);
    x = mid.x; y = mid.y; d = dist(u.x, u.y, x, y);
    if (d <= Math.max(range, 1.0) + 0.45 || (u.flying && d <= range + 0.5)) {
      if (world.tick >= u.cd && u.mods.canAttack) attackStruct(world, u, ts);
      u.state = 'attack';
      return true;
    }
  } else if (ts.kind === 'module') {
    const m = world.modules.get(ts.id)!;
    const md = moduleDist(m, u.x, u.y);
    const c = modCenter(m);
    x = c.x; y = c.y;
    if (md <= range + 0.2) {
      if (world.tick >= u.cd && u.mods.canAttack) attackStruct(world, u, ts);
      u.state = 'attack';
      return true;
    }
    // zum Bauteil laufen
    u.state = 'move';
    if (u.flying) { flyTo(world, u, x, y); return true; }
    pathTo(world, u, boxOfModule(m, 1), 16);
    walk(world, u);
    checkBlockingWall(world, u);
    return true;
  } else return false;
  // Mauer: vorher noch hinlaufen
  u.state = 'move';
  if (u.flying) { flyTo(world, u, x, y); return true; }
  const b: Box = { x0: Math.floor(x) - 1, y0: Math.floor(y) - 1, x1: Math.floor(x) + 1, y1: Math.floor(y) + 1 };
  pathTo(world, u, b, 16);
  walk(world, u);
  return true;
}

function retarget(world: World, u: Unit, def: NonNullable<ReturnType<typeof defOf>>, doctrine: string) {
  const enemy = enemyOf(u.team);
  const fx = unitFx(u.cid);
  let radius = 7;
  if (doctrine === 'conqueror') radius = 1.8;
  else if (doctrine === 'breaker') radius = 2.5;
  else if (doctrine === 'sprenger') radius = 0;
  else if (doctrine === 'looter') radius = 5;
  if (u.berserk) radius += 2;
  const t = radius > 0 ? pickEnemy(world, u, radius, doctrine) : null;
  if (t) {
    if (u.tgt !== t.id) { u.tgt = t.id; u.path = []; u.repath = 0; }
    u.tstruct = null;
    return;
  }
  u.tgt = 0;
  // Bauteile als Ziel
  if (doctrine === 'sprenger') {
    if (!u.tstruct) {
      let best: Module | undefined, bh = -1;
      for (const m of world.modules.values()) {
        if (m.owner !== enemy || m.destroyed || m.kind === 'core' || m.kind === 'tower' && false) continue;
        if (m.maxHp > bh) { bh = m.maxHp; best = m; }
      }
      if (best) u.tstruct = { kind: 'module', id: best.id };
    }
    return;
  }
  if (doctrine === 'looter' && !u.tstruct) {
    const m = nearestModule(world, u, enemy, (mm) => lootModules(world, enemy).includes(mm));
    if (m && dist(u.x, u.y, modCenter(m).x, modCenter(m).y) < 14) { u.tstruct = { kind: 'module', id: m.id }; return; }
  }
  if (doctrine === 'breaker' || (doctrine === 'hunter' && world.tick % 4 === 0)) {
    // nächstes Bauteil in Reichweite, wenn keine Einheit da ist
    const reach = (def.range ?? 1.1) + 0.6;
    let best: Module | undefined, bd = Infinity;
    for (const m of world.modules.values()) {
      if (m.owner !== enemy || m.destroyed || m.kind === 'core') continue;
      const d = moduleDist(m, u.x, u.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (best && bd <= reach + (doctrine === 'breaker' ? 3 : 0)) {
      if (!u.tstruct || u.tstruct.kind !== 'wall') u.tstruct = { kind: 'module', id: best.id };
      return;
    }
  }
  void fx;
}

function explode(world: World, u: Unit, def: NonNullable<ReturnType<typeof defOf>>, m: Module) {
  const dtype = (def.dtype ?? 'F') as DType;
  const dmg = (def.dmg ?? 60) * u.mods.dmgDealt;
  hurtModule(world, m, dmg * (def.structFactor && def.structFactor > 1 ? def.structFactor : 2), dtype, u);
  for (const o of world.near(u.x, u.y, 1.2, (o) => o.team !== u.team)) hurt(world, o, dmg, dtype, u);
  world.emit({ t: 'impact', x: u.x, y: u.y, r: 1.2, vis: 'fire' });
  killUnit(world, u, null);
}

function advance(world: World, u: Unit, def: NonNullable<ReturnType<typeof defOf>>, doctrine: string) {
  const enemy = enemyOf(u.team);
  u.state = 'move';
  if (u.flying) {
    const c = chamberBox(enemy);
    flyTo(world, u, (c.x0 + c.x1 + 1) / 2 + (u.id % 3) - 1, (c.y0 + c.y1 + 1) / 2, 1);
    return;
  }
  let goal: Box = chamberBox(enemy);
  if (doctrine === 'sprenger' && u.tstruct && u.tstruct.kind === 'module') {
    const m = world.modules.get(u.tstruct.id);
    if (m) goal = boxOfModule(m, 1);
  } else if (u.tstruct && u.tstruct.kind === 'module') {
    const m = world.modules.get(u.tstruct.id);
    if (m) goal = boxOfModule(m, 1);
  }
  pathTo(world, u, goal, 30);
  if (!walk(world, u)) {
    if (u.s.noPath) {
      // kein Weg (alles versperrt): auf die nächste feindliche Mauer losgehen
      const w = nearestWallTo(world, u, enemy);
      if (w) u.tstruct = { kind: 'wall', id: w.id };
    }
  }
  checkBlockingWall(world, u);
}

function nearestWallTo(world: World, u: Unit, owner: Team): Wall | null {
  let best: Wall | null = null, bd = Infinity;
  for (const w of world.walls.values()) {
    if (w.owner !== owner || w.door || w.hp <= 0) continue;
    const d = wallDist(w, u.x, u.y);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

// ------------------------------------------------------------------ Rückzug und Heilung

/** true, wenn die Einheit gerade mit Rückzug oder Heilung beschäftigt ist */
function retreatLogic(world: World, u: Unit): boolean {
  const hpFrac = u.hp / u.maxHp;
  if (u.rt.phase === 'none') {
    if (hpFrac < RETREAT_HP && !u.berserk && world.tick - u.rt.since > TPS * 4) {
      const src = findHealSource(world, u);
      if (src) {
        u.rt = { phase: 'go', src: src.id, since: world.tick };
        u.tgt = 0; u.tstruct = null; u.path = []; u.repath = 0;
        world.stats.retreats[u.team]++;
        u.s.retreatKind = src.kind === 'unit' ? 1 : 0;
      } else {
        u.berserk = true;
        world.emit({ t: 'text', x: u.x, y: u.y - 0.6, text: 'berserk', color: '#ff8a5c' });
      }
    }
    if (u.rt.phase === 'none') return false;
  }
  const src = findSource(world, u);
  if (!src) { // Heilquelle ausgefallen: umdrehen und kämpfen
    releaseHeal(world, u);
    u.rt.phase = 'none';
    u.berserk = true;
    return false;
  }
  if (u.rt.phase === 'go') {
    u.state = 'retreat';
    const d = dist(u.x, u.y, src.x, src.y);
    if (d < 0.9) {
      if (src.take(u)) { u.rt.phase = 'heal'; u.rt.since = world.tick; u.state = 'heal'; }
      else { u.rt.phase = 'wait'; u.rt.since = world.tick; }
      return true;
    }
    if (u.flying) flyTo(world, u, src.x, src.y, 1.3);
    else {
      pathTo(world, u, { x0: Math.floor(src.x), y0: Math.floor(src.y), x1: Math.floor(src.x), y1: Math.floor(src.y) }, 20);
      const ok = walk(world, u, 1.3);
      if (!ok && u.s.noPath) { u.berserk = true; u.rt.phase = 'none'; return false; }
    }
    return true;
  }
  if (u.rt.phase === 'wait') {
    u.state = 'queue';
    if (src.take(u)) { u.rt.phase = 'heal'; u.rt.since = world.tick; u.state = 'heal'; return true; }
    if (world.tick - u.rt.since > QUEUE_MAX_S * TPS) { u.rt.phase = 'none'; u.berserk = true; u.rt.since = world.tick; return false; }
    return true;
  }
  if (u.rt.phase === 'heal') {
    u.state = 'heal';
    if (u.hp >= u.maxHp * 0.9) {
      releaseHeal(world, u);
      u.rt.phase = 'none';
      u.rt.since = world.tick;
      u.state = 'idle';
      return false;
    }
    return true;
  }
  return false;
}

interface SrcPoint { x: number; y: number; take: (u: Unit) => boolean }

function findSource(world: World, u: Unit): SrcPoint | null {
  const id = u.rt.src;
  const m = world.modules.get(id);
  if (m && !m.destroyed) {
    const c = healPoint(world, m);
    return {
      x: c.x, y: c.y,
      take: (x) => {
        const occ = healOccupants(world, m).length;
        const cap = m.s.healSlots ?? 1;
        if (occ < cap || x.rt.phase === 'heal') { x.rt.src = m.id; x.s.healMod = m.id; return true; }
        return false;
      },
    };
  }
  const h = world.byId.get(id);
  if (h && !h.dead && h.team === u.team) {
    return { x: h.x, y: h.y, take: () => true };
  }
  return null;
}

export function healPoint(world: World, m: Module): { x: number; y: number } {
  const door = m.door;
  if (m.kind === 'room' && door) {
    // Behandlungsplatz mitten im Raum
    return { x: m.x0 + m.cols / 2, y: m.y0 + m.rows / 2 };
  }
  return modCenter(m);
}

export function healOccupants(world: World, m: Module): Unit[] {
  const out: Unit[] = [];
  for (const u of world.units) if (!u.dead && u.rt.phase === 'heal' && u.s.healMod === m.id) out.push(u);
  return out;
}

// ------------------------------------------------------------------ Verteidiger

export function defenderStep(world: World, u: Unit) {
  const def = defOf(u)!;
  const fx = unitFx(u.cid);
  separate(world, u);
  const enemy = enemyOf(u.team);
  const anchor = u.s.ax !== undefined ? { x: u.s.ax, y: u.s.ay } : zoneAnchor(u.team, u.zone);
  const jitter = ((u.id * 37) % 11) / 11 - 0.5;
  const spot = walkSpot(world, u.team, anchor.x + jitter * 1.2, anchor.y + (((u.id * 53) % 7) / 7 - 0.5) * 1.6, anchor);
  const ax = spot.x, ay = spot.y;
  let leash = (fx.leash ?? (def.id === 'UV-09' ? 6 : 4));
  leash *= alarmFactor(world, u.team);
  if (fx.stationary) leash = Math.max(leash, 0.5);
  const range = def.range ?? 1.1;
  const melee = range <= 1.3;
  // Ziel wählen
  if (u.tgt) {
    const t = world.byId.get(u.tgt);
    if (!t || t.dead || !enemyVisible(t) || !canHitUnit(u, t) || dist(t.x, t.y, ax, ay) > leash + range + 1.2) u.tgt = 0;
  }
  if (!u.tgt || (world.tick + u.id) % 10 === 0) {
    let best: Unit | null = null, bd = Infinity;
    for (const o of world.near(ax, ay, leash + range + 0.8, (o) => o.team !== u.team && enemyVisible(o) && canHitUnit(u, o))) {
      if (melee && !u.flying && wallBetween(world, u.x, u.y, o.x, o.y, u.team)) continue;
      let d = dist(u.x, u.y, o.x, o.y);
      if (o.rt.phase === 'heal' || o.rt.phase === 'go') d *= 1.2;
      if (d < bd) { bd = d; best = o; }
    }
    // Kontrollzone/Spott: Feinde nahe an einem Spötter ziehen den Blick an
    u.tgt = best ? best.id : 0;
  }
  if (u.tgt) {
    const t = world.byId.get(u.tgt)!;
    if (inReach(world, u, t, range, melee)) {
      if (world.tick >= u.cd && u.mods.canAttack) {
        if (fx.overheat) {
          const on = (u.s.heatStart ??= world.tick);
          if (u.s.cool && world.tick < u.s.cool) { u.state = 'attack'; return; }
          if ((world.tick - on) / TPS > fx.overheat.after) { u.s.cool = world.tick + fx.overheat.pause * TPS; u.s.heatStart = world.tick + fx.overheat.pause * TPS; return; }
        }
        attackUnit(world, u, t);
      }
      u.state = 'attack';
      if (!melee && fx.stationary) return;
      if (!melee && dist(u.x, u.y, t.x, t.y) > range * 0.7 && !fx.stationary) goNear(world, u, t.x, t.y);
      return;
    }
    if (fx.stationary) { u.state = 'idle'; return; }
    goNear(world, u, t.x, t.y);
    return;
  }
  // zurück zum Anker
  if (fx.stationary) { u.state = 'idle'; return; }
  if (dist(u.x, u.y, ax, ay) > 0.7) goNear(world, u, ax, ay);
  else u.state = 'idle';
}

function goNear(world: World, u: Unit, x: number, y: number) {
  u.state = 'move';
  if (u.flying) { flyTo(world, u, x, y); return; }
  const cx = Math.floor(x), cy = Math.floor(y);
  pathTo(world, u, { x0: cx, y0: cy, x1: cx, y1: cy }, 14);
  walk(world, u);
}

function alarmFactor(world: World, team: Team): number {
  // BU-04 Alarmglocke: bei Eindringlingen Leine x2
  for (const m of world.modules.values()) {
    if (m.owner === team && m.card === 'BU-04' && !m.destroyed && m.buildEnd <= world.tick) {
      if (world.tick < (m.s.alarmUntil ?? 0)) return 2;
    }
  }
  return 1;
}

// ------------------------------------------------------------------ Zivilisten und Bürger

function nearestEnemyDist(world: World, u: Unit, r: number): Unit | null {
  let best: Unit | null = null, bd = r;
  for (const o of world.near(u.x, u.y, r, (o) => o.team !== u.team && !o.dead && o.state !== 'burrow' && o.cat !== 'artillery')) {
    const d = dist(u.x, u.y, o.x, o.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function shadowNear(world: World, u: Unit): { x: number; y: number } | null {
  for (const a of world.areas) {
    if (a.kind === 'shadow' && a.team === u.team && a.until > world.tick && dist(a.x, a.y, u.x, u.y) < a.r + 1.4) return a;
  }
  return null;
}

function panicTarget(world: World, team: Team): { x: number; y: number } {
  for (const m of world.modules.values()) {
    if (m.owner === team && m.card === 'BU-05' && !m.destroyed) return modCenter(m);
  }
  const a = homeAnchor(team);
  return { x: a.x - (team === 0 ? 1.2 : -1.2), y: a.y };
}

/** Fliehen vor Gefahr: true, wenn die Einheit flieht */
function panic(world: World, u: Unit): boolean {
  const e = nearestEnemyDist(world, u, 3.6);
  const sh = shadowNear(world, u);
  if (!e && !sh) { u.s.panic = 0; return false; }
  u.s.panic = 1;
  u.state = 'flee';
  const dest = panicTarget(world, u.team);
  const cx = Math.floor(dest.x), cy = Math.floor(dest.y);
  if (sh && !e) {
    flee(world, u, sh.x, sh.y);
    return true;
  }
  pathTo(world, u, { x0: cx, y0: cy, x1: cx, y1: cy }, 20);
  if (!walk(world, u, 1.25) && e) flee(world, u, e.x, e.y);
  return true;
}

export function civilianStep(world: World, u: Unit) {
  separate(world, u);
  const fx = unitFx(u.cid);
  if (u.s.alarmFlee || panic(world, u)) {
    return;
  }
  // Heilerin: schwächsten Freund in Reichweite heilen, ihm hinterherlaufen
  if (fx.heal) {
    let best: Unit | null = null, bf = 0.999;
    for (const o of world.near(u.x, u.y, fx.heal.r + 4, (o) => o.team === u.team && !o.dead && o.id !== u.id && o.cat !== 'citizen' && o.state !== 'swallowed')) {
      const f = o.hp / o.maxHp;
      if (f < bf) { bf = f; best = o; }
    }
    if (best) {
      const d = dist(u.x, u.y, best.x, best.y);
      if (d <= fx.heal.r) {
        u.state = 'attack';
        healUnit(world, best, fx.heal.hps * u.mods.dmgDealt * DT, u);
        if (world.tick % 20 === 0) world.emit({ t: 'heal', x: best.x, y: best.y });
        return;
      }
      goNear(world, u, best.x, best.y);
      return;
    }
  }
  if (fx.repair) {
    const m = repairTarget(world, u, fx.repair.r + 6, fx.repair.rebuild);
    if (m) {
      const md = m.t === 'module' ? moduleDist(m.mod!, u.x, u.y) : wallDist(m.wall!, u.x, u.y);
      if (md <= fx.repair.r) {
        u.state = 'attack';
        repairStep(world, u, m, fx.repair.hps * DT);
        return;
      }
      const c = m.t === 'module' ? modCenter(m.mod!) : wallMid(m.wall!);
      goNear(world, u, c.x + (c.x < u.x ? 1 : -1) * 0.5, c.y);
      return;
    }
  }
  // sonst am Anker herumstehen
  const a = homeAnchor(u.team);
  const sp = walkSpot(world, u.team, a.x + (((u.id * 29) % 13) / 13 - 0.5) * 0.7, a.y + (((u.id * 41) % 9) / 9 - 0.5) * 3.2, a);
  const ax = sp.x, ay = sp.y;
  if (dist(u.x, u.y, ax, ay) > 0.8) goNear(world, u, ax, ay);
  else u.state = 'idle';
}

interface RepairT { t: 'module' | 'wall'; mod?: Module; wall?: Wall }

export function repairTarget(world: World, u: Unit, r: number, rebuild: boolean): RepairT | null {
  let best: RepairT | null = null, bd = Infinity;
  for (const m of world.modules.values()) {
    if (m.owner !== u.team) continue;
    if (m.destroyed && !rebuild) continue;
    if (!m.destroyed && m.hp >= m.maxHp - 0.5) continue;
    const c = modCenter(m);
    const d = dist(u.x, u.y, c.x, c.y);
    if (d < bd && d < r + 8) { bd = d; best = { t: 'module', mod: m }; }
  }
  for (const w of world.walls.values()) {
    if (w.owner !== u.team || w.door) continue;
    if (w.hp >= w.maxHp - 0.5) continue;
    if (w.hp <= 0 && !rebuild) continue;
    const d = wallDist(w, u.x, u.y);
    if (d < bd - 1 && d < r + 8) { bd = d; best = { t: 'wall', wall: w }; }
  }
  return best;
}

export function repairStep(world: World, u: Unit, t: RepairT, amount: number) {
  if (t.t === 'module' && t.mod) {
    const m = t.mod;
    if (m.destroyed) {
      m.s.rebuild = (m.s.rebuild ?? 0) + amount;
      if (m.s.rebuild >= m.maxHp * 0.4) {
        m.destroyed = false;
        m.hp = m.maxHp * 0.4;
        m.s.rebuild = 0;
        for (const c of m.cells) world.rubble[c] = 0;
        world.feed(`${m.card} rebuilt`, m.owner);
      }
      gainXp(world, u, 0.08 * amount);
    } else {
      const real = Math.min(amount, m.maxHp - m.hp);
      m.hp += real;
      gainXp(world, u, 0.08 * real);
    }
  } else if (t.wall) {
    const w = t.wall;
    if (w.hp <= 0) {
      w.s_rebuild = (w.s_rebuild ?? 0) + amount;
      if (w.s_rebuild >= w.maxHp * 0.4) { w.hp = w.maxHp * 0.4; w.s_rebuild = 0; }
    } else {
      const real = Math.min(amount, w.maxHp - w.hp);
      w.hp += real;
      gainXp(world, u, 0.08 * real);
    }
  }
}

declare module './types' {
  interface Wall { s_rebuild?: number }
}

// ---- Bürger

export function postPos(world: World, m: Module, idx: number): { x: number; y: number } {
  const n = m.cells.length;
  if (m.kind === 'tower') {
    // vor dem Turm: Nachbarzelle im Bastion-Inneren
    const cx = m.cells[0] % MAP_W, cy = Math.floor(m.cells[0] / MAP_W);
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (world.isOwned(nx, ny, m.owner) && !world.solid(nx, ny)) return { x: nx + 0.5, y: ny + 0.5 };
    }
    return { x: cx + 0.5, y: cy + 0.5 };
  }
  const c = m.cells[(idx * 2 + 1) % n];
  return { x: (c % MAP_W) + 0.5, y: Math.floor(c / MAP_W) + 0.5 };
}

export function citizenStep(world: World, u: Unit) {
  separate(world, u);
  if (panic(world, u)) return;
  const m = world.modules.get(u.post);
  if (!m || m.destroyed) {
    u.post = 0;
    const a = homeAnchor(u.team);
    const sp = walkSpot(world, u.team, a.x + (((u.id * 29) % 13) / 13 - 0.5) * 0.7, a.y + (((u.id * 41) % 9) / 9 - 0.5) * 3.0, a);
    const ax = sp.x, ay = sp.y;
    if (dist(u.x, u.y, ax, ay) > 0.8) goNear(world, u, ax, ay);
    else u.state = 'idle';
    return;
  }
  const p = postPos(world, m, u.postIdx);
  if (dist(u.x, u.y, p.x, p.y) > 0.45) goNear(world, u, p.x, p.y);
  else u.state = 'idle';
}

export { healOccupants as _ho, K_YARD, ci, addStatus, canCross, cellOf, crossCost, hurtWall, TPS, UNITS };
