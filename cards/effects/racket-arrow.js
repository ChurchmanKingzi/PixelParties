// ═══════════════════════════════════════════
//  CARD EFFECT: "Racket Arrow"
//  Artifact (Reaction, cost 2)
//
//  Play in reaction to an Attack by a Hero you
//  control. Choose a Creature your opponent
//  controls and return it to its original
//  owner's hand.
//
//  Does NOT arm the attacker with anything —
//  this Arrow is pure "bounce at reaction time."
//  Damage modification is absent; if the Attack
//  was aimed at the bounced creature, the Attack
//  fizzles against a no-longer-present target.
//  (`executeAttack` re-reads the target at
//  damage-time, so a bounced creature simply
//  isn't there when the attack lands.)
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { arrowTriggerCondition, noteArrowActivated } = require('./_arrows-shared');
const { returnSupportCreatureToHand } = require('./_deepsea-shared');

const CARD_NAME = 'Racket Arrow';

/** Eligible bounce targets: opponent-controlled Creatures on the board.
 *  Cardinal-immune creatures are STILL legal targets per the card text —
 *  the fizzle happens inside `returnSupportCreatureToHand` (absolute
 *  `_cardinalImmune` guard). */
function opponentCreatureTargets(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.owner !== oppIdx && inst.controller !== oppIdx) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return out;
}

module.exports = {
  isReaction: true,
  isArrow: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!arrowTriggerCondition(gs, pi, engine, chainCtx)) return false;
    // Also need at least one bounceable opponent Creature — otherwise
    // the reaction has literally nothing to do.
    return opponentCreatureTargets(engine, pi).length > 0;
  },

  resolve: async (engine, pi, _sel, _val, chain, _idx) => {
    // Update Darge's arrow-count stash even though we don't arm anything.
    noteArrowActivated(engine, pi, chain);

    const targets = opponentCreatureTargets(engine, pi);
    if (targets.length === 0) return false;

    const picked = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: "Choose one of your opponent's Creatures to return to its owner's hand.",
      confirmLabel: '🎾 Return to Hand!',
      confirmClass: 'btn-warning',
      cancellable: false, // Discard already paid (artifact consumed on reaction-add).
      exclusiveTypes: true,
      maxPerType: { equip: 1 },
    });
    if (!picked || picked.length === 0) return false;
    const target = targets.find(t => t.id === picked[0]);
    if (!target?.cardInstance) return false;

    await returnSupportCreatureToHand(engine, target.cardInstance, CARD_NAME);
    engine.log('racket_arrow_bounce', {
      player: engine.gs.players[pi]?.username, target: target.cardName,
    });
    engine.sync();
    return true;
  },
};
