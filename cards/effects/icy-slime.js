// ═══════════════════════════════════════════
//  CARD EFFECT: "Icy Slime"
//  Creature — On summon, choose any target
//  that is not Frozen or Immune and Freeze it.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      if (!ctx.hardOncePerTurn('icy-slime-summon')) return;

      const engine = ctx._engine;

      const selected = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'any',
        max: 1,
        title: 'Icy Slime',
        description: 'Select a target to Freeze.',
        confirmLabel: 'Freeze!',
        confirmClass: 'btn-info',
        cancellable: false,
        condition: (t, eng) => {
          if (t.type === 'hero') {
            const hero = eng.gs.players[t.owner]?.heroes?.[t.heroIdx];
            return hero && !hero.statuses?.frozen && !hero.statuses?.immune;
          }
          if (t.type === 'equip' && t.cardInstance) {
            return !t.cardInstance.counters?.frozen;
          }
          return true;
        },
      });

      if (selected.length === 0) return;
      const target = selected[0];

      if (target.type === 'hero') {
        await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', { appliedBy: ctx.cardOwner, animationType: 'ice_encase' });
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c => c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst) {
          // Animation plays unconditionally so the player sees the
          // freeze land even when the status fizzles on an immune target.
          engine._broadcastEvent('play_zone_animation', { type: 'ice_encase', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx });
          if (engine.canApplyCreatureStatus(inst, 'frozen')) {
            inst.counters.frozen = 1;
          }
        }
      }
      engine.log('freeze', { target: target.cardName, by: 'Icy Slime', type: target.type });
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
