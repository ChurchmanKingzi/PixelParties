// Gebäudewirkungen: Heilung, Türme, Spawn-Boni, Fallen, Räume mit Wirkung auf Feinde, Artillerie-Modifikatoren

import { DT, PLOT, TPS, type DType, type Team } from './constants';
import { BUILDINGS, UNITS } from './data';
import { effScale } from './bastion';
import { healOccupants, zoneAnchor, gateInner } from './ai';
import { hurtModule, hurtWall, igniteModule, knockback, modCenter, enemyVisible, wallMid } from './combat';
import { unitFx } from './fx';
import type { Module, Unit } from './types';
import { addStatus, clearDebuffs, createUnit, gainXp, healUnit, hurt, killUnit, removeStatus } from './units';
import { ci, dist, type World } from './world';

// ------------------------------------------------------------------ Hilfen

/** Wirkungsgrad eines Bauteils: Besetzung, Schaden, Frost, Kurzschluss, Bauzeit */
export function modEff(world: World, m: Module): number {
  if (m.destroyed || m.buildEnd > world.tick) return 0;
  if (world.tick < m.shortCircuit) return 0;
  let e = m.posts > 0 ? m.staffed / m.posts : 1;
  if (m.hp < m.maxHp * 0.5) e *= 0.75;
  if (world.tick < m.frozen) e *= 0.5;
  if (world.tick < (m.s.blind ?? 0)) e *= 0.5;
  return e;
}
export function moduleActive(world: World, m: Module): boolean {
  return !m.destroyed && m.buildEnd <= world.tick && modEff(world, m) > 0;
}
function active(world: World, team: Team, card: string): Module | undefined {
  for (const m of world.modules.values()) if (m.owner === team && m.card === card && moduleActive(world, m)) return m;
  return undefined;
}
function activeAll(world: World, team: Team, card: string): Module[] {
  const out: Module[] = [];
  for (const m of world.modules.values()) if (m.owner === team && m.card === card && moduleActive(world, m)) out.push(m);
  return out;
}

function enemyOfTeam(t: Team): Team { return t === 0 ? 1 : 0; }

function unitCellModule(world: World, u: Unit): number {
  return world.mod[ci(Math.floor(u.x), Math.floor(u.y))];
}
function neighborIds(world: World, m: Module): Set<number> {
  const out = new Set<number>([m.id]);
  for (const c of m.cells) {
    const cx = c % 56, cy = Math.floor(c / 56);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const id = world.mod[ci(cx + dx, cy + dy)];
      if (id) out.add(id);
    }
  }
  return out;
}
/** Feinde im Raum (und optional in den Nachbarmodulen) */
export function enemiesIn(world: World, m: Module, withNeighbors = false): Unit[] {
  const ids = withNeighbors ? neighborIds(world, m) : new Set([m.id]);
  const enemy = enemyOfTeam(m.owner);
  const out: Unit[] = [];
  for (const u of world.units) {
    if (u.dead || u.team !== enemy || u.state === 'burrow' || u.state === 'swallowed') continue;
    if (ids.has(unitCellModule(world, u))) out.push(u);
  }
  return out;
}
function alliesIn(world: World, m: Module, withNeighbors = false): Unit[] {
  const ids = withNeighbors ? neighborIds(world, m) : new Set([m.id]);
  const out: Unit[] = [];
  for (const u of world.units) {
    if (u.dead || u.team !== m.owner) continue;
    if (ids.has(unitCellModule(world, u))) out.push(u);
  }
  return out;
}

const FOREVER = 1e6;

// ------------------------------------------------------------------ Heilung

export interface HealSpec { slots: number; hps: number; aura?: { r: number; hps: number }; cleanse?: 'bath' | 'all'; xp?: number }
const HEAL: Record<string, HealSpec> = {
  'BH-01': { slots: 3, hps: 6 },
  'BH-02': { slots: 1, hps: 8 },
  'BH-03': { slots: 4, hps: 4, cleanse: 'bath' },
  'BH-04': { slots: 2, hps: 3, aura: { r: 3, hps: 3 } },
  'BH-05': { slots: 1, hps: 20, cleanse: 'all', xp: 8 },
  'BH-06': { slots: 6, hps: 5, aura: { r: 3, hps: 2 } },
  'BH-07': { slots: 6, hps: 6 },
};
export function healSpecOf(m: Module): HealSpec | undefined {
  return HEAL[m.card];
}

