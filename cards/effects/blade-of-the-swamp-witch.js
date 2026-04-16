// ═══════════════════════════════════════════
//  CARD EFFECT: "Blade of the Swamp Witch"
//  Artifact (Equipment, Cost 5)
//
//  ① Equipped Hero gains +10 ATK.
//  ② Any target hit by an Attack of the equipped
//    Hero gains 1 Poison Stack (permanent).
//    Already-Poisoned targets also just receive
//    +1 stack (the stack system handles the
//    resulting +30 damage per stack naturally).
//
//  Hero targets  → engine.addHeroStatus (afterDamage)
//  Creature targets → engine.actionApplyCreaturePoison
//                     (afterCreatureDamageBatch)
// ═══════════════════════════════════════════

const ATK_BONUS = 10;
const CARD_NAME = 'Blade of the Swamp Witch';

module.exports = {
  activeIn: ['support'],

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
     * After attack damage is dealt to a hero target, apply 1 Poison stack.
     * ctx.type = damage type tag ('attack') — lowercase.
     */
    afterDamage: async (ctx) => {
      if (ctx.type !== 'attack') return;
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      const sourceOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (sourceOwner !== ctx.cardOwner) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const target = ctx.target;
      if (!target) return;

      // Only hero objects have statuses
      if (target.hp === undefined || !target.statuses) return;

      // Find the target hero's player/heroIdx
      for (let tpi = 0; tpi < 2; tpi++) {
        const tps = gs.players[tpi];
        for (let thi = 0; thi < (tps.heroes || []).length; thi++) {
          if (tps.heroes[thi] !== target) continue;
          if (target.hp <= 0) return;
          await engine.addHeroStatus(tpi, thi, 'poisoned', {
            addStacks: 1,
            appliedBy: pi,
          });
          engine.log('swamp_witch_poison', {
            attacker: ctx.attachedHero?.name, target: target.name,
          });
          return;
        }
      }
    },

    /**
     * After a batch of creature damage, apply 1 Poison stack to each creature
     * hit by this hero's attacks.
     */
    afterCreatureDamageBatch: async (ctx) => {
      if (!ctx.entries) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      for (const e of ctx.entries) {
        if (e.type !== 'attack') continue;
        if ((e.source?.heroIdx ?? -1) !== heroIdx) continue;
        if ((e.source?.owner ?? -1) !== pi) continue;
        if (!e.inst || e.inst.zone !== 'support') continue;

        await engine.actionApplyCreaturePoison(
          { name: CARD_NAME, owner: pi, heroIdx },
          e.inst,
        );
      }

      engine.sync();
    },
  },
};
