// Systeme: Personal (Bürger), Heilquellen, Eroberung, Gebiete, Wellen, Spawns, Bauteil-Zustände, Sieg

import {
  CITIZEN_LIMIT_BASE, CITIZEN_LIMIT_PER_HOME, CITIZEN_REGEN_S, CORE_REGEN, DT, MADNESS_END_S, MADNESS_START_S,
  SPAWN_STAGGER_S, TPS, UNIT_LIMIT, WAVE_GAP_S, type Team,
} from './constants';
import { BUILDINGS, LINE_ROOM, UNITS } from './data';
import { chamberBox, healOccupants, inChamber, postPos, zoneAnchor, gateInner } from './ai';
import { applySpawnBuffs, healSpecOf, modEff, moduleActive, bonusQuota } from './bfx';
import { hurtModule, modCenter, igniteModule, rainOver } from './combat';
import { unitFx } from './fx';
import type { Module, Unit } from './types';
import { addStatus, createUnit, defOf, hurt, killUnit, cellOf } from './units';
import { ci, dist, type World } from './world';

// ------------------------------------------------------------------ Heilquellen

export function findHealSource(world: World, u: Unit): { id: number; kind: 'module' | 'unit'; x: number; y: number } | null {
  let best: { id: number; kind: 'module' | 'unit'; x: number; y: number } | null = null;
  let bs = Infinity;
  for (const m of world.modules.values()) {
    if (m.owner !== u.team || m.destroyed) continue;
    const hs = healSpecOf(m);
    if (!hs || modEff(world, m) <= 0) continue;
    const c = modCenter(m);
    const occ = healOccupants(world, m).length;
    const score = dist(u.x, u.y, c.x, c.y) + (occ >= hs.slots ? 8 : 0);
    if (score < bs) { bs = score; best = { id: m.id, kind: 'module', x: c.x, y: c.y }; }
  }
  for (const o of world.units) {
    if (o.team !== u.team || o.dead || o.id === u.id) continue;
    const fx = unitFx(o.cid);
    if (!fx.heal || o.hp < o.maxHp * 0.3) continue;
    const score = dist(u.x, u.y, o.x, o.y) + 2;
    if (score < bs) { bs = score; best = { id: o.id, kind: 'unit', x: o.x, y: o.y }; }
  }
  return best;
}

export function releaseHeal(world: World, u: Unit) {
  u.s.healMod = 0;
}

// ------------------------------------------------------------------ Personal

export function citizenLimit(world: World, team: Team): number {
  let homes = 0;
  for (const m of world.modules.values()) if (m.owner === team && m.card === 'BU-01' && !m.destroyed && m.buildEnd <= world.tick) homes++;
  return CITIZEN_LIMIT_BASE + CITIZEN_LIMIT_PER_HOME * homes;
}

export function staffingStep(world: World) {
  for (const m of world.modules.values()) m.staffed = 0;
  for (const team of [0, 1] as Team[]) {
    const citizens = world.units.filter((u) => !u.dead && u.team === team && u.cat === 'citizen');
    const mods: Module[] = [];
    for (const m of world.modules.values()) {
      if (m.owner === team && m.posts > 0 && !m.destroyed && m.buildEnd <= world.tick) mods.push(m);
    }
    const taken = new Set<string>();
    for (const c of citizens) {
      if (!c.post) continue;
      const m = world.modules.get(c.post);
      const key = c.post + ':' + c.postIdx;
      if (!m || m.destroyed || c.postIdx >= m.posts || taken.has(key)) { c.post = 0; continue; }
      taken.add(key);
    }
    for (const c of citizens) {
      if (c.post || (c.s.panic ?? 0) === 1) continue;
      let best: Module | null = null, bd = Infinity, bi = 0;
      for (const m of mods) {
        let idx = -1;
        for (let k = 0; k < m.posts; k++) if (!taken.has(m.id + ':' + k)) { idx = k; break; }
        if (idx < 0) continue;
        const cc = modCenter(m);
        const d = dist(c.x, c.y, cc.x, cc.y);
        if (d < bd) { bd = d; best = m; bi = idx; }
      }
      if (best) { c.post = best.id; c.postIdx = bi; taken.add(best.id + ':' + bi); }
    }
    for (const c of citizens) {
      if (!c.post || (c.s.panic ?? 0) === 1 || c.st.some((s) => s.id === 'frogged' || s.id === 'stunned')) continue;
      const m = world.modules.get(c.post);
      if (!m) continue;
      const p = postPos(world, m, c.postIdx);
      if (dist(c.x, c.y, p.x, p.y) < 0.7) m.staffed++;
    }
    // Nachwuchs
    const limit = citizenLimit(world, team);
    const alive = citizens.length;
    if (alive < limit) {
      let regen = CITIZEN_REGEN_S;
      for (const m of world.modules.values()) if (m.owner === team && m.card === 'BU-01' && !m.destroyed && m.buildEnd <= world.tick) regen = 4;
      world.citizenTimer[team] += DT;
      if (world.citizenTimer[team] >= regen) {
        world.citizenTimer[team] = 0;
        const a = zoneAnchor(team, 'middle');
        createUnit(world, team, 'citizen', a.x + world.rng.range(-0.5, 0.5), a.y + world.rng.range(-1, 1));
      }
    } else world.citizenTimer[team] = 0;
  }
}

