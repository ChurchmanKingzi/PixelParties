// ═══════════════════════════════════════════
//  CARD EFFECT: "The Great Wall of Deri"
//  Artifact (Equipment, Cost 10)
//
//  Equip this card to a Hero you control. While
//  you control this card, any damage Creatures
//  you control would take is reduced by 10,
//  to a minimum of 10.
//
//  Implementation
//  ──────────────
//  • `activeIn: ['support']` — the hook only fires
//    while the card is face-up in a Support Zone
//    (i.e. while equipped). The engine naturally
//    routes the Equipment to discard when its host
//    Hero dies or it's destroyed, so "while you
//    control this card" is enforced by the zone
//    gate without an explicit check here.
//
//  • `beforeCreatureDamageBatch` walks every entry,
//    keeps the ones whose target Creature is on
//    THIS Wall's controller's side, and applies the
//    reduction:
//        if (amount > 10) amount = max(10, amount - 10)
//    The `> 10` guard is load-bearing: it makes the
//    "minimum of 10" floor a CEILING on the
//    reduction, not a floor on the FINAL damage.
//    Without the guard, incoming damage below 10
//    would be RAISED to 10 (Math.max picking the
//    floor over the negative subtraction result) —
//    a shield that increases small damage is the
//    opposite of the card's intent.
//
//  • Multi-Wall stacking is correct by construction.
//    Each Wall instance fires its own hook on the
//    same batch; each independently reduces by 10.
//    Three Walls reduce 30 → 20 → 10 → 10 (third
//    Wall is a no-op because the entry is already
//    at the floor). Gameplay-wise this means two
//    Walls is the practical maximum protection.
//
//  • `cannotBeReduced` (the engine's "true damage"
//    flag — see _engine.js ~L19645) is respected.
//    True-damage cards like Acid Vial bypass every
//    reducer, including this one.
//
//  • Self-damage and status ticks (Burn, Poison)
//    ARE reduced — the text says "any damage", and
//    the hook fires for every batched creature
//    damage event regardless of source.
// ═══════════════════════════════════════════

const CARD_NAME = 'The Great Wall of Deri';

module.exports = {
  // Equipment lives in the support zone. The hook below only fires
  // while the card is there, which is the engine's canonical
  // "currently in play under your control" gate for Equipment.
  activeIn: ['support'],

  hooks: {
    beforeCreatureDamageBatch: async (ctx) => {
      const pi = ctx.cardOwner;
      const hero = ctx.attachedHero;
      // Defensive: if the host Hero is already at 0 HP this turn
      // (death cleanup not yet flushed), the Wall isn't meaningfully
      // "controlled" — match Diamond's pattern (`!hero || hero.hp <= 0`
      // bail at the top of its batch hook).
      if (!hero || hero.hp <= 0) return;

      const entries = ctx.entries;
      if (!entries || entries.length === 0) return;

      for (const e of entries) {
        if (e.cancelled) continue;
        // True damage (Acid Vial, future un-reducible sources) bypasses
        // every reducer — the engine sets `cannotBeReduced` on the
        // entry to signal this. Skip without modification.
        if (e.cannotBeReduced) continue;
        // "Creatures you control" — controller-aware so Diplomacy /
        // Dark Gear loaned Creatures count as the loaning side's,
        // matching the rest of the codebase's "you control" idiom.
        const entryOwner = e.inst?.controller ?? e.inst?.owner;
        if (entryOwner !== pi) continue;
        // Reduce by 10, floored at 10. The `> 10` guard is what makes
        // the floor a CEILING on the reduction rather than a floor on
        // the final damage — see the header comment.
        if (e.amount > 10) {
          e.amount = Math.max(10, e.amount - 10);
        }
      }
    },
  },

  cpuMeta: {
    /**
     * Per-instance defensive bonus added to the controller's eval.
     * The new Wall provides a flat -10 per Creature damage hit, floored
     * at 10. That's worth a lot in long games (every opponent's
     * attack / spell / status tick that hits a Creature is dampened),
     * but much less than the old card's board-wide non-damage
     * targeting shield — so the score is lower than the old +150.
     *
     * Stacking is allowed (the hook compose linearly) so this
     * intentionally does NOT dedup-by-lowest-id the way the old shield
     * version did. MCTS still gets the right diminishing-returns signal
     * organically: a third Wall's hook fires on entries already at the
     * floor of 10, so the rollout-state delta from the third equip is
     * zero and the gate won't favour over-stacking. The bonus is
     * intentionally a per-instance flat amount, not a per-side total,
     * so the eval correctly rewards keeping each Wall alive.
     */
    cpuInstBonus(engine, inst, ownerIdx) {
      if (inst.zone !== 'support') return 0;
      if (inst.faceDown) return 0;
      if ((inst.controller ?? inst.owner) !== ownerIdx) return 0;
      const host = engine.gs.players[ownerIdx]?.heroes?.[inst.heroIdx];
      if (!host?.name || host.hp <= 0) return 0;
      return 60;
    },
  },
};
