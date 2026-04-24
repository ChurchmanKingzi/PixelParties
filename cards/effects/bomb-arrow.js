// ═══════════════════════════════════════════
//  CARD EFFECT: "Bomb Arrow"
//  Artifact (Reaction, cost 5)
//
//  Play in reaction to an Attack by a Hero you
//  control. Two effects:
//    (a) Increase that Attack's damage by 10
//        (armed on the attacker — the normal
//        arrow-machinery path).
//    (b) You may choose a Creature your opponent
//        controls and deal 100 damage to it.
//        Resolved at reaction time (before the
//        Attack itself, per LIFO chain order),
//        independent of the Attack's own target.
//        "May" wording — if the opponent has no
//        live Creatures, we skip silently rather
//        than fail the whole card.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { arrowTriggerCondition, armAttackerWithArrow } = require('./_arrows-shared');

const CARD_NAME = 'Bomb Arrow';
const BOMB_DAMAGE = 100;

/** Opponent Creature targets (live, non-face-down, support zone).
 *  Cardinal-immune creatures remain legal targets per the card text —
 *  the 100 damage fizzles at the engine's immunity gate. */
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

  reactionCondition: (gs, pi, engine, chainCtx) =>
    arrowTriggerCondition(gs, pi, engine, chainCtx),

  resolve: async (engine, pi, _sel, _val, chain, _idx) => {
    armAttackerWithArrow(engine, pi, chain, {
      flatDamage: 10,
      sourceCard: CARD_NAME,
    });
    engine.log('arrow_armed', { player: engine.gs.players[pi]?.username, arrow: CARD_NAME });

    // Pick an opponent Creature and deal 100 damage. "You may" — if
    // there's no target OR the player cancels, we silently skip.
    const targets = opponentCreatureTargets(engine, pi);
    if (targets.length === 0) { engine.sync(); return; }

    const picked = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: `Choose one of your opponent's Creatures to deal ${BOMB_DAMAGE} damage to.`,
      confirmLabel: `💣 ${BOMB_DAMAGE} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { equip: 1 },
    });
    if (!picked || picked.length === 0) { engine.sync(); return; }
    const target = targets.find(t => t.id === picked[0]);
    if (!target?.cardInstance) { engine.sync(); return; }

    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
    });
    await engine._delay(280);

    await engine.actionDealCreatureDamage(
      { name: CARD_NAME, owner: pi, heroIdx: -1 },
      target.cardInstance, BOMB_DAMAGE, 'destruction_spell',
      { sourceOwner: pi, canBeNegated: true },
    );
    engine.log('bomb_arrow_creature_hit', {
      player: engine.gs.players[pi]?.username, target: target.cardName, damage: BOMB_DAMAGE,
    });
    engine.sync();
  },
};
