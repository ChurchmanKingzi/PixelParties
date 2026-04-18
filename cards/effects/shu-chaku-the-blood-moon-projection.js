// ═══════════════════════════════════════════
//  CARD EFFECT: "Shu'Chaku, the Blood Moon Projection"
//  Hero (400 HP, 40 ATK, Adventurousness + Magic Arts)
//
//  Once per turn: return any number of Artifacts
//  from your side of the board to your hand.
//  The next Artifact you play this turn has its
//  Cost reduced by the combined Costs of the
//  returned Artifacts.
//
//  Implementation:
//    • heroEffect opens an artifact-multi-pick
//      from support zones on this player's side.
//    • Each bounced artifact is returned to hand
//      via the standard onCardLeaveZone / pile-
//      transfer path (actionMoveCard → hand).
//    • Combined cost accumulates into
//      ps._nextArtifactCostReduction (consumed
//      by the server's artifact-play path).
//    • Fires onCardsReturnedToHand AFTER all
//      bounces so Teppes and Siphem tally the
//      whole batch in a single event.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { fireReturnBatchHook } = require('./_deepsea-shared');

const CARD_NAME = "Shu'Chaku, the Blood Moon Projection";

function _findOwnArtifactInstances(engine, pi) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    out.push(inst);
  }
  return out;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    return _findOwnArtifactInstances(engine, ctx.cardOwner).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    const cardDB = engine._getCardDB();

    const artifacts = _findOwnArtifactInstances(engine, pi);
    if (artifacts.length === 0) return false;

    // Direct click-to-select on-board — highlight each own artifact's
    // support slot so the player clicks them individually. Targets are
    // keyed by instance-ID in the target id so duplicates pick the
    // exact instance. Confirm button returns once 1+ are chosen.
    const targets = artifacts.map(inst => ({
      id: `equip-${pi}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: pi,
      heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    }));
    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: 'Click your Artifacts on the board to return them to hand. Their combined Cost discounts your next Artifact this turn.',
      confirmLabel: '🌙 Recall!',
      confirmClass: 'btn-success',
      cancellable: true,
      maxTotal: targets.length,
      minRequired: 1,
    });
    if (!selectedIds || selectedIds.length === 0) return false;
    const chosenInsts = selectedIds
      .map(id => targets.find(t => t.id === id)?.cardInstance)
      .filter(Boolean);
    if (chosenInsts.length === 0) return false;

    let totalCost = 0;
    const returnedNames = [];
    for (const inst of chosenInsts) {
      totalCost += (cardDB[inst.name]?.cost || 0);
      returnedNames.push(inst.name);
      // Bounce via actionMoveCard — flag _returnToHand routes it to hand.
      inst._returnToHand = true;
      await engine.actionMoveCard(inst, 'discard');
    }

    // Apply / stack cost reduction.
    ps._nextArtifactCostReduction = (ps._nextArtifactCostReduction || 0) + totalCost;
    ps._nextArtifactCostReductionTurn = gs.turn;

    // Fire the batch hook so Teppes / Siphem tally once for the event.
    await fireReturnBatchHook(engine, pi, returnedNames, chosenInsts, CARD_NAME);

    engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle', owner: pi, heroIdx: ctx.cardHeroIdx, zoneSlot: -1,
    });
    engine.log('shu_chaku_discount', {
      player: ps.username, bounced: returnedNames, discount: totalCost,
    });
    engine.sync();
    return true;
  },
};
