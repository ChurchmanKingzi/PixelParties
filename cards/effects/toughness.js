// ═══════════════════════════════════════════
//  CARD EFFECT: "Toughness"
//  Ability — Grants bonus current + max HP to
//  the attached Hero based on stack level.
//  Lv1: +100, Lv2: +100, Lv3: +200 (total +400).
//  On removal, subtracts the granted HP (min 1).
//  Works for starting abilities (onGameStart).
// ═══════════════════════════════════════════

const HP_PER_LEVEL = [100, 100, 200]; // Index 0 = 1st copy, etc.

/** Apply HP bonus to a hero using the generic max HP system. */
function applyBonus(engine, card, hero, ownerIdx, heroIdx, copyIndex) {
  const bonus = HP_PER_LEVEL[Math.min(copyIndex, HP_PER_LEVEL.length - 1)];

  const effective = engine.increaseMaxHp(hero, bonus, { alsoHealCurrent: true });
  card.counters.hpGranted = effective;

  engine._broadcastEvent('toughness_hp_change', {
    owner: ownerIdx, heroIdx, amount: effective,
  });
  engine.log('toughness_hp_up', { hero: hero.name, amount: effective, copy: copyIndex + 1 });
  engine.sync();
}

module.exports = {
  activeIn: ['ability'],

  hooks: {
    /**
     * When played during the game, grant HP based on zone level.
     */
    onPlay: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero || !hero.name) return;

      const ps = ctx.players[ctx.cardOwner];
      const zone = (ps.abilityZones[ctx.cardHeroIdx] || [])[ctx.card.zoneSlot] || [];
      const copyIndex = zone.length - 1; // 0-based (zone already includes this card)

      applyBonus(ctx._engine, ctx.card, hero, ctx.cardOwner, ctx.cardHeroIdx, copyIndex);
    },

    /**
     * At game start, apply HP bonus for starting abilities.
     * Each instance determines its position by counting already-processed
     * Toughness cards in the same zone.
     */
    onGameStart: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero || !hero.name) return;

      const engine = ctx._engine;
      const sameZone = engine.cardInstances.filter(c =>
        c.owner === ctx.cardOwner && c.zone === 'ability' &&
        c.heroIdx === ctx.cardHeroIdx && c.zoneSlot === ctx.card.zoneSlot &&
        c.name === 'Toughness'
      );
      const processedCount = sameZone.filter(c => c.counters.hpGranted > 0).length;

      applyBonus(engine, ctx.card, hero, ctx.cardOwner, ctx.cardHeroIdx, processedCount);
    },

    /**
     * When removed, subtract the stored HP bonus (hero HP can't drop below 1).
     * Only reacts when an ABILITY zone card leaves — ignores creature/support zone departures.
     */
    onCardLeaveZone: async (ctx) => {
      // Only react when an ability card leaves (not creatures dying in support zones)
      if (ctx.fromZone !== 'ability') return;
      // Self-only: ctx.card is the LISTENING Toughness. Comparing
      // instance ids prevents this hero from losing maxHp every time
      // some OTHER ability left the board.
      if (ctx.leavingCard && ctx.leavingCard.id !== ctx.card?.id) return;
      const hpGranted = ctx.card.counters.hpGranted || 0;
      if (hpGranted <= 0) return;

      const hero = ctx.players[ctx.cardOwner]?.heroes?.[ctx.cardHeroIdx];
      if (!hero || !hero.name) return;

      const effective = ctx._engine.decreaseMaxHp(hero, hpGranted);

      ctx._engine._broadcastEvent('toughness_hp_change', {
        owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx, amount: -effective,
      });

      ctx.log('toughness_hp_down', { hero: hero.name, amount: effective });
      ctx._engine.sync();
    },
  },
};
