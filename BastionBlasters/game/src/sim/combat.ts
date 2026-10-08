// Kampf: Nahkampf/Fernkampf, Strukturschaden, Artillerie, Projektile, Einschläge

import { DT, MAT_MULT, TPS, type DType, type Team } from './constants';
import { destroyModule } from './bastion';
import { BUILDINGS, buildingDef } from './data';
import { artMods, onModuleDestroyed } from './bfx';
import { aidOf } from './catchup';
import { ART_FX } from './artfx';
import { unitFx } from './fx';
import { traceLine, type LosHit } from './nav';
import type { Module, Projectile, Unit, UnitDef, Wall } from './types';
import { K_CORE } from './types';
import { addStatus, defOf, gainXp, healUnit, hurt, killUnit } from './units';
import { ci, dist, inMap, type World } from './world';

const DTYPES: DType[] = ['F', 'E', 'B', 'G', 'A'];

export function modCenter(m: Module): { x: number; y: number } {
  return { x: m.x0 + m.cols / 2, y: m.y0 + m.rows / 2 };
}
export function wallMid(w: Wall): { x: number; y: number } {
  return w.dir === 'E' ? { x: w.x + 1, y: w.y + 0.5 } : { x: w.x + 0.5, y: w.y + 1 };
}

// ------------------------------------------------------------------ Strukturschaden

export function wallMult(w: Wall, dtype: DType): number {
  let m = MAT_MULT[dtype][w.material];
  if (w.variant === 'armor' && (dtype === 'W' || dtype === 'G')) m *= 0.7;
  if (w.variant === 'ward' && (dtype === 'A' || dtype === 'B')) m *= 0.5;
  return m;
}

export function hurtWall(world: World, w: Wall, amount: number, dtype: DType, src: Unit | null): number {
  if (w.door || w.hp <= 0 || amount <= 0) return 0;
  const dmg = Math.min(w.hp, amount * wallMult(w, dtype) * (1 - aidOf(world, w.owner).shield));
  w.hp -= dmg;
  if (src) {
    gainXp(world, src, 0.08 * dmg);
    world.stats.dmgStruct[src.team] += dmg;
  }
  if (w.hp <= 0.01) {
    w.hp = 0;
    const mid = wallMid(w);
    world.emit({ t: 'break', x: mid.x, y: mid.y, what: w.gate ? 'gate' : 'wall' });
    world.stats.wallsBroken[w.owner === 0 ? 1 : 0]++;
    world.feed(w.gate ? 'The gate is broken!' : 'A wall segment is breached', w.owner);
  }
  return dmg;
}

export function moduleMult(m: Module, dtype: DType): number {
  let k = MAT_MULT[dtype][m.material];
  if (m.frozen > 0) k *= 1;
  return k;
}

export function hurtModule(world: World, m: Module, amount: number, dtype: DType, src: Unit | null, srcTeam?: Team): number {
  if (m.destroyed || amount <= 0) return 0;
  let dmg = amount * moduleMult(m, dtype) * (1 - aidOf(world, m.owner).shield);
  if (m.card === 'BC-09') dmg *= 1;
  dmg = Math.min(m.hp, dmg);
  m.hp -= dmg;
  const t = src ? src.team : srcTeam;
  if (src) gainXp(world, src, 0.08 * dmg);
  if (t !== undefined) world.stats.dmgStruct[t] += dmg;
  if (dtype === 'F' && dmg > 0 && (m.material === 'wood' || m.material === 'organic') && world.rng.chance(0.05)) igniteModule(world, m, 4);
  if (m.hp <= 0.01) {
    m.hp = 0;
    const c = modCenter(m);
    const name = m.kind === 'core' ? 'The core' : buildingDef(m.card).name;
    if (m.kind === 'core') {
      world.emit({ t: 'break', x: c.x, y: c.y, what: 'core' });
    } else {
      destroyModule(world, m);
      onModuleDestroyed(world, m);
      world.emit({ t: 'break', x: c.x, y: c.y, what: 'module' });
      world.feed(`${name} is destroyed`, m.owner);
    }
  }
  return dmg;
}

export function igniteModule(world: World, m: Module, secs: number) {
  if (m.destroyed) return;
  if (rainOver(world, m)) return;
  m.burning = Math.max(m.burning, world.tick + Math.round(secs * TPS));
}

export function rainOver(world: World, m: Module): boolean {
  const c = modCenter(m);
  for (const a of world.areas) if (a.kind === 'rain' && a.until > world.tick && dist(a.x, a.y, c.x, c.y) <= a.r) return true;
  return false;
}

// ------------------------------------------------------------------ Einheiten greifen an

