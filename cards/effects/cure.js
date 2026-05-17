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

const { STATUS_EFFECTS, getCleansableStatuses } = require('./_hooks');

/**
 * Find all valid targets: heroes/creatures with 1+ negative status.
 *
 * Heroes / Creatures are enumerated via the engine's standard helpers
 * (`getHeroTargets` filters by alive, `getCreatureTargets` enumerates
 * every Support Zone regardless of host-Hero state — creatures are
 * independent of their Hero — and already filters down to actual
 * Creatures including Artifact-Creature hybrids). Cure-specific
 * filters layer on top.
 */
function getValidTargets(gs, engine, excludeHeroKey) {
  const negKeys = getCleansableStatuses();
  const targets = [];
  for (let pi = 0; pi < 2; pi++) {
    for (const t of engine.getHeroTargets(pi)) {
      if (excludeHeroKey && `${t.owner}-${t.heroIdx}` === excludeHeroKey) continue;
      const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!hero?.statuses) continue;
      if (negKeys.some(k => hero.statuses[k])) targets.push(t);
    }
    for (const t of engine.getCreatureTargets(pi)) {
      const inst = t.cardInstance;
      if (!inst) continue;
      // Instance-aware: also includes per-instance-cleansable
      // negation (Unwanted Audience) on top of the global set.
      if (engine.getCleansableCreatureStatusKeys(inst).length > 0) targets.push(t);
    }
  }
  return targets;
}

/**
 * Core cleanse + heal logic used by both proactive and reaction paths.
 */
async function doCure(engine, pi, target, casterHeroIdx) {
  const negKeys = getCleansableStatuses();
  let removed = 0;

  // Build the heal source. When a `casterHeroIdx` is provided
  // (reaction-chain path threading the picked-hero idx down from the
  // engine's reaction window, OR the proactive path passing
  // `ctx.cardHeroIdx`), the source carries that heroIdx so passive
  // checks like Nao's overheal — which gate on
  // `source.heroIdx >= 0` and look up `gs.heroFlags['<owner>-<heroIdx>']`
  // — can fire correctly. Falls back to a tracked Cure inst (rare —
  // the spell is being resolved, the inst usually only exists for
  // the brief window before the discard at the chain's end).
  const heroIdxForSource = (casterHeroIdx != null && casterHeroIdx >= 0) ? casterHeroIdx : -1;
  const sourceInst = engine.cardInstances.find(c =>
    c.owner === pi && c.name === 'Cure'
  );
  const healSource = sourceInst || { name: 'Cure', owner: pi, heroIdx: heroIdxForSource };

  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.statuses) return 0;

    // Play heal sparkle animation
    engine._broadcastEvent('play_zone_animation', {
      type: 'heal_sparkle', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
    });
    await engine._delay(400);

    // Remove all negative statuses (centralized — skips unhealable)
    const removedKeys = engine.cleanseHeroStatuses(hero, target.owner, target.heroIdx, negKeys, 'Cure');
    removed = removedKeys.length;

    // Heal 100 × removed
    if (removed > 0 && hero.hp > 0) {
      const healAmount = 100 * removed;
      await engine.actionHealHero(healSource, hero, healAmount);
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

    // Remove all negative statuses from creature (centralized — skips
    // unhealable). Instance-aware key set so a per-instance-cleansable
    // negation (Unwanted Audience) is included alongside the globals.
    const removedCreatureKeys = engine.cleanseCreatureStatuses(
      inst, engine.getCleansableCreatureStatusKeys(inst), 'Cure');
    removed += removedCreatureKeys.length;

    // Heal creature 100 × removed
    if (removed > 0) {
      const healAmount = 100 * removed;
      await engine.actionHealCreature(healSource, inst, healAmount);
    }
  }

  engine.sync();
  return removed;
}

module.exports = {
  isReaction: true,
  proactivePlay: true,
  inherentAction: true,
  includesHealing: true,

  reactionCondition: (gs, pi, engine) => {
    if (getValidTargets(gs, engine).length === 0) return false;
    // At least 1 hero must be able to cast this (Support Magic Lv1)
    if (engine) {
      const ps = gs.players[pi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (engine._canHeroActivateSurprise(pi, hi, 'Cure')) return true;
      }
      return false;
    }
    return true;
  },

  spellPlayCondition(gs, pi) {
    // Proactive: need at least 1 valid target (no engine access here, optimistic check)
    const negKeys = getCleansableStatuses();
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

      const removed = await doCure(engine, pi, target, heroIdx);
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

    // The reaction-window picked a casting Hero (engine threads it
    // onto the chain link's `casterHeroIdx`). Pass it down so
    // `actionHealHero` can credit the Hero's passives — Nao's
    // overheal in particular gates on
    // `source.heroIdx >= 0 && gs.heroFlags['<owner>-<heroIdx>'].overhealPassive`.
    const casterHeroIdx = chain?.[chainIdx]?.casterHeroIdx;
    const removed = await doCure(engine, pi, target, casterHeroIdx);
    engine.log('cure', { player: engine.gs.players[pi]?.username, target: target.cardName, removed });
    return true;
  },
};