function healStep(world: World, m: Module, hs: HealSpec) {
  const eff = modEff(world, m);
  m.s.healSlots = hs.slots;
  if (eff <= 0) return;
  const k = effScale(m.star);
  const occ = healOccupants(world, m).slice(0, hs.slots);
  for (const u of occ) {
    healUnit(world, u, hs.hps * k * eff * DT, null);
    if (hs.cleanse === 'bath' && world.tick % 15 === 0) {
      for (const s of ['burning', 'poisoned', 'slimed'] as const) removeStatus(u, s);
    }
    if (hs.cleanse === 'all' && !u.s['tinker' + m.id]) {
      u.s['tinker' + m.id] = 1;
      clearDebuffs(u);
      gainXp(world, u, hs.xp ?? 0);
    }
    if (world.tick % 20 === 0) world.emit({ t: 'heal', x: u.x, y: u.y });
  }
  if (hs.aura) {
    const c = modCenter(m);
    for (const u of world.near(c.x, c.y, hs.aura.r, (o) => o.team === m.owner && o.cat !== 'artillery')) {
      if (occ.includes(u)) continue;
      healUnit(world, u, hs.aura.hps * k * eff * DT, null);
    }
  }
}

// ------------------------------------------------------------------ Türme

interface TowerSpec {
  range: number; dmg: number; dtype: DType; interval: number;
  mode: 'single' | 'goo' | 'cone' | 'pierce' | 'storm' | 'flak' | 'beacon' | 'summon';
  vis: string; flyOK?: boolean; fleeBonus?: number;
}
const TOWER: Record<string, TowerSpec> = {
  'BT-01': { range: 7, dmg: 12, dtype: 'W', interval: 1.2, mode: 'single', vis: 'arrow', fleeBonus: 1.5 },
  'BT-02': { range: 5, dmg: 6, dtype: 'G', interval: 2, mode: 'goo', vis: 'goo' },
  'BT-03': { range: 3, dmg: 7, dtype: 'E', interval: 0.5, mode: 'cone', vis: 'ice' },
  'BT-04': { range: 6, dmg: 22, dtype: 'A', interval: 2, mode: 'pierce', vis: 'arcane' },
  'BT-05': { range: 6, dmg: 0, dtype: 'W', interval: 8, mode: 'summon', vis: 'arrow' },
  'BT-06': { range: 7, dmg: 55, dtype: 'B', interval: 4, mode: 'storm', vis: 'bolt' },
  'BT-07': { range: 8, dmg: 36, dtype: 'W', interval: 1.5, mode: 'flak', vis: 'fish', flyOK: true },
  'BT-08': { range: 8, dmg: 0, dtype: 'A', interval: 6, mode: 'beacon', vis: 'arcane' },
};

function towerTargets(world: World, m: Module, spec: TowerSpec): Unit[] {
  const c = modCenter(m);
  const hitFlyers = spec.range >= 8 || !!spec.flyOK;
  return world.near(c.x, c.y, spec.range, (o) => o.team !== m.owner && enemyVisible(o) && (spec.mode === 'flak' ? o.flying : !o.flying || hitFlyers));
}

