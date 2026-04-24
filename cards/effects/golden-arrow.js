// ═══════════════════════════════════════════
//  CARD EFFECT: "Golden Arrow"
//  Artifact (Reaction, cost 0, archetype: Arrows)
//
//  Play in reaction to a Hero you control hitting
//  exactly 1 target with an Attack. You gain 1
//  Gold for every 10 damage that Attack deals,
//  then your gold is LOCKED for the rest of the
//  turn (cannot gain or spend — enforced in the
//  engine's `actionGainGold` / `actionSpendGold`
//  via the new `ps.goldLocked` flag; cleared on
//  turn-start).
//
//  Single-target gate: currently all PP Attack
//  cards resolve via a single `promptDamageTarget`
//  call, so the "hits exactly 1 target" condition
//  is functionally always true. The hook is
//  wired through `arrowTriggerCondition`'s
//  `requireSingleTarget` option so it'll filter
//  automatically once multi-target Attacks ship.
// ═══════════════════════════════════════════

const { arrowTriggerCondition, armAttackerWithArrow } = require('./_arrows-shared');

const CARD_NAME = 'Golden Arrow';

module.exports = {
  isReaction: true,
  isArrow: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) =>
    arrowTriggerCondition(gs, pi, engine, chainCtx, { requireSingleTarget: true }),

  resolve: async (engine, pi, _sel, _val, chain, _idx) => {
    armAttackerWithArrow(engine, pi, chain, {
      goldRatio: 10,
      goldLockAfter: true,
      sourceCard: CARD_NAME,
    });
    engine.log('arrow_armed', { player: engine.gs.players[pi]?.username, arrow: CARD_NAME });
    engine.sync();
  },
};
