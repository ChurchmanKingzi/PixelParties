// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Hammer"
//  Spell (Destruction Magic Lv3)
//  Choose a target and deal 300 damage to it.
//  Uses the magic_hammer zone animation.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Select any target (enemy or ally heroes + creatures)
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: 300,
        title: 'Magic Hammer',
        description: 'Choose a target to deal 300 damage.',
        confirmLabel: '🔨 Smash! (300)',
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (!target) return; // Cancelled → _spellCancelled handled by server

      // Play hammer animation
      if (target.type === 'hero') {
        engine._broadcastEvent('play_zone_animation', {
          type: 'magic_hammer', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: -1,
        });
        await engine._delay(900);
        const hero = gs.players[target.owner].heroes[target.heroIdx];
        if (hero && hero.hp > 0) {
          await ctx.dealDamage(hero, 300, 'destruction_spell');
        }
      } else if (target.type === 'equip') {
        engine._broadcastEvent('play_zone_animation', {
          type: 'magic_hammer', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
        });
        await engine._delay(900);
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            { name: 'Magic Hammer', owner: pi, heroIdx },
            inst, 300, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      engine.log('magic_hammer', { player: gs.players[pi].username, target: target.cardName, damage: 300 });
      engine.sync();
    },
  },
};
