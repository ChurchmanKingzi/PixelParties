// ═══════════════════════════════════════════
//  CARD EFFECT: "Slimy Slime"
//  Creature — On summon, choose any target on
//  the board (Hero or Creature) and heal it for
//  80 HP. At the start of owner's turn, gain 1
//  level.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;

      const selected = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'any',
        max: 1,
        title: 'Slimy Slime',
        description: 'Select a target to heal for 80 HP.',
        confirmLabel: 'Heal!',
        confirmClass: 'btn-success',
        cancellable: false,
        condition: (t, eng) => {
          if (t.type === 'hero') {
            const hero = eng.gs.players[t.owner]?.heroes?.[t.heroIdx];
            return !!(hero && hero.hp > 0);
          }
          if (t.type === 'equip' && t.cardInstance) {
            return !t.cardInstance.faceDown;
          }
          return false;
        },
      });

      if (selected.length === 0) return;
      const target = selected[0];

      if (target.type === 'hero') {
        const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (!hero) return;
        engine._broadcastEvent('play_zone_animation', {
          type: 'slimy_heal_goo',
          owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
        });
        await ctx.healHero(hero, 80);
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (!inst) return;
        engine._broadcastEvent('play_zone_animation', {
          type: 'slimy_heal_goo',
          owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
        });
        await ctx.healCreature(inst, 80);
      }
      engine.log('slimy_slime_heal', {
        target: target.cardName, type: target.type, amount: 80,
      });
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
