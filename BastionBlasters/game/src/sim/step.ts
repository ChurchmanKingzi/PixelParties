// Ein Simulationsschritt (30 Hz). Reihenfolge laut GDD 11: Spawn, Navigation, Targeting, Kampf, Geschosse, Status, XP, Personal, Heilung, Eroberung, Sieg.

import './unitfx';
import { TPS, WAVE_GAP_S, wavesPerSegment, type Team } from './constants';
import { unitStep } from './ai';
import { buildingsTick, modEff } from './bfx';
import { projectileStep } from './combat';
import { unitFx } from './fx';
import {
  areasStep, conquestStep, coreStep, moduleStep, spawnStep, spawnWave, staffingStep, winCheck,
} from './systems';
import { computeMods, killUnit, recomputeMaxHp } from './units';
import { type World } from './world';

function auras(world: World) {
  for (const s of world.units) {
    if (s.dead || s.state === 'swallowed') continue;
    const fx = unitFx(s.cid);
    if (fx.auraAlly) {
      const a = fx.auraAlly;
      for (const o of world.near(s.x, s.y, a.r, (o) => o.team === s.team && !o.dead && o.id !== s.id && (!a.civ || o.cat === 'civilian' || o.cat === 'citizen'))) {
        if (a.dmgDealt) o.mods.dmgDealt *= a.dmgDealt;
        if (a.dmgTaken) o.mods.dmgTaken *= a.dmgTaken;
        if (a.atk) o.mods.atkSpeed *= a.atk;
        if (a.fearImmune && o.st.some((x) => x.id === 'feared')) o.st = o.st.filter((x) => x.id !== 'feared');
      }
    }
    if (fx.auraEnemy) {
      const a = fx.auraEnemy;
      for (const o of world.near(s.x, s.y, a.r, (o) => o.team !== s.team && !o.dead && o.state !== 'burrow')) {
        if (a.speed) o.mods.speed *= a.speed;
        if (a.atk) o.mods.atkSpeed *= a.atk;
      }
    }
  }
}

export function step(world: World) {
  if (world.phase !== 'battle') return;
  world.tick++;
  world.battleTick++;
  world.rebuildBuckets();
  for (const u of world.units) {
    if (u.dead) continue;
    computeMods(world, u);
  }
  auras(world);
  for (const u of world.units) if (!u.dead) recomputeMaxHp(u);
  // Wellenplan
  if (!world.pendingPause && world.tick >= world.nextWaveTick) {
    spawnWave(world);
    world.waveInCycle++;
    if (world.waveInCycle < wavesPerSegment(world.pauseNo)) {
      world.nextWaveTick = world.tick + WAVE_GAP_S * TPS;
    } else {
      world.waveInCycle = 0;
      world.pendingPause = true;
    }
  }
  spawnStep(world);
  staffingStep(world);
  moduleStep(world);
  buildingsTick(world);
  for (const u of world.units) unitStep(world, u);
  for (const u of world.units) if (!u.dead && u.hp <= 0 && u.state !== 'swallowed') killUnit(world, u, null);
  projectileStep(world);
  areasStep(world);
  conquestStep(world);
  coreStep(world);
  winCheck(world);
  // Bauzeit abgeschlossen: Bauteile auf volle HP
  for (const m of world.modules.values()) {
    if (m.s.half && world.tick >= m.buildEnd) { m.s.half = 0; m.hp = m.maxHp; }
  }
  // Aufräumen
  if (world.tick % 15 === 0) {
    const alive = world.units.filter((u) => !u.dead);
    if (alive.length !== world.units.length) {
      for (const u of world.units) if (u.dead) world.byId.delete(u.id);
      world.units = alive;
    }
  }
  if (world.pendingPause && world.spawnQueue.length === 0 && world.phase === 'battle') {
    if (!world.pauseReadyAt) world.pauseReadyAt = world.tick + 2 * TPS;
    else if (world.tick >= world.pauseReadyAt) {
      world.pauseReadyAt = 0;
      world.pendingPause = false;
      world.phase = 'pause';
    }
  }
}

export { modEff };
export type { Team };
