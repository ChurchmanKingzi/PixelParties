// ═══════════════════════════════════════════
//  CARD EFFECT: "Soul Shard Shut" (Shadow)
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//  Archetype: Soul Shards.
//
//  PASSIVE: This Creature's effects don't get
//    negated when it's summoned by the effect
//    of Necromancy.
//
//  ON SUMMON FROM DISCARD: you MAY send the top
//    5 cards of your deck to your discard pile.
//
//  HARD 1/TURN by name: shared canSummon gate.
// ═══════════════════════════════════════════

const {
  canSummonSoulShard, markSoulShardSummoned,
  SOUL_SHARD_PILE_FUEL,
  soulShardEffectActivates_FromDiscard,
  markSoulShardEffectFired,
} = require('./_soul-shards-shared');

const CARD_NAME = 'Soul Shard Shut';
const MILL_COUNT = 5;

module.exports = {
  activeIn: ['support'],
  bypassNecromancyNegation: true,
  canSummon: canSummonSoulShard,
  cpuMeta: { pileFuel: SOUL_SHARD_PILE_FUEL },
  // Sandy Blob gate — effect only runs when summoned from discard.
  summonEffectActivates: soulShardEffectActivates_FromDiscard,

  // CPU: this is a pure-positive "you may mill 5" prompt — under any
  // Soul-Shard pileFuel-armed board, milling 5 cards into discard is
  // strictly value-positive (chance to land more Shards, fuel
  // future revives). The default cancellable-confirm policy declines,
  // which would silently turn Shut into a vanilla 50-HP body. Always
  // confirm; the engine still runs Gerrymander redirects on top.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm' && promptData?.title === CARD_NAME) {
      return true;
    }
    return undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      // Stamp the per-name 1/turn flag for ALL summon sources (hand,
      // Necromancy, placement). The shared `canSummon` gate consults
      // this flag to block re-summons later in the same turn.
      markSoulShardSummoned(gs, pi, CARD_NAME);
      // Discard-summon-only effect.
      if (!ctx._summonedFromDiscard) return;

      // True "you may" — confirm with the player before milling. The
      // canonical `promptConfirmEffect` helper is Gerrymander-eligible
      // by default, so the opponent can redirect the choice with
      // Gerrymander as with any other optional effect.
      const ps = gs.players[pi];
      if ((ps?.mainDeck?.length || 0) === 0) return;

      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Send the top ${MILL_COUNT} cards from your deck to the discard pile?`,
      });
      if (!confirmed) return;

      const milled = await engine.actionMillCards(pi, MILL_COUNT, {
        source: CARD_NAME, selfInflicted: true,
      });
      // Effect fully committed — Sandy Blob marker.
      markSoulShardEffectFired(ctx);
      engine.log('soul_shard_shut_mill', {
        player: ps.username, milled: milled.length,
      });
      engine.sync();
    },
  },
};
