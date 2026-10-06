'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — STANDARD-POLICY DES BOTS
//
//  Alles, was der Bot WÄHLT, steht hier und liest seine Gewichte aus
//  einem Profil (`weights`). Das Lernsystem (skilltest/learn/) ersetzt
//  nur die Gewichte, nie den Code.
// ═══════════════════════════════════════════════════════════════════
const rounds = require('./rounds');

const DEFAULT_WEIGHTS = {
  aggression: 1.0,          // wie bereitwillig angreifen statt Effekte zu nutzen
  lowestHp: 1.0,            // Vorliebe für Ziele mit wenig HP
  killBonus: 2.0,           // Vorliebe für tödliche Treffer
  focusLeader: 0.0,         // >0: stärkste Gegner bevorzugen; <0: Schwache
  heroEffect: 0.6,          // Neigung, aktive Hero-Effekte zu nutzen
  creatureEffect: 0.8,      // Neigung, Creature-Effekte zu nutzen
};

function weightsOf(room, seat) {
  const st = room.gameState.skillTest;
  return Object.assign({}, DEFAULT_WEIGHTS, (st.botWeights && st.botWeights[seat]) || {});
}

/** Zielwahl: bevorzugt Gegner, dann niedrige HP / tödliche Treffer. */
function chooseTargets(engine, seat, validTargets, config, base) {
  if (!validTargets || !validTargets.length) return [];
  const w = weightsOf(engine.room, seat);
  // Eigene Karten-Antworten (cpuResponse) haben Vorrang: sie kennen die Regel der Karte.
  const cardName = config.source || config.title;
  if (cardName) {
    try {
      const { loadCardEffect } = require('../cards/effects/_loader');
      const script = loadCardEffect(cardName);
      if (script && script.cpuResponse) {
        const r = script.cpuResponse(engine, 'effectTarget', { validTargets, config, playerIdx: seat });
        if (r !== undefined) return r;
      }
    } catch { /* weiter mit der Heuristik */ }
  }
  if (config.cancellable && !config.requiresChoice) {
    // Freiwillige Prompts: für den Anfang annehmen, wenn es Gegner gibt.
  }
  const scored = validTargets.filter(t => !t.ineligible).map(t => {
    const enemy = t.owner != null && t.owner !== seat;
    let score = enemy ? 10 : -10;
    const hp = t.hp ?? t.currentHp ?? null;
    if (hp != null) score += w.lowestHp * (200 / Math.max(20, hp));
    if (t.type === 'hero') score += 2;
    return { id: t.id, score: score + Math.random() * 0.5 };
  }).sort((a, b) => b.score - a.score);
  const minNeeded = Math.max(config.cancellable ? 0 : 1, config.minRequired || 0);
  const maxAllowed = config.maxTotal ?? scored.length;
  const count = Math.min(Math.max(minNeeded, 1), maxAllowed, scored.length);
  return scored.slice(0, count).map(s => s.id);
}

/** Welchen Gegner trifft ein Flächenschaden? Standard: den mit den wenigsten Gesamt-HP (focusLeader>0: den stärksten). */
function choosePlayer(engine, seat, candidates) {
  const w = weightsOf(engine.room, seat);
  const hpOf = (i) => (engine.gs.players[i].heroes || []).reduce((a, h) => a + (h && h.name && h.hp > 0 ? h.hp : 0), 0);
  const sorted = [...candidates].sort((a, b) => hpOf(a) - hpOf(b));
  return w.focusLeader > 0 ? sorted[sorted.length - 1] : sorted[0];
}

/** Mögliche Aktionen des Zuges, beste zuerst. */
function rankActions(room, seat, host) {
  const engine = room.engine;
  const w = weightsOf(room, seat);
  const out = [];
  const heroes = rounds.heroActors(engine, seat);
  const creatures = rounds.withActive(engine, seat, () => rounds.creatureActors(engine, seat));
  for (const c of creatures) {
    const params = { heroIdx: c.heroIdx, zoneSlot: c.zoneSlot, instId: c.instId ?? c.id };
    out.push({ score: w.creatureEffect * 5 + Math.random(), kind: 'creature',
      run: () => rounds.act(room, seat, 'activate_creature_effect', params, () => host.doActivateCreatureEffect(room, seat, params), host) });
  }
  for (const hi of heroes) {
    out.push({ score: w.aggression * 6 + Math.random() * 2, kind: 'attack',
      run: () => rounds.playBaseAttack(room, seat, hi, host) });
  }
  return out.sort((a, b) => b.score - a.score);
}

module.exports = { DEFAULT_WEIGHTS, chooseTargets, choosePlayer, rankActions };
