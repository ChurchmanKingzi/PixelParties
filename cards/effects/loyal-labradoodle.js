// ═══════════════════════════════════════════
//  CARD EFFECT: "Loyal Labradoodle"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Loyals
//
//  All damage your Creatures receive is reduced
//  by 20 times the number of "Loyal" Creatures
//  you control. This effect does not stack with
//  itself.
//
//  Wiring: passive `beforeCreatureDamageBatch`
//  listener. Walks the batch's entries, drops the
//  per-entry damage by `20 × loyalCount` for any
//  entry whose target creature is on the same
//  side as this Labradoodle. The reduction is
//  capped to keep amounts non-negative; healing
//  via this hook isn't a thing.
//
//  Non-stacking: the first Labradoodle to fire
//  per batch tags the entry with `_labradoodleReduced`
//  so a second Labradoodle's listener sees the
//  tag and bails. Multiple Labradoodles in the
//  same batch don't compound — only one
//  applies. (Loyal count itself can vary across
//  Labradoodles if their owners differ; only the
//  Labradoodle whose owner equals the entry's
//  target controller actually applies, so the
//  "first to fire" is always on the right side.)
// ═══════════════════════════════════════════

const { countLoyalCreatures } = require('./_loyal-shared');

const CARD_NAME       = 'Loyal Labradoodle';
const REDUCTION_PER_LOYAL = 20;

module.exports = {
  activeIn: ['support'],

  hooks: {
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const ownerIdx = ctx.cardOriginalOwner;

      // Pre-compute Loyal count for this side once — same value
      // applies to every entry in this batch.
      const loyalCount = countLoyalCreatures(engine, ownerIdx);
      if (loyalCount <= 0) return;
      const reduction = REDUCTION_PER_LOYAL * loyalCount;

      let appliedSomewhere = false;
      for (const e of (ctx.entries || [])) {
        if (!e || e.cancelled) continue;
        if (!e.inst) continue;
        // Only reduce damage to OUR Creatures.
        const targetController = e.inst.controller ?? e.inst.owner;
        if (targetController !== ownerIdx) continue;
        // Non-stacking: another Labradoodle (also our own) already
        // applied this turn. Bail without doubling.
        if (e._labradoodleReduced) continue;
        // "Cannot be reduced/negated" damage (e.g. Tempeste's redirect,
        // Acid Vial true damage) bypasses Cloudy & friends; honor that
        // here too — Labradoodle is a soft reduction, same family.
        if (e.canBeNegated === false) continue;

        const before = e.amount || 0;
        e.amount = Math.max(0, before - reduction);
        e._labradoodleReduced = true;
        appliedSomewhere = true;
        if (before > e.amount) {
          engine.log('loyal_labradoodle_reduce', {
            target: e.inst.name, from: before, to: e.amount,
            reduction, loyalCount,
          });
        }
      }

      if (appliedSomewhere) {
        // Brief sparkle so the player can see Labradoodle popped a shield.
        engine._broadcastEvent('play_zone_animation', {
          type: 'shield_burst',
          owner: ctx.cardOriginalOwner,
          heroIdx: ctx.cardHeroIdx,
          zoneSlot: ctx.card.zoneSlot,
        });
      }
    },
  },
};
