// Einheiten: Erzeugung, Status, Schaden, Heilung, Tod, XP und Ränge

import {
  ARMOR_MULT, BERSERK_DMG, CITIZEN_HP, DT, MAP_H, MAP_W, RANK_XP, STATUS_DEFAULT_S, TPS, type DType, type Team,
} from './constants';
import { UNITS } from './data';
import { aidOf } from './catchup';
import { unitFx } from './fx';
import { deathSaves, onUnitFell } from './bfx';
import type { Mods, Status, StatusId, Unit, UnitDef } from './types';
import { ci, type World } from './world';

export const CITIZEN_DEF = { id: 'citizen', name: 'Citizen', cat: 'civilian' as const, hp: CITIZEN_HP, armor: 'flesh' as const, speed: 1.5 };

export function defOf(u: Unit): UnitDef | null {
  return u.cid === 'citizen' ? null : UNITS[u.cid];
}

export function rankMult(u: Unit): number {
  return 1 + 0.1 * Math.min(5, u.rank);
}

export function baseMods(): Mods {
  return { speed: 1, atkSpeed: 1, dmgTaken: 1, dmgDealt: 1, maxHp: 1, canMove: true, canAct: true, canAttack: true };
}

export interface SpawnOpts {
  entry?: number;
  wave?: number;
  star?: number;
  zone?: Unit['zone'];
  prio?: Unit['prio'];
  rank?: number;
  xp?: number;
}

export function createUnit(world: World, team: Team, cid: string, x: number, y: number, o: SpawnOpts = {}): Unit {
  const def = cid === 'citizen' ? null : UNITS[cid];
  const fx = unitFx(cid);
  const hp = def ? def.hp : CITIZEN_HP;
  const u: Unit = {
    id: world.id(), team, cid, cat: def ? def.cat : 'citizen', x, y, face: team === 0 ? 1 : -1,
    hp, maxHp: hp, baseHp: hp, rank: 0, xp: 0, armor: def ? def.armor : 'flesh', cd: world.tick + Math.floor(TPS * (0.3 + world.rng.next())),
    tgt: 0, tstruct: null, path: [], pi: 0, repath: 0, goal: -1, state: 'idle', st: [], mods: baseMods(),
    zone: o.zone ?? (def?.zone ?? 'middle'), prio: o.prio ?? 'surgeon', slot: null, born: world.tick, wave: o.wave ?? 0,
    s: {}, rt: { phase: 'none', src: 0, since: 0 }, berserk: false, invisible: !!fx.invisible, flying: !!fx.flying, ghost: !!fx.ghost,
    post: 0, postIdx: 0, home: o.entry ?? -1, star: o.star ?? 1, lastHit: -999, inCombat: 0, dead: false, radius: 0.3,
  };
  if (def && def.hp > 300) u.radius = 0.42;
  else if (def && def.hp > 120) u.radius = 0.36;
  if (o.xp) gainXp(world, u, o.xp, true);
  if (o.rank) {
    u.rank = o.rank;
    u.xp = RANK_XP[o.rank];
  }
  recomputeMaxHp(u, true);
  world.units.push(u);
  world.byId.set(u.id, u);
  return u;
}

// ------------------------------------------------------------------ Status

export function hasStatus(u: Unit, id: StatusId): boolean {
  for (const s of u.st) if (s.id === id) return true;
  return false;
}
export function statusPower(u: Unit, id: StatusId): number {
  let p = 0;
  for (const s of u.st) if (s.id === id) p = Math.max(p, s.power);
  return p;
}

