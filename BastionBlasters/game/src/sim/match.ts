// Spielablauf: Loadout -> Erstaufbau -> Kampf -> Zeitstopp (Ziehen, Bauen) -> Kampf ... -> Sieg

import { CORE_HP, YARD_PER_PAUSE, YARD_START_CELLS, type Team } from './constants';
import { createBastion } from './bastion';
import { botChoose, botPlay } from './bot';
import { contingentSlots, keepCount } from './bfx';
import { applyCmd, type Cmd, type Res } from './commands';
import { drawFoundation, drawLoadout, drawPause } from './draw';
import { step } from './step';
import type { Player } from './types';
import { createUnit } from './units';
import { homeAnchor, jitterSpot } from './ai';
import { World, ci } from './world';
import { CITIZEN_START } from './constants';

export interface MatchOpts {
  seed: number;
  bots: [boolean, boolean];
  ponds?: number[][]; // [x0, y0, x1, y1] inklusive
}

export function newPlayer(team: Team, isBot: boolean): Player {
  return {
    team, isBot, hand: [], kept: [], played: [], keepCount: 7, rerolls: 0, mulligan: 1, contingent: [], slotsMax: 5, yardBudget: 0,
    moveBudget: 0, ready: false, draws: 0, coreSkillReady: true, owned: [], quota: 0, found: [],
  };
}

export class Match {
  world: World;
  opts: MatchOpts;
  pauseBegun = false;

  constructor(opts: MatchOpts) {
    this.opts = opts;
    const players: [Player, Player] = [newPlayer(0, opts.bots[0]), newPlayer(1, opts.bots[1])];
    this.world = new World(opts.seed, players);
    const w = this.world;
    for (const r of opts.ponds ?? []) {
      for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) w.blocked[ci(x, y)] = 1;
    }
    createBastion(w, 0);
    createBastion(w, 1);
    for (const t of [0, 1] as Team[]) {
      const a0 = homeAnchor(t);
      for (let i = 0; i < CITIZEN_START; i++) { const a = jitterSpot(w, t, a0, 0.4, 1.4); createUnit(w, t, 'citizen', a.x, a.y); }
    }
    void CORE_HP;
  }

  // ---- Loadout
  startLoadout() {
    const w = this.world;
    w.phase = 'loadout';
    for (const p of w.players) {
      p.hand = drawLoadout(w, p.team);
      p.kept = [];
      p.keepCount = 7;
      p.ready = false;
      if (p.isBot) { p.kept = botChoose(w, p.team, p.hand, 7); p.ready = true; }
    }
    this.checkLoadoutDone();
  }
  mulligan(team: Team): boolean {
    const p = this.world.players[team];
    if (this.world.phase !== 'loadout' || p.mulligan <= 0) return false;
    p.mulligan--;
    p.hand = drawLoadout(this.world, team);
    return true;
  }
  keepLoadout(team: Team, ids: string[]): boolean {
    const p = this.world.players[team];
    if (this.world.phase !== 'loadout' || ids.length !== 7 || !subMultiset(ids, p.hand)) return false;
    p.kept = ids.slice();
    p.ready = true;
    this.checkLoadoutDone();
    return true;
  }
  private checkLoadoutDone() {
    const w = this.world;
    if (w.players.every((p) => p.ready && p.kept.length === p.keepCount)) this.beginBuild();
  }

  // ---- Erstaufbau
  beginBuild() {
    const w = this.world;
    w.phase = 'build';
    for (const p of w.players) {
      p.ready = false;
      p.yardBudget = YARD_START_CELLS;
      p.moveBudget = 1;
      p.slotsMax = contingentSlots(w, p.team);
      p.rerolls = 0;
      // Fundament: kostenlose Zusatzkarten (viele Räume, Fallen, Türme) für das Labyrinth zum Kern
      p.found = drawFoundation(w, p.team, p.kept);
      p.kept.push(...p.found);
    }
    for (const p of w.players) if (p.isBot) { botPlay(w, p.team); applyCmd(w, { t: 'ready', p: p.team }); }
    this.checkReady();
  }

  cmd(c: Cmd): Res {
    const r = applyCmd(this.world, c);
    if (c.t === 'ready' && r.ok) this.checkReady();
    return r;
  }
  private checkReady() {
    const w = this.world;
    if (w.players.every((p) => p.ready)) {
      if (w.phase === 'build') this.startBattle();
      else if (w.phase === 'pause') this.endPause();
    }
  }

  startBattle() {
    const w = this.world;
    w.phase = 'battle';
    w.battleTick = 0;
    w.nextWaveTick = w.tick;
    w.waveInCycle = 0;
    for (const p of w.players) { p.ready = false; p.slotsMax = contingentSlots(w, p.team); p.kept = []; p.found = []; }
  }

  // ---- Zeitstopp
  beginPause() {
    const w = this.world;
    this.pauseBegun = true;
    w.pauseNo++;
    for (const p of w.players) {
      p.hand = drawPause(w, p.team, 5);
      p.kept = [];
      p.found = [];
      p.played = [];
      p.keepCount = keepCount(w, p.team);
      p.rerolls = 1;
      p.yardBudget = YARD_PER_PAUSE;
      p.moveBudget = 1;
      p.ready = false;
      p.slotsMax = contingentSlots(w, p.team);
      if (p.isBot) {
        p.kept = botChoose(w, p.team, p.hand, p.keepCount);
        botPlay(w, p.team);
        p.ready = true;
      }
    }
    this.checkReady();
  }
  keepPause(team: Team, ids: string[]): boolean {
    const p = this.world.players[team];
    if (this.world.phase !== 'pause' || ids.length > p.keepCount || !subMultiset(ids, p.hand)) return false;
    p.kept = ids.slice();
    return true;
  }
  reroll(team: Team): boolean {
    const w = this.world;
    const p = w.players[team];
    if (w.phase !== 'pause' || p.rerolls <= 0 || p.played.length > 0) return false;
    p.rerolls--;
    p.hand = drawPause(w, team, 5);
    p.kept = [];
    return true;
  }
  endPause() {
    const w = this.world;
    for (const p of w.players) {
      // Trostpflaster: behaltene, aber nicht gespielte Karten reparieren die Bastion um 4 %
      const left = p.kept.length;
      if (left > 0) {
        for (const m of w.modules.values()) if (m.owner === p.team && !m.destroyed) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.04 * left);
        for (const wl of w.walls.values()) if (wl.owner === p.team && !wl.door && wl.hp > 0) wl.hp = Math.min(wl.maxHp, wl.hp + wl.maxHp * 0.04 * left);
      }
      p.kept = [];
      p.ready = false;
    }
    w.phase = 'battle';
    w.nextWaveTick = w.tick; // nach der Pause spawnt die nächste Welle sofort
    this.pauseBegun = false;
  }

  /** ein Simulationsschritt, wenn gekämpft wird */
  tick() {
    const w = this.world;
    if (w.phase === 'battle') step(w);
    if (w.phase === 'pause' && !this.pauseBegun) this.beginPause();
  }
}

function subMultiset(ids: string[], hand: string[]): boolean {
  const pool = hand.slice();
  for (const id of ids) {
    const i = pool.indexOf(id);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  return true;
}
