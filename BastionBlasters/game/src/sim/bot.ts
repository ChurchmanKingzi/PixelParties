// Einfacher Bot: wählt Karten, baut eine Bastion nach Heuristik und füllt das Kontingent

import { GATE_CELL, PLOT, type Priority, type Team } from './constants';
import {
  checkRoom, checkTower, checkWallCard, checkYardBuilding, checkYardCell, footprint, inPlot, isOuterWall,
} from './bastion';
import { BUILDINGS, LINE_ROOM, UNITS, isBuilding } from './data';
import { applyCmd } from './commands';
import type { World } from './world';
import { ci } from './world';
import { K_YARD } from './types';

const isPlatform = (id: string) => BUILDINGS[id]?.group === 'Platforms' && BUILDINGS[id].gunSlots > 0;
const isHeal = (id: string) => BUILDINGS[id]?.group === 'Healing';

/** n Karten aus der Hand behalten */
export function botChoose(world: World, team: Team, hand: string[], n: number): string[] {
  const rng = world.rng;
  const keep: string[] = [];
  const pool = hand.slice();
  const take = (id: string | undefined) => {
    if (!id) return;
    const i = pool.indexOf(id);
    if (i >= 0 && keep.length < n) { keep.push(id); pool.splice(i, 1); }
  };
  const hasRoom = (room: string) => keep.includes(room) || [...world.modules.values()].some((m) => m.owner === team && m.card === room && !m.destroyed);
  const playable = (id: string) => {
    const u = UNITS[id];
    if (!u || u.line === 'Basic') return true;
    return hasRoom(LINE_ROOM[u.line]);
  };
  const best = (pred: (id: string) => boolean) => {
    const c = pool.filter(pred);
    if (!c.length) return undefined;
    c.sort((a, b) => cardScore(b) - cardScore(a) + (rng.next() - 0.5));
    return c[0];
  };
  const alreadyHasPlatform = [...world.modules.values()].some((m) => m.owner === team && !m.destroyed && m.slots.length > 0);
  if (!alreadyHasPlatform) take(best(isPlatform));
  const art = best((id) => UNITS[id]?.cat === 'artillery' && (UNITS[id].line === 'Basic' || hand.includes(LINE_ROOM[UNITS[id].line])));
  if (art) {
    take(art);
    const u = UNITS[art];
    if (u.line !== 'Basic') take(LINE_ROOM[u.line]);
  }
  if (world.pauseNo === 0 || !world.players[team].contingent.some((e) => UNITS[e.card].cat === 'defender')) take(best((id) => UNITS[id]?.cat === 'defender' && playable(id)));
  take(best((id) => UNITS[id]?.cat === 'assault' && playable(id)));
  if (world.pauseNo === 0) take(best(isHeal));
  while (keep.length < n && pool.length) {
    const c = pool.slice().sort((a, b) => cardScore(b) - cardScore(a) + (rng.next() - 0.5) * 3);
    const id = c[0];
    const u = UNITS[id];
    if (u && u.line !== 'Basic' && !hasRoom(LINE_ROOM[u.line])) {
      const room = LINE_ROOM[u.line];
      if (pool.includes(room) && keep.length + 2 <= n) { take(room); take(id); continue; }
      pool.splice(pool.indexOf(id), 1);
      continue;
    }
    take(id);
  }
  return keep;
}

function cardScore(id: string): number {
  const d = UNITS[id] ?? BUILDINGS[id];
  let s = 2 + d.tier;
  if (isBuilding(id)) {
    const b = BUILDINGS[id];
    if (b.group === 'Healing') s += 3;
    if (b.group === 'Turrets') s += 2.5;
    if (b.group === 'Platforms') s += 2;
    if (b.group === 'Workshops') s += 1.5;
    if (id === 'BU-01' || id === 'BU-03') s += 1.5;
    if (b.group === 'Chaos') s -= 0.5;
  } else {
    const u = UNITS[id];
    if (u.cat === 'artillery') s += 3;
    if (u.cat === 'assault') s += 2.5;
    if (u.cat === 'defender') s += 2.5;
    if (u.cat === 'civilian') s += 1;
  }
  return s;
}

