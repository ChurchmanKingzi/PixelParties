// Bastion: Kernhof, Module, automatische Mauern auf Zellkanten, Türen, Platzierung und Prüfung

import {
  CHAMBER, CORE_CELLS, CORE_HP, GATE_CELL, GATE_HP, MAP_H, MAP_W, MASONRY_HP, PLOT, YARD_START, type Team,
} from './constants';
import { BUILDINGS, buildingDef } from './data';
import type { BuildingDef, EdgeDir, GunSlot, Module, Wall, WallVariant } from './types';
import { K_CORE, K_EMPTY, K_ROOM, K_TOWER, K_YARD } from './types';
import { ci, inMap, type World } from './world';

export type Check = { ok: true } | { ok: false; reason: string };
const OK: Check = { ok: true };
const no = (reason: string): Check => ({ ok: false, reason });

const DIRS: [number, number, 'N' | 'S' | 'E' | 'W'][] = [[0, 1, 'S'], [1, 0, 'E'], [-1, 0, 'W'], [0, -1, 'N']];

// ------------------------------------------------------------------ Kanten

export function edgeKey(x: number, y: number, dir: EdgeDir): number {
  return (y * MAP_W + x) * 2 + (dir === 'S' ? 1 : 0);
}
/** Kante zwischen zwei Nachbarzellen als (x, y, dir) mit der kleineren Koordinate */
export function edgeOf(ax: number, ay: number, bx: number, by: number): { x: number; y: number; dir: EdgeDir } {
  if (bx !== ax) return { x: Math.min(ax, bx), y: ay, dir: 'E' };
  return { x: ax, y: Math.min(ay, by), dir: 'S' };
}

export function inPlot(p: Team, x: number, y: number): boolean {
  const r = PLOT[p];
  return x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
}

export function footprint(def: BuildingDef, x: number, y: number, rot: number): { cells: [number, number][]; cols: number; rows: number } {
  const cols = rot % 2 ? def.rows : def.cols;
  const rows = rot % 2 ? def.cols : def.rows;
  const cells: [number, number][] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cells.push([x + i, y + j]);
  return { cells, cols, rows };
}

// ------------------------------------------------------------------ Aufbau

function newWall(world: World, p: Team, x: number, y: number, dir: EdgeDir): Wall {
  const w: Wall = {
    id: world.id(), owner: p, x, y, dir, hp: MASONRY_HP, maxHp: MASONRY_HP, material: 'stone', variant: 'stone',
    gate: false, door: false, burning: 0,
  };
  world.walls.set(w.id, w);
  world.setEdge(x, y, dir, w);
  return w;
}

function needsWall(world: World, p: Team, ax: number, ay: number, bx: number, by: number): boolean {
  const aOwn = world.isOwned(ax, ay, p);
  const bOwn = inMap(bx, by) && world.isOwned(bx, by, p);
  if (!aOwn && !bOwn) return false;
  if (aOwn && bOwn) {
    const ai = ci(ax, ay), bi = ci(bx, by);
    const ka = world.kind[ai], kb = world.kind[bi];
    if (ka === K_TOWER || kb === K_TOWER || ka === K_CORE || kb === K_CORE) return false;
    if (ka === K_YARD && kb === K_YARD) return false;
    if (world.mod[ai] === world.mod[bi]) return false;
    return true;
  }
  const k = aOwn ? world.kind[ci(ax, ay)] : world.kind[ci(bx, by)];
  return !(k === K_TOWER || k === K_CORE);
}

