// Bastion: Kernhof, Module, automatische Mauern auf Zellkanten, Türen, Platzierung und Prüfung

import {
  APPROACH, CHAMBER, CORE_CELLS, CORE_HP, GATE_CELL, GATE_HP, MAP_H, MAP_W, MASONRY_HP, PLOT, YARD_START, type Team,
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
  // Türen: je Raum eine, bevorzugt zum Hof, sonst zu einem schon angeschlossenen Nachbarraum (Süd, Ost, West, Nord)
  const doors = computeDoors(world, p);
  for (const m of world.modules.values()) {
    if (m.owner !== p || m.kind !== 'room') continue;
    const door = doors.get(m.id) ?? null;
    m.door = door;
    if (door) {
      const e = edgeOf(door.x, door.y, door.x + (door.dir === 'E' ? 1 : door.dir === 'W' ? -1 : 0), door.y + (door.dir === 'S' ? 1 : door.dir === 'N' ? -1 : 0));
      const w = world.edgeAt(e.x, e.y, e.dir);
      if (w && !w.gate) { w.door = true; w.hp = w.maxHp = 1e9; }
    }
  }
}

type Door = NonNullable<Module['door']>;

/** Tür eines Raums zu einer Nachbarzelle, die `accept` annimmt; eine noch gültige bisherige Tür bleibt erhalten */
function pickDoor(world: World, m: Module, accept: (x: number, y: number) => boolean): Door | null {
  const own = new Set(m.cells);
  for (const [dx, dy, d] of DIRS) {
    const cand: Door[] = [];
    for (const c of m.cells) {
      const x = c % MAP_W, y = Math.floor(c / MAP_W);
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny) || own.has(ci(nx, ny))) continue;
      if (accept(nx, ny)) cand.push({ x, y, dir: d });
    }
    if (!cand.length) continue;
    if (m.door && m.door.dir === d && cand.some((c) => c.x === m.door!.x && c.y === m.door!.y)) return m.door;
    const cx = m.x0 + m.cols / 2 - 0.5, cy = m.y0 + m.rows / 2 - 0.5;
    cand.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    return cand[0];
  }
  return null;
}

/**
 * Türen aller Räume eines Spielers. Räume am Hof öffnen sich zum Hof, weitere Räume zu einem schon angeschlossenen
 * Nachbarraum – so entstehen Ketten und Labyrinthe. null = abgeschlossener Raum (kein Zugang außer durch Mauern).
 * `skip`: Raum, der gedanklich entfernt wird (Umbau-Prüfung); seine überbauten Hofzellen werden wieder Hof.
 * `virtual`: Raum, der gedanklich dazukommt (Platzierungsprüfung); seine Zellen zählen nicht mehr als Hof.
 * `blocked`: Hofzellen, die gedanklich überbaut werden (Turm).
 */