// ------------------------------------------------------------------ Aufbau

function frontX(team: Team): number {
  return team === 0 ? PLOT[0].x1 - 1 : PLOT[1].x0;
}

interface Spot { x: number; y: number; rot: number; score: number }

function gatePos(team: Team) {
  const g = GATE_CELL[team];
  return { x: g.x, y: g.y };
}

function findRoomSpot(world: World, team: Team, card: string, pref: 'front' | 'gate' | 'back' | 'any'): Spot | null {
  const def = BUILDINGS[card];
  const r = PLOT[team];
  const gp = gatePos(team);
  let best: Spot | null = null;
  for (let rot = 0; rot < (def.cols === def.rows ? 1 : 2); rot++) {
    for (let y = r.y0; y < r.y1; y++) {
      for (let x = r.x0; x < r.x1; x++) {
        if (!checkRoom(world, team, card, x, y, rot).ok) continue;
        const fp = footprint(def, x, y, rot);
        const cx = x + fp.cols / 2, cy = y + fp.rows / 2;
        let score = world.rng.next() * 1.5;
        const dFront = Math.abs(frontX(team) - cx);
        const dGate = Math.hypot(cx - gp.x, cy - gp.y);
        if (pref === 'front') score += 10 - dFront;
        else if (pref === 'gate') score += 12 - dGate;
        else if (pref === 'back') score += dFront * 0.5;
        else score += 6 - dGate * 0.3;
        if (!best || score > best.score) best = { x, y, rot, score };
      }
    }
  }
  return best;
}

function growYard(world: World, team: Team): boolean {
  const r = PLOT[team];
  let best: { x: number; y: number; s: number } | null = null;
  for (let y = r.y0; y < r.y1; y++) {
    for (let x = r.x0; x < r.x1; x++) {
      if (!checkYardCell(world, team, x, y).ok) continue;
      // bevorzugt nach hinten, möglichst auf Höhe der Kernhofmitte
      const back = team === 0 ? (PLOT[0].x1 - x) : (x - PLOT[1].x0);
      const s = -Math.abs(y - 13.5) * 0.9 + back * 0.6 + world.rng.next();
      if (!best || s > best.s) best = { x, y, s };
    }
  }
  if (!best) return false;
  return applyCmd(world, { t: 'yard', p: team, x: best.x, y: best.y }).ok;
}

function playRoom(world: World, team: Team, card: string, pref: 'front' | 'gate' | 'back' | 'any'): boolean {
  for (let attempt = 0; attempt < 3; attempt++) {
    const s = findRoomSpot(world, team, card, pref);
    if (s) return applyCmd(world, { t: 'play', p: team, card, x: s.x, y: s.y, rot: s.rot }).ok;
    if (world.players[team].yardBudget <= 0) return false;
    for (let k = 0; k < 3; k++) if (!growYard(world, team)) break;
  }
  return false;
}

function playYardBuilding(world: World, team: Team, card: string, pref: 'gate' | 'core'): boolean {
  const def = BUILDINGS[card];
  const gp = gatePos(team);
  const core = { x: team === 0 ? 15 : 41, y: 14 };
  let best: Spot | null = null;
  const r = PLOT[team];
  for (let rot = 0; rot < (def.cols === def.rows ? 1 : 2); rot++) {
    for (let y = r.y0; y < r.y1; y++) {
      for (let x = r.x0; x < r.x1; x++) {
        if (!checkYardBuilding(world, team, card, x, y, rot).ok) continue;
        const t = pref === 'gate' ? gp : core;
        const d = Math.hypot(x - t.x, y - t.y);
        const score = 10 - d + world.rng.next() * 1.5;
        if (!best || score > best.score) best = { x, y, rot, score };
      }
    }
  }
  if (!best) return false;
  return applyCmd(world, { t: 'play', p: team, card, x: best.x, y: best.y, rot: best.rot }).ok;
}

