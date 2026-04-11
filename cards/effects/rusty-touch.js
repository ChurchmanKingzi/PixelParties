// ═══════════════════════════════════════════
//  CARD EFFECT: "Rusty Touch"
//  Spell (Reaction) — Decay Magic Lv3
//
//  When the opponent plays an Artifact,
//  chain this and negate it. The opponent
//  still has to pay the Artifact's Gold cost.
//
//  Animation: rust corrosion effect.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isReaction: true,

  // Cannot be played proactively
  canActivate: () => false,

  /**
   * Fires when the most recent chain link is an opponent's Artifact
   * and the Rusty Touch owner has a hero with Decay Magic Lv3.
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;

    // Must react to the most recent card played by the opponent
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    if (lastLink.owner === pi) return false;

    // Must be an Artifact
    if (lastLink.cardType !== 'Artifact') return false;

    // Owner must have at least one hero with Decay Magic Lv3, alive and not incapacitated
    const ps = gs.players[pi];
    if (!ps) return false;
    const cardData = engine._getCardDB()['Rusty Touch'];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
      if (engine.heroMeetsLevelReq(pi, hi, cardData)) return true;
    }
    return false;
  },

  /**
   * Resolve: negate the Artifact below this link in the chain.
   * Force the opponent to pay its Gold cost (normally negation
   * skips gold deduction, but Rusty Touch overrides this).
   */
  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const gs = engine.gs;
    const ps = gs.players[pi];

    // The link directly below this one is the Artifact we're negating
    const targetIndex = myIndex - 1;
    if (targetIndex < 0) return;
    const targetLink = chain[targetIndex];
    if (!targetLink) return;

    // Rust corrosion animation on the opponent
    engine._broadcastEvent('play_zone_animation', {
      type: 'plague_smoke', owner: targetLink.owner,
      heroIdx: 0, zoneSlot: -1,
    });
    await engine._delay(500);

    // Force-deduct the Artifact's gold cost BEFORE negating
    const oppIdx = targetLink.owner;
    const oppPs = gs.players[oppIdx];
    const goldCost = targetLink.goldCost || 0;
    if (goldCost > 0 && oppPs) {
      oppPs.gold = Math.max(0, (oppPs.gold || 0) - goldCost);
      engine.log('rusty_touch_gold', {
        player: oppPs.username, card: targetLink.cardName, gold: goldCost,
      });
    }

    // Negate the Artifact
    engine.negateChainLink(chain, targetIndex);
    engine.log('rusty_touch_negate', {
      player: ps.username,
      negated: targetLink.cardName,
      owner: targetLink.owner,
    });

    engine.sync();
  },
};