export function computeDoors(world: World, p: Team, opts: { skip?: number; virtual?: Module; blocked?: Set<number> } = {}): Map<number, Door | null> {
  const skip = opts.skip ?? 0, virt = opts.virtual;
  const rooms = [...world.modules.values()].filter((m) => m.owner === p && m.kind === 'room' && m.id !== skip).sort((a, b) => a.id - b.id);
  if (virt) rooms.push(virt);
  const out = new Map<number, Door | null>();
  const under = new Set(skip ? world.modules.get(skip)?.under ?? [] : []);
  const vcells = new Set(virt?.cells ?? []);
  const yardAt = (x: number, y: number) => {
    const i = ci(x, y);
    if (vcells.has(i) || opts.blocked?.has(i)) return false;
    if (under.has(i)) return true;
    return world.isOwned(x, y, p) && world.kind[i] === K_YARD && !(skip && world.mod[i] === skip);
  };
  const linked = new Set<number>(); // Zellen schon angeschlossener Räume
  let rest: Module[] = [];
  for (const m of rooms) {
    const d = pickDoor(world, m, yardAt);
    if (d) { out.set(m.id, d); for (const c of m.cells) linked.add(c); } else rest.push(m);
  }
  for (let again = true; again && rest.length;) {
    again = false;
    const left: Module[] = [];
    for (const m of rest) {
      const d = pickDoor(world, m, (x, y) => linked.has(ci(x, y)));
      if (d) { out.set(m.id, d); for (const c of m.cells) linked.add(c); again = true; } else left.push(m);
    }
    rest = left;
  }
  for (const m of rest) out.set(m.id, null);
  return out;
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
  // Zufahrtsgang vom Kernhof zum Haupttor (1 Zelle breit; Räume, Türme und Hofzellen dürfen daran anschließen)
  const ap = APPROACH[p];
  for (let xx = ap.x0; xx <= ap.x1; xx++) {
    const i = ci(xx, ap.y);
    world.kind[i] = K_YARD;
    world.owner[i] = p;
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

/**
 * Tor und Kernkammer hängen über Hofzellen zusammen (Räume sind Sackgassen mit nur einer Tür, Türme, Kern und
 * überbaute Zellen sperren). `excluded`: Zellen, die gedanklich überbaut werden (Platzierungsprüfung).
 */
export function gateConnected(world: World, p: Team, excluded?: Set<number>): boolean {
  const g = GATE_CELL[p];
  const walk = (x: number, y: number) => {
    if (!inMap(x, y)) return false;
    const i = ci(x, y);
    return world.owner[i] === p && world.kind[i] === K_YARD && !excluded?.has(i);
  };
  if (!walk(g.x, g.y)) return false;
  const seen = new Set<number>([ci(g.x, g.y)]);
  const q: number[][] = [[g.x, g.y]];
  const ch = CHAMBER[p];
  while (q.length) {
    const [x, y] = q.pop()!;
    if (x >= ch.x0 && x < ch.x1 && y >= ch.y0 && y < ch.y1) return true;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!walk(nx, ny) || seen.has(ci(nx, ny))) continue;
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
  const ch = CHAMBER[p], g = GATE_CELL[p];
  const over = new Set<number>(); // schlichte Hofzellen, die der Raum überbauen würde
  for (const [cx, cy] of fp.cells) {
    if (!inPlot(p, cx, cy)) return no('Outside your building plot');
    if (cellFree(world, p, cx, cy)) continue;
    const i = ci(cx, cy);
    if (world.kind[i] === K_YARD && !world.mod[i] && world.owner[i] === p) {
      if (cx >= ch.x0 && cx < ch.x1 && cy >= ch.y0 && cy < ch.y1) return no('The core chamber stays open');
      if (cx === g.x && cy === g.y) return no('Do not block the gate');
      over.add(i);
      continue;
    }
    return no('Cells are occupied');
  }
  if (over.size && !gateConnected(world, p, over)) return no('Would block the path from the gate to the core');
  // Tür: zum Hof oder zu einem angeschlossenen Nachbarraum; bestehende Räume dürfen ihre Tür nicht verlieren
  const virt = { id: -1, owner: p, cells: fp.cells.map(([cx, cy]) => ci(cx, cy)), x0: x, y0: y, cols: fp.cols, rows: fp.rows, door: null } as unknown as Module;
  const doors = computeDoors(world, p, { virtual: virt });
  if (!doors.get(-1)) {
    let touching = false;
    for (const [cx, cy] of fp.cells) if (touchesBastion(world, p, cx, cy)) touching = true;
    return no(touching ? 'No open side: a room needs a door to the courtyard or to a connected room' : 'Build next to your courtyard or any connected building');
  }
  for (const m of world.modules.values()) {
    if (m.owner === p && m.kind === 'room' && m.door && doors.get(m.id) === null) return no('That would cut off another room from the courtyard');
  }
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
    const ch = CHAMBER[p];
    if (x >= ch.x0 && x < ch.x1 && y >= ch.y0 && y < ch.y1) return no('The core chamber stays open');
    // Verbindung Tor -> Kernkammer darf nicht abreißen
    if (!gateConnected(world, p, new Set([i]))) return no('Would block the path from the gate to the core');
    const after = computeDoors(world, p, { blocked: new Set([i]) });
    for (const m of world.modules.values()) {
      if (m.owner === p && m.kind === 'room' && m.door && after.get(m.id) === null) return no('That would cut off a room from the courtyard');
    }
    return OK;
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
  const under = new Set(m.under ?? []);
  for (const c of m.cells) {
    world.mod[c] = 0;
    world.rubble[c] = 0;
    if (m.kind === 'yard' || under.has(c)) { world.kind[c] = K_YARD; continue; }
    world.kind[c] = K_EMPTY;
    world.owner[c] = -1;
  }
  world.modules.delete(id);
}

function addModule(world: World, p: Team, def: BuildingDef, fp: ReturnType<typeof footprint>, x: number, y: number, kind: Module['kind'], cellKind: number, star: number): Module {
  const under = fp.cells.map(([cx, cy]) => ci(cx, cy)).filter((i) => world.kind[i] === K_YARD && !world.mod[i] && world.owner[i] === p);
  const m: Module = {
    id: world.id(), owner: p, card: def.id, kind, cells: [], x0: x, y0: y, cols: fp.cols, rows: fp.rows,
    hp: def.hp, maxHp: def.hp, material: def.material, destroyed: false, star, buildEnd: 0, posts: def.posts, staffed: 0, door: null,
    slots: [], burning: 0, frozen: 0, shortCircuit: 0, s: {},
  };
  if (under.length && kind !== 'yard') m.under = under;
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

/** Nach dem Entfernen des Raums `id` bliebe kein bisher angeschlossener Raum ohne Tür zurück */
export function dependentsOk(world: World, p: Team, id: number): boolean {
  const after = computeDoors(world, p, { skip: id });
  for (const m of world.modules.values()) {
    if (m.owner !== p || m.kind !== 'room' || m.id === id) continue;
    if (m.door && after.get(m.id) === null) return false;
  }
  return true;
}

/** Bauteil aufnehmen (Umbau); die Karte ist danach wieder spielbar */
export function removeModule(world: World, p: Team, id: number): string | null {
  const m = world.modules.get(id);
  if (!m || m.owner !== p || m.kind === 'core') return null;
  if (m.kind === 'room' && !dependentsOk(world, p, id)) return null;
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
