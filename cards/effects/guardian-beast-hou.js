// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Hou" (Monkey)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/turn): delete N cards from both
//    discard piles where N ≤ targets on the board,
//    then choose N targets and deal 50 damage to
//    each. The COUNT of cards deleted IS the
//    number of hits — picked directly in the
//    delete gallery.
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  promptAndDeleteFromBothDiscards,
  rangeValidCounts,
  buildAllBoardTargets,
} = require('./_guardian-beasts-shared');

const CARD_NAME = 'Guardian Beast Hou';
const DAMAGE_PER_HIT = 50;

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const targets = buildAllBoardTargets(engine);
    if (targets.length === 0) return false;
    const totalDiscards = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    return totalDiscards >= 1; // at least one card to delete is needed.
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const targets = buildAllBoardTargets(engine);
    if (targets.length === 0) return false;
    const totalDiscards = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    const cap = Math.min(targets.length, totalDiscards);
    if (cap <= 0) return false;

    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts: rangeValidCounts(cap),
      title: CARD_NAME,
      description: `Pick 1-${cap} cards from the discard piles to delete. Each card deleted = one ${DAMAGE_PER_HIT}-damage hit.`,
      sourceName: CARD_NAME,
      cancellable: true,
    });
    if (!deleted || deleted.length === 0) return false;
    const hitsAvailable = deleted.length;

    // Player must pick exactly `hitsAvailable` targets — or all targets
    // on the board if fewer exist than the cost paid. The relevant
    // gating param for `promptEffectTarget` is `minRequired`; the
    // earlier `minSelect` was a typo that silently fell back to 0.
    const refreshedTargets = buildAllBoardTargets(engine);
    if (refreshedTargets.length === 0) return true;
    const requiredHits = Math.min(hitsAvailable, refreshedTargets.length);
    const tgtIds = await engine.promptEffectTarget(pi, refreshedTargets, {
      title: CARD_NAME,
      description: requiredHits === refreshedTargets.length
        ? `Pick all ${requiredHits} target${requiredHits === 1 ? '' : 's'} on the board to take ${DAMAGE_PER_HIT} damage each.`
        : `Pick exactly ${requiredHits} target${requiredHits === 1 ? '' : 's'} to take ${DAMAGE_PER_HIT} damage each.`,
      confirmLabel: '💥 Blow them up!',
      confirmClass: 'btn-danger',
      cancellable: false,
      maxTotal: requiredHits,
      minRequired: requiredHits,
      exclusiveTypes: false,
    });
    if (!tgtIds || tgtIds.length === 0) return true;

    const source = { name: CARD_NAME, owner: pi, heroIdx: ctx.card.heroIdx, cardInstance: ctx.card };

    // Phase 1: fire ALL explosion animations in the same frame. Each
    // _broadcastEvent flushes synchronously, so the client receives
    // every explosion event before the JS yields — they mount and
    // begin animating simultaneously. No per-target delay between
    // broadcasts.
    for (const id of tgtIds) {
      const tgt = refreshedTargets.find(t => t.id === id);
      if (!tgt) continue;
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion',
        owner: tgt.owner,
        heroIdx: tgt.heroIdx,
        zoneSlot: tgt.type === 'hero' ? -1 : tgt.slotIdx,
      });
    }
    // One shared beat to let the explosions play out before HP drops.
    await engine._delay(450);

    // Phase 2: apply the damage to each target. Damage events still
    // fire sequentially (so individual death/onCreatureDeath/onHeroKO
    // hooks resolve in order), but the visuals are already in sync.
    for (const id of tgtIds) {
      const tgt = refreshedTargets.find(t => t.id === id);
      if (!tgt) continue;
      if (tgt.type === 'hero') {
        const hero = engine.gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
        if (hero && hero.hp > 0) await engine.actionDealDamage(source, hero, DAMAGE_PER_HIT, 'creature');
      } else if (tgt.cardInstance) {
        await engine.actionDealCreatureDamage(
          source, tgt.cardInstance, DAMAGE_PER_HIT, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }

    engine.log('guardian_beast_hou_strike', {
      player: engine.gs.players[pi]?.username, hits: tgtIds.length, deleted: deleted.length,
    });
    engine.sync();
    return true;
  },
};
