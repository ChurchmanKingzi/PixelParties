// ═══════════════════════════════════════════
//  CARD EFFECT: "Flame Arrow"
//  Artifact (Reaction, cost 5)
//
//  Play in reaction to an Attack by a Hero you
//  control. Increase that Attack's damage by 10
//  and Burn the target. (Hit all targets if the
//  Attack somehow hits multiple — the Burn and
//  the +10 are both per-target riders.)
//
//  See `_arrows-shared.js` for the full Arrow
//  reaction / damage-modifier machinery.
// ═══════════════════════════════════════════

const { arrowTriggerCondition, armAttackerWithArrow } = require('./_arrows-shared');

const CARD_NAME = 'Flame Arrow';

module.exports = {
  isReaction: true,
  isArrow: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) =>
    arrowTriggerCondition(gs, pi, engine, chainCtx),

  resolve: async (engine, pi, _sel, _val, chain, _idx) => {
    armAttackerWithArrow(engine, pi, chain, {
      flatDamage: 10,
      applyBurn: true,
      sourceCard: CARD_NAME,
    });
    engine.log('arrow_armed', { player: engine.gs.players[pi]?.username, arrow: CARD_NAME });
    engine.sync();
  },
};
