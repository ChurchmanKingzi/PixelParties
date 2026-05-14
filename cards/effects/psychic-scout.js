// ═══════════════════════════════════════════
//  CARD EFFECT: "Psychic Scout"
//  Creature (Summoning Magic Lv1, 50 HP)
//
//  Two passive effects:
//
//  1) ADDITIONAL ACTION: Once per turn, the
//     controller may summon a level-0 Creature
//     from their hand as an additional Action.
//     Unconditional — no "must be first summon"
//     restriction like Slime Rancher's, no
//     archetype gate, just "any Lv0 Creature".
//
//  2) DAMAGE REDUCTION: While Psychic Scout is on
//     the board, any damage the controller's
//     level-0 Creatures take is reduced by 100
//     (floored at 0).
//
//  Implementation
//  ──────────────
//  • Additional action wiring follows the standard
//    register-then-grant pattern from Slime Rancher:
//      - `onPlay` registers the action type AND
//        grants it for this instance.
//      - `onTurnStart` re-grants on the owner's
//        turn so a fresh "once per turn" slot is
//        available each round.
//    The engine's `consumeAdditionalAction` path
//    consumes the grant when a Lv0 Creature gets
//    played; the filter on the action type makes
//    sure only Lv0 Creatures match.
//
//  • Stacking: each Scout instance carries its
//    own grant. Two Scouts on board = two free
//    Lv0 summons per turn. Matches Slime Rancher's
//    multi-instance behaviour.
//
//  • Damage reduction uses `beforeCreatureDamageBatch`
//    and reads `e.originalLevel === 0` (the same
//    field Diamond's Lv0 status-immunity effect
//    consults — set in `_engine.js` ~L19554 from
//    the card-data level). "Original level" matches
//    Diamond's convention: a Lv0 Creature whose
//    effective level got boosted by Slime Rancher /
//    similar still counts as Lv0 for this passive.
//
//  • `cannotBeReduced` (true-damage flag — Acid Vial,
//    future un-reducible sources) is respected, so
//    the protection composes cleanly with the rest
//    of the damage pipeline.
//
//  • Self isn't covered — Psychic Scout is Lv1, so
//    its own damage is unaffected. The protection
//    is for the Lv0 swarm it commands.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME         = 'Psychic Scout';
const ADDITIONAL_TYPE   = 'psychic_scout_lv0_summon';
const DAMAGE_REDUCTION  = 100;

/** Idempotent type-registration helper. Safe to call from both
 *  `onPlay` and `onTurnStart` — the engine just overwrites the slot
 *  with the same config. */
function _registerScoutAction(engine) {
  engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
    label: CARD_NAME,
    allowedCategories: ['creature'],
    filter: (cardData) => {
      return hasCardType(cardData, 'Creature') && (cardData?.level ?? -1) === 0;
    },
  });
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    /**
     * On summon: register the action type AND grant THIS Scout's
     * once-per-turn additional Lv0 summon. The grant is consumed by
     * the engine when the controller plays a matching Creature.
     */
    onPlay: async (ctx) => {
      // Only react to OUR OWN summon (the engine fires onPlay for
      // every tracked listener — without this gate every existing
      // Scout would re-grant when ANY new card lands).
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      const engine = ctx._engine;
      _registerScoutAction(engine);
      ctx.grantAdditionalAction(ADDITIONAL_TYPE);
      engine.sync();
    },

    /**
     * On the controller's turn start: refresh the grant so the player
     * gets a fresh "once per turn" Lv0 summon each round. Mirrors
     * Slime Rancher's restoration pattern.
     */
    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const engine = ctx._engine;
      _registerScoutAction(engine);
      ctx.grantAdditionalAction(ADDITIONAL_TYPE);
    },

    /**
     * Damage-reduction passive. Walks every entry in the batch and,
     * for each entry whose target is an own-side Lv0 Creature, shaves
     * `DAMAGE_REDUCTION` off the amount (floor 0). True damage
     * (`cannotBeReduced`) bypasses, matching the Wall of Deri
     * convention.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      const pi = ctx.cardOwner;
      const entries = ctx.entries;
      if (!entries || entries.length === 0) return;

      for (const e of entries) {
        if (e.cancelled) continue;
        if (e.cannotBeReduced) continue;
        // "Your level 0 Creatures" — controller-aware so Diplomacy /
        // Dark Gear loaned Creatures count as the current controller's.
        const entryOwner = e.inst?.controller ?? e.inst?.owner;
        if (entryOwner !== pi) continue;
        // `originalLevel` is stamped on every entry by
        // `processCreatureDamageBatch` (~L19554). Matches Diamond's
        // Lv0-status-immunity convention — a level-boosted Lv0
        // Creature still counts as Lv0 for this passive.
        if (e.originalLevel !== 0) continue;
        if (e.amount > 0) {
          e.amount = Math.max(0, e.amount - DAMAGE_REDUCTION);
        }
      }
    },
  },
};
