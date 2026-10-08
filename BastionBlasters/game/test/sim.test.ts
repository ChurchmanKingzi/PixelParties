import { describe, expect, it } from 'vitest';
import { Match } from '../src/sim/match';
import { checkRoom, checkTower, gateConnected, placeRoom, placeTower, placeYardCell, removeModule } from '../src/sim/bastion';
import { contingentSlots, slotBreakdown } from '../src/sim/bfx';
import { drawFoundation } from '../src/sim/draw';
import { wavesPerSegment } from '../src/sim/constants';
import { CHAMBER, GATE_CELL } from '../src/sim/constants';
import { ci } from '../src/sim/world';
import { K_YARD } from '../src/sim/types';

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

describe('bastion layout', () => {
  const fresh = () => new Match({ seed: 5, bots: [true, true] }).world;

  it('has the core at the back, a gate at the front and a connecting approach', () => {
    const w = fresh();
    for (const t of [0, 1] as const) {
      const g = GATE_CELL[t];
      expect(w.kind[ci(g.x, g.y)]).toBe(K_YARD);
      expect(gateConnected(w, t)).toBe(true);
      const ch = CHAMBER[t];
      expect(Math.abs(g.x - ch.x0)).toBeGreaterThan(8);
    }
    expect([...w.walls.values()].some((x) => x.gate && x.owner === 0)).toBe(true);
    expect([...w.walls.values()].some((x) => x.gate && x.owner === 1)).toBe(true);
  });

  it('lets rooms attach to other rooms and opens a door to the neighbour', () => {
    const w = fresh();
    const a = placeRoom(w, 0, 'BP-02', 10, 14, 0);
    expect(a).not.toBeNull();
    expect(a!.door).not.toBeNull();
    // Raum B berührt nur Raum A, nicht den Hof
    expect(checkRoom(w, 0, 'BF-01', 11, 16, 0).ok).toBe(true);
    const b = placeRoom(w, 0, 'BF-01', 11, 16, 0);
    expect(b).not.toBeNull();
    expect(b!.door).not.toBeNull();
    const d = b!.door!;
    const wall = w.edgeBetween(d.x, d.y, d.x + (d.dir === 'E' ? 1 : d.dir === 'W' ? -1 : 0), d.y + (d.dir === 'S' ? 1 : d.dir === 'N' ? -1 : 0));
    expect(wall?.door).toBe(true);
    // A trägt B: nicht aufnehmbar, bevor B weg ist
    expect(removeModule(w, 0, a!.id)).toBeNull();
    expect(removeModule(w, 0, b!.id)).toBe('BF-01');
    expect(removeModule(w, 0, a!.id)).toBe('BP-02');
  });

  it('refuses rooms that touch nothing', () => {
    const w = fresh();
    expect(checkRoom(w, 0, 'BP-02', 3, 7, 0).ok).toBe(false);
  });
});

describe('v0.9 rules', () => {
  const fresh = () => new Match({ seed: 9, bots: [true, true] }).world;

  it('lengthens the battle segments with every time stop', () => {
    expect([0, 1, 2, 3, 4].map(wavesPerSegment)).toEqual([2, 3, 4, 5, 6]);
  });

  it('gives +1 contingent slot per time stop and half a slot per unit room', () => {
    const w = fresh();
    expect(contingentSlots(w, 0)).toBe(5);
    w.pauseNo = 3;
    expect(contingentSlots(w, 0)).toBe(8);
    // zwei Einheiten-Räume = +1 Platz, einer allein noch nichts
    const a = placeRoom(w, 0, 'BF-01', 10, 14, 0);
    expect(a).not.toBeNull();
    expect(slotBreakdown(w, 0).roomSlots).toBe(0);
    placeRoom(w, 0, 'BF-02', 14, 14, 0);
    expect(slotBreakdown(w, 0).rooms).toBe(2);
    expect(slotBreakdown(w, 0).roomSlots).toBe(1);
    expect(contingentSlots(w, 0)).toBe(9);
  });

  it('draws a Foundation of free building cards with traps, towers and many rooms', () => {
    const w = fresh();
    const f = drawFoundation(w, 0, []);
    expect(f.length).toBe(12);
    expect(new Set(f).size).toBe(12);
    expect(f.filter((id) => id.startsWith('BS-') || id === 'BA-03').length).toBeGreaterThanOrEqual(2);
    expect(f.filter((id) => id.startsWith('BT-')).length).toBeGreaterThanOrEqual(2);
  });

  it('allows a room across the approach only when another path exists, and keeps the gate connected', () => {
    const w = fresh();
    // Riegel quer über den Gang ohne Umweg: abgelehnt
    expect(checkRoom(w, 0, 'BW-03', 12, 12, 0).ok).toBe(false); // 2x2 über (12..13, 12..13)
    // Umweg aus Hofzellen oben herum
    w.players[0].yardBudget = 10;
    for (const [x, y] of [[11, 12], [11, 11], [12, 11], [13, 11], [14, 11], [14, 12]]) expect(placeYardCell(w, 0, x, y)).toBe(true);
    expect(checkRoom(w, 0, 'BW-03', 12, 12, 0).ok).toBe(true);
    const r = placeRoom(w, 0, 'BW-03', 12, 12, 0);
    expect(r).not.toBeNull();
    expect(gateConnected(w, 0)).toBe(true);
    // aufnehmen stellt den Gang wieder her
    expect(removeModule(w, 0, r!.id)).toBe('BW-03');
    expect(w.kind[12 + 13 * 56]).toBe(K_YARD);
    expect(gateConnected(w, 0)).toBe(true);
    // ein Turm im Gang geht jetzt, der Umweg bleibt offen
    expect(checkTower(w, 0, 'BT-01', 13, 13).ok).toBe(true);
    expect(placeTower(w, 0, 'BT-01', 13, 13)).not.toBeNull();
    expect(gateConnected(w, 0)).toBe(true);
  });
});