/** Betriebsgrad: besetzte / benötigte Posten */
export function operatingDegree(world: World, team: Team): number {
  let need = 0, have = 0;
  for (const m of world.modules.values()) {
    if (m.owner !== team || m.destroyed || m.posts <= 0) continue;
    need += m.posts;
    have += Math.min(m.posts, m.staffed);
  }
  return need ? have / need : 1;
}

// ------------------------------------------------------------------ Eroberung

export function conquestStep(world: World) {
  for (const defender of [0, 1] as Team[]) {
    const inv: Team = defender === 0 ? 1 : 0;
    let n = 0;
    let locked = false;
    let half = 1;
    for (const u of world.units) {
      if (u.dead) continue;
      if (u.team === inv && u.cat === 'assault' && inChamber(defender, u.x, u.y) && u.state !== 'burrow' && u.state !== 'swallowed' && u.rt.phase === 'none') {
        n += u.cid === 'US-04' ? 1 : 1;
      }
      if (u.team === defender) {
        if (u.cat === 'defender' && inChamber(defender, u.x, u.y) && u.state !== 'swallowed') locked = true;
        if (u.cid === 'UV-16') locked = true; // Letztes Aufgebot: Eroberung vollständig gesperrt
        if (u.cid === 'UV-13' && inChamber(defender, u.x, u.y)) half = 0.5;
      }
    }
    n = Math.min(5, n);
    if (n > 0) {
      if (!locked) world.conquest[defender] = Math.min(100, world.conquest[defender] + (4 + 2 * (n - 1)) * half * (1 + world.madness) * DT);
    } else {
      world.conquest[defender] = Math.max(0, world.conquest[defender] - 6 * DT);
    }
  }
}

// ------------------------------------------------------------------ Gebiete (Wolken, Schleim, Regen, Zielschatten)

export function areasStep(world: World) {
  if (!world.areas.length) return;
  const keep = [];
  for (const a of world.areas) {
    if (a.until <= world.tick) continue;
    keep.push(a);
    if (a.kind === 'shadow' || world.tick % 5 !== 0) continue;
    for (const u of world.near(a.x, a.y, a.r, (o) => o.team === a.team && !o.dead && !o.flying && o.state !== 'burrow')) {
      if (a.dps > 0) hurt(world, u, (a.dps * 5) / TPS, a.dtype, world.byId.get(a.src) ?? null, { noXp: false });
      if (a.status) addStatus(world, u, a.status, a.statusDur ?? 1.5, 1, a.src);
    }
  }
  world.areas = keep;
}

// ------------------------------------------------------------------ Bauteile: Feuer, Bau, Kern

export function moduleStep(world: World) {
  for (const m of world.modules.values()) {
    if (m.destroyed) continue;
    if (m.burning > world.tick) {
      if (rainOver(world, m)) { m.burning = 0; continue; }
      if (world.tick % 10 === 0) {
        hurtModule(world, m, 10 / 3, 'F', null);
        if (!m.destroyed && world.rng.chance(0.08)) {
          for (const o of world.modules.values()) {
            if (o.owner !== m.owner || o.destroyed || o.id === m.id) continue;
            const a = modCenter(m), b = modCenter(o);
            if (dist(a.x, a.y, b.x, b.y) < Math.max(m.cols, m.rows) / 2 + Math.max(o.cols, o.rows) / 2 + 0.6) {
              const def = BUILDINGS[o.card];
              if (def && (o.material === 'wood' || o.material === 'organic' || /Leicht-Entflammbar/.test(def.tags))) igniteModule(world, o, 4);
            }
          }
        }
      }
    }
  }
}

