// ═══════════════════════════════════════════
//  CARD EFFECT: "Toxic Trap"
//  Spell (Surprise) — Decay Magic Lv1
//
//  Activate when the host Hero is hit by an
//  Attack, Spell, or Creature effect.
//  Inflict 1 stack of Poison to the attacker.
//  The triggering effect is NOT negated.
//
//  Same trigger condition as Booby Trap,
//  different payoff (Poison instead of damage).
// ═══════════════════════════════════════════

module.exports = {
  isSurprise: true,

  /**
   * Trigger condition: identical to Booby Trap.
   * Fires when the host hero is targeted by any Attack, Spell, or Creature effect.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    if (sourceInfo.owner < 0 || sourceInfo.heroIdx < 0) return false;

    // Creature source — check creature is still alive
    const srcInst = sourceInfo.cardInstance;
    if (srcInst?.zone === 'support') {
      const cd = engine._getCardDB()[srcInst.name];
      const hp = srcInst.counters?.currentHp ?? cd?.hp ?? 1;
      return hp > 0;
    }

    // Hero source (spell/attack) — check hero is alive
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    return attacker && attacker.hp > 0;
  },

  /**
   * On activation: mushroom animation on defender, poison pollen on attacker,
   * then apply 1 stack of Poison to the attacker.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;

    // ── Telekinesis mode: pick any target to poison ──
    if (sourceInfo.telekinesis) {
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        title: 'Toxic Trap',
        description: 'Choose a target to Poison (1 stack).',
        confirmLabel: '☠️ Poison!',
        confirmClass: 'btn-danger',
        cancellable: false,
        noSpellCancel: true,
      });
      if (!target) return null;

      // Poison animation on target
      const tSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'poison_vial', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: tSlot,
      });
      await engine._delay(500);

      if (target.type === 'hero') {
        await engine.addHeroStatus(target.owner, target.heroIdx, 'poisoned', {
          addStacks: 1, appliedBy: pi,
        });
      } else if (target.cardInstance) {
        const inst = target.cardInstance;
        if (engine.canApplyCreatureStatus(inst, 'poisoned')) {
          if (inst.counters.poisoned) {
            inst.counters.poisonStacks = (inst.counters.poisonStacks || 1) + 1;
          } else {
            inst.counters.poisoned = 1;
            inst.counters.poisonStacks = 1;
          }
          inst.counters.poisonAppliedBy = pi;
        }
      }
      engine.log('poison_applied', { target: target.cardName, stacks: 1, by: 'Toxic Trap' });
      engine.sync();
      return null;
    }

    // ── Normal mode: poison the attacker ──
    const srcInst = sourceInfo.cardInstance;
    const isCreatureSource = srcInst?.zone === 'support';
    const defenderHeroIdx = ctx.cardHeroIdx;

    // Mushroom animation on the defender (the hero being protected)
    engine._broadcastEvent('play_zone_animation', {
      type: 'mushroom_spore', owner: pi,
      heroIdx: defenderHeroIdx, zoneSlot: -1,
    });
    await engine._delay(400);

    if (isCreatureSource) {
      // ── Creature source: poison the creature ──
      const creatureHp = srcInst.counters?.currentHp ?? engine._getCardDB()[srcInst.name]?.hp ?? 1;
      if (creatureHp <= 0) return null;

      // Poison pollen animation on the creature
      engine._broadcastEvent('play_zone_animation', {
        type: 'poison_vial', owner: srcInst.owner,
        heroIdx: srcInst.heroIdx, zoneSlot: srcInst.zoneSlot,
      });
      await engine._delay(500);

      if (engine.canApplyCreatureStatus(srcInst, 'poisoned')) {
        if (srcInst.counters.poisoned) {
          srcInst.counters.poisonStacks = (srcInst.counters.poisonStacks || 1) + 1;
        } else {
          srcInst.counters.poisoned = 1;
          srcInst.counters.poisonStacks = 1;
        }
        srcInst.counters.poisonAppliedBy = pi;
        engine.log('poison_applied', {
          target: srcInst.name, stacks: srcInst.counters.poisonStacks,
          by: 'Toxic Trap',
        });
      }
    } else {
      // ── Hero source (spell/attack): poison the attacker hero ──
      const attackerOwner = sourceInfo.owner;
      const attackerHeroIdx = sourceInfo.heroIdx;
      const attacker = gs.players[attackerOwner]?.heroes?.[attackerHeroIdx];
      if (!attacker || attacker.hp <= 0) return null;

      // Poison pollen animation on the attacker
      engine._broadcastEvent('play_zone_animation', {
        type: 'poison_vial', owner: attackerOwner,
        heroIdx: attackerHeroIdx, zoneSlot: -1,
      });
      await engine._delay(500);

      await engine.addHeroStatus(attackerOwner, attackerHeroIdx, 'poisoned', {
        addStacks: 1, appliedBy: pi,
      });

      engine.log('poison_applied', {
        target: attacker.name, stacks: 1, by: 'Toxic Trap',
      });
    }

    engine.sync();

    // Effect is NOT negated — the attack/spell still resolves
    return null;
  },
};