function playTower(world: World, team: Team, card: string): boolean {
  const r = PLOT[team];
  const gp = gatePos(team);
  let best: Spot | null = null;
  for (let y = r.y0; y < r.y1; y++) {
    for (let x = r.x0; x < r.x1; x++) {
      if (!checkTower(world, team, card, x, y).ok) continue;
      const d = Math.hypot(x - gp.x, (y - gp.y) * 0.7);
      const score = 12 - d + world.rng.next();
      if (!best || score > best.score) best = { x, y, rot: 0, score };
    }
  }
  if (!best) return false;
  return applyCmd(world, { t: 'play', p: team, card, x: best.x, y: best.y }).ok;
}

function playWall(world: World, team: Team, card: string): boolean {
  const gp = gatePos(team);
  let best: { x: number; y: number; dir: 'E' | 'S'; s: number } | null = null;
  for (const w of world.walls.values()) {
    if (w.owner !== team || w.door || w.gate || w.hp <= 0) continue;
    if (!checkWallCard(world, team, card, w.x, w.y, w.dir).ok) continue;
    if (!isOuterWall(world, w)) continue;
    const s = 10 - Math.hypot(w.x - gp.x, w.y - gp.y) + world.rng.next();
    if (!best || s > best.s) best = { x: w.x, y: w.y, dir: w.dir, s };
  }
  if (!best) return false;
  return applyCmd(world, { t: 'play', p: team, card, edge: { x: best.x, y: best.y, dir: best.dir } }).ok;
}

function prioFor(card: string): Priority {
  const u = UNITS[card];
  if (!u || u.cat !== 'artillery') return 'surgeon';
  if (u.traj === 'flat' || u.traj === 'pierce') return 'breaker';
  if ((u.reach ?? 0) >= 42) return 'coreHunt';
  return 'surgeon';
}

/** Alle behaltenen Karten spielen */
export function botPlay(world: World, team: Team) {
  const p = world.players[team];
  const order = (id: string): number => {
    if (!isBuilding(id)) return 90;
    const b = BUILDINGS[id];
    if (b.group === 'Platforms') return 1;
    if (b.group === 'Unlock') return 2;
    if (b.group === 'Healing') return 3;
    if (b.kind === 'tower') return 4;
    if (b.kind === 'wall' || b.kind === 'gate') return 6;
    if (b.kind === 'yard') return 5;
    return 7;
  };
  const cards = p.kept.slice().sort((a, b) => order(a) - order(b));
  for (const card of cards) {
    if (!p.kept.includes(card)) continue;
    if (!isBuilding(card)) {
      const before = p.contingent.length;
      const full = before >= p.slotsMax && !p.contingent.some((e) => e.card === card);
      if (full) {
        // schwächsten Eintrag ersetzen, falls die neue Karte besser ist
        let wi = -1, ws = 1e9;
        p.contingent.forEach((e, i) => { const s = cardScore(e.card); if (s < ws) { ws = s; wi = i; } });
        if (wi >= 0 && cardScore(card) > ws + 0.5) applyCmd(world, { t: 'play', p: team, card, replace: wi });
      } else applyCmd(world, { t: 'play', p: team, card });
      continue;
    }
    const def = BUILDINGS[card];
    // Duplikat eines vorhandenen Bauteils: aufwerten
    const have = [...world.modules.values()].find((m) => m.owner === team && m.card === card && !m.destroyed);
    if (have && def.kind !== 'wall' && def.kind !== 'gate') { if (applyCmd(world, { t: 'play', p: team, card, upgrade: true }).ok) continue; }
    switch (def.kind) {
      case 'room': playRoom(world, team, card, isPlatform(card) ? 'front' : def.group === 'Healing' || card === 'BU-03' ? 'gate' : def.group === 'Unlock' ? 'any' : 'any'); break;
      case 'yard': playYardBuilding(world, team, card, def.group === 'Healing' ? 'core' : 'gate'); break;
      case 'tower': playTower(world, team, card); break;
      case 'wall': playWall(world, team, card); break;
      case 'gate': applyCmd(world, { t: 'play', p: team, card }); break;
    }
  }
  // Artillerie-Prioritäten
  p.contingent.forEach((e, i) => { const pr = prioFor(e.card); if (e.prio !== pr) applyCmd(world, { t: 'prio', p: team, idx: i, prio: pr }); });
  void inPlot; void ci; void K_YARD;
}
