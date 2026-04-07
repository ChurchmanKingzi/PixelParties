// ═══════════════════════════════════════════
//  CARD EFFECT: "Cure"
//  Spell (Support Magic Lv1, Reaction)
//  Choose any target with 1+ negative status
//  effects (except the caster). Cleanse ALL
//  negative statuses, then heal HP by 100 ×
//  number of effects removed.
//
//  Does NOT cleanse healReversed (Overheal Shock)
//  since it's not a registered negative status.
//
//  Reaction — can be activated in response to
//  any event. Never requires an Action.
//
//  Animation: green healing sparkle on target.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, getNegativeStatuses } = require('./_hooks');

/**
 * Find all valid targets: heroes/creatures with 1+ negative status.
 */
function getValidTargets(gs, engine, excludeHeroKey) {
  const negKeys = getNegativeStatuses();
  const targets = [];
  for (let pi = 0; pi < 2; pi++) {
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      // Exclude the casting hero if specified
      if (excludeHeroKey && `${pi}-${hi}` === excludeHeroKey) continue;
      if (hero.statuses && negKeys.some(k => hero.statuses[k])) {
        targets.push({
          id: `hero-${pi}-${hi}`,
          type: 'hero',
          owner: pi,
          heroIdx: hi,
          cardName: hero.name,
        });
      }
    }
    // Creatures
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (!ps.heroes[hi]?.name || ps.heroes[hi].hp <= 0) continue;
      for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
        const slot = (ps.supportZones[hi] || [])[si] || [];
        if (slot.length === 0) continue;
        const inst = engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
        );
        if (!inst) continue;
        const cureCD = engine._getCardDB()[inst.name];
        if (!cureCD || cureCD.cardType !== 'Creature') continue; // Only Creatures can be cured
        if (negKeys.some(k => inst.counters[k])) {
          targets.push({
            id: `equip-${pi}-${hi}-${si}`,
            type: 'equip',
            owner: pi,
            heroIdx: hi,
            slotIdx: si,
            cardName: slot[0],
            cardInstance: inst,
          });
        }
      }
    }
  }
  return targets;
}

/**
 * Core cleanse + heal logic used by both proactive and reaction paths.
 */
async function doCure(engine, pi, target) {
  const negKeys = getNegativeStatuses();
  let removed = 0;

  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.statuses) return 0;

    // Play heal sparkle animation
    engine._broadcastEvent('play_zone_animation', {
      type: 'heal_sparkle', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
    });
    await engine._delay(400);

    // Remove all negative statuses
    for (const key of negKeys) {
      if (hero.statuses[key]) {
        delete hero.statuses[key];
        engine.log('status_remove', { target: hero.name, status: key, by: 'Cure' });
        removed++;
      }
    }

    // Heal 100 × removed
    if (removed > 0 && hero.hp > 0) {
      const healAmount = 100 * removed;
      // Find the source card instance for overheal checking
      const sourceInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === 'Cure'
      );
      await engine.actionHealHero(sourceInst || { name: 'Cure', owner: pi, heroIdx: -1 }, hero, healAmount);
    }
  } else if (target.type === 'equip') {
    const inst = target.cardInstance || engine.cardInstances.find(c =>
      c.owner === target.owner && c.zone === 'support' &&
      c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
    );
    if (!inst) return 0;

    // Play heal sparkle animation
    engine._broadcastEvent('play_zone_animation', {
      type: 'heal_sparkle', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
    });
    await engine._delay(400);

    // Remove all negative statuses from creature
    for (const key of negKeys) {
      if (inst.counters[key]) {
        delete inst.counters[key];
        engine.log('status_remove', { target: inst.name, status: key, by: 'Cure' });
        removed++;
      }
    }

    // Heal creature 100 × removed
    if (removed > 0) {
      const healAmount = 100 * removed;
      const sourceInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === 'Cure'
      );
      await engine.actionHealCreature(sourceInst || { name: 'Cure', owner: pi, heroIdx: -1 }, inst, healAmount);
    }
  }

  engine.sync();
  return removed;
}

module.exports = {
  isReaction: true,
  inherentAction: true,
  includesHealing: true,

  reactionCondition: (gs, pi, engine) => {
    return getValidTargets(gs, engine).length > 0;
  },

  spellPlayCondition(gs, pi) {
    // Proactive: need at least 1 valid target (no engine access here, optimistic check)
    const negKeys = getNegativeStatuses();
    for (let phi = 0; phi < 2; phi++) {
      const ps = gs.players[phi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses && negKeys.some(k => hero.statuses[k])) return true;
      }
    }
    return false;
  },

  hooks: {
    /**
     * Proactive play path (spell played from hand).
     */
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const excludeKey = `${pi}-${heroIdx}`;

      const targets = getValidTargets(gs, engine, excludeKey);
      if (targets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const picked = await engine.promptEffectTarget(pi, targets, {
        title: 'Cure',
        description: 'Choose a target to cleanse all negative status effects and heal.',
        confirmLabel: '💚 Cure!',
        confirmClass: 'btn-success',
        cancellable: true,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
      });

      if (!picked || picked.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const target = targets.find(t => t.id === picked[0]);
      if (!target) { gs._spellCancelled = true; return; }

      // Ensure card is revealed to opponent (belt-and-suspenders with _pendingCardReveal)
      if (gs._pendingCardReveal) engine._firePendingCardReveal();

      const removed = await doCure(engine, pi, target);
      engine.log('cure', { player: gs.players[pi]?.username, target: target.cardName, removed });
    },
  },

  /**
   * Reaction path (activated from chain).
   */
  resolve: async (engine, pi, selectedIds, validTargets, chain, chainIdx) => {
    const targets = getValidTargets(engine.gs, engine);
    if (targets.length === 0) {
      engine.log('reaction_fizzle', { card: 'Cure', reason: 'no valid targets' });
      return false;
    }

    const picked = await engine.promptEffectTarget(pi, targets, {
      title: 'Cure',
      description: 'Choose a target to cleanse all negative status effects and heal.',
      confirmLabel: '💚 Cure!',
      confirmClass: 'btn-success',
      cancellable: false,
      greenSelect: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1 },
    });

    if (!picked || picked.length === 0) return false;

    const target = targets.find(t => t.id === picked[0]);
    if (!target) return false;

    const removed = await doCure(engine, pi, target);
    engine.log('cure', { player: engine.gs.players[pi]?.username, target: target.cardName, removed });
    return true;
  },
};
