// ═══════════════════════════════════════════
//  CARD EFFECT: "Rainbow's Arrow"
//  Artifact (Reaction, cost 10)
//
//  Play in reaction to an Attack by a Hero you
//  control. Increase that Attack's damage by 10
//  and draw 2 cards.
//
//  The card draw happens at resolve time (before
//  the Attack itself resolves, per LIFO chain
//  order). The +10 damage is armed on the
//  attacker so the Attack's damage call picks
//  it up via the shared arrow machinery.
// ═══════════════════════════════════════════

const { arrowTriggerCondition, armAttackerWithArrow } = require('./_arrows-shared');

const CARD_NAME = "Rainbow's Arrow";
const DRAW_COUNT = 2;

module.exports = {
  isReaction: true,
  isArrow: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) =>
    arrowTriggerCondition(gs, pi, engine, chainCtx),

  resolve: async (engine, pi, _sel, _val, chain, _idx) => {
    armAttackerWithArrow(engine, pi, chain, {
      flatDamage: 10,
      sourceCard: CARD_NAME,
    });
    await engine.actionDrawCards(pi, DRAW_COUNT);
    engine.log('arrow_armed', { player: engine.gs.players[pi]?.username, arrow: CARD_NAME });
    engine.sync();
  },
};