/** Status setzen oder verlängern. Immunitäten werden berücksichtigt. */
export function addStatus(world: World, u: Unit, id: StatusId, dur?: number, power = 1, src = 0): boolean {
  if (u.dead) return false;
  const fx = unitFx(u.cid);
  if (fx.immune && fx.immune.includes(id)) return false;
  if (id === 'burning' && (hasStatus(u, 'wet') || fx.fireImmune)) return false;
  if (u.s.runeSkin && (id === 'stunned' || id === 'feared' || id === 'confused')) {
    u.s.runeSkin = 0;
    return false;
  }
  if (fx.noKnock && id === 'stunned' && false) return false;
  const secs = dur ?? STATUS_DEFAULT_S[id] ?? 3;
  const until = world.tick + Math.round(secs * TPS);
  for (const s of u.st) {
    if (s.id === id) {
      s.until = Math.max(s.until, until);
      s.power = Math.max(s.power, power);
      return true;
    }
  }
  u.st.push({ id, until, power, src });
  if (id === 'frogged') u.s.froggedHp = 1;
  return true;
}
export function removeStatus(u: Unit, id: StatusId) {
  u.st = u.st.filter((s) => s.id !== id);
}
export function clearDebuffs(u: Unit) {
  const bad: StatusId[] = ['burning', 'chilled', 'frozen', 'slimed', 'poisoned', 'stunned', 'confused', 'feared', 'rooted', 'frogged', 'dancing', 'blinded', 'slow', 'wet'];
  u.st = u.st.filter((s) => !bad.includes(s.id));
}

/** Modifikatoren aus Status und Rang berechnen (Auren wirken danach zusätzlich) */
export function computeMods(world: World, u: Unit) {
  const m = baseMods();
  u.st = u.st.filter((s) => s.until > world.tick);
  for (const s of u.st) {
    switch (s.id) {
      case 'chilled': m.speed *= 0.7; m.atkSpeed *= 0.7; break;
      case 'frozen': m.canAct = false; break;
      case 'slimed': m.speed *= 0.75; break;
      case 'slow': m.speed *= 1 - 0.01 * s.power; break;
      case 'haste': m.speed *= 1 + 0.01 * s.power; break;
      case 'stunned': m.canAct = false; break;
      case 'rooted': m.canMove = false; break;
      case 'frogged': m.dmgDealt *= 0.25; break;
      case 'dancing': m.canAttack = false; break;
      case 'floating': m.speed *= 0.5; m.canAttack = false; break;
      case 'blinded': m.dmgDealt *= 0.5; break;
      case 'wet': m.speed *= 0.9; break;
      case 'spurred': m.atkSpeed *= 1.15; break;
      case 'hardened': m.maxHp *= 1.12; m.dmgDealt *= 1.0; break;
      case 'fed': m.maxHp *= 1 + 0.15 * s.power; break;
      case 'sated': m.maxHp *= 1.15; break;
      case 'strong': m.dmgDealt *= 1 + 0.01 * s.power; break;
      case 'tough': m.maxHp *= 1 + 0.01 * s.power; break;
      case 'triumph': m.speed *= 1.1; break;
      case 'guarded': m.dmgTaken *= 1 - 0.01 * s.power; break;
      case 'swallowed': m.canAct = false; m.canMove = false; break;
      default: break;
    }
  }
  if (u.berserk) m.dmgDealt *= BERSERK_DMG;
  m.dmgDealt *= rankMult(u);
  if (hasStatus(u, 'hardened') && u.cat !== 'artillery') m.dmgDealt *= 1.1;
  u.mods = m;
}

export function recomputeMaxHp(u: Unit, fill = false) {
  const prev = u.maxHp;
  u.maxHp = Math.round(u.baseHp * rankMult(u) * u.mods.maxHp);
  if (fill) u.hp = u.maxHp;
  else if (u.maxHp > prev) u.hp += u.maxHp - prev; // Max-HP-Zuwachs bringt HP mit
  else if (u.hp > u.maxHp) u.hp = u.maxHp;
}

// ------------------------------------------------------------------ XP und Ränge

export function gainXp(world: World, u: Unit, amount: number, silent = false) {
  if (amount <= 0 || u.dead) return;
  if (u.team >= 0) {
    const acad = academyBonus(world, u.team);
    amount *= acad * (1 + aidOf(world, u.team).xp);
  }
  u.xp += amount;
  while (u.rank < 5 && u.xp >= RANK_XP[u.rank + 1]) {
    u.rank++;
    const before = u.maxHp;
    recomputeMaxHp(u);
    u.hp = Math.min(u.maxHp, u.hp + before * 0.25 + (u.maxHp - before));
    if (!silent) world.emit({ t: 'rank', x: u.x, y: u.y, id: u.id, rank: u.rank, cid: u.cid, team: u.team });
  }
}

