// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Topaz"
//  Artifact (Reaction, Cost 5)
//
//  Play immediately when one of your Heroes
//  performs an Attack. Increase that Attack's
//  damage by 60.
//  You may discard a card from your hand to keep
//  this card in your hand. Once per turn.
//
//  Same arrow-modifier scaffolding as
//  Angelfeather Arrow — armAttackerWithArrow
//  pushes a `{ flatDamage: 60 }` rider onto the
//  attacker's `_armedArrows` list. Engine's
//  `_actionDealDamageImpl` reads it during the
//  damage pipeline and bumps each hit.
// ═══════════════════════════════════════════

const { arrowTriggerCondition, armAttackerWithArrow } = require('./_arrows-shared');
const { canPlayMagicGem, maybeKeepGemInHand } = require('./_magic-gem-shared');

const CARD_NAME = 'Magic Topaz';
const FLAT_DAMAGE_BONUS = 60;

module.exports = {
  isReaction: true,
  isArrow: true,

  // The engine's reaction chain auto-discards each non-initial link
  // after its resolve runs (see `_resolveReactionChain`). Topaz opts
  // out so the keep-in-hand prompt has time to redirect the card back
  // to hand instead of into the discard pile.
  skipPostResolveDiscard: true,

  // Strictly reactive — never proactively playable.
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!canPlayMagicGem(gs, pi, CARD_NAME)) return false;
    return arrowTriggerCondition(gs, pi, engine, chainCtx);
  },

  resolve: async (engine, pi, _sel, _val, chain, _idx) => {
    armAttackerWithArrow(engine, pi, chain, {
      flatDamage: FLAT_DAMAGE_BONUS,
      sourceCard: CARD_NAME,
    });
    engine.log('arrow_armed', {
      player: engine.gs.players[pi]?.username, arrow: CARD_NAME,
    });
    engine.sync();

    // Disposition: the engine's auto-discard is suppressed via
    // `skipPostResolveDiscard`, so we own the routing here.
    const { keepInHand } = await maybeKeepGemInHand(engine, pi, CARD_NAME);
    const ps = engine.gs.players[pi];
    if (!ps) return;
    if (keepInHand) {
      ps.hand.push(CARD_NAME);
      engine.log('magic_topaz_kept_in_hand', { player: ps.username });
    } else {
      ps.discardPile.push(CARD_NAME);
    }
    engine.sync();
  },
};