export function coreStep(world: World) {
  for (const t of [0, 1] as Team[]) {
    const c = world.modules.get(world.coreMod[t])!;
    if (c.hp > 0 && c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + CORE_REGEN * DT);
  }
  // Wahnsinn (Anti-Patt)
  const bt = world.battleTime;
  world.madness = bt > MADNESS_START_S ? 0.1 * Math.floor((bt - MADNESS_START_S) / 30) : 0;
  if (bt > MADNESS_END_S) {
    for (const t of [0, 1] as Team[]) {
      const c = world.modules.get(world.coreMod[t])!;
      c.hp -= c.maxHp * 0.01 * DT;
    }
  }
}

export function winCheck(world: World) {
  if (world.winner !== null) return;
  const c0 = world.modules.get(world.coreMod[0])!, c1 = world.modules.get(world.coreMod[1])!;
  const d0 = c0.hp <= 0, d1 = c1.hp <= 0;
  if (d0 && d1) { end(world, -1, 'draw'); return; }
  if (d0) { end(world, 1, 'core'); return; }
  if (d1) { end(world, 0, 'core'); return; }
  if (world.conquest[0] >= 100 && world.conquest[1] >= 100) { end(world, -1, 'draw'); return; }
  if (world.conquest[0] >= 100) { end(world, 1, 'conquest'); return; }
  if (world.conquest[1] >= 100) { end(world, 0, 'conquest'); return; }
  if (world.battleTime > MADNESS_END_S + 120) end(world, -1, 'time');
}

function end(world: World, winner: Team | -1, type: 'core' | 'conquest' | 'draw' | 'time') {
  world.winner = winner;
  world.winType = type;
  world.phase = 'over';
  world.feed(winner < 0 ? 'Draw' : `Player ${winner + 1} wins by ${type === 'core' ? 'destroying the core' : 'conquest'}`, -1);
}

// ------------------------------------------------------------------ Kontingent, Wellen, Spawns

export function entryStats(world: World, team: Team, idx: number) {
  const p = world.players[team];
  const e = p.contingent[idx];
  const d = UNITS[e.card];
  let S = d.soll;
  let N = d.nachschub;
  if (e.star >= 2) { S = Math.round(S * (e.star >= 3 ? 2 : 1.5)); N += 1; }
  if (d.cat === 'defender' || d.cat === 'civilian') S += bonusQuota(world, team, 'soll');
  if (d.cat === 'assault') N += bonusQuota(world, team, 'nachschub');
  return { S, N };
}

export function lineActive(world: World, team: Team, line: string): boolean {
  if (line === 'Basic') return true;
  const room = LINE_ROOM[line];
  if (!room) return true;
  for (const m of world.modules.values()) {
    if (m.owner === team && m.card === room && moduleActive(world, m)) return true;
  }
  return false;
}

function countUnits(world: World, team: Team): number {
  let n = 0;
  for (const u of world.units) if (!u.dead && u.team === team && u.cat !== 'citizen') n++;
  return n;
}

export function spawnWave(world: World) {
  world.waveNo++;
  for (const team of [0, 1] as Team[]) {
    const p = world.players[team];
    let t = world.tick;
    const stagger = SPAWN_STAGGER_S * TPS * (hasGranny(world, team) ? 0.75 : 1);
    p.contingent.forEach((e, idx) => {
      e.alive = e.alive.filter((id) => { const u = world.byId.get(id); return u && !u.dead; });
      const d = UNITS[e.card];
      if (!lineActive(world, team, d.line)) return;
      const { S, N } = entryStats(world, team, idx);
      const n = Math.max(0, Math.min(N, S - e.alive.length));
      for (let k = 0; k < n; k++) {
        t += stagger;
        world.spawnQueue.push({ team, entry: idx, at: Math.round(t), wave: world.waveNo });
      }
    });
    // Brutmutter (UZ-17): +1 Nachschub für zwei zufällige Karten
    if (hasGranny(world, team) && p.contingent.length) {
      for (let k = 0; k < 2; k++) {
        const idx = world.rng.int(p.contingent.length);
        const e = p.contingent[idx];
        const { S } = entryStats(world, team, idx);
        if (e.alive.length < S && lineActive(world, team, UNITS[e.card].line)) {
          t += stagger;
          world.spawnQueue.push({ team, entry: idx, at: Math.round(t), wave: world.waveNo });
        }
      }
    }
  }
  world.feed(`Wave ${world.waveNo}`, -1);
}

function hasGranny(world: World, team: Team): boolean {
  for (const u of world.units) if (!u.dead && u.team === team && u.cid === 'UZ-17') return true;
  return false;
}

