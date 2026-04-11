// ═══════════════════════════════════════════
//  CARD EFFECT: "Spider Avalanche"
//  Spell (Surprise) — Destruction Magic Lv1
//
//  Activate when host Hero is hit by an
//  opponent's Attack, Spell or Creature effect.
//  Deal damage equal to 20 × number of
//  Creatures you control to ALL targets
//  your opponent controls.
//  Does NOT negate the triggering effect.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isSurprise: true,

  canTelekinesisActivate(engine, ownerIdx) {
    // Hard once per turn
    const hoptKey = `spider_avalanche:${ownerIdx}`;
    if (engine.gs.hoptUsed?.[hoptKey] === engine.gs.turn) return false;

    const cardDB = engine._getCardDB();
    for (const inst of engine.cardInstances) {
      if (inst.controller !== ownerIdx || inst.zone !== 'support') continue;
      const cd = cardDB[inst.name];
      if (cd && hasCardType(cd, 'Creature')) return true;
    }
    return false;
  },

  /**
   * Trigger: when host hero is targeted by any opponent's effect.
   * Must have a valid source and the source must belong to the opponent.
   * Hard once per turn.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    // Hard once per turn
    const hoptKey = `spider_avalanche:${ownerIdx}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;

    if (sourceInfo.owner < 0 || sourceInfo.heroIdx < 0) return false;
    // Only triggers against OPPONENT effects
    if (sourceInfo.owner === ownerIdx) return false;
    return true;
  },

  /**
   * On activation: count controlled creatures, then rain spiders
   * on every target the opponent controls for 20 × creature count damage.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const cardDB = engine._getCardDB();

    // Claim hard once per turn
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[`spider_avalanche:${pi}`] = gs.turn;

    // Count creatures the activating player controls
    let creatureCount = 0;
    for (const inst of engine.cardInstances) {
      if (inst.controller !== pi || inst.zone !== 'support') continue;
      const cd = cardDB[inst.name];
      if (cd && hasCardType(cd, 'Creature') && !inst.faceDown) creatureCount++;
    }

    const damage = 20 * creatureCount;
    if (damage <= 0) {
      engine.log('spider_avalanche_fizzle', { player: gs.players[pi]?.username, reason: 'no_creatures' });
      return null;
    }

    engine.log('spider_avalanche', {
      player: gs.players[pi]?.username,
      creatures: creatureCount, damage,
    });

    // Use aoeHit — automatically handles Ida's forcesSingleTarget for destruction_spell
    const result = await ctx.aoeHit({
      side: 'enemy',
      types: ['hero', 'creature'],
      damage,
      damageType: 'destruction_spell',
      sourceName: 'Spider Avalanche',
      animationType: 'spider_avalanche',
      animDelay: 500,
    });

    engine.sync();
    await engine._delay(400);

    // Does NOT negate the triggering effect
    return null;
  },
};
