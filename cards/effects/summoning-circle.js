// ═══════════════════════════════════════════
//  CARD EFFECT: "Summoning Circle"
//  Artifact (Equipment, Cost 10)
//
//  When the equipped Hero summons a Creature,
//  that Creature's current and max HP are
//  doubled (base HP × 2 applied as an additive
//  bonus equal to baseHp, before other bonuses).
//  A Hero can only be equipped with 1 Summoning
//  Circle at a time.
//
//  Implementation note:
//  "Double the base HP" = increase by +baseHp.
//  Using ctx.increaseMaxHp makes this order-
//  independent: (base + baseHp) + Layn(100) =
//  (base + Layn(100)) + baseHp regardless of
//  hook execution order. The bonus is tracked
//  as inst.counters._circleBonus for cleanup.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { checkArthorAscension } = require('./_arthor-shared');

const CARD_NAME = 'Summoning Circle';

module.exports = {
  activeIn: ['support'],

  /** Only 1 Summoning Circle per hero. */
  canEquipToHero(gs, playerIdx, heroIdx) {
    const supportZones = gs.players[playerIdx]?.supportZones?.[heroIdx] || [];
    return !supportZones.some(slot => (slot || []).includes(CARD_NAME));
  },

  hooks: {
    onPlay: (ctx) => {
      checkArthorAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, null);
    },

    onGameStart: (ctx) => {
      checkArthorAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, null);
    },

    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      checkArthorAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, ctx.card.id);
    },

    /**
     * When a Creature enters any Support Zone of the equipped Hero,
     * double its HP (= add baseHp as a bonus once).
     */
    onCardEnterZone: (ctx) => {
      if (ctx.toZone !== 'support') return;
      if (ctx.toHeroIdx !== ctx.cardHeroIdx) return;

      const entering = ctx.enteringCard;
      if (!entering) return;

      // Only affect creatures owned by the same player
      if (entering.owner !== ctx.cardOwner && entering.controller !== ctx.cardOwner) return;

      const engine = ctx._engine;
      const cardDB = engine._getCardDB();
      const cd = engine.getEffectiveCardData(entering) || cardDB[entering.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;

      // Skip if the circle bonus was already applied (e.g. re-entry edge case)
      if (entering.counters._circleBonus) return;

      const baseHp = cd.hp ?? 0;
      if (baseHp <= 0) return;

      // "Double" = add baseHp once more to current+max (order-safe with other additive bonuses)
      ctx.increaseMaxHp(entering, baseHp);
      entering.counters._circleBonus = baseHp;

      engine._broadcastEvent('play_zone_animation', {
        type: 'heart_burst',
        owner: entering.owner,
        heroIdx: entering.heroIdx,
        zoneSlot: entering.zoneSlot,
      });

      engine.log('circle_double', {
        player: engine.gs.players[ctx.cardOwner]?.username,
        creature: entering.name,
        baseHp,
        newHp: entering.counters.maxHp,
      });
    },
  },
};
