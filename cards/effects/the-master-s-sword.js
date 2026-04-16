// ═══════════════════════════════════════════
//  CARD EFFECT: "The Master's Sword"
//  Artifact (Equipment, Cost 8) — BANNED
//
//  ① Equipped Hero gains +10 ATK.
//  ② While the Hero's HP equals its maximum HP,
//    any Attack that hits exactly 1 target deals
//    additional damage equal to the Hero's ATK
//    stat (added to the same damage instance via
//    beforeDamage, not a separate hit).
//
//  Single-target detection: gs._spellDamageLog
//  has exactly 1 entry by the time beforeDamage
//  fires, because targets are pushed to the log
//  when selected (before damage is dealt).
// ═══════════════════════════════════════════

const ATK_BONUS = 10;

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
     * When the equipped Hero deals attack damage, check:
     *   - damage type is 'attack'
     *   - source is this hero
     *   - hero is at full HP
     *   - exactly 1 target was selected for this attack
     * If all pass, add hero.atk to this damage instance.
     *
     * ctx.type        = damage type tag (lowercase: 'attack', 'destruction_spell', …)
     * spellCardData.cardType = card category from cards.json ('Attack', 'Spell', …) —
     *   only available in afterSpellResolved, not here.
     */
    beforeDamage: (ctx) => {
      if (ctx.type !== 'attack') return;
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      const sourceOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (sourceOwner !== ctx.cardOwner) return;

      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;

      // Bonus requires full HP
      if (hero.hp < (hero.maxHp || hero.hp)) return;

      // Bonus requires exactly 1 selected target
      // _spellDamageLog is populated when targets are selected, before damage fires
      const gs = ctx._engine.gs;
      if ((gs._spellDamageLog?.length ?? 0) !== 1) return;

      ctx.modifyAmount(hero.atk || 0);
    },
  },
};
