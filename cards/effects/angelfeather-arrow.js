// ═══════════════════════════════════════════
//  CARD EFFECT: "Angelfeather Arrow"
//  Artifact (Reaction, cost 5)
//
//  Play in reaction to an Attack by a Hero you
//  control. Increase that Attack's damage by 60.
//
//  See `_arrows-shared.js` for the full Arrow
//  reaction / damage-modifier machinery. The
//  only card-specific bit here is the modifier
//  descriptor pushed onto the attacker's
//  `_armedArrows` list: `{ flatDamage: 60 }`.
//  The engine's `_actionDealDamageImpl` picks
//  it up in its armed-arrow pass and bumps the
//  damage for every target the Attack hits.
// ═══════════════════════════════════════════

const { arrowTriggerCondition, armAttackerWithArrow } = require('./_arrows-shared');

const CARD_NAME = 'Angelfeather Arrow';

module.exports = {
  isReaction: true,
  isArrow: true,

  // Strictly reactive — cannot be played proactively from hand.
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) =>
    arrowTriggerCondition(gs, pi, engine, chainCtx),

  resolve: async (engine, pi, _sel, _val, chain, _idx) => {
    armAttackerWithArrow(engine, pi, chain, {
      flatDamage: 60,
      sourceCard: CARD_NAME,
    });
    engine.log('arrow_armed', { player: engine.gs.players[pi]?.username, arrow: CARD_NAME });
    engine.sync();
  },
};
