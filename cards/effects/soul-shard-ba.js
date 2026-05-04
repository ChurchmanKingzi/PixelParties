// ═══════════════════════════════════════════
//  CARD EFFECT: "Soul Shard Ba" (Personality)
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//  Archetype: Soul Shards. BANNED.
//
//  PASSIVE: This Creature's effects don't get
//    negated when it's summoned by the effect
//    of Necromancy.
//
//  ON SUMMON FROM DISCARD: you MAY perform a
//    second Action during your Action Phase
//    this turn with the corresponding Hero.
//
//  Implementation: defers to the shared
//  `_second-action-shared` handler (see that
//  file for the full second-action lifecycle —
//  hero-restriction, phase-advance gate,
//  fizzle-on-action-2, badge cleanup). Ba just
//  supplies its source label + animation key
//  and spreads the shared hooks.
//
//  HARD 1/TURN by name.
// ═══════════════════════════════════════════

const {
  canSummonSoulShard, markSoulShardSummoned,
  SOUL_SHARD_PILE_FUEL,
  soulShardEffectActivates_FromDiscard,
  markSoulShardEffectFired,
} = require('./_soul-shards-shared');
const {
  secondActionGrant, secondActionHooks,
} = require('./_second-action-shared');

const CARD_NAME = 'Soul Shard Ba';

module.exports = {
  activeIn: ['support'],
  bypassNecromancyNegation: true,
  canSummon: canSummonSoulShard,
  cpuMeta: { pileFuel: SOUL_SHARD_PILE_FUEL },
  // Sandy Blob gate — effect only runs when summoned from discard.
  summonEffectActivates: soulShardEffectActivates_FromDiscard,

  hooks: {
    ...secondActionHooks,

    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      markSoulShardSummoned(gs, pi, CARD_NAME);
      if (!ctx._summonedFromDiscard) return;

      await secondActionGrant(ctx, {
        sourceLabel: CARD_NAME,
        animationType: 'soul_shard_dark_grant',
      });
      // Effect fully committed — Sandy Blob marker.
      markSoulShardEffectFired(ctx);
      await engine._delay(800);
    },
  },
};
