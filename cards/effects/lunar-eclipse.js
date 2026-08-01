// ═══════════════════════════════════════════
//  CARD EFFECT: "Lunar Eclipse"
//  Spell (Surprise) — Magic Arts Lv1, Lunatic
//
//  Placed face-down. Activates as a chain
//  REACTION when the opponent activates ANY card
//  FROM THEIR HAND (Spell / Attack / Creature /
//  Artifact / Potion / Ability — board
//  activations carry `fromBoard` and are
//  excluded, same rule as The Master's Plan).
//
//  Activation cost: send one "Lunatic Cycle" card
//  from YOUR side of the board to the discard
//  pile (paid the moment you choose to flip it).
//
//  Effect: NEGATE the opponent's card and DELETE
//  it (removed from the game, not discarded). If
//  the negated card had cost the opponent an
//  Action, they MAY immediately perform a
//  different Action with any Hero (optional —
//  identical to The Master's Plan's clause).
//
//  Engine: a Surprise that is ALSO `isReaction`
//  is offered straight from its face-down zone in
//  the play-chain reaction window
//  (`_promptReactionsForChain`); `payActivationCost`
//  is the generic per-Surprise activation-cost
//  hook the engine calls on flip.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');
const { isLunaticCycle } = require('./_lunatic-shared');

const CARD_NAME = 'Lunar Eclipse';

/** Lunatic Cycle support instances on `pi`'s side of the board. */
function ownLunaticCycleInsts(engine, pi) {
  return (engine.cardInstances || []).filter(c =>
    c && c.zone === 'support' && !c.faceDown
    && (c.controller ?? c.owner) === pi
    && isLunaticCycle(c.name));
}

module.exports = {
  isSurprise: true,
  isReaction: true,
  // Stays face-up in its Surprise Zone for the whole chain; the
  // engine's end-of-chain surprise-reaction cleanup sends it to
  // discard AFTER the negated card is processed. This flag stops
  // `_resolveReactionChain` from discarding it early mid-chain.
  skipPostResolveDiscard: true,

  // Never a proactive play — it only ever flips from its Surprise Zone
  // inside the reaction window.
  canActivate: () => false,

  /**
   * Fires when the chain's most recent card was played by the OPPONENT
   * FROM HAND (not a board activation), AND the owner has at least one
   * "Lunatic Cycle" card on their side of the board to pay the cost.
   * (The host Hero's alive/not-CC'd + spell-school/level gate is
   * enforced by the engine's `_canHeroActivateSurprise` on the
   * Surprise's zone before this card is offered.)
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    if (!lastLink) return false;
    if (lastLink.owner === pi) return false;   // must be the opponent's card
    if (lastLink.fromBoard) return false;      // must be FROM HAND
    return ownLunaticCycleInsts(engine, pi).length > 0; // can pay the cost
  },

  /**
   * Activation cost — send one "Lunatic Cycle" card from your side of
   * the board to the discard pile. Called by the engine the moment the
   * owner confirms flipping the Surprise (before the chain link is
   * built); a `false` return aborts the activation.
   */
  payActivationCost: async (engine, pi) => {
    const insts = ownLunaticCycleInsts(engine, pi);
    if (insts.length === 0) return false;
    // Send the first one to discard. (All five moons satisfy the cost
    // equally — no benefit to prompting which.)
    await engine.actionMoveCard(insts[0], 'discard');
    engine.log('lunar_eclipse_cost', {
      player: engine.gs.players[pi]?.username, sent: insts[0].name,
    });
    engine.sync();
    return true;
  },

  /**
   * Resolve (LIFO): negate the card directly below us in the chain and
   * flag it for DELETION (deleted pile, not discard). If that card had
   * cost the opponent an Action, grant them an optional replacement
   * Action with any Hero (same detection as The Master's Plan).
   */
  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const gs = engine.gs;
    const ps = gs.players[pi];

    const targetIndex = myIndex - 1;
    if (targetIndex < 0) return;
    const targetLink = chain[targetIndex];
    if (!targetLink) return;

    // Animation auf dem CASTER-Helden (gleicher Fund wie bei "The
    // Master's Plan": `heroIdx: 0` war fest verdrahtet, der Puls lief
    // also immer über dem linken Helden). Der eigene Chain-Link trägt
    // den Caster; Fallback 0 hält die Animation im Zweifel am Laufen.
    const selfLink = chain[myIndex];
    const casterHeroIdx = selfLink?.casterHeroIdx ?? selfLink?.heroIdx ?? 0;
    engine._broadcastEvent('play_zone_animation', {
      type: 'lunar_eclipse_pulse', owner: pi, heroIdx: casterHeroIdx, zoneSlot: -1,
    });
    await engine._delay(500);

    // Negate AND delete the opponent's card.
    engine.negateChainLink(chain, targetIndex, { deleteCard: true });
    engine.log('lunar_eclipse_negate', {
      player: ps?.username,
      negated: targetLink.cardName,
      owner: targetLink.owner,
    });

    // Replacement Action only when the negated card actually SPENT an
    // Action. Reactions chained from hand don't spend Actions — only
    // initial cards (Attack/Spell/Creature without inherentAction, or
    // an action-cost Ability) do.
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
    if (targetLink.cardType === 'Ability' && negatedScript?.actionCost) {
      costsAction = true;
    }
    if (!costsAction) return;

    // Defer the replacement Action until AFTER the whole chain has
    // resolved — granting it inline (mid-`_resolveReactionChain`)
    // prompts while the reaction lock still blocks card plays, so the
    // opponent's highlighted cards can't actually be played. The engine
    // drains this once the chain is over and the lock is released.
    const oppIdx = targetLink.owner;
    engine.queuePostChainAction(async () => {
      await engine.performImmediateActionAnyHero(oppIdx, {
        title: CARD_NAME,
        description: 'Your card was negated and deleted. You may perform a different Action with any Hero — or skip.',
        cancellable: true,
      });
      engine.sync();
    });
  },
};