function towerStep(world: World, m: Module, spec: TowerSpec) {
  const eff = modEff(world, m);
  if (eff <= 0) return;
  if (world.tick < (m.s.cd ?? 0)) return;
  const c = modCenter(m);
  const k = effScale(m.star);
  const interval = (spec.interval / eff) * TPS;
  if (spec.mode === 'summon') {
    // Hornissen nachliefern
    m.s.hornets = (m.s.hornets ?? 0);
    const alive = world.units.filter((u) => !u.dead && u.s.owner === m.id).length;
    if (alive < 3) {
      const u = createUnit(world, m.owner, 'HORNET', c.x + world.rng.range(-0.4, 0.4), c.y + world.rng.range(-0.4, 0.4));
      u.s.owner = m.id; u.s.ax = c.x; u.s.ay = c.y;
      m.s.cd = world.tick + Math.round(interval);
    } else m.s.cd = world.tick + 15;
    return;
  }
  const targets = towerTargets(world, m, spec);
  if (!targets.length) { m.s.cd = world.tick + 8; return; }
  let t = targets[0], bd = Infinity;
  for (const o of targets) {
    let d = dist(c.x, c.y, o.x, o.y);
    if (o.rt.phase === 'go' && spec.fleeBonus) d *= 0.5; // Fliehende werden bevorzugt gejagt
    if (d < bd) { bd = d; t = o; }
  }
  m.s.cd = world.tick + Math.round(interval);
  const shot = (tx: number, ty: number, vis = spec.vis) => world.emit({ t: 'shot', x0: c.x, y0: c.y - 0.6, x1: tx, y1: ty - 0.3, fly: 6, vis, team: m.owner, cid: m.card });
  switch (spec.mode) {
    case 'single': {
      let d = spec.dmg * k;
      if (t.rt.phase === 'go' && spec.fleeBonus) d *= spec.fleeBonus;
      shot(t.x, t.y);
      hurt(world, t, d, spec.dtype, null);
      break;
    }
    case 'flak': {
      shot(t.x, t.y);
      hurt(world, t, spec.dmg * k, spec.dtype, null);
      break;
    }
    case 'goo': {
      shot(t.x, t.y);
      for (const o of world.near(t.x, t.y, 1, (x) => x.team !== m.owner && !x.flying)) {
        hurt(world, o, spec.dmg * k, 'G', null);
        addStatus(world, o, 'slimed', 4);
      }
      break;
    }
    case 'cone': {
      shot(t.x, t.y);
      const dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy) || 1;
      for (const o of targets) {
        const vx = o.x - c.x, vy = o.y - c.y, dd = Math.hypot(vx, vy) || 0.01;
        if ((vx * dx + vy * dy) / (dd * d) < 0.5) continue;
        hurt(world, o, spec.dmg * k, 'E', null);
        addStatus(world, o, 'chilled', 4);
      }
      break;
    }
    case 'pierce': {
      shot(t.x, t.y);
      const dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy) || 1;
      const line = targets.filter((o) => {
        const vx = o.x - c.x, vy = o.y - c.y;
        const along = (vx * dx + vy * dy) / d;
        const perp = Math.abs(vx * dy - vy * dx) / d;
        return along > 0 && perp < 0.6;
      }).sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y)).slice(0, 3);
      for (const o of line) hurt(world, o, spec.dmg * k, 'A', null);
      break;
    }
    case 'storm': {
      const rt = targets[world.rng.int(targets.length)];
      shot(rt.x, rt.y);
      hurt(world, rt, spec.dmg * k, 'B', null);
      let from = rt;
      for (let j = 0; j < 2; j++) {
        if (!world.rng.chance(0.5)) break;
        const nxt = world.near(from.x, from.y, 3, (o) => o.team !== m.owner && !o.dead && o.id !== from.id && !o.flying)[0];
        if (!nxt) break;
        world.emit({ t: 'shot', x0: from.x, y0: from.y - 0.3, x1: nxt.x, y1: nxt.y - 0.3, fly: 3, vis: 'bolt', team: m.owner, cid: m.card });
        hurt(world, nxt, spec.dmg * 0.5 * k, 'B', null);
        from = nxt;
      }
      break;
    }
    case 'beacon': {
      shot(t.x, t.y, 'arcane');
      for (const o of targets) {
        o.invisible = false;
        addStatus(world, o, 'confused', 2);
      }
      break;
    }
    default: break;
  }
}

// ------------------------------------------------------------------ Artillerie-Modifikatoren

export interface ArtMods { reload: number; struct: number; range: number; rangeArcane: number; spread: number }
export function artMods(world: World, team: Team): ArtMods {
  const m: ArtMods = { reload: 1, struct: 1, range: 0, rangeArcane: 0, spread: 1 };
  if (active(world, team, 'BW-03')) m.reload *= 0.88;
  if (active(world, team, 'BW-05')) m.struct *= 1.15;
  if (active(world, team, 'BP-03')) { m.range += 4; m.spread *= 0.7; }
  if (active(world, team, 'BF-02')) m.rangeArcane += 0.1;
  return m;
}

