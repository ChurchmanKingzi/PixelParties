// Wegfindung (A* auf dem Zellenraster, Mauern liegen auf Kanten) und Schusslinie

import { MAP_H, MAP_W, type Team } from './constants';
import type { Wall } from './types';
import { K_CORE, K_EMPTY, K_ROOM, K_TOWER } from './types';
import { ci, inMap, N_CELLS, type World } from './world';

export interface NavOpts {
  team: Team;
  breakWalls: boolean; // darf feindliche Mauern einplanen (mit Zerstörungskosten)
  ghost?: boolean; // geht durch Mauern
  maxExpand?: number;
}

export interface Box { x0: number; y0: number; x1: number; y1: number } // Zellen, einschließlich

const SQ2 = Math.SQRT2;

/**
 * Wegkosten für das Durchbrechen einer Mauer: Das Aufbrechen dauert Sekunden bis Minuten, deshalb nehmen Angreifer
 * lieber einen Umweg von bis zu etwa 30 Zellen durch ein Labyrinth, als eine 300-HP-Mauer einzureißen.
 */
export const BREACH_BASE = 6;
export const BREACH_PER_HP = 1 / 12;

/** Kosten für das Überschreiten einer Kante: 0 frei, Infinity gesperrt */
export function crossCost(world: World, w: Wall | null, o: NavOpts): number {
  if (!w || w.door || w.hp <= 0) return 0;
  if (o.ghost) return 0;
  if (w.gate) {
    if (w.owner === o.team) return w.closedUntil && world.tick < w.closedUntil ? Infinity : 0;
    return o.breakWalls ? BREACH_BASE + w.hp * BREACH_PER_HP : Infinity;
  }
  if (w.owner !== o.team && o.breakWalls) return BREACH_BASE + w.hp * BREACH_PER_HP;
  return Infinity;
}

// wiederverwendete Arbeitsfelder
const G = new Float32Array(N_CELLS);
const PAR = new Int32Array(N_CELLS);
const STAMP = new Uint32Array(N_CELLS);
const CLOSED = new Uint32Array(N_CELLS);
let curStamp = 0;

class Heap {
  keys: number[] = [];
  vals: number[] = [];
  get size() { return this.keys.length; }
  clear() { this.keys.length = 0; this.vals.length = 0; }
  push(k: number, v: number) {
    const ks = this.keys, vs = this.vals;
    let i = ks.length;
    ks.push(k); vs.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (ks[p] <= k) break;
      ks[i] = ks[p]; vs[i] = vs[p];
      i = p;
    }
    ks[i] = k; vs[i] = v;
  }
  pop(): number {
    const ks = this.keys, vs = this.vals;
    const top = vs[0];
    const lk = ks.pop()!, lv = vs.pop()!;
    const n = ks.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && ks[c + 1] < ks[c]) c++;
        if (ks[c] >= lk) break;
        ks[i] = ks[c]; vs[i] = vs[c];
        i = c;
      }
      ks[i] = lk; vs[i] = lv;
    }
    return top;
  }
}
const heap = new Heap();

function hDist(x: number, y: number, b: Box): number {
  const dx = Math.max(b.x0 - x, 0, x - b.x1);
  const dy = Math.max(b.y0 - y, 0, y - b.y1);
  return Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy);
}

/** Pfad als Zellenindizes (ohne Startzelle); null, wenn kein Weg. Leer, wenn der Start schon im Ziel liegt. */
export function findPath(world: World, sx: number, sy: number, goal: Box, o: NavOpts): number[] | null {
  sx = Math.max(0, Math.min(MAP_W - 1, Math.floor(sx)));
  sy = Math.max(0, Math.min(MAP_H - 1, Math.floor(sy)));
  if (sx >= goal.x0 && sx <= goal.x1 && sy >= goal.y0 && sy <= goal.y1) return [];
  curStamp++;
  heap.clear();
  const s = ci(sx, sy);
  G[s] = 0; PAR[s] = -1; STAMP[s] = curStamp;
  heap.push(hDist(sx, sy, goal), s);
  let expand = 0;
  const maxE = o.maxExpand ?? 3000;
  let found = -1;
  while (heap.size && expand++ < maxE) {
    const cur = heap.pop();
    if (CLOSED[cur] === curStamp) continue;
    CLOSED[cur] = curStamp;
    const cx = cur % MAP_W, cy = (cur / MAP_W) | 0;
    if (cx >= goal.x0 && cx <= goal.x1 && cy >= goal.y0 && cy <= goal.y1) { found = cur; break; }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        if (world.solid(nx, ny)) continue;
        let cost: number;
        if (dx && dy) {
          if (world.solid(cx + dx, cy) || world.solid(cx, cy + dy)) continue;
          const c1 = crossCost(world, world.edgeBetween(cx, cy, cx + dx, cy), o);
          const c2 = crossCost(world, world.edgeBetween(cx + dx, cy, nx, ny), o);
          const c3 = crossCost(world, world.edgeBetween(cx, cy, cx, cy + dy), o);
          const c4 = crossCost(world, world.edgeBetween(cx, cy + dy, nx, ny), o);
          if (c1 || c2 || c3 || c4) continue;
          cost = SQ2;
        } else {
          const cc = crossCost(world, world.edgeBetween(cx, cy, nx, ny), o);
          if (cc === Infinity) continue;
          cost = 1 + cc;
        }
        const ni = ci(nx, ny);
        if (world.rubble[ni]) cost += 0.5;
        const ng = G[cur] + cost;
        if (STAMP[ni] !== curStamp || ng < G[ni]) {
          G[ni] = ng; PAR[ni] = cur; STAMP[ni] = curStamp;
          heap.push(ng + hDist(nx, ny, goal), ni);
        }
      }
    }
  }
  if (found < 0) return null;
  const path: number[] = [];
  for (let c = found; c !== s && c >= 0; c = PAR[c]) path.push(c);
  path.reverse();
  return path;
}

