// ═══════════════════════════════════════════
//  CARD EFFECT: "Tears of Creation"
//  Potion (Normal) — Gain 5 Gold for every
//  target the player controls (living Heroes,
//  Creatures, and charmed opponent Heroes).
//
//  Animation: golden sparkles from each target
//  flying to the gold counter.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isPotion: true,

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];
    const cardDB = engine._getCardDB();

    // Count all targets the player controls
    const targetPositions = []; // For animation

    // Own living heroes
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (hero?.name && hero.hp > 0) {
        targetPositions.push({ owner: pi, heroIdx: hi, zoneSlot: -1 });
      }
    }

    // Own creatures
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support' || inst.faceDown) continue;
      if (inst.owner !== pi && inst.controller !== pi) continue;
      const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      const hp = inst.counters?.currentHp ?? cd.hp ?? 0;
      if (hp <= 0) continue;
      targetPositions.push({ owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
    }

    // Charmed opponent heroes (controlled by this player)
    if (oppPs) {
      for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
        const hero = oppPs.heroes[hi];
        if (hero?.name && hero.hp > 0 && hero.charmedBy === pi) {
          targetPositions.push({ owner: oppIdx, heroIdx: hi, zoneSlot: -1 });
        }
      }
    }

    const targetCount = targetPositions.length;
    if (targetCount === 0) return true;

    const goldGain = targetCount * 5;

    // Broadcast animation: sparkles from each target to gold counter
    engine._broadcastEvent('tears_of_creation_animation', {
      owner: pi,
      targets: targetPositions,
    });
    await engine._delay(1200);

    // Gain gold
    await engine.actionGainGold(pi, goldGain);

    engine.log('tears_of_creation', {
      player: ps.username,
      targetCount,
      goldGained: goldGain,
    });

    engine.sync();
    return true;
  },
};