export function attackInterval(world: World, u: Unit, def: UnitDef): number {
  let atk = u.mods.atkSpeed;
  const fx = unitFx(u.cid);
  if (fx.ramp) {
    const t = Math.max(0, (world.tick - (u.s.combatStart ?? world.tick)) / TPS);
    atk *= 1 + Math.min(fx.ramp.max, fx.ramp.perS * t);
  }
  return Math.max(0.08, (def.interval ?? 1) / atk);
}

export function pickType(world: World, def: UnitDef): DType {
  if (def.dtype === 'R') return world.rng.pick(DTYPES);
  return (def.dtype ?? 'W') as DType;
}

export function knockback(world: World, u: Unit, fx0: number, fy0: number, cells: number) {
  const f = unitFx(u.cid);
  if (f.noKnock || u.ghost || u.flying) return;
  let dx = u.x - fx0, dy = u.y - fy0;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;
  const step = 0.25;
  for (let k = 0; k < cells / step; k++) {
    const nx = u.x + dx * step, ny = u.y + dy * step;
    const cx = Math.floor(u.x), cy = Math.floor(u.y), mx = Math.floor(nx), my = Math.floor(ny);
    if (mx !== cx || my !== cy) {
      if (mx !== cx && my !== cy) break;
      const ok = !world.solid(mx, my) && (() => { const w = world.edgeBetween(cx, cy, mx, my); return !w || w.door || w.hp <= 0 || (w.gate && w.owner === u.team); })();
      if (!ok) break;
    }
    u.x = nx; u.y = ny;
  }
  u.path = [];
  u.repath = 0;
}

/** Angriff Einheit gegen Einheit (Treffer sind sicher) */
export function attackUnit(world: World, u: Unit, t: Unit) {
  const def = defOf(u)!;
  const fx = unitFx(u.cid);
  const interval = attackInterval(world, u, def);
  u.cd = world.tick + Math.max(1, Math.round(interval * TPS));
  u.inCombat = world.tick;
  if (!u.s.combatStart) u.s.combatStart = world.tick;
  const dtype = pickType(world, def);
  const melee = (def.range ?? 1.1) <= 1.3;
  let mult = 1;
  if (fx.firstHit && !u.s['fh' + t.id]) {
    u.s['fh' + t.id] = 1;
    mult *= fx.firstHit.mult ?? 1;
  }
  if (fx.firstVsCiv && (t.cat === 'citizen' || t.cat === 'civilian') && !u.s.civStrike) {
    u.s.civStrike = 1;
    mult *= fx.firstVsCiv;
  }
  if (u.invisible) u.invisible = false;
  // Ziele sammeln
  let targets: Unit[] = [t];
  if (fx.area) targets = world.near(t.x, t.y, fx.area, (o) => o.team !== u.team && !o.dead && enemyVisible(o) && canHitUnit(u, o));
  else if (def.cone) targets = coneTargets(world, u, t, def.cone);
  else if (fx.multi) {
    const extra = world.near(u.x, u.y, (def.range ?? 1.1) + 0.5, (o) => o.team !== u.team && o.id !== t.id && !o.dead && canHitUnit(u, o)).slice(0, fx.multi - 1);
    targets = [t, ...extra];
  }
  if (!melee) world.emit({ t: 'shot', x0: u.x, y0: u.y - 0.4, x1: t.x, y1: t.y - 0.3, fly: 5, vis: shotVis(def, dtype), team: u.team, cid: u.cid });
  const hits = def.hits ?? 1;
  let dealtTotal = 0;
  for (const o of targets) {
    if (o.dead) continue;
    // Ausweichen (Armbrustfrosch)
    const ofx = unitFx(o.cid);
    if (melee && ofx.dodge && world.tick >= (o.s.dodgeAt ?? 0)) {
      o.s.dodgeAt = world.tick + Math.round(ofx.dodge * TPS);
      world.emit({ t: 'text', x: o.x, y: o.y - 0.6, text: 'dodge', color: '#ffe9a8' });
      continue;
    }
    for (let h = 0; h < hits; h++) {
      const base = (u.s.dmgOverride ?? def.dmg ?? 0) * u.mods.dmgDealt * mult;
      if (o.dead) break;
      dealtTotal += hurt(world, o, base, dtype, u, { melee });
    }
    if (o.dead) continue;
    if (fx.onHit) for (const s of fx.onHit) if (s.chance === undefined || world.rng.chance(s.chance)) addStatus(world, o, s.s, s.dur, s.power ?? 1, u.id);
    if (fx.firstHit && mult > 1 && fx.firstHit.stun) addStatus(world, o, 'stunned', fx.firstHit.stun, 1, u.id);
    const kn = (fx.knock ?? 0) + (fx.firstHit && mult > 1 ? fx.firstHit.knock ?? 0 : 0);
    if (kn > 0) knockback(world, o, u.x, u.y, kn);
    if (fx.fearCiv && (o.cat === 'citizen' || o.cat === 'civilian') && world.rng.chance(fx.fearCiv)) addStatus(world, o, 'feared', 3, 1, u.id);
    if (fx.fearAny && world.rng.chance(fx.fearAny)) addStatus(world, o, 'feared', 2, 1, u.id);
  }
  if (fx.lifesteal && dealtTotal > 0) healUnit(world, u, dealtTotal * fx.lifesteal, null);
  // zufällige Schadensart mit Fehlzauber (Wirrkopf-Lehrling)
  if (fx.randomType && world.rng.chance(0.1)) {
    addStatus(world, t, 'frogged', 3, 1, u.id);
    if (world.rng.chance(0.5)) addStatus(world, u, 'frogged', 3, 1, u.id);
  }
  if (fx.onAttack) fx.onAttack(world, u, t);
}

