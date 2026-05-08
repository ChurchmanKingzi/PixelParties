// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Ji" (Rooster)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/turn): delete exactly 3 cards
//    from the discard piles → Stun any one
//    target on the board for 1 turn.
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  promptAndDeleteFromBothDiscards,
  buildAllBoardTargets,
} = require('./_guardian-beasts-shared');

const CARD_NAME = 'Guardian Beast Ji';
const DELETE_COST = 3;

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
    if (total < DELETE_COST) return false;
    return buildAllBoardTargets(engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;

    // Pay the deletion cost first — exactly 3 cards, picked directly
    // in the gallery. If they cancel before confirm, no commitment
    // is made.
    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts: [DELETE_COST],
      title: CARD_NAME,
      description: `Pick exactly ${DELETE_COST} cards from the discard piles to delete.`,
      sourceName: CARD_NAME,
      cancellable: true,
    });
    if (!deleted || deleted.length < DELETE_COST) return false;

    // Pick a target. Refresh after deletion in case statuses fired.
    const targets = buildAllBoardTargets(engine);
    if (targets.length === 0) return true; // cost paid; nothing to stun
    const tgtIds = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: 'Stun a target for 1 turn.',
      confirmLabel: '💫 Stun',
      confirmClass: 'btn-info',
      cancellable: false,
      maxTotal: 1,
      minSelect: 1,
      exclusiveTypes: false,
    });
    if (!tgtIds || tgtIds.length === 0) return true;
    const tgt = targets.find(t => t.id === tgtIds[0]);
    if (!tgt) return true;

    engine._broadcastEvent('play_zone_animation', {
      type: 'stun_strike',
      owner: tgt.owner, heroIdx: tgt.heroIdx,
      zoneSlot: tgt.type === 'hero' ? -1 : tgt.slotIdx,
    });
    // Hold long enough for the giant megabolts to crash down and the
    // flash to peak before the stun overlay paints over the target.
    // The cyan halo bolts continue past this point alongside the
    // status badge — sells the "still being shocked" read.
    await engine._delay(450);

    if (tgt.type === 'hero') {
      await engine.addHeroStatus(tgt.owner, tgt.heroIdx, 'stunned', { duration: 1, appliedBy: pi });
    } else if (tgt.cardInstance) {
      const inst = tgt.cardInstance;
      if (engine.canApplyCreatureStatus(inst, 'stunned')) {
        inst.counters.stunned = 1;
        inst.counters.stunnedAppliedBy = pi;
        engine.log('status_add', { target: inst.name, status: 'stunned', owner: tgt.owner });
      }
    }
    engine.log('guardian_beast_ji_stun', {
      player: engine.gs.players[pi]?.username, target: tgt.cardName,
    });
    engine.sync();
    return true;
  },
};