/** Mauern, Türen und Tor neu berechnen; bestehende Mauern behalten ihre HP und Varianten */
export function rebuildWalls(world: World, p: Team) {
  const needed = new Map<number, { x: number; y: number; dir: EdgeDir }>();
  const r = PLOT[p];
  for (let y = r.y0 - 1; y <= r.y1; y++) {
    for (let x = r.x0 - 1; x <= r.x1; x++) {
      if (!inMap(x, y)) continue;
      for (const [dx, dy, d] of [[1, 0, 'E'], [0, 1, 'S']] as const) {
        const nx = x + dx, ny = y + dy;
        if (!inMap(nx, ny)) continue;
        if (needsWall(world, p, x, y, nx, ny)) needed.set(edgeKey(x, y, d), { x, y, dir: d });
      }
    }
  }
  // veraltete entfernen (nur Mauern dieses Spielers)
  for (const w of [...world.walls.values()]) {
    if (w.owner !== p) continue;
    if (!needed.has(edgeKey(w.x, w.y, w.dir))) {
      world.walls.delete(w.id);
      world.setEdge(w.x, w.y, w.dir, null);
    } else if (w.door) {
      w.door = false; // Türen werden unten neu gesetzt
      if (w.hp > 1e8) { w.hp = MASONRY_HP; w.maxHp = MASONRY_HP; }
    }
  }
  const g = GATE_CELL[p];
  const gx = g.dir === 'E' ? g.x : g.x - 1; // P1: Kante rechts von (17, y); P2: Kante links von (38, y) = E-Kante bei (37, y)
  const gateK = edgeKey(gx, g.y, 'E');
  for (const [k, e] of needed) {
    let w = world.edgeAt(e.x, e.y, e.dir);
    if (!w) {
      w = newWall(world, p, e.x, e.y, e.dir);
      if (k === gateK) { w.gate = true; w.hp = w.maxHp = GATE_HP; w.material = 'wood'; }
    }
  }
  // Türen: je Raum eine, bevorzugt zum Hof (Süd, Ost, West, Nord)
  for (const m of world.modules.values()) {
    if (m.owner !== p || m.kind !== 'room') continue;
    const door = pickDoor(world, p, m);
    m.door = door;
    if (door) {
      const e = edgeOf(door.x, door.y, door.x + (door.dir === 'E' ? 1 : door.dir === 'W' ? -1 : 0), door.y + (door.dir === 'S' ? 1 : door.dir === 'N' ? -1 : 0));
      const w = world.edgeAt(e.x, e.y, e.dir);
      if (w && !w.gate) { w.door = true; w.hp = w.maxHp = 1e9; }
    }
  }
}

function pickDoor(world: World, p: Team, m: Module): Module['door'] {
  const own = new Set(m.cells);
  for (const [dx, dy, d] of DIRS) {
    const cand: { x: number; y: number; dir: 'N' | 'S' | 'E' | 'W' }[] = [];
    for (const c of m.cells) {
      const x = c % MAP_W, y = Math.floor(c / MAP_W);
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny) || own.has(ci(nx, ny))) continue;
      if (world.isOwned(nx, ny, p) && world.kind[ci(nx, ny)] === K_YARD) cand.push({ x, y, dir: d });
    }
    if (!cand.length) continue;
    if (m.door && m.door.dir === d && cand.some((c) => c.x === m.door!.x && c.y === m.door!.y)) return m.door;
    const cx = m.x0 + m.cols / 2 - 0.5, cy = m.y0 + m.rows / 2 - 0.5;
    cand.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    return cand[0];
  }
  return null;
}

// ------------------------------------------------------------------ Start

export function createBastion(world: World, p: Team) {
  const y = YARD_START[p];
  for (let yy = y.y0; yy < y.y1; yy++) {
    for (let xx = y.x0; xx < y.x1; xx++) {
      const i = ci(xx, yy);
      world.kind[i] = K_YARD;
      world.owner[i] = p;
    }
  }
  const c = CORE_CELLS[p];
  const core: Module = {
    id: world.id(), owner: p, card: 'CORE', kind: 'core', cells: [], x0: c.x0, y0: c.y0, cols: 2, rows: 2,
    hp: CORE_HP, maxHp: CORE_HP, material: 'crystal', destroyed: false, star: 1, buildEnd: 0, posts: 0, staffed: 0, door: null,
    slots: [], burning: 0, frozen: 0, shortCircuit: 0, s: {},
  };
  for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
    const i = ci(c.x0 + xx, c.y0 + yy);
    world.kind[i] = K_CORE;
    world.mod[i] = core.id;
    core.cells.push(i);
  }
  world.modules.set(core.id, core);
  world.coreMod[p] = core.id;
  rebuildWalls(world, p);
}

// ------------------------------------------------------------------ Anbauten prüfen und setzen

function touchesYard(world: World, p: Team, cells: [number, number][]): boolean {
  const own = new Set(cells.map(([x, y]) => ci(x, y)));
  for (const [x, y] of cells) {
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny) || own.has(ci(nx, ny))) continue;
      if (world.isOwned(nx, ny, p) && world.kind[ci(nx, ny)] === K_YARD) return true;
    }
  }
  return false;
}

function touchesBastion(world: World, p: Team, x: number, y: number): boolean {
  for (const [dx, dy] of DIRS) {
    const nx = x + dx, ny = y + dy;
    if (inMap(nx, ny) && world.isOwned(nx, ny, p)) return true;
  }
  return false;
}