function academyBonus(world: World, team: Team): number {
  // BW-08 Forbidden Book Academy: alle Einheiten +25 % XP
  for (const m of world.modules.values()) {
    if (m.owner === team && m.card === 'BW-08' && !m.destroyed && m.buildEnd <= world.tick) {
      const eff = m.posts ? m.staffed / m.posts : 1;
      return 1 + 0.25 * eff;
    }
  }
  return 1;
}

// ------------------------------------------------------------------ Schaden und Heilung

export interface HurtOpts {
  melee?: boolean;
  ignoreArmor?: boolean;
  noXp?: boolean;
  flat?: boolean; // Flach-Geschoss (Gummi-Golem reflektiert)
  structure?: boolean;
}

/** Schaden an einer Einheit. Liefert den tatsächlich abgezogenen Schaden. */
export function hurt(world: World, dst: Unit, amount: number, dtype: DType, src: Unit | null, o: HurtOpts = {}): number {
  if (dst.dead || amount <= 0) return 0;
  if (dst.state === 'swallowed' || dst.state === 'burrow') return 0;
  const fx = unitFx(dst.cid);
  let m = o.ignoreArmor ? 1 : ARMOR_MULT[dtype][dst.armor];
  m *= dst.mods.dmgTaken;
  if (o.melee && fx.blockMelee) m *= 1 - fx.blockMelee;
  if (fx.fireVuln && dtype === 'F') m *= fx.fireVuln;
  if (fx.fireImmune && dtype === 'F') m = 0;
  if (fx.dormantMult && dst.s.dormant && dtype === 'W') m *= fx.dormantMult;
  if (fx.poisonImmune && dtype === 'G') m = 0;
  if (dtype === 'B' && hasStatus(dst, 'wet')) m *= 1.5;
  let dmg = amount * m;
  if (dmg <= 0) return 0;
  // Gesegnet absorbiert Schaden
  const bl = dst.st.find((s) => s.id === 'blessed');
  if (bl) {
    const take = Math.min(bl.power, dmg);
    bl.power -= take;
    dmg -= take;
    if (bl.power <= 0.01) removeStatus(dst, 'blessed');
    if (dmg <= 0) return 0;
  }
  dmg = Math.min(dmg, dst.hp);
  dst.hp -= dmg;
  dst.lastHit = world.tick;
  dst.inCombat = world.tick;
  if (src && !o.noXp) {
    const diff = Math.max(0, dst.rank - src.rank);
    gainXp(world, src, 0.25 * dmg * (1 + 0.1 * diff));
    world.stats.dmgUnits[src.team] += dmg;
  }
  if (dmg >= 1 && (src === null || src.team !== dst.team)) world.emit({ t: 'hit', x: dst.x, y: dst.y, dmg: Math.round(dmg), team: dst.team });
  if (dst.hp <= 0.0001) killUnit(world, dst, src);
  return dmg;
}

export function healUnit(world: World, dst: Unit, amount: number, src: Unit | null): number {
  if (dst.dead || amount <= 0) return 0;
  if (hasStatus(dst, 'poisoned')) amount *= 0.5;
  const real = Math.min(amount, dst.maxHp - dst.hp);
  if (real <= 0) return 0;
  dst.hp += real;
  if (src && src.team === dst.team) gainXp(world, src, 0.2 * real);
  world.stats.healed[dst.team] += real;
  return real;
}