// ------------------------------------------------------------------ Schusslinie

export interface LosHit {
  kind: 'wall' | 'module' | 'core';
  id: number;
  x: number;
  y: number;
  dist: number;
}

/**
 * Strahl durch das Raster. Trifft nur Hindernisse des Gegners (eigene Mauern und Zellen blockieren nicht):
 * Mauersegmente auf Kanten und feste Zellen (Raum, Turm, Kern).
 */
export function traceLine(world: World, x0: number, y0: number, x1: number, y1: number, shooter: Team, maxHits = 1): LosHit[] {
  const hits: LosHit[] = [];
  let cx = Math.floor(x0), cy = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1);
  const dx = x1 - x0, dy = y1 - y0;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tDeltaX = stepX ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = stepY ? Math.abs(1 / dy) : Infinity;
  let tMaxX = stepX ? (stepX > 0 ? (cx + 1 - x0) / dx : (x0 - cx) / -dx) : Infinity;
  let tMaxY = stepY ? (stepY > 0 ? (cy + 1 - y0) / dy : (y0 - cy) / -dy) : Infinity;
  const len = Math.hypot(dx, dy);
  let lastMod = -1;
  let guard = 0;
  while (guard++ < 400) {
    if (cx === ex && cy === ey) break;
    let nx = cx, ny = cy, t: number;
    if (tMaxX < tMaxY) { nx += stepX; t = tMaxX; tMaxX += tDeltaX; } else { ny += stepY; t = tMaxY; tMaxY += tDeltaY; }
    if (!inMap(nx, ny)) break;
    const w = world.edgeBetween(cx, cy, nx, ny);
    if (w && w.owner !== shooter && !w.door && w.hp > 0) {
      hits.push({ kind: 'wall', id: w.id, x: cx, y: cy, dist: t * len });
      if (hits.length >= maxHits) return hits;
    }
    const i = ci(nx, ny);
    const k = world.kind[i];
    if (world.owner[i] !== shooter && (k === K_ROOM || k === K_TOWER || k === K_CORE)) {
      const m = world.modules.get(world.mod[i]);
      if (m && !m.destroyed && m.id !== lastMod) {
        lastMod = m.id;
        hits.push({ kind: m.kind === 'core' ? 'core' : 'module', id: m.id, x: nx, y: ny, dist: t * len });
        if (hits.length >= maxHits) return hits;
      }
    } else if (k === K_EMPTY) lastMod = -1;
    cx = nx; cy = ny;
  }
  return hits;
}

/** Zwischen zwei Punkten liegt eine blockierende Mauer (für Nahkampf durch Wände) */
export function wallBetween(world: World, ax: number, ay: number, bx: number, by: number, team: Team): boolean {
  let cx = Math.floor(ax), cy = Math.floor(ay);
  const ex = Math.floor(bx), ey = Math.floor(by);
  if (cx === ex && cy === ey) return false;
  const dx = bx - ax, dy = by - ay;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tDeltaX = stepX ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = stepY ? Math.abs(1 / dy) : Infinity;
  let tMaxX = stepX ? (stepX > 0 ? (cx + 1 - ax) / dx : (ax - cx) / -dx) : Infinity;
  let tMaxY = stepY ? (stepY > 0 ? (cy + 1 - ay) / dy : (ay - cy) / -dy) : Infinity;
  let guard = 0;
  while (guard++ < 40 && !(cx === ex && cy === ey)) {
    let nx = cx, ny = cy;
    if (tMaxX < tMaxY) { nx += stepX; tMaxX += tDeltaX; } else { ny += stepY; tMaxY += tDeltaY; }
    if (!inMap(nx, ny)) return false;
    const w = world.edgeBetween(cx, cy, nx, ny);
    if (w && !w.door && w.hp > 0 && !(w.gate && w.owner === team)) return true;
    cx = nx; cy = ny;
  }
  return false;
}