function cellFree(world: World, p: Team, x: number, y: number): boolean {
  if (!inPlot(p, x, y)) return false;
  const i = ci(x, y);
  if (world.kind[i] === K_EMPTY) return true;
  const m = world.modules.get(world.mod[i]);
  return !!m && m.destroyed && m.kind !== 'core';
}

export function gateConnected(world: World, p: Team): boolean {
  const g = GATE_CELL[p];
  const sx = g.x, sy = g.y;
  if (!world.isOwned(sx, sy, p) || world.solid(sx, sy)) return false;
  const seen = new Set<number>([ci(sx, sy)]);
  const q: number[][] = [[sx, sy]];
  const ch = CHAMBER[p];
  while (q.length) {
    const [x, y] = q.pop()!;
    if (x >= ch.x0 && x < ch.x1 && y >= ch.y0 && y < ch.y1) return true;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny) || !world.isOwned(nx, ny, p) || world.solid(nx, ny) || seen.has(ci(nx, ny))) continue;
      const w = world.edgeBetween(x, y, nx, ny);
      if (w && !w.door && !w.gate && w.hp > 0) continue;
      seen.add(ci(nx, ny));
      q.push([nx, ny]);
    }
  }
  return false;
}

export function checkRoom(world: World, p: Team, card: string, x: number, y: number, rot: number): Check {
  const def = buildingDef(card);
  if (def.kind !== 'room') return no('Not a room card');
  const fp = footprint(def, x, y, rot);
  for (const [cx, cy] of fp.cells) {
    if (!inPlot(p, cx, cy)) return no('Outside your building plot');
    if (!cellFree(world, p, cx, cy)) return no('Cells are occupied');
  }
  if (!touchesYard(world, p, fp.cells)) return no('A room must touch the courtyard');
  return OK;
}

export function checkYardBuilding(world: World, p: Team, card: string, x: number, y: number, rot: number): Check {
  const def = buildingDef(card);
  if (def.kind !== 'yard') return no('Not a courtyard building');
  const fp = footprint(def, x, y, rot);
  for (const [cx, cy] of fp.cells) {
    if (!inPlot(p, cx, cy) || !world.isOwned(cx, cy, p)) return no('Needs courtyard cells');
    const i = ci(cx, cy);
    if (world.kind[i] !== K_YARD) return no('Needs courtyard cells');
    const m = world.modules.get(world.mod[i]);
    if (m && !m.destroyed) return no('Cells are occupied');
  }
  return OK;
}

export function checkTower(world: World, p: Team, card: string, x: number, y: number): Check {
  const def = buildingDef(card);
  if (def.kind !== 'tower') return no('Not a tower card');
  if (!inPlot(p, x, y)) return no('Outside your building plot');
  const i = ci(x, y);
  if (world.kind[i] === K_EMPTY || (world.modules.get(world.mod[i])?.destroyed && world.kind[i] !== K_CORE)) {
    if (!touchesBastion(world, p, x, y)) return no('Must touch the bastion');
    return OK;
  }
  if (world.kind[i] === K_YARD && !world.mod[i]) {
    const g = GATE_CELL[p];
    if (x === g.x && y === g.y) return no('Do not block the gate');
    // Verbindung Tor -> Kernkammer darf nicht abreißen
    const saved = world.kind[i];
    world.kind[i] = K_TOWER;
    const mid = world.mod[i];
    world.mod[i] = -1; // nicht zerstört => massiv
    const okc = gateConnected(world, p);
    world.kind[i] = saved;
    world.mod[i] = mid;
    return okc ? OK : no('Would block the path from the gate to the core');
  }
  return no('Cells are occupied');
}

function slotsFor(def: BuildingDef, cells: [number, number][], air: boolean): GunSlot[] {
  const n = def.gunSlots + (def.id === 'BF-04' ? 1 : 0) + (def.id === 'BF-08' ? 1 : 0);
  const out: GunSlot[] = [];
  if (n <= 0) return out;
  for (let k = 0; k < n; k++) {
    const idx = Math.min(cells.length - 1, Math.floor(((k + 0.5) * cells.length) / n));
    const [cx, cy] = cells[idx];
    out.push({ x: cx + 0.5, y: cy + 0.5, unit: 0, air: def.id === 'BF-08' && k === n - 1 });
  }
  void air;
  return out;
}

function removeDestroyedAt(world: World, cells: [number, number][]) {
  const ids = new Set<number>();
  for (const [x, y] of cells) {
    const id = world.mod[ci(x, y)];
    const m = id ? world.modules.get(id) : undefined;
    if (m && m.destroyed && m.kind !== 'core') ids.add(id);
  }
  for (const id of ids) removeModuleCells(world, id);
}

