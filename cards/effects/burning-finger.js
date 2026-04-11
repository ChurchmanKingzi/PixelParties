// ═══════════════════════════════════════════
//  CARD EFFECT: "Burning Finger"
//  Spell (Destruction Magic Lv1) — Deal
//  100/160/240 destruction damage to any
//  single target (Hero or Creature).
//
//  Damage scaling (Destruction Magic + Performance):
//    Lv 1 → 100
//    Lv 2 → 160
//    Lv 3+ → 240
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = ctx.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      const hero = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Count Destruction Magic level on this hero (with Performance)
      const abZones = ps.abilityZones[heroIdx] || [];
      let dmLevel = 0;
      for (const slot of abZones) {
        if (!slot || slot.length === 0) continue;
        const base = slot[0];
        for (const ab of slot) {
          if (ab === 'Destruction Magic') dmLevel++;
          else if (ab === 'Performance' && base === 'Destruction Magic') dmLevel++;
        }
      }

      const damage = dmLevel >= 3 ? 240 : dmLevel >= 2 ? 160 : 100;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: damage,
        title: 'Burning Finger',
        description: `Deal ${damage} destruction damage to a target.`,
        confirmLabel: `🔥 ${damage} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (!target) return;

      // Fiery slash animation
      const tgtOwner = target.owner === pi ? 'me' : 'opp';
      const slot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('burning_finger_slash', {
        owner: target.owner, heroIdx: target.heroIdx, zoneSlot: slot,
      });
      await engine._delay(500);

      // Deal damage
      if (target.type === 'hero') {
        const tgtHero = ctx.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealDamage(tgtHero, damage, 'destruction_spell');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: 'Burning Finger', owner: pi, heroIdx },
          target.cardInstance, damage, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.sync();
    },
  },
};
