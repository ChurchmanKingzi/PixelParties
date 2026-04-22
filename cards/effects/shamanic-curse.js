// ═══════════════════════════════════════════
//  CARD EFFECT: "Shamanic Curse"
//  Spell (Reaction) — Decay Magic Lv3
//
//  When the opponent plays a Spell, increase that
//  Spell's level by 1. If the caster can no longer
//  meet the level requirement — even via Wisdom
//  coverage they can actually pay for in hand cards
//  — the Spell is negated and sent to the discard
//  pile. In that case the caster gets a bonus
//  Action to replace the one they just wasted.
// ═══════════════════════════════════════════

module.exports = {
  isReaction: true,

  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    if (!lastLink || lastLink.owner === pi) return false;
    if (lastLink.cardType !== 'Spell') return false;

    const ps = gs.players[pi];
    if (!ps) return false;
    const cardData = engine._getCardDB()['Shamanic Curse'];
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
    const gs = engine.gs;
    const targetIndex = myIndex - 1;
    if (targetIndex < 0) return;
    const targetLink = chain[targetIndex];
    if (!targetLink) return;

    const oppIdx = targetLink.owner;
    const oppPs = gs.players[oppIdx];
    const castingHi = targetLink.heroIdx ?? -1;
    const castingHero = oppPs?.heroes?.[castingHi];
    const spellName = targetLink.cardName;
    const spellCd = engine._getCardDB()[spellName];

    if (!oppPs || !castingHero || !spellCd) {
      engine.log('shamanic_curse_abort', { reason: 'caster-or-spell-missing' });
      return;
    }

    // Determine the new required Wisdom cost when the spell's effective
    // level goes up by 1. Temporarily patch the caster's levelOverrideCards
    // so engine.getWisdomDiscardCost sees the bumped level.
    if (!castingHero.levelOverrideCards) castingHero.levelOverrideCards = {};
    const hadOverride = Object.prototype.hasOwnProperty.call(castingHero.levelOverrideCards, spellName);
    const prevOverride = hadOverride ? castingHero.levelOverrideCards[spellName] : undefined;
    const currentLevel = prevOverride != null ? prevOverride : (spellCd.level || 0);
    castingHero.levelOverrideCards[spellName] = currentLevel + 1;

    const newCost = engine.getWisdomDiscardCost(oppIdx, castingHi, spellCd);

    // Restore override exactly as it was
    if (!hadOverride) delete castingHero.levelOverrideCards[spellName];
    else castingHero.levelOverrideCards[spellName] = prevOverride;

    // newCost: -1 means uncoverable (no Wisdom path exists), otherwise the
    // required extra discards. Spell survives iff the caster CAN cover it
    // AND has enough hand cards to pay. The original cast already paid
    // its own Wisdom cost before this reaction — we don't charge more.
    const coverable = newCost >= 0;
    const affordable = coverable && (oppPs.hand?.length || 0) >= newCost;

    engine._broadcastEvent('play_zone_animation', {
      type: 'plague_smoke', owner: oppIdx,
      heroIdx: castingHi >= 0 ? castingHi : 0, zoneSlot: -1,
    });
    await engine._delay(500);

    if (affordable) {
      // Still legal — the +1 is flavor only; spell resolves normally.
      engine.log('shamanic_curse_survived', {
        player: gs.players[pi]?.username,
        spell: spellName, newCost,
      });
      engine.sync();
      return;
    }

    // Uncoverable → negate + refund the Action as a bonus for the caster.
    engine.negateChainLink(chain, targetIndex);
    oppPs._bonusMainActions = (oppPs._bonusMainActions || 0) + 1;
    if (castingHi >= 0) {
      oppPs.bonusActions = { heroIdx: castingHi, remaining: 1 };
    }

    engine.log('shamanic_curse_negate', {
      player: gs.players[pi]?.username,
      spell: spellName, owner: oppIdx, refundTo: castingHi,
    });
    engine.sync();
  },
};