function removeModuleCells(world: World, id: number) {
  const m = world.modules.get(id);
  if (!m) return;
  for (const c of m.cells) {
    world.mod[c] = 0;
    world.rubble[c] = 0;
    world.kind[c] = m.kind === 'yard' ? K_YARD : K_EMPTY;
    if (m.kind !== 'yard') world.owner[c] = -1;
  }
  world.modules.delete(id);
}

function addModule(world: World, p: Team, def: BuildingDef, fp: ReturnType<typeof footprint>, x: number, y: number, kind: Module['kind'], cellKind: number, star: number): Module {
  const m: Module = {
    id: world.id(), owner: p, card: def.id, kind, cells: [], x0: x, y0: y, cols: fp.cols, rows: fp.rows,
    hp: def.hp, maxHp: def.hp, material: def.material, destroyed: false, star, buildEnd: 0, posts: def.posts, staffed: 0, door: null,
    slots: [], burning: 0, frozen: 0, shortCircuit: 0, s: {},
  };
  for (const [cx, cy] of fp.cells) {
    const i = ci(cx, cy);
    world.kind[i] = cellKind;
    world.owner[i] = p;
    world.mod[i] = m.id;
    world.rubble[i] = 0;
    m.cells.push(i);
  }
  m.slots = slotsFor(def, fp.cells, false);
  world.modules.set(m.id, m);
  return m;
}

export function placeRoom(world: World, p: Team, card: string, x: number, y: number, rot: number, buildEnd = 0): Module | null {
  if (!checkRoom(world, p, card, x, y, rot).ok) return null;
  const def = buildingDef(card);
  const fp = footprint(def, x, y, rot);
  removeDestroyedAt(world, fp.cells);
  const m = addModule(world, p, def, fp, x, y, 'room', K_ROOM, 1);
  m.buildEnd = buildEnd;
  rebuildWalls(world, p);
  return m;
}

export function placeYardBuilding(world: World, p: Team, card: string, x: number, y: number, rot: number, buildEnd = 0): Module | null {
  if (!checkYardBuilding(world, p, card, x, y, rot).ok) return null;
  const def = buildingDef(card);
  const fp = footprint(def, x, y, rot);
  removeDestroyedAt(world, fp.cells);
  const m = addModule(world, p, def, fp, x, y, 'yard', K_YARD, 1);
  m.buildEnd = buildEnd;
  return m;
}

export function placeTower(world: World, p: Team, card: string, x: number, y: number, buildEnd = 0): Module | null {
  if (!checkTower(world, p, card, x, y).ok) return null;
  const def = buildingDef(card);
  const fp = footprint(def, x, y, 0);
  removeDestroyedAt(world, fp.cells);
  const m = addModule(world, p, def, fp, x, y, 'tower', K_TOWER, 1);
  m.buildEnd = buildEnd;
  rebuildWalls(world, p);
  return m;
}

export function checkYardCell(world: World, p: Team, x: number, y: number): Check {
  if (!inPlot(p, x, y)) return no('Outside your building plot');
  if (!cellFree(world, p, x, y)) return no('Cells are occupied');
  let adj = false;
  for (const [dx, dy] of DIRS) {
    const nx = x + dx, ny = y + dy;
    if (inMap(nx, ny) && world.isOwned(nx, ny, p) && world.kind[ci(nx, ny)] === K_YARD) adj = true;
  }
  if (!adj) return no('Courtyard must be connected');
  if (world.players[p].yardBudget <= 0) return no('No courtyard cells left this phase');
  return OK;
}

export function placeYardCell(world: World, p: Team, x: number, y: number): boolean {
  if (!checkYardCell(world, p, x, y).ok) return false;
  removeDestroyedAt(world, [[x, y]]);
  const i = ci(x, y);
  world.kind[i] = K_YARD;
  world.owner[i] = p;
  world.mod[i] = 0;
  world.rubble[i] = 0;
  world.players[p].yardBudget--;
  rebuildWalls(world, p);
  return true;
}

// ------------------------------------------------------------------ Wandkarten und Tor

