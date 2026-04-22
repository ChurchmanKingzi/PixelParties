// ═══════════════════════════════════════════
//  CARD EFFECT: "The Master's Plan"
//  Spell (Reaction) — Decay Magic Lv3
//
//  When the opponent plays ANY card from hand
//  or activates/attaches an Ability, chain this
//  and negate that card.
//  If the negated card cost an Action (Attack,
//  Spell, Creature without inherentAction, or
//  action-cost Ability), the opponent MAY
//  immediately perform a different Action with
//  any of their Heroes (like a normal Action
//  Phase). The replacement action is optional —
//  the target can cancel the prompt to skip it.
//
//  Hard once per turn (across all copies).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

module.exports = {
  isReaction: true,

  // Cannot be played proactively
  canActivate: () => false,

  /**
   * Reaction fires when the chain's initial card belongs to the opponent
   * and the Plan owner has at least one hero with Decay Magic Lv3
   * that is alive and not incapacitated.
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;

    // Hard once per turn
    const hoptKey = `masters_plan:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;

    // Must react to the most recent card played by the opponent (initial or reaction)
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    if (lastLink.owner === pi) return false;

    // Owner must have at least one hero with Decay Magic Lv3, alive and not incapacitated
    const ps = gs.players[pi];
    if (!ps) return false;
    const cardData = engine._getCardDB()["The Master's Plan"];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
      if (engine.heroMeetsLevelReq(pi, hi, cardData)) return true;
    }
    return false;
  },

  /**
   * Resolve: negate the initial card. If it cost an Action,
   * grant the opponent an immediate replacement Action with any hero.
   */
  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const gs = engine.gs;
    const ps = gs.players[pi];

    // Mark HOPT
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[`masters_plan:${pi}`] = gs.turn;

    // The link directly below this one is the card we're negating
    const targetIndex = myIndex - 1;
    if (targetIndex < 0) return;
    const targetLink = chain[targetIndex];
    if (!targetLink) return;

    // Animation — dark mastermind flash
    engine._broadcastEvent('play_zone_animation', {
      type: 'plague_smoke', owner: pi,
      heroIdx: 0, zoneSlot: -1,
    });
    await engine._delay(500);

    // Negate the target card
    engine.negateChainLink(chain, targetIndex);
    engine.log('masters_plan_negate', {
      player: ps.username,
      negated: targetLink.cardName,
      owner: targetLink.owner,
    });

    // Only grant a replacement Action if the negated card actually spent an Action.
    // Reactions played from hand during a chain do NOT spend Actions — only initial
    // cards (Attack/Spell/Creature/action-cost Ability) do.
    if (!targetLink.isInitialCard) return;

    const cardDB = engine._getCardDB();
    const negatedData = cardDB[targetLink.cardName];
    const negatedScript = loadCardEffect(targetLink.cardName);

    let costsAction = false;

    if (negatedData) {
      const isAttack = hasCardType(negatedData, 'Attack');
      const isSpell = hasCardType(negatedData, 'Spell');
      const isCreature = hasCardType(negatedData, 'Creature');

      if (isAttack || isSpell || isCreature) {
        const isInherent = negatedScript
          ? (typeof negatedScript.inherentAction === 'function'
            ? negatedScript.inherentAction(gs, targetLink.owner, targetLink.heroIdx ?? -1, engine)
            : negatedScript.inherentAction === true)
          : false;
        if (!isInherent) costsAction = true;
      }
    }

    // Action-cost Abilities also cost an action
    if (targetLink.cardType === 'Ability' && negatedScript?.actionCost) {
      costsAction = true;
    }

    if (!costsAction) return;

    // Grant opponent an immediate Action with any hero — optional, they may
    // cancel to skip (the replacement is a "may", not a "must").
    const oppIdx = targetLink.owner;
    await engine.performImmediateActionAnyHero(oppIdx, {
      title: "The Master's Plan",
      description: 'Your card was negated. You may perform a different Action with any Hero — or skip.',
      cancellable: true,
    });

    engine.sync();
  },
};
