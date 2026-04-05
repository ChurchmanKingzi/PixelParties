// ═══════════════════════════════════════════
//  CARD EFFECT: "Heavy Hit"
//  Attack (Fighting Lv1, Normal) — Choose a
//  target (not the caster). Deal damage equal
//  to the attacker's ATK stat and Stun for 1 turn.
//  Uses generic executeAttack handler.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = ctx.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Generic attack: prompt target, play animation, deal ATK damage
      const result = await ctx.executeAttack({
        title: 'Heavy Hit',
        description: `Deal ${hero.atk || 0} damage and Stun the target.`,
        confirmLabel: `⚔️ Heavy Hit! (${hero.atk || 0})`,
        animationType: 'magic_hammer',
        animDuration: 500,
        side: 'any',
        types: ['hero', 'creature'],
        excludeSelf: true,
      });

      if (!result) return; // Cancelled

      // Stun the target for 1 turn
      if (result.target.type === 'hero') {
        const targetHero = ctx.players[result.target.owner]?.heroes?.[result.target.heroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.addHeroStatus(result.target.owner, result.target.heroIdx, 'stunned', {
            appliedBy: pi,
            animationType: 'electric_strike',
          });
        }
      } else if (result.target.type === 'equip') {
        // Stun creature (counter-based)
        const inst = result.target.cardInstance || engine.cardInstances.find(c =>
          c.owner === result.target.owner && c.zone === 'support' &&
          c.heroIdx === result.target.heroIdx && c.zoneSlot === result.target.slotIdx
        );
        if (inst && engine.canApplyCreatureStatus(inst, 'stunned')) {
          inst.counters.stunned = 1;
          engine._broadcastEvent('play_zone_animation', {
            type: 'electric_strike', owner: result.target.owner,
            heroIdx: result.target.heroIdx, zoneSlot: result.target.slotIdx,
          });
          engine.log('stun', { target: inst.name, by: 'Heavy Hit', type: 'creature' });
        }
      }

      engine.sync();
    },
  },
};