/** bis zu 4 zusammenhängende Mauersegmente, die die angeklickte Kante enthalten */
export function wallRun(world: World, p: Team, x: number, y: number, dir: EdgeDir): Wall[] {
  const w0 = world.edgeAt(x, y, dir);
  if (!w0 || w0.owner !== p || w0.door || w0.gate) return [];
  const run = [w0];
  const step = dir === 'E' ? [0, 1] : [1, 0];
  let a = 1, b = 1;
  while (run.length < 4) {
    let added = false;
    for (const sgn of [1, -1]) {
      if (run.length >= 4) break;
      const k = sgn === 1 ? a : b;
      const w = world.edgeAt(x + step[0] * sgn * k, y + step[1] * sgn * k, dir);
      if (w && w.owner === p && !w.door && !w.gate && !run.includes(w)) {
        run.push(w);
        if (sgn === 1) a++; else b++;
        added = true;
      } else if (sgn === 1) a = 99; else b = 99;
    }
    if (!added) break;
  }
  return run;
}

export function isOuterWall(world: World, w: Wall): boolean {
  const ax = w.x, ay = w.y;
  const bx = w.dir === 'E' ? w.x + 1 : w.x, by = w.dir === 'S' ? w.y + 1 : w.y;
  return !(world.isOwned(ax, ay, w.owner) && world.isOwned(bx, by, w.owner));
}

const WALL_VARIANT: Record<string, WallVariant> = { 'BS-02': 'pudding', 'BS-03': 'armor', 'BS-04': 'ward' };

export function checkWallCard(world: World, p: Team, card: string, x: number, y: number, dir: EdgeDir): Check {
  if (!(card in WALL_VARIANT)) return no('Not a wall card');
  const run = wallRun(world, p, x, y, dir);
  if (!run.length) return no('Click a wall segment');
  if ((card === 'BS-03' || card === 'BS-04') && !isOuterWall(world, run[0])) return no('Only for outer walls');
  return OK;
}

export function placeWallCard(world: World, p: Team, card: string, x: number, y: number, dir: EdgeDir): Wall[] {
  if (!checkWallCard(world, p, card, x, y, dir).ok) return [];
  const def = buildingDef(card);
  const run = wallRun(world, p, x, y, dir);
  for (const w of run) {
    const frac = w.maxHp > 0 ? Math.max(0.3, w.hp / w.maxHp) : 0.4;
    w.variant = WALL_VARIANT[card];
    w.material = def.material;
    w.maxHp = def.hp;
    w.hp = def.hp * Math.min(1, frac + 0.4);
  }
  return run;
}

export function placeGateCard(world: World, p: Team, card: string): boolean {
  const g = GATE_CELL[p];
  const gx = g.dir === 'E' ? g.x : g.x - 1;
  const w = world.edgeAt(gx, g.y, 'E');
  if (!w || !w.gate) return false;
  const def = buildingDef(card);
  w.material = def.material;
  w.maxHp = def.hp;
  w.hp = def.hp;
  w.portcullis = true;
  return true;
}

// ------------------------------------------------------------------ Aufwertung und Umbau

export function starScale(star: number): number {
  return star >= 3 ? 2 : star === 2 ? 1.5 : 1;
}
export function effScale(star: number): number {
  return star >= 3 ? 1.8 : star === 2 ? 1.4 : 1;
}

export function findOwnModule(world: World, p: Team, card: string): Module | undefined {
  for (const m of world.modules.values()) if (m.owner === p && m.card === card && !m.destroyed) return m;
  return undefined;
}

export function upgradeModule(world: World, p: Team, card: string): boolean {
  const m = findOwnModule(world, p, card);
  if (!m || m.star >= 3) return false;
  const def = BUILDINGS[card];
  const before = starScale(m.star);
  m.star++;
  const after = starScale(m.star);
  m.maxHp = Math.round(def.hp * after);
  m.hp = Math.min(m.maxHp, m.hp + def.hp * (after - before));
  return true;
}

/** Bauteil aufnehmen (Umbau); die Karte ist danach wieder spielbar */
export function removeModule(world: World, p: Team, id: number): string | null {
  const m = world.modules.get(id);
  if (!m || m.owner !== p || m.kind === 'core') return null;
  const card = m.card;
  removeModuleCells(world, id);
  rebuildWalls(world, p);
  return card;
}

/** Zerstörung: Trümmerfeld; Geschützplätze verfallen */
export function destroyModule(world: World, m: Module) {
  if (m.destroyed) return;
  m.destroyed = true;
  m.hp = 0;
  for (const c of m.cells) world.rubble[c] = 1;
  world.stats.modulesLost[m.owner]++;
  for (const s of m.slots) {
    if (s.unit) {
      const u = world.byId.get(s.unit);
      if (u) u.hp = 0;
      s.unit = 0;
    }
  }
}

export function bastionBounds(world: World, p: Team) {
  void world;
  return PLOT[p];
}
export { MAP_H };