// ------------------------------------------------------------------ Kontingent, Karten, Ziehen

export function bonusQuota(world: World, team: Team, kind: 'soll' | 'nachschub'): number {
  if (kind === 'nachschub') return active(world, team, 'BU-08') ? 1 : 0;
  return active(world, team, 'BU-10') ? 1 : 0;
}
export function contingentSlots(world: World, team: Team): number {
  let n = 5;
  if (active(world, team, 'BF-01')) n++;
  if (world.pauseNo >= 3) n++;
  if (world.pauseNo >= 6) n++;
  return Math.min(8, n);
}
export function keepCount(world: World, team: Team): number {
  return active(world, team, 'BU-11') ? 4 : 3;
}
export function pauseBonusSeconds(world: World): number {
  return active(world, 0, 'BU-11') || active(world, 1, 'BU-11') ? 10 : 0;
}

// ------------------------------------------------------------------ Spawn-Boni

export function applySpawnBuffs(world: World, u: Unit) {
  const team = u.team;
  const def = UNITS[u.cid];
  if (!def) return;
  const fight = u.cat === 'assault' || u.cat === 'defender';
  const forge = activeAll(world, team, 'BW-01').length > 0;
  if (active(world, team, 'BW-07')) gainXp(world, u, 25, true);
  if (forge && fight) addStatus(world, u, 'hardened', FOREVER);
  if (active(world, team, 'BW-02') && fight) addStatus(world, u, 'guarded', FOREVER, 15);
  if (active(world, team, 'BW-06') && (u.cat === 'defender' || u.cat === 'civilian')) u.s.runeSkin = 1;
  if (active(world, team, 'BW-11') && fight) {
    addStatus(world, u, 'hardened', FOREVER);
    gainXp(world, u, 140, true);
  }
  if (def.line === 'Beast' && active(world, team, 'BF-03')) addStatus(world, u, 'tough', FOREVER, 10);
  if (def.line === 'Frost' && active(world, team, 'BF-06')) addStatus(world, u, 'strong', FOREVER, 10);
  if (active(world, team, 'BW-10')) {
    const r = world.rng.int(4);
    if (r === 0) addStatus(world, u, 'strong', FOREVER, 25);
    else if (r === 1) addStatus(world, u, 'haste', FOREVER, 25);
    else if (r === 2) addStatus(world, u, 'tough', FOREVER, 25);
    else u.invisible = true;
  }
  if (active(world, team, 'BF-10') && world.rng.chance(0.1)) {
    const r = world.rng.int(4);
    if (r === 0) addStatus(world, u, 'strong', FOREVER, 30);
    else if (r === 1) addStatus(world, u, 'tough', FOREVER, 30);
    else if (r === 2) addStatus(world, u, 'haste', FOREVER, 30);
    else u.s.regen = 2;
    world.emit({ t: 'text', x: u.x, y: u.y - 0.7, text: 'chaos-born', color: '#c58cff' });
  }
  void def;
}

// ------------------------------------------------------------------ Tod im Bastion: Phönix, Gruft

export function inOwnBastion(world: World, u: Unit): boolean {
  const i = ci(Math.floor(u.x), Math.floor(u.y));
  return world.owner[i] === u.team && world.kind[i] !== 0;
}

/** true, wenn die Einheit durch einen Effekt wiederaufersteht (der normale Tod entfällt) */
export function deathSaves(world: World, u: Unit): boolean {
  if (u.cat === 'artillery' || u.cat === 'citizen' || u.dead) return false;
  if (!inOwnBastion(world, u)) return false;
  if (!u.s.reborn && active(world, u.team, 'BH-07')) {
    u.s.reborn = 1;
    u.hp = 1;
    u.state = 'swallowed';
    u.s.reviveAt = world.tick + 5 * TPS;
    u.s.reviveFrac = 0.5;
    clearDebuffs(u);
    world.emit({ t: 'fx', x: u.x, y: u.y, name: 'flame' });
    return true;
  }
  return false;
}

