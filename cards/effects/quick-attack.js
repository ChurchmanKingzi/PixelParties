// ═══════════════════════════════════════════
//  CARD EFFECT: "Quick Attack"
//  Attack (Fighting Lv1, Normal)
//
//  Deal damage equal to attacker's base ATK.
//  If this is the first Attack used this turn,
//  it counts as an inherent additional Action
//  (doesn't consume the Action Phase action).
//
//  Animation: fast ram dash + flashy cut impact.
// ═══════════════════════════════════════════

module.exports = {
  // Inherent action only if no attacks played yet this turn
  inherentAction: (gs, playerIdx, heroIdx, engine) => {
    const ps = gs.players[playerIdx];
    return (ps.attacksPlayedThisTurn || 0) === 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const baseAtk = hero.baseAtk || 0;

      // Prompt for target
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: baseAtk,
        title: 'Quick Attack',
        description: `Deal ${baseAtk} base ATK damage.`,
        confirmLabel: `⚡ Strike! (${baseAtk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });

      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      // Fast ram animation
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: pi, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        cardName: hero.name, duration: 600,
      });
      await engine._delay(80);

      // Flash cut impact
      const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'quick_slash', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
      });
      await engine._delay(100);

      // Deal base ATK damage
      const attackSource = { name: 'Quick Attack', owner: pi, heroIdx, controller: pi };

      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.actionDealDamage(attackSource, targetHero, baseAtk, 'attack');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, baseAtk, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      // Wait for ram return
      await engine._delay(300);

      engine.log('quick_attack', {
        player: ps.username, hero: hero.name,
        target: target.cardName, damage: baseAtk,
      });
      engine.sync();
    },
  },
};
