// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Tu" (Rabbit)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/turn): pick 3, 6 or 9 cards from
//    the combined discard piles to delete →
//    draw 1 / 2 / 3 cards (1 per 3 deleted).
//    The picker enforces the discrete count
//    rule — confirm is grayed out at any other
//    selection size.
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  promptAndDeleteFromBothDiscards,
} = require('./_guardian-beasts-shared');

const CARD_NAME = 'Guardian Beast Tu';

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    // Smallest valid cost is 3; below that the effect can't fire.
    return total >= 3;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < 3) return false;

    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts: [3, 6, 9],
      title: CARD_NAME,
      description: 'Pick 3, 6 or 9 cards from the discard piles to delete. Draw 1 card per 3 deleted.',
      sourceName: CARD_NAME,
      cancellable: true,
    });
    if (!deleted || deleted.length === 0) return false;

    const drawCount = Math.floor(deleted.length / 3);
    if (drawCount > 0) await engine.actionDrawCards(pi, drawCount);
    engine.log('guardian_beast_tu_draw', {
      player: engine.gs.players[pi]?.username,
      deleted: deleted.length, drew: drawCount,
    });
    engine.sync();
    return true;
  },
};