export function killUnit(world: World, u: Unit, killer: Unit | null) {
  if (u.dead) return;
  const fx = unitFx(u.cid);
  if (deathSaves(world, u)) return;
  // Wiederauferstehung (Klapperkopf, Letztes Aufgebot, Ton-Golem)
  if (fx.revive && !u.s.revived && (fx.revive.per !== 'wave' || (u.s.reviveWave ?? -1) !== world.waveNo)) {
    u.s.revived = 1;
    u.s.reviveWave = world.waveNo;
    u.hp = 1;
    u.state = 'swallowed';
    u.s.reviveAt = world.tick + Math.round(fx.revive.delay * TPS);
    u.s.reviveFrac = fx.revive.frac;
    clearDebuffs(u);
    return;
  }
  u.dead = true;
  u.hp = 0;
  u.state = 'dead';
  world.stats.deaths[u.team]++;
  world.emit({ t: 'death', x: u.x, y: u.y, cid: u.cid, team: u.team, cat: u.cat });
  if (u.slot) {
    const m = world.modules.get(u.slot.mod);
    if (m) for (let k = 0; k < u.slot.n; k++) { const s = m.slots[u.slot.idx + k]; if (s && s.unit === u.id) s.unit = 0; }
  }
  if (killer && killer.team !== u.team && !killer.dead) {
    world.stats.kills[killer.team]++;
    if (u.cat === 'citizen' || u.cat === 'civilian') world.stats.civKilled[killer.team]++;
    const diff = Math.max(0, u.rank - killer.rank);
    let bonus = (10 + 5 * u.rank) * (1 + 0.1 * diff);
    if (hasTrophyHall(world, killer.team)) {
      bonus *= 2;
      addStatus(world, killer, 'triumph', 5);
    }
    gainXp(world, killer, bonus);
    const kfx = unitFx(killer.cid);
    if (kfx.onKill) kfx.onKill(world, killer, u);
  }
  if (fx.onDeath) fx.onDeath(world, u, killer);
  onUnitFell(world, u);
  if (u.cat !== 'citizen') world.feed(`${name(u)} falls`, u.team);
}

function hasTrophyHall(world: World, team: Team): boolean {
  for (const m of world.modules.values()) {
    if (m.owner === team && m.card === 'BW-09' && !m.destroyed && m.buildEnd <= world.tick) return true;
  }
  return false;
}

export function name(u: Unit): string {
  const d = defOf(u);
  return d ? d.name : 'Citizen';
}

// ------------------------------------------------------------------ Bewegung

export function cellOf(u: Unit): number {
  return ci(Math.min(MAP_W - 1, Math.max(0, Math.floor(u.x))), Math.min(MAP_H - 1, Math.max(0, Math.floor(u.y))));
}

/** Darf die Einheit von (ax,ay) nach (bx,by) (benachbarte Zellen)? */
export function canCross(world: World, u: Unit, ax: number, ay: number, bx: number, by: number): boolean {
  if (bx < 0 || by < 0 || bx >= MAP_W || by >= MAP_H) return false;
  if (!u.flying && world.solid(bx, by)) return false;
  if (u.flying || u.ghost) return !(world.blocked[ci(bx, by)] && !u.flying);
  const w = world.edgeBetween(ax, ay, bx, by);
  if (!w || w.door || w.hp <= 0) return true;
  if (w.gate && w.owner === u.team) return !(w.closedUntil && world.tick < w.closedUntil);
  return false;
}

/** Eine Achse bewegen; blockierte Zellwechsel werden verworfen */
export function stepAxis(world: World, u: Unit, dx: number, dy: number): boolean {
  if (!dx && !dy) return false;
  const nx = u.x + dx, ny = u.y + dy;
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  const mx = Math.floor(nx), my = Math.floor(ny);
  if (mx !== cx || my !== cy) {
    if (!canCross(world, u, cx, cy, mx, my)) return false;
  }
  u.x = Math.max(0.05, Math.min(MAP_W - 0.05, nx));
  u.y = Math.max(0.05, Math.min(MAP_H - 0.05, ny));
  return true;
}

export function moveBy(world: World, u: Unit, dx: number, dy: number) {
  stepAxis(world, u, dx, 0);
  stepAxis(world, u, 0, dy);
  if (dx > 0.001) u.face = 1;
  else if (dx < -0.001) u.face = -1;
}

export function speedOf(world: World, u: Unit): number {
  const d = defOf(u);
  let sp = d ? d.speed : 1.5;
  sp *= u.mods.speed;
  if (world.rubble[cellOf(u)]) sp *= 0.7;
  return sp;
}

export function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export { DT };
export type { Status };