export function enemyVisible(o: Unit): boolean {
  return !o.invisible && o.state !== 'burrow' && o.state !== 'swallowed' && !o.dead;
}

/** Fliegende Ziele nur für Flieger und Türme mit Reichweite >= 8 (Glossar "Flying") */
export function canHitUnit(a: Unit | { flying: boolean }, o: Unit): boolean {
  if (o.flying && !a.flying) return false;
  return true;
}

function coneTargets(world: World, u: Unit, t: Unit, len: number): Unit[] {
  const dx = t.x - u.x, dy = t.y - u.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  return world.near(u.x, u.y, len + 0.5, (o) => {
    if (o.team === u.team || o.dead || !enemyVisible(o) || !canHitUnit(u, o)) return false;
    const vx = o.x - u.x, vy = o.y - u.y;
    const dd = Math.hypot(vx, vy) || 0.001;
    return (vx * ux + vy * uy) / dd > 0.55;
  });
}

export function shotVis(def: UnitDef, dtype: DType): string {
  if (def.cone) return 'flame';
  switch (dtype) {
    case 'F': return 'fire';
    case 'E': return 'ice';
    case 'B': return 'bolt';
    case 'G': return 'poison';
    case 'A': return 'arcane';
    default: return def.id === 'US-04' || def.id === 'UV-12' ? 'arrow' : 'stone';
  }
}

/** Angriff Einheit gegen ein Bauteil (Mauer, Raum, Turm) */
export function attackStruct(world: World, u: Unit, tgt: NonNullable<Unit['tstruct']>) {
  const def = defOf(u)!;
  const fx = unitFx(u.cid);
  const interval = attackInterval(world, u, def);
  u.cd = world.tick + Math.max(1, Math.round(interval * TPS));
  u.inCombat = world.tick;
  if (u.invisible) u.invisible = false;
  const dtype = pickType(world, def);
  const coreHit = tgt.kind === 'module' && world.modules.get(tgt.id)?.kind === 'core';
  // Der Kernkristall zerbricht unter dem Hammer der Eindringlinge: volle Wucht statt Bauteil-Faktor
  const sf = (coreHit ? Math.max(1, def.structFactor ?? 0.4) : (def.structFactor ?? 0.4)) * (fx.structBonus ?? 1);
  const base = (u.s.dmgOverride ?? def.dmg ?? 0) * u.mods.dmgDealt * sf * (def.hits ?? 1);
  if (tgt.kind === 'wall') {
    const w = world.walls.get(tgt.id);
    if (w) {
      hurtWall(world, w, base, dtype, u);
      if (w.variant === 'pudding') addStatus(world, u, 'slimed', 2, 1, 0);
    }
  } else if (tgt.kind === 'module') {
    const m = world.modules.get(tgt.id);
    if (m) {
      const dealt = hurtModule(world, m, base, dtype, u);
      if (coreHit && dealt > 0) world.emit({ t: 'hit', x: u.x, y: u.y - 0.4, dmg: Math.round(dealt), team: m.owner });
    }
  }
}

// ------------------------------------------------------------------ Artillerie

export interface ArtTarget {
  x: number;
  y: number;
  kind: 'wall' | 'module' | 'core' | 'cell';
  id: number;
  hits?: LosHit[];
}

const GROUP_VALUE: Record<string, number> = {
  Healing: 8, Platforms: 7, Turrets: 6, Unlock: 5, Workshops: 5, Utility: 4, Countermeasures: 5, Chaos: 3, Defense: 2,
};

function moduleValue(m: Module): number {
  if (m.kind === 'core') return 1.5;
  const def = BUILDINGS[m.card];
  let v = GROUP_VALUE[def.group] ?? 3;
  if (m.hp < m.maxHp * 0.7) v += 3;
  if (m.posts > 0) v *= 0.6 + 0.4 * (m.staffed / m.posts);
  return v;
}

export function slotPos(world: World, u: Unit): { x: number; y: number } {
  if (u.slot) {
    const m = world.modules.get(u.slot.mod);
    const s = m?.slots[u.slot.idx];
    if (s) return { x: s.x, y: s.y };
  }
  return { x: u.x, y: u.y };
}

