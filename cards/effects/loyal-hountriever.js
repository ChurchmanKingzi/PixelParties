// ═══════════════════════════════════════════
//  CARD EFFECT: "Loyal Hountriever"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Loyals
//
//  Up to 3 times per turn, when you summon a
//  "Loyal" Creature, except "Loyal Hountriever",
//  draw 1 card.
//
//  Per-instance counter (`hountrieverFiresThisTurn`)
//  caps the trigger at 3 per turn per Hountriever
//  — so two Hountrievers in play can each draw up
//  to 3 cards per turn (six total). Counter resets
//  on the controller's turn start. Self-summons
//  and Hountriever copies are excluded by the card
//  text.
// ═══════════════════════════════════════════

const { isLoyalCreature } = require('./_loyal-shared');

const CARD_NAME    = 'Loyal Hountriever';
const MAX_PER_TURN = 3;

module.exports = {
  activeIn: ['support'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;
      // Only react when a Creature lands in a Support zone — abilities
      // / equipment moving don't count.
      if (entering.zone !== 'support') return;
      // Card text triggers off summons; moves (Slippery Skates,
      // Dark Gear, Diplomacy) shuffle existing creatures around and
      // do not count as a fresh summon.
      if (ctx._isMove) return;
      // Same-side trigger — Hountriever fires off OUR summons only.
      if ((entering.owner ?? entering.controller) !== ctx.cardOriginalOwner) return;
      // Self-exclusion: the dying-into-life Hountriever doesn't trigger
      // its own draw, and other Hountrievers don't trigger each other
      // (per card text "except Loyal Hountriever").
      if (entering.name === CARD_NAME) return;
      // Loyal-only.
      if (!isLoyalCreature(entering.name, ctx._engine)) return;

      // Per-instance triple HOPT.
      const fired = ctx.card.counters.hountrieverFiresThisTurn || 0;
      if (fired >= MAX_PER_TURN) return;
      ctx.card.counters.hountrieverFiresThisTurn = fired + 1;

      const engine = ctx._engine;
      const ps     = engine.gs.players[ctx.cardOriginalOwner];

      // Sparkle on Hountriever's slot — same anim Friendship / similar
      // ability-driven draws use.
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle',
        owner: ctx.cardOriginalOwner,
        heroIdx: ctx.cardHeroIdx,
        zoneSlot: ctx.card.zoneSlot,
      });
      await engine._delay(220);

      await engine.actionDrawCards(ctx.cardOriginalOwner, 1);
      engine.log('loyal_hountriever_draw', {
        player: ps?.username, trigger: entering.name,
        firesUsed: fired + 1, max: MAX_PER_TURN,
      });
      engine.sync();
    },

    /** Reset the per-turn fire counter at the start of each of the controller's turns. */
    onTurnStart: async (ctx) => {
      if (ctx.card.counters.hountrieverFiresThisTurn) {
        ctx.card.counters.hountrieverFiresThisTurn = 0;
      }
    },
  },
};
