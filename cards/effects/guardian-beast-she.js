// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast She" (Snake)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/turn): delete up to 3 cards from
//    the discard piles → choose that many targets
//    on the board. Targets that are NOT already
//    Poisoned receive Poison (permanent — for the
//    rest of the game). Targets that ARE already
//    Poisoned have their Poison damage increased
//    by 30 instead (= one extra stack, since
//    POISON_BASE_DAMAGE = 30 per stack).
//
//  The "+30 damage" rider is implemented as +1
//  stack: a stack adds POISON_BASE_DAMAGE per
//  tick, which equals 30 by engine constant. So
//  the per-target outcome (already-poisoned →
//  +30 per tick) lands exactly. Card text reads
//  cleaner this way and stays consistent with how
//  poison stacking works elsewhere in the game.
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  promptAndDeleteFromBothDiscards,
  rangeValidCounts,
  buildAllBoardTargets,
} = require('./_guardian-beasts-shared');

const CARD_NAME = 'Guardian Beast She';
const MAX_DELETE = 3;

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < 1) return false;
    return buildAllBoardTargets(engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    const cap = Math.min(MAX_DELETE, total, buildAllBoardTargets(engine).length);
    if (cap <= 0) return false;

    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts: rangeValidCounts(cap),
      title: CARD_NAME,
      description: `Pick 1-${cap} cards from the discard piles to delete. Each = one target Poisoned (or +30 to existing Poison damage).`,
      sourceName: CARD_NAME,
      cancellable: true,
    });
    if (!deleted || deleted.length === 0) return false;
    const k = deleted.length;

    const targets = buildAllBoardTargets(engine);
    if (targets.length === 0) return true;
    // Player must commit to exactly `requiredHits` targets — or all
    // targets on the board if fewer exist than the cost paid. The
    // gating param that promptEffectTarget actually reads is
    // `minRequired`; the earlier `minSelect: 1` silently fell back
    // to 0, letting the player click Poison after picking just one.
    const requiredHits = Math.min(k, targets.length);
    const tgtIds = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: requiredHits === targets.length
        ? `Pick all ${requiredHits} target${requiredHits === 1 ? '' : 's'} on the board to Poison. Already-Poisoned targets gain +30 Poison damage instead.`
        : `Pick exactly ${requiredHits} target${requiredHits === 1 ? '' : 's'} to Poison. Already-Poisoned targets gain +30 Poison damage instead.`,
      confirmLabel: '☠️ Poison',
      confirmClass: 'btn-info',
      cancellable: false,
      maxTotal: requiredHits,
      minRequired: requiredHits,
      exclusiveTypes: false,
    });
    if (!tgtIds || tgtIds.length === 0) return true;

    // Phase 1: fire ALL snake-bite animations in the same frame.
    // Each _broadcastEvent flushes synchronously, so the client
    // receives every bite event before the JS yields — fangs descend
    // on every target simultaneously. No per-target delay between
    // broadcasts. Mirrors Hou's simultaneous-explosion pattern.
    for (const id of tgtIds) {
      const tgt = targets.find(t => t.id === id);
      if (!tgt) continue;
      engine._broadcastEvent('play_zone_animation', {
        type: 'snake_bite',
        owner: tgt.owner, heroIdx: tgt.heroIdx,
        zoneSlot: tgt.type === 'hero' ? -1 : tgt.slotIdx,
      });
    }
    // One shared beat to let the fangs land + venom flash hit before
    // the Poison status overlay paints over the targets.
    await engine._delay(450);

    // Phase 2: apply Poison to each target sequentially so individual
    // status hooks resolve in order, but the visuals are already in
    // sync from Phase 1.
    for (const id of tgtIds) {
      const tgt = targets.find(t => t.id === id);
      if (!tgt) continue;
      if (tgt.type === 'hero') {
        const hero = engine.gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
        if (!hero || hero.hp <= 0) continue;
        const wasPoisoned = !!hero.statuses?.poisoned;
        if (wasPoisoned) {
          // Target already poisoned → bump stack count by 1 (= +30 dmg
          // per tick). Don't go through addHeroStatus's surprise-check
          // path again; just write the stack directly so we don't
          // accidentally re-apply Surprise redirects.
          const cur = hero.statuses.poisoned;
          cur.stacks = (cur.stacks || 1) + 1;
          cur.permanent = true;
          engine.log('status_add', { target: hero.name, status: 'poisoned', addStacks: 1, by: CARD_NAME });
        } else {
          await engine.addHeroStatus(tgt.owner, tgt.heroIdx, 'poisoned', {
            permanent: true, addStacks: 1, appliedBy: pi, by: CARD_NAME,
          });
        }
      } else if (tgt.cardInstance) {
        const inst = tgt.cardInstance;
        const wasPoisoned = !!inst.counters?.poisoned;
        if (wasPoisoned) {
          inst.counters.poisonStacks = (inst.counters.poisonStacks || 1) + 1;
          inst.counters.poisonPermanent = true;
          engine.log('status_add', { target: inst.name, status: 'poisoned', addStacks: 1, by: CARD_NAME });
        } else if (engine.canApplyCreatureStatus(inst, 'poisoned')) {
          inst.counters.poisoned = 1;
          inst.counters.poisonStacks = 1;
          inst.counters.poisonAppliedBy = pi;
          inst.counters.poisonPermanent = true;
          engine.log('status_add', { target: inst.name, status: 'poisoned', owner: tgt.owner, by: CARD_NAME });
        }
      }
    }
    engine.log('guardian_beast_she_strike', {
      player: engine.gs.players[pi]?.username, hits: tgtIds.length, deleted: k,
    });
    engine.sync();
    return true;
  },
};
