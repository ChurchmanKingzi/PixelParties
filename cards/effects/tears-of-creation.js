// ═══════════════════════════════════════════
//  CARD EFFECT: "Tears of Creation"
//  Potion (Normal) — Gain 5 Gold for every
//  target the player controls (living Heroes,
//  Creatures, and charmed opponent Heroes).
//
//  Animation: golden sparkles from each target
//  flying to the gold counter.
// ═══════════════════════════════════════════

// Als Ruling 17.8. ("Tuscan Aristocrat"), analog zum Zieh-Riegel:
// ist der Gold-Gewinn der EINZIGE Nutzen, wird die Karte gesperrt
// statt wirkungslos zu feuern. Auslegung in `_gold-block-shared.js`.
const { goldGainWouldBeBlocked } = require('./_gold-block-shared');

const { hasCardType } = require('./_hooks');

module.exports = {
  isPotion: true,

  // "Gain 5 Gold for every target you control" — der Gewinn ist der
  // ganze Effekt.
  canActivate(gs, pi, engine) {
    return !goldGainWouldBeBlocked(engine, pi);
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oppIdx = engine.opponentOf(pi);
    const oppPs = gs.players[oppIdx];
    const cardDB = engine._getCardDB();

    // Count all targets the player controls
    const targetPositions = []; // For animation

    // Living heroes I CONTROL (W16f, M02-16: Kontrolle statt Spalte - ein vom Gegner gecharmter eigener Held zählt nicht, ein von mir
    // gecharmter/übernommener Gegnerheld schon; Adresse = Brettseite).
    for (const { physOwner, heroIdx: hi, hero } of engine.heroesControlledBy(pi)) {
      if (hero?.name && hero.hp > 0) {
        targetPositions.push({ owner: physOwner, heroIdx: hi, zoneSlot: -1 });
      }
    }

    // Own creatures
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support' || inst.faceDown) continue;
      // Controller-aware: "Creatures you control".
      if ((inst.controller ?? inst.owner) !== pi) continue;
      const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      const hp = inst.counters?.currentHp ?? cd.hp ?? 0;
      if (hp <= 0) continue;
      targetPositions.push({ owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
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