export function raiseSkeletonChance(world: World, u: Unit): number {
  if (u.cat !== 'assault' && u.cat !== 'defender') return 0;
  if (!inOwnBastion(world, u) || u.cid === 'US-01') return 0;
  let p = 0;
  if (active(world, u.team, 'BF-05')) p = Math.max(p, 0.15);
  for (const o of world.units) if (!o.dead && o.team === u.team && o.cid === 'UZ-14') p = Math.max(p, 0.2);
  return p;
}

export function onUnitFell(world: World, u: Unit) {
  const p = raiseSkeletonChance(world, u);
  if (p > 0 && world.rng.chance(p)) {
    const sk = createUnit(world, u.team, 'US-01', u.x, u.y);
    sk.hp = sk.maxHp * 0.5;
    sk.s.lifeUntil = world.tick + 15 * TPS;
    world.emit({ t: 'fx', x: u.x, y: u.y, name: 'bones' });
  }
}

// ------------------------------------------------------------------ Zerstörung

export function onModuleDestroyed(world: World, m: Module) {
  const c = modCenter(m);
  if (m.card === 'BW-03' || m.card === 'BW-04') {
    const dmg = m.card === 'BW-03' ? 80 : 120;
    world.emit({ t: 'impact', x: c.x, y: c.y, r: 1.5, vis: 'fire' });
    for (const o of world.modules.values()) {
      if (o.id === m.id || o.destroyed) continue;
      const oc = modCenter(o);
      if (dist(oc.x, oc.y, c.x, c.y) <= 1.5 + Math.max(o.cols, o.rows) / 2) hurtModule(world, o, dmg, 'F', null);
    }
    for (const u of world.near(c.x, c.y, 1.8)) hurt(world, u, dmg, 'F', null);
  }
  void hurtWall; void wallMid; void knockback; void killUnit;
}

// ------------------------------------------------------------------ Tick

function onlyOwnerUnits(world: World, m: Module, r: number, f: (u: Unit) => boolean = () => true): Unit[] {
  const c = modCenter(m);
  return world.near(c.x, c.y, r, (u) => u.team === m.owner && f(u));
}

