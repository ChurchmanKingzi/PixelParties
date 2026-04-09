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
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
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
    const oppIdx = pi === 0 ? 1 : 0;
    const cardDB = engine._getCardDB();

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

    // Collect all opponent targets: heroes + creatures
    const oppPs = gs.players[oppIdx];
    const hitHeroes = [];
    const creatureBatch = [];

    for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
      const hero = oppPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      hitHeroes.push({ hero, heroIdx: hi });
    }

    for (const inst of engine.cardInstances) {
      if ((inst.owner !== oppIdx && inst.controller !== oppIdx) || inst.zone !== 'support') continue;
      const cd = cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      creatureBatch.push({
        inst, amount: damage, type: 'destruction_spell',
        source: { name: 'Spider Avalanche', owner: pi, heroIdx: ctx.cardHeroIdx },
        sourceOwner: pi, canBeNegated: true,
        isStatusDamage: false, animType: 'spider_avalanche',
      });
    }

    // Play spider avalanche animation on ALL hero targets simultaneously
    for (const { heroIdx: hi } of hitHeroes) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'spider_avalanche', owner: oppIdx,
        heroIdx: hi, zoneSlot: -1,
      });
    }
    // Creature animations handled by processCreatureDamageBatch's animType

    await engine._delay(500);

    // Deal damage to all opponent heroes
    for (const { hero, heroIdx: hi } of hitHeroes) {
      if (hero.hp > 0) {
        await ctx.dealDamage(hero, damage, 'destruction_spell');
      }
    }

    // Deal damage to all opponent creatures as a batch
    if (creatureBatch.length > 0) {
      await engine.processCreatureDamageBatch(creatureBatch);
    }

    engine.sync();
    await engine._delay(400);

    // Does NOT negate the triggering effect
    return null;
  },
};
