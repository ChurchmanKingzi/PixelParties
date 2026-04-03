// ═══════════════════════════════════════════
//  CARD EFFECT: "Fighting"
//  Ability — Grants bonus ATK to the attached
//  Hero based on stack level.
//  Lv1: +10, Lv2: +10, Lv3: +20 (total +40).
//  On removal, subtracts the granted ATK.
//  Works for starting abilities (onGameStart).
// ═══════════════════════════════════════════

const ATK_PER_LEVEL = [10, 10, 20]; // Index 0 = 1st copy, etc.

/** Apply ATK bonus to a hero and store it on the card instance. */
function applyBonus(engine, card, hero, ownerIdx, heroIdx, copyIndex) {
  const bonus = ATK_PER_LEVEL[Math.min(copyIndex, ATK_PER_LEVEL.length - 1)];

  hero.atk = (hero.atk || 0) + bonus;
  card.counters.atkGranted = bonus;

  engine._broadcastEvent('fighting_atk_change', {
    owner: ownerIdx, heroIdx, amount: bonus,
  });
  engine.log('fighting_atk_up', { hero: hero.name, amount: bonus, copy: copyIndex + 1 });
  engine.sync();
}

module.exports = {
  activeIn: ['ability'],

  hooks: {
    /**
     * When played during the game, grant ATK based on zone level.
     */
    onPlay: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero || !hero.name) return;

      const ps = ctx.players[ctx.cardOwner];
      const zone = (ps.abilityZones[ctx.cardHeroIdx] || [])[ctx.card.zoneSlot] || [];
      const copyIndex = zone.length - 1;

      applyBonus(ctx._engine, ctx.card, hero, ctx.cardOwner, ctx.cardHeroIdx, copyIndex);
    },

    /**
     * At game start, apply ATK bonus for starting abilities.
     */
    onGameStart: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero || !hero.name) return;

      const engine = ctx._engine;
      const sameZone = engine.cardInstances.filter(c =>
        c.owner === ctx.cardOwner && c.zone === 'ability' &&
        c.heroIdx === ctx.cardHeroIdx && c.zoneSlot === ctx.card.zoneSlot &&
        c.name === 'Fighting'
      );
      const processedCount = sameZone.filter(c => c.counters.atkGranted > 0).length;

      applyBonus(engine, ctx.card, hero, ctx.cardOwner, ctx.cardHeroIdx, processedCount);
    },

    /**
     * When removed, subtract the stored ATK bonus.
     * Only reacts when an ABILITY zone card leaves — ignores creature/support zone departures.
     */
    onCardLeaveZone: async (ctx) => {
      // Only react when an ability card leaves (not creatures dying in support zones)
      if (ctx.fromZone !== 'ability') return;
      const engine = ctx._engine;
      const atkGranted = ctx.card.counters.atkGranted || 0;
      if (atkGranted <= 0) return;

      const hero = ctx.players[ctx.cardOwner]?.heroes?.[ctx.cardHeroIdx];
      if (!hero || !hero.name) return;

      hero.atk = Math.max(0, (hero.atk || 0) - atkGranted);

      engine._broadcastEvent('fighting_atk_change', {
        owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx, amount: -atkGranted,
      });

      ctx.log('fighting_atk_down', { hero: hero.name, amount: atkGranted });
      engine.sync();
    },
  },
};
