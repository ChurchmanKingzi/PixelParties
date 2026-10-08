import { describe, expect, it } from 'vitest';
import { Match } from '../src/sim/match';

function run(seed: number, maxMin = 8) {
  const m = new Match({ seed, bots: [true, true] });
  m.startLoadout();
  let guard = 0;
  while (m.world.phase !== 'over' && m.world.battleTime < maxMin * 60 && guard++ < 2_000_000) {
    m.tick();
    m.world.events.length = 0;
  }
  return m.world;
}

function fingerprint(w: ReturnType<typeof run>): string {
  const core = [0, 1].map((t) => Math.round(w.modules.get(w.coreMod[t as 0 | 1])!.hp));
  return JSON.stringify({ tick: w.tick, winner: w.winner, type: w.winType, core, units: w.units.length, kills: w.stats.kills, rng: w.rng.state });
}

describe('simulation', { timeout: 120_000 }, () => {
  it('is deterministic for a fixed seed', () => {
    expect(fingerprint(run(11))).toBe(fingerprint(run(11)));
  });
  it('runs bot matches without errors', () => {
    for (const seed of [1, 2, 3]) {
      const w = run(seed);
      expect(w.battleTime).toBeGreaterThan(60);
      expect(['battle', 'pause', 'over']).toContain(w.phase);
    }
  });
  it('different seeds give different matches', () => {
    expect(fingerprint(run(21))).not.toBe(fingerprint(run(22)));
  });
});