function rayPoint(x0: number, y0: number, x1: number, y1: number, d: number) {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1;
  return { x: x0 + ((x1 - x0) / L) * d, y: y0 + ((y1 - y0) / L) * d };
}

/** Ziel wählen. Flach/Durchschlag brauchen freie Schusslinie, die anderen treffen jede Zelle in Reichweite. */
export function chooseArtTarget(world: World, u: Unit, def: UnitDef, range: number): ArtTarget | null {
  const sp = slotPos(world, u);
  const enemy: Team = u.team === 0 ? 1 : 0;
  const traj = def.traj!;
  const direct = traj === 'flat' || traj === 'pierce';
  const prio = u.prio;
  const cands: { t: ArtTarget; score: number }[] = [];
  const coreM = world.modules.get(world.coreMod[enemy])!;
  const coreC = modCenter(coreM);

  if (prio === 'scatterer' && !direct) {
    // zufällige bebaute Zelle in Reichweite
    for (let k = 0; k < 12; k++) {
      const m = pickRandomModule(world, enemy);
      if (!m) break;
      const c = modCenter(m);
      if (dist(sp.x, sp.y, c.x, c.y) <= range) return { x: c.x + world.rng.range(-1, 1), y: c.y + world.rng.range(-1, 1), kind: 'cell', id: 0 };
    }
  }

  for (const m of world.modules.values()) {
    if (m.owner !== enemy || m.destroyed) continue;
    const c = modCenter(m);
    const d = dist(sp.x, sp.y, c.x, c.y);
    if (d > range + Math.max(m.cols, m.rows) / 2) continue;
    let aim = c;
    let hits: LosHit[] | undefined;
    if (direct) {
      let ok = false;
      for (const cell of m.cells) {
        const cx = (cell % 56) + 0.5, cy = Math.floor(cell / 56) + 0.5;
        if (dist(sp.x, sp.y, cx, cy) > range) continue;
        const h = traceLine(world, sp.x, sp.y, cx, cy, u.team, 1);
        if (h.length && h[0].id === m.id) { aim = { x: cx, y: cy }; hits = h; ok = true; break; }
      }
      if (!ok) continue;
    } else if (d > range) continue;
    let score = moduleValue(m);
    if (prio === 'weaponHunter') score = m.kind === 'tower' || (BUILDINGS[m.card]?.gunSlots ?? 0) > 0 ? 10 : BUILDINGS[m.card]?.group === 'Countermeasures' ? 7 : 1;
    else if (prio === 'coreHunt') score = m.kind === 'core' ? 100 : 10 / (1 + dist(c.x, c.y, coreC.x, coreC.y));
    else if (prio === 'breaker' && !direct) score = moduleValue(m);
    else if (prio === 'breaker') score = 1;
    cands.push({ t: { x: aim.x, y: aim.y, kind: m.kind === 'core' ? 'core' : 'module', id: m.id, hits }, score: score + world.rng.next() * 0.5 });
  }
  if (direct) {
    for (const w of world.walls.values()) {
      if (w.owner !== enemy || w.door || w.hp <= 0) continue;
      const mid = wallMid(w);
      const d = dist(sp.x, sp.y, mid.x, mid.y);
      if (d > range) continue;
      const far = rayPoint(sp.x, sp.y, mid.x, mid.y, d + 0.05);
      const h = traceLine(world, sp.x, sp.y, far.x, far.y, u.team, 1);
      if (!h.length || h[0].id !== w.id) continue;
      let score = 1.2;
      if (w.gate) score = 1.5;
      if (prio === 'breaker') score = 6 + 8 / (1 + dist(mid.x, mid.y, coreC.x, coreC.y)) + (w.hp < w.maxHp ? 2 : 0);
      else if (prio === 'coreHunt') score = 4 + 8 / (1 + dist(mid.x, mid.y, coreC.x, coreC.y));
      else if (prio === 'weaponHunter') score = 0.5;
      cands.push({ t: { x: mid.x, y: mid.y, kind: 'wall', id: w.id, hits: h }, score: score + world.rng.next() * 0.5 });
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  return cands[0].t;
}

function pickRandomModule(world: World, owner: Team): Module | undefined {
  const arr: Module[] = [];
  for (const m of world.modules.values()) if (m.owner === owner && !m.destroyed) arr.push(m);
  return arr.length ? arr[world.rng.int(arr.length)] : undefined;
}

export function artilleryStep(world: World, u: Unit) {
  if (!u.mods.canAct || !u.mods.canAttack) return;
  if (world.tick < u.cd) return;
  const def = defOf(u)!;
  const am = artMods(world, u.team);
  const range = (def.reach ?? 26) + am.range + (am.rangeArcane && isArcane(def) ? (def.reach ?? 0) * am.rangeArcane : 0);
  const tgt = chooseArtTarget(world, u, def, range);
  const baseInterval = (def.interval ?? 6) * am.reload / u.mods.atkSpeed;
  if (!tgt) {
    u.cd = world.tick + 15;
    return;
  }
  fireArtillery(world, u, def, tgt, baseInterval, am);
}

function isArcane(def: UnitDef): boolean {
  return def.line === 'Arcane' || def.dtype === 'A';
}

export function fireArtillery(world: World, u: Unit, def: UnitDef, tgt: ArtTarget, interval: number, am: ReturnType<typeof artMods>) {
  const sp = slotPos(world, u);
  const traj = def.traj!;
  u.cd = world.tick + Math.max(1, Math.round(interval * TPS));
  world.stats.shots[u.team]++;
  if (u.invisible) u.invisible = false;
  u.inCombat = world.tick;
  const dtype = (def.dtype === 'R' ? 'W' : def.dtype ?? 'W') as DType;
  const rankM = u.mods.dmgDealt;
  const madness = 1 + world.madness;
  const aidArt = 1 + aidOf(world, u.team).arty; // Aufholhilfe: Gegenfeuer
  const structDmg = (def.structDmg ?? 0) * rankM * am.struct * madness * aidArt;
  const personDmg = (def.personDmg ?? 0) * rankM * madness * aidArt;
  const d = dist(sp.x, sp.y, tgt.x, tgt.y);
  const count = traj === 'scatter' ? def.count ?? 1 : 1;
  const bombs = def.id === 'UA-14' ? 2 : 1;
  const vis = def.id === 'UA-09' ? 'bat' : def.id === 'UA-14' ? 'bomb' : def.id === 'UA-04' || def.id === 'UA-05' ? 'goblin'
    : traj === 'vertical' ? (dtype === 'E' ? 'icicle' : dtype === 'A' ? 'meteor' : 'stone') : dtype === 'F' ? 'fire' : dtype === 'B' ? 'bolt' : dtype === 'G' ? 'poison' : dtype === 'A' ? 'arcane' : def.id === 'UA-08' ? 'ink' : 'stone';
  const spreadBase = (0.4 + 0.04 * d) * am.spread * (hasBlind(u) ? 2 : 1);
  const n = traj === 'scatter' ? count : bombs;
  for (let i = 0; i < n; i++) {
    let ax = tgt.x, ay = tgt.y;
    let fly: number;
    switch (traj) {
      case 'flat': case 'pierce': fly = Math.max(0.5, 0.3 + d * 0.03); break;
      case 'arc': fly = 1.2 + d / 70; break;
      case 'vertical': fly = 2.0; break;
      case 'air': fly = 1.4 + d / 90; break;
      case 'under': fly = 0.8 + d / 80; break;
      default: fly = 1.2 + d / 70;
    }
    const proj: Projectile = {
      id: world.id(), team: u.team, kind: traj, x0: sp.x, y0: sp.y, x1: ax, y1: ay, t0: world.tick, t1: world.tick + Math.round(fly * TPS) + i * 4,
      src: u.id, cid: u.cid, structDmg: traj === 'scatter' ? structDmg : structDmg, personDmg: traj === 'scatter' ? personDmg : personDmg,
      dtype, splash: def.splash ?? 0, pierce: traj === 'pierce' ? (def.id === 'UA-17' ? 5 : 3) : 0, vis, spec: {},
    };
    if (traj === 'flat' || traj === 'pierce') {
      const hits = tgt.hits ?? traceLine(world, sp.x, sp.y, ax, ay, u.team, 1 + proj.pierce);
      if (traj === 'pierce') {
        const far = rayPoint(sp.x, sp.y, ax, ay, d + 12);
        const hs = traceLine(world, sp.x, sp.y, far.x, far.y, u.team, 1 + proj.pierce);
        proj.spec.hitsN = hs.length;
        (proj as unknown as { hitList: LosHit[] }).hitList = hs;
        const last = hs[hs.length - 1] ?? hits[0];
        if (last) { const p = rayPoint(sp.x, sp.y, ax, ay, last.dist); proj.x1 = p.x; proj.y1 = p.y; }
      } else if (hits.length) {
        const p = rayPoint(sp.x, sp.y, ax, ay, hits[0].dist);
        proj.x1 = p.x; proj.y1 = p.y;
        proj.hit = { kind: hits[0].kind, id: hits[0].id };
        (proj as unknown as { hitList: LosHit[] }).hitList = hits;
      }
    } else if (traj === 'scatter') {
      ax += world.rng.range(-1.5, 1.5);
      ay += world.rng.range(-1.5, 1.5);
      proj.x1 = ax; proj.y1 = ay;
    } else {
      const sr = traj === 'under' ? 0.8 : traj === 'vertical' ? spreadBase * 0.5 : spreadBase;
      const ang = world.rng.next() * Math.PI * 2;
      const rr = Math.sqrt(world.rng.next()) * sr * (traj === 'air' ? 0.8 : 1);
      proj.x1 = ax + Math.cos(ang) * rr + (n > 1 ? world.rng.range(-0.6, 0.6) : 0);
      proj.y1 = ay + Math.sin(ang) * rr + (n > 1 ? world.rng.range(-0.6, 0.6) : 0);
    }
    // Nebel: Fehlschuss
    applyFog(world, proj);
    world.projectiles.push(proj);
    if (traj === 'arc' || traj === 'vertical' || traj === 'air' || traj === 'scatter') {
      world.areas.push({
        id: world.id(), team: u.team === 0 ? 1 : 0, x: proj.x1, y: proj.y1, r: Math.max(1.0, def.splash ?? 0, traj === 'scatter' ? 0.8 : 0),
        until: proj.t1, kind: 'shadow', dps: 0, dtype: 'W', src: u.id,
      });
    }
    world.emit({ t: 'shot', x0: sp.x, y0: sp.y, x1: proj.x1, y1: proj.y1, fly: proj.t1 - world.tick, vis, team: u.team, cid: u.cid });
  }
  const afx = ART_FX[def.id];
  if (afx?.onFire) afx.onFire(world, u, tgt);
}

function hasBlind(u: Unit): boolean {
  return u.st.some((s) => s.id === 'blinded');
}

function applyFog(world: World, p: Projectile) {
  const enemy: Team = p.team === 0 ? 1 : 0;
  if (p.kind !== 'under') {
    for (const u of world.units) {
      if (u.dead || u.team !== enemy || u.cid !== 'UZ-15') continue;
      if (dist(u.x, u.y, p.x1, p.y1) <= 2.2 && world.rng.chance(0.35)) {
        const a = world.rng.next() * Math.PI * 2;
        p.x1 += Math.cos(a) * 1.4;
        p.y1 += Math.sin(a) * 1.4;
        world.emit({ t: 'text', x: u.x, y: u.y - 0.8, text: 'foresight', color: '#c8f0ff' });
        break;
      }
    }
  }
  for (const m of world.modules.values()) {
    if (m.owner !== enemy || m.destroyed || m.card !== 'BA-02' || m.buildEnd > world.tick) continue;
    const c = modCenter(m);
    if (dist(c.x, c.y, p.x1, p.y1) <= 4 && p.kind !== 'under') {
      const eff = m.posts ? m.staffed / m.posts : 1;
      if (world.rng.chance(0.3 * eff)) {
        const a = world.rng.next() * Math.PI * 2;
        p.x1 += Math.cos(a) * 1.3;
        p.y1 += Math.sin(a) * 1.3;
      } else {
        const a = world.rng.next() * Math.PI * 2, r = world.rng.range(0, 0.8) * eff;
        p.x1 += Math.cos(a) * r;
        p.y1 += Math.sin(a) * r;
      }
    }
  }
}

// ------------------------------------------------------------------ Projektile und Einschläge

export function projectileStep(world: World) {
  if (!world.projectiles.length) return;
  const keep: Projectile[] = [];
  for (const p of world.projectiles) {
    if (world.tick >= p.t1) impact(world, p);
    else keep.push(p);
  }
  world.projectiles = keep;
}

interface HitListProj extends Projectile { hitList?: LosHit[] }

function impact(world: World, p: Projectile) {
  const enemy: Team = p.team === 0 ? 1 : 0;
  const src = world.byId.get(p.src) ?? null;
  const srcAlive = src && !src.dead ? src : null;
  const hp = p as HitListProj;
  if (defenseIntercept(world, p, enemy, srcAlive)) return;
  // Schutzkuppel (BA-01)
  if (absorbByDome(world, p, enemy)) {
    world.emit({ t: 'impact', x: p.x1, y: p.y1, r: 1, vis: 'dome' });
    return;
  }
  world.emit({ t: 'impact', x: p.x1, y: p.y1, r: Math.max(0.6, p.splash), vis: p.vis });
  let structMult = 1;
  // Trampolindach (BA-05): Bogen-/Senkrechtschaden im Radius 2 halbiert
  if (p.kind === 'arc' || p.kind === 'vertical' || p.kind === 'air') {
    for (const m of world.modules.values()) {
      if (m.owner === enemy && m.card === 'BA-05' && !m.destroyed && m.buildEnd <= world.tick) {
        const c = modCenter(m);
        if (dist(c.x, c.y, p.x1, p.y1) <= 2.5) structMult *= 0.5;
      }
    }
  }
  const afx = ART_FX[p.cid];
  if (p.kind === 'flat' || p.kind === 'pierce') {
    const hits = hp.hitList ?? (p.hit ? [{ kind: p.hit.kind, id: p.hit.id, x: 0, y: 0, dist: 0 }] : []);
    let falloff = 1;
    let n = 0;
    for (const h of hits) {
      if (n++ > p.pierce) break;
      const dmg = p.structDmg * falloff * structMult;
      let hx = p.x1, hy = p.y1;
      if (h.kind === 'wall') {
        const w = world.walls.get(h.id);
        if (!w || w.hp <= 0) { falloff *= 0.8; continue; }
        const mid = wallMid(w);
        hx = mid.x; hy = mid.y;
        hurtWall(world, w, dmg, p.dtype, srcAlive);
        if (p.splash > 0) splashStruct(world, enemy, hx, hy, p.splash, dmg * 0.5, p.dtype, srcAlive, w.id);
      } else {
        const m = world.modules.get(h.id);
        if (!m || m.destroyed) { falloff *= 0.8; continue; }
        const c = modCenter(m);
        hx = c.x; hy = c.y;
        let dd = dmg;
        if (m.kind === 'core' && afx?.coreMult) dd *= afx.coreMult;
        hurtModule(world, m, dd, p.dtype, srcAlive, p.team);
        personnel(world, p, enemy, m, hx, hy, falloff, srcAlive);
        if (p.splash > 0) splashStruct(world, enemy, hx, hy, p.splash, dmg * 0.5, p.dtype, srcAlive, 0);
      }
      if (afx?.onImpact) afx.onImpact(world, p, hx, hy, srcAlive);
      falloff *= 0.8;
    }
    if (!hits.length) world.emit({ t: 'impact', x: p.x1, y: p.y1, r: 0.5, vis: 'dust' });
    return;
  }
  // Bogen, Senkrecht, Luft, Streu, Untergrund: landen auf einer Zelle
  const cx = Math.floor(p.x1), cy = Math.floor(p.y1);
  const m = inMap(cx, cy) ? world.moduleAt(cx, cy) : undefined;
  const target = m && m.owner === enemy && !m.destroyed ? m : undefined;
  if (target) {
    let dd = p.structDmg * structMult;
    if (target.kind === 'core' && afx?.coreMult) dd *= afx.coreMult;
    hurtModule(world, target, dd, p.dtype, srcAlive, p.team);
  }
  if (p.splash > 0 || !target) {
    const r = Math.max(p.splash, 0.7);
    splashStruct(world, enemy, p.x1, p.y1, r, p.structDmg * structMult * (target ? 0.5 : 0.35), p.dtype, srcAlive, target?.id ?? 0);
  }
  if (p.kind !== 'under') personnel(world, p, enemy, target, p.x1, p.y1, 1, srcAlive);
  if (afx?.onImpact) afx.onImpact(world, p, p.x1, p.y1, srcAlive);
}

/** Blitzableiter, Fangnetz und Spiegel der Vergeltung fangen Geschosse ab */
function defenseIntercept(world: World, p: Projectile, enemy: Team, src: Unit | null): boolean {
  if (p.kind === 'under') return false;
  for (const m of world.modules.values()) {
    if (m.owner !== enemy || m.destroyed || m.buildEnd > world.tick) continue;
    const c = modCenter(m);
    const d = dist(c.x, c.y, p.x1, p.y1);
    const eff = m.posts ? Math.max(0, m.staffed / m.posts) : 1;
    if (eff <= 0) continue;
    if (m.card === 'BA-04' && d <= 4.5 && (p.dtype === 'B' || p.dtype === 'A')) {
      hurtModule(world, m, p.structDmg * 0.5, p.dtype, src, p.team);
      world.emit({ t: 'impact', x: c.x, y: c.y - 1, r: 1, vis: 'bolt' });
      return true;
    }
    const reflectable = p.kind === 'flat' || p.kind === 'arc' || p.kind === 'pierce';
    if (m.card === 'BA-03' && reflectable && d <= 4.5 && world.tick >= (m.s.cd ?? 0)) {
      m.s.cd = world.tick + 8 * TPS;
      throwBack(world, p, src, 0.4);
      world.emit({ t: 'text', x: c.x, y: c.y - 1, text: 'caught!', color: '#ffe9a8' });
      return true;
    }
    if (m.card === 'BA-06' && reflectable && d <= 5.5) {
      if (world.tick >= (m.s.nextAt ?? 0)) { m.s.mirrorUntil = world.tick + 6 * TPS; m.s.nextAt = world.tick + 25 * TPS; }
      if (world.tick < (m.s.mirrorUntil ?? 0)) {
        throwBack(world, p, src, 0.6);
        world.emit({ t: 'text', x: c.x, y: c.y - 1, text: 'reflected!', color: '#c8f0ff' });
        return true;
      }
    }
  }
  return false;
}

function throwBack(world: World, p: Projectile, src: Unit | null, k: number) {
  if (!src) return;
  const sp = slotPos(world, src);
  world.emit({ t: 'shot', x0: p.x1, y0: p.y1, x1: sp.x, y1: sp.y, fly: 14, vis: p.vis, team: p.team === 0 ? 1 : 0, cid: p.cid });
  hurt(world, src, (p.structDmg * 0.5 + p.personDmg) * k, p.dtype, null);
}

function absorbByDome(world: World, p: Projectile, enemy: Team): boolean {
  if (p.kind === 'under') return false;
  for (const m of world.modules.values()) {
    if (m.owner !== enemy || m.card !== 'BA-01' || m.destroyed || m.buildEnd > world.tick) continue;
    if (world.tick < (m.s.domeDown ?? 0)) continue;
    const c = modCenter(m);
    if (dist(c.x, c.y, p.x1, p.y1) > 3.5) continue;
    const eff = m.posts ? Math.max(0.3, m.staffed / m.posts) : 1;
    const maxS = 400 * eff;
    if (m.s.shield === undefined) m.s.shield = 400;
    m.s.shield = Math.min(m.s.shield, Math.max(maxS, 1));
    const dmg = p.structDmg + p.personDmg;
    m.s.shield -= dmg;
    if (m.s.shield <= 0) {
      m.s.shield = 400;
      m.s.domeDown = world.tick + 20 * TPS;
      world.feed('Shield dome breaks', enemy);
    }
    return true;
  }
  return false;
}

function splashStruct(world: World, enemy: Team, x: number, y: number, r: number, dmg: number, dtype: DType, src: Unit | null, skipId: number) {
  if (dmg <= 0) return;
  for (const m of world.modules.values()) {
    if (m.owner !== enemy || m.destroyed || m.id === skipId) continue;
    let near = false;
    for (const c of m.cells) {
      const cx = (c % 56) + 0.5, cy = Math.floor(c / 56) + 0.5;
      if (dist(cx, cy, x, y) <= r + 0.5) { near = true; break; }
    }
    if (near) hurtModule(world, m, dmg, dtype, src, src ? src.team : undefined);
  }
  for (const w of world.walls.values()) {
    if (w.owner !== enemy || w.door || w.hp <= 0 || w.id === skipId) continue;
    if (w.variant === 'pudding') continue; // Puddingwand schluckt Splash
    const mid = wallMid(w);
    if (dist(mid.x, mid.y, x, y) <= r + 0.3) hurtWall(world, w, dmg, dtype, src);
  }
}

/** Personenschaden: Einheiten im Einschlagraum voll, in Nachbarräumen 60 % */
function personnel(world: World, p: Projectile, enemy: Team, m: Module | undefined, x: number, y: number, falloff: number, src: Unit | null) {
  if (p.personDmg <= 0) return;
  const done = new Set<number>();
  const rooms = new Set<number>();
  if (m && m.kind === 'room') {
    rooms.add(m.id);
  }
  const apply = (u: Unit, mult: number) => {
    if (done.has(u.id) || u.dead) return;
    done.add(u.id);
    if (u.team !== enemy || !canBeHit(u)) return;
    const pm = ART_FX[p.cid]?.personMult?.(u) ?? 1;
    hurt(world, u, p.personDmg * mult * falloff * pm, p.dtype, src, { flat: p.kind === 'flat' });
    if (p.dtype === 'F' && u.cat !== 'artillery') addStatus(world, u, 'burning', 3, 1, p.src);
  };
  if (rooms.size && m) {
    for (const u of world.units) {
      if (u.dead || u.team !== enemy) continue;
      const c = ci(Math.floor(u.x), Math.floor(u.y));
      if (world.mod[c] === m.id) apply(u, 1);
    }
    // Nachbarräume
    const nb = new Set<number>();
    for (const c of m.cells) {
      const cx = c % 56, cy = Math.floor(c / 56);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!inMap(nx, ny)) continue;
        const id = world.mod[ci(nx, ny)];
        const o = id ? world.modules.get(id) : undefined;
        if (o && o.id !== m.id && o.owner === enemy && o.kind === 'room') nb.add(o.id);
      }
    }
    if (nb.size) for (const u of world.units) {
      if (u.dead || u.team !== enemy) continue;
      const id = world.mod[ci(Math.floor(u.x), Math.floor(u.y))];
      if (nb.has(id)) apply(u, 0.6);
    }
  }
  const r = Math.max(0.8, p.splash);
  for (const u of world.near(x, y, r)) apply(u, 1);
}

function canBeHit(u: Unit): boolean {
  if (u.state === 'burrow' || u.state === 'swallowed') return false;
  return true;
}

export { DT, K_CORE, killUnit };
