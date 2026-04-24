// ═══════════════════════════════════════════
//  CARD EFFECT: "Elven Forager"
//  Creature (Summoning Magic Lv1) — 50 HP
//
//  Passive: "Elven" Creatures in your hand and deck
//  have their levels reduced by 1.
//
//  Plugs into the engine's generic card-level
//  reduction mechanism via `reduceCardLevel` —
//  sibling hook to the existing `reduceSpellLevel`
//  walked by abilities (Mana Mining). The engine
//  walks every tracked instance on the player's
//  side and sums returned reductions before running
//  the school-level check.
//
//  Consequences that fall out of the per-instance
//  walk:
//    - Two Foragers on the board naturally stack to
//      a level-2 reduction. (Mirrors how multiple
//      Mana Mining copies already stack.)
//    - The reduction does NOT apply to cards from
//      the opponent's hand/deck — `inst.controller`
//      is compared to `ownerIdx` in the engine walk.
//    - Forager only contributes its reduction while
//      on the board (support zone). `activeIn:
//      ['support']` gates the hook via the engine's
//      generic activeIn check — so a Forager sitting
//      in the owner's hand/deck does NOT pre-reduce
//      the level of other Elven Creatures (including
//      itself) before it ever lands.
//    - Druid's deck-tutor summon bypasses the level
//      check anyway, so Forager's effect is
//      irrelevant to that summon path — which is
//      fine; the card text is about hand/deck
//      levels, not bypass-summon levels.
// ═══════════════════════════════════════════

const { isElvenCreature } = require('./_elven-shared');

module.exports = {
  activeIn: ['support'],

  /**
   * Generic engine-side reduction hook. The engine walks every tracked
   * instance `ownerIdx` controls and sums non-negative returns from
   * each script's `reduceCardLevel`. Forager's contribution: -1 if
   * the card in question is an Elven Creature.
   *
   * The engine already clamps the final level at zero, so we don't
   * need to worry about going negative.
   *
   * NOTE: The engine passes `cardData` describing the card being
   * level-checked — NOT Forager itself. So `isElvenCreature(cardData)`
   * asks "is the card being summoned an Elven Creature?", which is
   * exactly the card-text condition.
   *
   * @param {object} cardData - The card whose level is being checked.
   * @returns {number} levels to subtract (0 if not applicable).
   */
  reduceCardLevel(cardData) {
    return isElvenCreature(cardData) ? 1 : 0;
  },
};
