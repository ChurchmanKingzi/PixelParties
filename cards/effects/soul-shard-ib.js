// ═══════════════════════════════════════════
//  CARD EFFECT: "Soul Shard Ib" (Heart)
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//  Archetype: Soul Shards.
//
//  PASSIVE: This Creature's effects don't get
//    negated when it's summoned by the effect
//    of Necromancy.
//
//  ON SUMMON FROM DISCARD: heal the corresponding
//    Hero's HP for 40 × the number of different
//    Creatures in your discard pile.
//
//  "Corresponding Hero" = Ib's host (the Hero
//  whose Support Zone now contains Ib). For
//  Necromancy revives that's the Necromancy
//  Hero; for hand plays it's whichever Hero the
//  player picked.
//
//  HARD 1/TURN by name.
// ═══════════════════════════════════════════

const {
  canSummonSoulShard, markSoulShardSummoned,
  distinctCreatureNamesInDiscard,
  SOUL_SHARD_PILE_FUEL,
  soulShardEffectActivates_FromDiscard,
  markSoulShardEffectFired,
} = require('./_soul-shards-shared');

const CARD_NAME = 'Soul Shard Ib';
const HEAL_PER_CREATURE = 40;

module.exports = {
  activeIn: ['support'],
  bypassNecromancyNegation: true,
  canSummon: canSummonSoulShard,
  cpuMeta: { pileFuel: SOUL_SHARD_PILE_FUEL },
  // Sandy Blob gate — heal effect only runs when summoned from discard.
  summonEffectActivates: soulShardEffectActivates_FromDiscard,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      markSoulShardSummoned(gs, pi, CARD_NAME);
      if (!ctx._summonedFromDiscard) return;

      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const distinct = distinctCreatureNamesInDiscard(engine, pi);
      if (distinct <= 0) return;
      const healAmount = HEAL_PER_CREATURE * distinct;

      // Heal animation on the host's portrait.
      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle', owner: pi, heroIdx, zoneSlot: -1,
      });
      await engine._delay(280);

      const source = { name: CARD_NAME, owner: pi, heroIdx, cardInstance: ctx.card };
      await engine.actionHealHero(source, hero, healAmount);

      // Effect fully committed — Sandy Blob marker.
      markSoulShardEffectFired(ctx);
      engine.log('soul_shard_ib_heal', {
        player: gs.players[pi]?.username, hero: hero.name,
        distinctCreatures: distinct, healed: healAmount,
      });
      engine.sync();
    },
  },
};
