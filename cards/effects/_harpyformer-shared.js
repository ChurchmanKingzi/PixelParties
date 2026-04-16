// ═══════════════════════════════════════════
//  Shared helpers for the Harpyformer archetype.
//
//  All Harpyformers share the same inherent-
//  action rule: summoning the first Creature
//  of your turn counts as an additional Action.
// ═══════════════════════════════════════════

/**
 * inherentAction function shared by every Harpyformer.
 * Returns true (= counts as additional action) only when
 * no other creature has been summoned yet this turn.
 *
 * Usage in a card module:
 *   const { harpyformerInherentAction } = require('./_harpyformer-shared');
 *   module.exports = { inherentAction: harpyformerInherentAction, ... };
 */
function harpyformerInherentAction(gs, pi) {
  const ps = gs.players[pi];
  return ps ? (ps._creaturesSummonedThisTurn || 0) === 0 : false;
}

module.exports = { harpyformerInherentAction };
