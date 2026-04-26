// ═══════════════════════════════════════════
//  CARD EFFECT: "Fiery Slime"
//  Creature — On summon, choose any target
//  that is not already Burned and Burn it.
//  Burned ignores Immune.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      if (!ctx.hardOncePerTurn('fiery-slime-summon')) return;

      const engine = ctx._engine;

      // Note: Burned ignores Immune — so we do NOT filter out immune heroes
      const selected = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'any',
        max: 1,
        title: 'Fiery Slime',
        description: 'Select a target to Burn.',
        confirmLabel: 'Burn!',
        confirmClass: 'btn-danger',
        cancellable: false,
        condition: (t, eng) => {
          if (t.type === 'hero') {
            const hero = eng.gs.players[t.owner]?.heroes?.[t.heroIdx];
            return hero && !hero.statuses?.burned;
          }
          if (t.type === 'equip' && t.cardInstance) {
            // Already-burned creatures don't qualify (no stacking on
            // creature burns). Cardinal-immune / face-down / shielded
            // targets are deliberately NOT filtered — the player picks,
            // the animation plays, the status fizzles. Visual feedback
            // beats silent target absence.
            return !t.cardInstance.counters?.burned;
          }
          return true;
        },
      });

      if (selected.length === 0) return;
      const target = selected[0];

      if (target.type === 'hero') {
        await engine.addHeroStatus(target.owner, target.heroIdx, 'burned', {
          appliedBy: ctx.cardOwner,
          animationType: 'flame_strike',
        });
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c => c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst) {
          // Animation plays unconditionally — the player needs to see
          // their effect "land" on the target even when the status
          // itself fizzles against an immune creature.
          engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx });
          if (engine.canApplyCreatureStatus(inst, 'burned')) {
            inst.counters.burned = 1;
            inst.counters.burnAppliedBy = ctx.cardOwner;
          }
        }
      }
      engine.log('burn', { target: target.cardName, by: 'Fiery Slime', type: target.type });
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