export function spawnStep(world: World) {
  if (!world.spawnQueue.length) return;
  const rest = [];
  for (const q of world.spawnQueue) {
    if (q.at > world.tick) { rest.push(q); continue; }
    spawnFromEntry(world, q.team, q.entry, q.wave);
  }
  world.spawnQueue = rest;
}

export function spawnFromEntry(world: World, team: Team, idx: number, wave: number): Unit | null {
  const p = world.players[team];
  const e = p.contingent[idx];
  if (!e) return null;
  const d = UNITS[e.card];
  const { S } = entryStats(world, team, idx);
  e.alive = e.alive.filter((id) => { const u = world.byId.get(id); return u && !u.dead; });
  if (e.alive.length >= S) return null;
  if (countUnits(world, team) >= UNIT_LIMIT) return null;
  if (!lineActive(world, team, d.line)) return null;
  let x = 0, y = 0;
  let slot: Unit['slot'] = null;
  if (d.cat === 'artillery') {
    slot = findSlots(world, team, d.gp ?? 1);
    if (!slot) return null;
    const m = world.modules.get(slot.mod)!;
    const s = m.slots[slot.idx];
    x = s.x; y = s.y;
  } else if (d.cat === 'assault') {
    const g = gateInner(team);
    x = g.x - (team === 0 ? 0.5 : -0.5) + world.rng.range(-0.15, 0.15);
    y = g.y + world.rng.range(-0.3, 0.3);
  } else {
    const a = zoneAnchor(team, d.cat === 'defender' ? e.zone : 'middle');
    x = a.x + world.rng.range(-0.8, 0.8);
    y = a.y + world.rng.range(-1, 1);
  }
  const u = createUnit(world, team, e.card, x, y, { entry: idx, wave, star: e.star, zone: e.zone, prio: e.prio });
  u.slot = slot;
  if (slot) {
    const m = world.modules.get(slot.mod)!;
    for (let k = 0; k < slot.n; k++) m.slots[slot.idx + k].unit = u.id;
  }
  e.alive.push(u.id);
  applySpawnBuffs(world, u);
  const fx = unitFx(u.cid);
  if (fx.burrow) {
    const enemy: Team = team === 0 ? 1 : 0;
    const tx = pickEmergence(world, enemy);
    u.state = 'burrow';
    u.s.bx = tx.x; u.s.by = tx.y;
    u.flying = true;
  }
  world.emit({ t: 'spawn', x: u.x, y: u.y, cid: u.cid });
  return u;
}

function pickEmergence(world: World, enemy: Team): { x: number; y: number } {
  const cb = chamberBox(enemy);
  const cands: { x: number; y: number }[] = [];
  for (let k = 0; k < 40; k++) {
    const cx = cb.x0 - 4 + world.rng.int(cb.x1 - cb.x0 + 9);
    const cy = cb.y0 - 4 + world.rng.int(cb.y1 - cb.y0 + 9);
    if (!world.isOwned(cx, cy, enemy) || world.solid(cx, cy)) continue;
    if (world.kind[ci(cx, cy)] !== 1) continue;
    cands.push({ x: cx + 0.5, y: cy + 0.5 });
  }
  if (cands.length) return cands[world.rng.int(cands.length)];
  const g = gateInner(enemy);
  return { x: g.x, y: g.y };
}

/** Freie Geschützplätze (n aufeinanderfolgende in einem Modul, Luftplätze nur für Luft-Artillerie) */
export function findSlots(world: World, team: Team, gp: number | 'air'): Unit['slot'] {
  const air = gp === 'air';
  const need = air ? 1 : gp;
  for (const m of world.modules.values()) {
    if (m.owner !== team || m.destroyed || m.buildEnd > world.tick || !m.slots.length) continue;
    for (let i = 0; i + need <= m.slots.length; i++) {
      let ok = true;
      for (let k = 0; k < need; k++) {
        const s = m.slots[i + k];
        if (s.unit || (air ? !s.air : s.air)) { ok = false; break; }
      }
      if (ok) return { mod: m.id, idx: i, n: need };
    }
  }
  return null;
}

export function freeSlotCount(world: World, team: Team): number {
  let n = 0;
  for (const m of world.modules.values()) {
    if (m.owner !== team || m.destroyed) continue;
    for (const s of m.slots) if (!s.unit && !s.air) n++;
  }
  return n;
}

export { cellOf, WAVE_GAP_S, defOf, killUnit, MADNESS_END_S };
