// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Punishment"
//  Spell (Reaction) — Decay Magic Lv2
//
//  When the opponent activates a Hero effect,
//  chain this and negate it. The chain link for
//  hero-effect activations is pushed with
//  cardType 'Hero' (see server.js doActivateHeroEffect).
// ═══════════════════════════════════════════

module.exports = {
  isReaction: true,

  // Not proactively playable — greyed out in hand
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    if (!lastLink || lastLink.owner === pi) return false;
    // Hero-effect activations route through executeCardWithChain with
    // cardType: 'Hero'. That's the only chain-link type this card cares
    // about.
    if (lastLink.cardType !== 'Hero') return false;

    const ps = gs.players[pi];
    if (!ps) return false;
    const cardData = engine._getCardDB()['Divine Punishment'];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
      if (engine.heroMeetsLevelReq(pi, hi, cardData)) return true;
    }
    return false;
  },

  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const targetIndex = myIndex - 1;
    if (targetIndex < 0) return;
    const targetLink = chain[targetIndex];
    if (!targetLink) return;

    engine._broadcastEvent('play_zone_animation', {
      type: 'holy_revival', owner: targetLink.owner,
      heroIdx: targetLink.heroIdx ?? 0, zoneSlot: -1,
    });
    await engine._delay(500);

    engine.negateChainLink(chain, targetIndex);
    engine.log('divine_punishment_negate', {
      player: engine.gs.players[pi]?.username,
      negated: targetLink.cardName,
      owner: targetLink.owner,
    });
    engine.sync();
  },
};
