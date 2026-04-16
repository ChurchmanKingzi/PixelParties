// ═══════════════════════════════════════════
//  CARD EFFECT: "Vampiric Sword"
//  Artifact (Equipment, Cost 50)
//
//  ① Equipped Hero gains +10 ATK.
//  ② Whenever the equipped Hero deals damage to
//    a target with an Attack, heal the Hero for
//    half the amount dealt (rounded up).
//  ③ Maximum 1 Vampiric Sword per Hero
//    (canEquipToHero blocks a second copy).
// ═══════════════════════════════════════════

const ATK_BONUS = 10;
const CARD_NAME = 'Vampiric Sword';

module.exports = {
  activeIn: ['support'],

  /**
   * Block placement if this hero already has a Vampiric Sword equipped.
   * Called by the play_artifact handler before placement.
   */
  canEquipToHero(gs, playerIdx, heroIdx) {
    const supportZones = gs.players[playerIdx]?.supportZones[heroIdx] || [];
    for (const slot of supportZones) {
      if ((slot || []).includes(CARD_NAME)) return false;
    }
    return true;
  },

  hooks: {
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
    },

    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      ctx.grantAtk(ATK_BONUS);
    },

    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner || ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
    },

    /**
     * After the equipped Hero deals attack damage, heal the Hero for half.
     * ctx.type = damage type tag ('attack', 'destruction_spell', …) — lowercase.
     */
    afterDamage: async (ctx) => {
      if (ctx.type !== 'attack') return;
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      const sourceOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (sourceOwner !== ctx.cardOwner) return;
      if ((ctx.amount || 0) <= 0) return;

      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;

      const healAmount = Math.ceil(ctx.amount / 2);
      await ctx.healHero(hero, healAmount);

      ctx._engine.log('vampiric_heal', {
        hero: hero.name, healed: healAmount, from: ctx.amount,
      });
    },
  },
};
