// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Long" (Dragon)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.   BANNED.
//
//  EFFECT (once/turn): delete up to 3 cards from
//    the discard piles → Burn that many targets
//    permanently (rest of game). After the effect
//    resolves, no more than 3 targets total may
//    be Burned at once — if the resolve would
//    push the count past 3, only enough are
//    burned to fill to the cap.
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  promptAndDeleteFromBothDiscards,
  rangeValidCounts,
  buildAllBoardTargets,
} = require('./_guardian-beasts-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Guardian Beast Long';
const MAX_DELETE = 3;
const GLOBAL_BURN_CAP = 3;

/** Count currently-Burned heroes + creatures across the whole board. */
function countBurnedTargets(engine) {
  let n = 0;
  for (let p = 0; p < 2; p++) {
    const ps = engine.gs.players[p];
    for (const h of ps?.heroes || []) {
      if (!h?.name || h.hp <= 0) continue;
      if (h.statuses?.burned) n++;
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.counters?.burned) n++;
  }
  return n;
}

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
    if (countBurnedTargets(engine) >= GLOBAL_BURN_CAP) return false;
    return buildAllBoardTargets(engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    const remaining = GLOBAL_BURN_CAP - countBurnedTargets(engine);
    const cap = Math.min(MAX_DELETE, total, remaining, buildAllBoardTargets(engine).length);
    if (cap <= 0) return false;

    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts: rangeValidCounts(cap),
      title: CARD_NAME,
      description: `Pick 1-${cap} cards from the discard piles to delete. Each = one target permanently Burned. (Global cap: ${GLOBAL_BURN_CAP} Burned at once.)`,
      sourceName: CARD_NAME,
      cancellable: true,
    });
    if (!deleted || deleted.length === 0) return false;
    const k = deleted.length;

    // Build target pool excluding ALREADY-Burned targets — burning them
    // again is a wasted pick (they're already burned permanently).
    const allTargets = buildAllBoardTargets(engine).filter(t => {
      if (t.type === 'hero') {
        const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
        return !h?.statuses?.burned;
      }
      return !t.cardInstance?.counters?.burned;
    });
    if (allTargets.length === 0) return true;

    // Player must commit to exactly `requiredHits` targets — or all
    // not-yet-Burned targets on the board if fewer exist than the
    // cost paid. The gating param that promptEffectTarget actually
    // reads is `minRequired`; the earlier `minSelect: 1` silently
    // fell back to 0, letting the player click Burn after picking
    // just one.
    const requiredHits = Math.min(k, allTargets.length);
    const tgtIds = await engine.promptEffectTarget(pi, allTargets, {
      title: CARD_NAME,
      description: requiredHits === allTargets.length
        ? `Pick all ${requiredHits} burnable target${requiredHits === 1 ? '' : 's'} on the board to Burn for the rest of the game.`
        : `Pick exactly ${requiredHits} target${requiredHits === 1 ? '' : 's'} to Burn for the rest of the game.`,
      confirmLabel: '🔥 Burn',
      confirmClass: 'btn-danger',
      cancellable: false,
      maxTotal: requiredHits,
      minRequired: requiredHits,
      exclusiveTypes: false,
    });
    if (!tgtIds || tgtIds.length === 0) return true;

    let appliedCount = 0;
    for (const id of tgtIds) {
      // Re-check cap before each application — multi-target picks
      // could otherwise breach 3 total burned.
      if (countBurnedTargets(engine) >= GLOBAL_BURN_CAP) break;
      const tgt = allTargets.find(t => t.id === id);
      if (!tgt) continue;
      engine._broadcastEvent('play_zone_animation', {
        type: 'flame_strike',
        owner: tgt.owner, heroIdx: tgt.heroIdx,
        zoneSlot: tgt.type === 'hero' ? -1 : tgt.slotIdx,
      });
      if (tgt.type === 'hero') {
        await engine.addHeroStatus(tgt.owner, tgt.heroIdx, 'burned', { permanent: true, appliedBy: pi });
        appliedCount++;
      } else if (tgt.cardInstance) {
        const inst = tgt.cardInstance;
        const applied = await engine.applyCreatureStatus(inst, 'burned', {
          sourceOwner: pi,
          source: CARD_NAME,
        });
        if (applied) {
          inst.counters.burnPermanent = true;
          engine.log('status_add', { target: inst.name, status: 'burned', owner: tgt.owner, by: CARD_NAME });
          appliedCount++;
        }
      }
    }

    engine.log('guardian_beast_long_strike', {
      player: engine.gs.players[pi]?.username, applied: appliedCount, deleted: k,
    });
    engine.sync();
    return true;
  },
};
