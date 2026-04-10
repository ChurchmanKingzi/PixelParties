// ═══════════════════════════════════════════
//  CARD EFFECT: "Invisibility Cloak"
//  Artifact (Reaction) — Cost 8
//
//  Post-target reaction: fires AFTER an
//  opponent's Attack or Spell selects exactly
//  1 target the IC owner controls (not their
//  last living hero).
//
//  Negates the Attack/Spell. The protected
//  target is automatically the one that was
//  targeted. Opponent may use another Attack
//  or Spell with the same hero, but cannot
//  target the cloaked target.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

/**
 * Count all living targets a player controls (heroes + creatures).
 */
function countLivingTargets(gs, pi, engine) {
  const ps = gs.players[pi];
  let count = 0;
  const cardDB = engine._getCardDB();
  for (const hero of (ps.heroes || [])) {
    if (hero?.name && hero.hp > 0) count++;
  }
  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi || inst.zone !== 'support' || inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (cd && hasCardType(cd, 'Creature')) count++;
  }
  return count;
}

module.exports = {
  isPostTargetReaction: true,

  /**
   * Post-target condition:
   * - Opponent's Attack or Spell targeting exactly 1 of IC owner's targets
   * - IC owner has 2+ living targets (protecting one leaves others targetable)
   */
  postTargetCondition: (gs, pi, engine, targetedHeroes, sourceCard) => {
    // Source must be from the opponent
    const sourceOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (sourceOwner === pi) return false;

    // Source must be an Attack or Spell
    const cardDB = engine._getCardDB();
    const srcData = sourceCard?.name ? cardDB[sourceCard.name] : null;
    if (srcData && !hasCardType(srcData, 'Attack') && !hasCardType(srcData, 'Spell')) return false;

    // Exactly 1 target, belonging to the IC owner
    if (targetedHeroes.length !== 1) return false;
    if (targetedHeroes[0].owner !== pi) return false;

    // Must have 2+ living targets (can't cloak last hero)
    if (countLivingTargets(gs, pi, engine) < 2) return false;

    return true;
  },

  /**
   * Post-target resolve: negate the spell, protect the targeted target,
   * grant opponent a replacement action.
   */
  postTargetResolve: async (engine, pi, targetedHeroes, sourceCard) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const protectedTarget = targetedHeroes[0];
    const protectedId = protectedTarget.id;

    engine.log('invisibility_cloak', {
      player: ps.username,
      protected: protectedTarget.cardName,
      negated: sourceCard?.name,
    });

    // Grant opponent a replacement action with the SAME hero
    const oppIdx = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (oppIdx < 0) return;
    const oppHeroIdx = sourceCard?.heroIdx ?? -1;
    if (oppHeroIdx < 0) return;

    const oppHero = gs.players[oppIdx]?.heroes?.[oppHeroIdx];
    if (!oppHero?.name || oppHero.hp <= 0) return;

    // Vanish animation: fade out 1s, invisible 1s, fade in 1s
    engine._broadcastEvent('play_cloak_vanish', {
      owner: pi,
      heroIdx: protectedTarget.heroIdx,
      zoneSlot: protectedTarget.type === 'equip' ? protectedTarget.slotIdx : undefined,
    });

    await engine._delay(3100);

    // Perform immediate action: Attack/Spell only, exclude protected target
    await engine.performImmediateAction(oppIdx, oppHeroIdx, {
      title: 'Invisibility Cloak',
      description: `Use an Attack or Spell with ${oppHero.name}. ${protectedTarget.cardName} cannot be targeted.`,
      allowedCardTypes: ['Attack', 'Spell'],
      skipAbilities: true,
      excludeTargets: [protectedId],
    });

    engine.sync();

    return { effectNegated: true };
  },
};
