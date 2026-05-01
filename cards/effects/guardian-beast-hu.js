// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Hu" (Tiger)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.   BANNED.
//
//  EFFECT (once/turn): delete exactly 5 cards
//    from the discard piles → immediately
//    perform an additional Action with any Hero
//    you control.
//
//  IMPLEMENTATION:
//
//  • Pay the 5-card deletion cost via the standard
//    Guardian Beast picker (combined-discard
//    gallery, exact-count gating).
//  • Hand off to `engine.performImmediateActionAnyHero`
//    — opens an "Action Phase-style" prompt where
//    eligible Action cards in hand light up and
//    the player either CLICKS one then picks a
//    Hero / Support Zone, or DRAGS-and-DROPS the
//    card directly onto a target Hero / zone.
//    Same UX as a normal Action Phase action.
//
//  • The `Any-Hero` variant doesn't lock the
//    activation to a specific Hero — the player
//    chooses card first, hero second (or together
//    via drag/drop), like the normal Action Phase
//    flow. The card-eligibility filter respects
//    every per-card restriction: canSummon
//    (Guardian-Beast empty-discard gate), Wisdom
//    discard cost, level / spell-school
//    requirements, sacrifice / beforeSummon
//    costs (Dragon Pilot, Steam Dwarf Engineer,
//    DDG, 500 Piranhas), once-per-game flags,
//    and any custom `spellPlayCondition`.
//    Engine fixes pushed to `getHeroEligibleActionCards`
//    (canSummon filter) and the Creature play
//    branches in `performImmediateAction(AnyHero)`
//    (now route through `summonCreatureWithHooks`
//    so beforeSummon fires) make this work
//    correctly across all card types.
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  promptAndDeleteFromBothDiscards,
} = require('./_guardian-beasts-shared');

const CARD_NAME = 'Guardian Beast Hu';
const DELETE_COST = 5;

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < DELETE_COST) return false;
    // At least one alive Hero must exist on this side — otherwise the
    // bonus action has no possible recipient.
    return (ps.heroes || []).some(h => h?.name && h.hp > 0);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    // Pay the deletion cost first. If the player cancels mid-pick, no
    // commitment is made and the bonus action doesn't fire.
    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts: [DELETE_COST],
      title: CARD_NAME,
      description: `Pick exactly ${DELETE_COST} cards from the discard piles to delete and gain an additional Action with any Hero.`,
      sourceName: CARD_NAME,
      cancellable: true,
    });
    if (!deleted || deleted.length < DELETE_COST) return false;

    // Run the action prompt. `performImmediateActionAnyHero`:
    //   • Lights up eligible Action cards in hand (filtered to
    //     "at least one Hero could legally play this").
    //   • Player clicks a card then picks a Hero / Support Zone, OR
    //     drags the card directly onto a target. Standard Action
    //     Phase UX.
    //   • Routes the play through normal hand-play paths so all
    //     restrictions land (canSummon, beforeSummon, level/school,
    //     Wisdom, once-per-game, spellPlayCondition).
    //   • Auto-skips silently if no Hero can play anything in hand.
    const result = await engine.performImmediateActionAnyHero(pi, {
      title: CARD_NAME,
      description: 'Use an additional Action with any of your Heroes!',
      cancellable: true,
    });

    engine.log('guardian_beast_hu_grant_action', {
      player: ps.username,
      played: !!result?.played,
      cardName: result?.cardName,
      cardType: result?.cardType,
    });
    engine.sync();
    return true;
  },
};