export function buildingsTick(world: World) {
  for (const m of world.modules.values()) {
    if (m.destroyed || m.kind === 'core') continue;
    if (m.buildEnd > world.tick) continue;
    const owner = m.owner;
    const eff = modEff(world, m);
    const hs = HEAL[m.card];
    if (hs) healStep(world, m, hs);
    const tw = TOWER[m.card];
    if (tw) towerStep(world, m, tw);
    const enemy = enemyOfTeam(owner);
    switch (m.card) {
      case 'BS-05': { // Stachelflur
        for (const u of enemiesOnCells(world, m)) {
          if (u.flying || u.ghost || unitFx(u.cid).ignoreTraps) continue;
          hurt(world, u, 10 * DT, 'W', null, { noXp: true });
          addStatus(world, u, 'slow', 0.3, 20);
        }
        break;
      }
      case 'BS-06': { // Fallgrube
        if (m.s.pitWave !== world.waveNo) { m.s.pitWave = world.waveNo; m.s.pitN = 0; }
        if ((m.s.pitN ?? 0) < 2) {
          for (const u of enemiesOnCells(world, m)) {
            if (u.flying || u.ghost || unitFx(u.cid).ignoreTraps || u.s['pit' + m.id] === world.waveNo) continue;
            u.s['pit' + m.id] = world.waveNo;
            m.s.pitN++;
            hurt(world, u, 60, 'W', null);
            addStatus(world, u, 'stunned', 4);
            world.emit({ t: 'text', x: u.x, y: u.y - 0.7, text: 'pit!', color: '#ffe9a8' });
            if (m.s.pitN >= 2) break;
          }
        }
        break;
      }
      case 'BS-08': { // Drehtür-Irrgarten
        for (const u of enemiesOnCells(world, m)) {
          if (u.flying || u.ghost || world.tick < (u.s.mazeImmune ?? 0)) continue;
          addStatus(world, u, 'confused', 3);
          u.s.mazeImmune = world.tick + 13 * TPS;
        }
        break;
      }
      case 'BS-09': { // Löschteich
        for (const u of onlyOwnerUnits(world, m, 3)) removeStatus(u, 'burning');
        for (const o of world.modules.values()) {
          if (o.owner === owner && o.burning > world.tick && dist(modCenter(o).x, modCenter(o).y, modCenter(m).x, modCenter(m).y) <= 3.5) o.burning = 0;
        }
        break;
      }
      case 'BU-02': { // Kantine
        if (world.tick % 30 === 0 && eff > 0) for (const u of alliesIn(world, m, true)) if (u.cat !== 'citizen') addStatus(world, u, 'sated', 40);
        break;
      }
      case 'BU-03': { // Reparaturwerkstatt
        if (eff <= 0) break;
        const rate = 8 * eff * DT;
        const mc = modCenter(m);
        for (const o of world.modules.values()) {
          if (o.owner !== owner || o.destroyed || o.id === m.id || o.hp >= o.maxHp) continue;
          const oc = modCenter(o);
          if (Math.abs(oc.x - mc.x) <= (o.cols + m.cols) / 2 + 0.1 && Math.abs(oc.y - mc.y) <= (o.rows + m.rows) / 2 + 0.1) o.hp = Math.min(o.maxHp, o.hp + rate);
        }
        for (const w of world.walls.values()) {
          if (w.owner !== owner || w.door || w.hp <= 0 || w.hp >= w.maxHp) continue;
          const mid = wallMid(w);
          if (mid.x >= m.x0 - 0.1 && mid.x <= m.x0 + m.cols + 0.1 && mid.y >= m.y0 - 0.1 && mid.y <= m.y0 + m.rows + 0.1) w.hp = Math.min(w.maxHp, w.hp + rate);
        }
        break;
      }
      case 'BU-04': { // Alarmglocke
        if (world.tick % 10 === 0) {
          for (const u of world.units) {
            if (u.dead || u.team !== enemy || u.flying && false) continue;
            const i = ci(Math.floor(u.x), Math.floor(u.y));
            if (world.owner[i] === owner && world.kind[i] !== 0) { m.s.alarmUntil = world.tick + 5 * TPS; break; }
          }
        }
        break;
      }
      case 'BU-06': { // Eilgang: Freunde x3
        for (const u of alliesOnCells(world, m)) addStatus(world, u, 'haste', 0.3, 200);
        break;
      }
      case 'BW-07': { // Drillplatz: XP für Anwesende
        for (const u of alliesOnCells(world, m)) if (u.cat !== 'citizen') gainXp(world, u, 0.6 * DT);
        break;
      }
      case 'BF-07': { // Gewächshaus: Bauteile im Radius 2 regenerieren
        if (eff <= 0) break;
        const c = modCenter(m);
        for (const o of world.modules.values()) {
          if (o.owner !== owner || o.destroyed) continue;
          const oc = modCenter(o);
          if (dist(oc.x, oc.y, c.x, c.y) <= 2 + Math.max(o.cols, o.rows) / 2) o.hp = Math.min(o.maxHp, o.hp + 1 * DT);
        }
        break;
      }
      case 'BF-09': { // Tempel der Heiterkeit
        if (m.s.wave !== world.waveNo && eff > 0) {
          m.s.wave = world.waveNo;
          const cand = world.units.filter((u) => !u.dead && u.team === owner && u.cat !== 'citizen');
          for (let k = 0; k < 2 && cand.length; k++) { const u = cand.splice(world.rng.int(cand.length), 1)[0]; addStatus(world, u, 'blessed', 15, 40); }
        }
        break;
      }
      case 'BC-01': { // Wunschbrunnen
        if (m.s.wave !== world.waveNo) {
          m.s.wave = world.waveNo;
          const r = world.rng.next();
          const mine = world.units.filter((u) => !u.dead && u.team === owner && u.cat !== 'citizen');
          if (r < 0.35) for (const u of mine) healUnit(world, u, u.maxHp * 0.15, null);
          else if (r < 0.6) for (let k = 0; k < 3 && mine.length; k++) gainXp(world, mine.splice(world.rng.int(mine.length), 1)[0], 40);
          else if (r < 0.8) { const a = zoneAnchor(owner, 'middle'); for (let k = 0; k < 3; k++) createUnit(world, owner, 'citizen', a.x + world.rng.range(-1, 1), a.y + world.rng.range(-1, 1)); }
          world.feed('The wishing well grants a wish', owner);
        }
        break;
      }
      case 'BC-02': { // Kuckucksuhr
        if (eff > 0 && world.tick >= (m.s.cd ?? 0)) {
          m.s.cd = world.tick + 30 * TPS;
          const core = modCenter(world.modules.get(world.coreMod[owner])!);
          let best: Unit | null = null, bd = Infinity;
          for (const u of world.units) {
            if (u.dead || u.team !== enemy || u.cat === 'assault' === false) continue;
            const i = ci(Math.floor(u.x), Math.floor(u.y));
            if (world.owner[i] !== owner) continue;
            const d = dist(u.x, u.y, core.x, core.y);
            if (d < bd) { bd = d; best = u; }
          }
          if (best) {
            const g = gateInner(owner);
            best.x = g.x + (owner === 0 ? 1.2 : -1.2); best.y = g.y; best.path = []; best.repath = 0;
            addStatus(world, best, 'stunned', 2);
            world.emit({ t: 'fx', x: best.x, y: best.y, name: 'puff' });
          }
        }
        break;
      }
      case 'BC-04': { // Schunkelsaal
        if (eff > 0 && world.tick >= (m.s.cd ?? 0)) { m.s.cd = world.tick + 8 * TPS; for (const u of enemiesIn(world, m, true)) addStatus(world, u, 'dancing', 2); }
        break;
      }
      case 'BC-05': { // Schwerkraft-Umkehrer
        if (eff > 0 && world.tick >= (m.s.cd ?? 0)) {
          const t = enemiesIn(world, m, true);
          if (t.length) {
            m.s.cd = world.tick + 15 * TPS;
            for (const u of t) { addStatus(world, u, 'floating', 3); u.s.dropAt = world.tick + 3 * TPS; }
          }
        }
        break;
      }
      case 'BC-07': { // Hüpfhalle
        if (eff > 0 && world.tick % (4 * TPS) === 0) {
          const c = modCenter(m);
          for (const u of enemiesIn(world, m)) knockback(world, u, c.x, c.y, 2);
        }
        break;
      }
      case 'BC-08': { // Zeitlupen-Teesalon
        if (eff > 0) {
          for (const u of enemiesIn(world, m)) addStatus(world, u, 'chilled', 0.4);
          if (world.tick % 5 === 0) for (const u of alliesIn(world, m)) addStatus(world, u, 'haste', 0.4, 10);
        }
        break;
      }
      case 'BC-06': { // lebende Schatztruhe
        if (!m.s.used) {
          const c = modCenter(m);
          const t = world.near(c.x, c.y, 1.1, (u) => u.team === enemy && enemyVisible(u) && !u.flying)[0];
          if (t) {
            m.s.used = 1;
            hurt(world, t, 120, 'W', null);
            if (!t.dead) { t.state = 'swallowed'; t.s.spitAt = world.tick + 5 * TPS; }
            world.emit({ t: 'text', x: c.x, y: c.y - 0.8, text: 'CHOMP', color: '#ffe9a8' });
          }
        }
        break;
      }
      default: break;
    }
  }
  // Schwerkraft-Aufprall
  for (const u of world.units) {
    if (u.s.dropAt && world.tick >= u.s.dropAt && !u.dead) {
      u.s.dropAt = 0;
      hurt(world, u, 40, 'W', null);
    }
    if (u.s.regen && !u.dead) healUnit(world, u, u.s.regen * DT, null);
  }
  void igniteModule;
}

function enemiesOnCells(world: World, m: Module): Unit[] {
  const enemy = enemyOfTeam(m.owner);
  const out: Unit[] = [];
  for (const u of world.units) {
    if (u.dead || u.team !== enemy || u.state === 'burrow') continue;
    if (m.cells.includes(ci(Math.floor(u.x), Math.floor(u.y)))) out.push(u);
  }
  return out;
}
function alliesOnCells(world: World, m: Module): Unit[] {
  const out: Unit[] = [];
  for (const u of world.units) {
    if (u.dead || u.team !== m.owner) continue;
    if (m.cells.includes(ci(Math.floor(u.x), Math.floor(u.y)))) out.push(u);
  }
  return out;
}

export { PLOT, BUILDINGS };
