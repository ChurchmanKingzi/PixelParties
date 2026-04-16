// ═══════════════════════════════════════════
//  CARD EFFECT: "Rockfall"
//  Spell (Destruction Magic Lv2, Normal)
//
//  Choose a target and deal 200 damage to it.
//  This damage cannot be reduced or negated.
//
//  True-damage implementation mirrors Ida:
//  • Heroes:   beforeDamage hook sets
//              ctx.cannotBeNegated = true
//              (bypasses Cloudy, Shielded, etc.)
//  • Creatures: canBeNegated: false in the
//               damage batch entry
//              (pierces Gate Shield, Guardian)
//
//  Animation: giant boulder falls from above
//  and crashes on the target (boulder_fall).
// ═══════════════════════════════════════════

const CARD_NAME = 'Rockfall';
const DAMAGE    = 200;

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps      = gs.players[pi];
      const hero    = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to any target. Cannot be reduced or negated.`,
        confirmLabel: `🪨 Rockfall! (${DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;

      const tgtOwner   = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtSlot    = target.type === 'hero' ? -1 : target.slotIdx;

      // Boulder falls and crashes on the target
      engine._broadcastEvent('boulder_fall', {
        owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
      });
      await engine._delay(550); // Let the boulder reach the target before damage numbers

      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          // ctx.dealDamage triggers beforeDamage hooks; Rockfall's own hook
          // (below) intercepts by matching source ID and sets cannotBeNegated.
          await ctx.dealDamage(tgtHero, DAMAGE, 'destruction_spell');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx },
          target.cardInstance, DAMAGE, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: false }, // True damage: pierces all shields
        );
      }

      engine.log('rockfall', { player: ps.username, target: target.cardName, damage: DAMAGE });
      engine.sync();
    },

    /**
     * Mark Rockfall's own hero damage as un-reducible / un-negatable.
     * Fires for every beforeDamage event; guards ensure only Rockfall's
     * own damage (matched by card instance ID and hero slot) is affected.
     */
    beforeDamage: (ctx) => {
      if (ctx.type !== 'destruction_spell') return;

      // Source must be this specific Rockfall instance
      if (ctx.source?.id !== ctx.card.id) return;
      if ((ctx.source?.heroIdx ?? -1) !== ctx.cardHeroIdx) return;
      if ((ctx.source?.owner ?? ctx.source?.controller ?? -1) !== ctx.cardOwner) return;

      ctx.cannotBeNegated = true; // Bypasses Cloudy half-damage, Shielded, etc.
    },
  },
};
