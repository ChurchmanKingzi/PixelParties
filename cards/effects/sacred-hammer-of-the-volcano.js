// ═══════════════════════════════════════════
//  CARD EFFECT: "Sacred Hammer of the Volcano"
//  Artifact (Equipment, 4 Gold)
//  Grants +30 ATK to the equipped Hero.
//  When the Hero hits a Burned target with an
//  Attack, additionally increase that Attack's
//  damage by the Hero's base ATK.
//  Uses generic grantAtk/revokeAtk system.
// ═══════════════════════════════════════════

const ATK_BONUS = 30;

module.exports = {
  activeIn: ['support'],

  hooks: {
    /**
     * On equip: grant +30 ATK to the hero.
     */
    onPlay: async (ctx) => {
      ctx.grantAtk(ATK_BONUS);
    },

    /**
     * On game start: apply ATK bonus for pre-equipped hammers (Bill, etc.).
     */
    onGameStart: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero || !hero.name) return;
      // Only apply if not already granted (avoids double-grant if onPlay also fired)
      if (ctx.card.counters.atkGranted > 0) return;
      ctx.grantAtk(ATK_BONUS);
    },

    /**
     * On removal: revoke the granted ATK.
     */
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      ctx.revokeAtk();
    },

    /**
     * Before damage: if this hero is attacking a Burned target,
     * add the hero's base ATK to the damage.
     */
    beforeDamage: (ctx) => {
      // Only applies to attack-type damage
      if (ctx.type !== 'attack') return;

      // Source must be this hero
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      const sourceOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (sourceOwner !== ctx.cardOwner) return;

      // Target must be burned
      const target = ctx.target;
      if (!target) return;
      const isBurned = target.statuses?.burned || target.counters?.burned;
      if (!isBurned) return;

      // Add hero's base ATK to the damage
      const hero = ctx.attachedHero;
      if (!hero) return;
      const baseAtk = hero.baseAtk || 0;
      if (baseAtk <= 0) return;

      ctx.modifyAmount(baseAtk);
      ctx._engine.log('sacred_hammer_bonus', {
        hero: hero.name, baseAtk, target: target.name || 'target',
      });
    },
  },
};
