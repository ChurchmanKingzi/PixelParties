// ═══════════════════════════════════════════
//  CARD EFFECT: "Ushabti of the Great Pharaoh"
//  Artifact — Move a Creature to its Hero's
//  Surprise Zone face-down. Owner may summon
//  it as an additional action on future turns.
// ═══════════════════════════════════════════

const { hasCardType, ZONES } = require('./_hooks');

module.exports = {
  canActivate(gs, playerIdx, engine) {
    return _getEligibleCreatures(gs, engine || null).length > 0;
  },

  async resolve(engine, playerIdx, selectedTargets, targetIds) {
    const gs = engine.gs;
    const pi = playerIdx;

    const targets = _getEligibleCreatures(gs, engine);
    if (targets.length === 0) return false;

    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: 'Ushabti of the Great Pharaoh',
      description: "Choose a Creature to place face-down into its Hero's Surprise Zone.",
      confirmLabel: '🏺 Entomb',
      cancellable: true,
      maxTotal: 1,
    });

    if (!selectedIds || selectedIds.length === 0) return false;

    const target = targets.find(t => t.id === selectedIds[0]);
    if (!target) return false;

    const inst = target.cardInstance;
    const cardName = target.cardName;
    const heroOwner = target.owner;
    const heroIdx = target.heroIdx;
    const slotIdx = target.slotIdx;
    const ps = gs.players[heroOwner];

    if ((ps.surpriseZones?.[heroIdx] || []).length > 0) return false;

    engine._broadcastEvent('play_zone_animation', {
      type: 'sand_reset', owner: heroOwner, heroIdx, zoneSlot: slotIdx,
    });
    engine._broadcastEvent('creature_zone_move', { owner: heroOwner, heroIdx, zoneSlot: slotIdx });
    await engine._delay(500);

    const supSlot = ps.supportZones?.[heroIdx]?.[slotIdx];
    if (supSlot) {
      const idx = supSlot.indexOf(cardName);
      if (idx >= 0) supSlot.splice(idx, 1);
    }

    await engine.runHooks('onCardLeaveZone', {
      card: inst, leavingCard: inst,
      fromZone: 'support', fromHeroIdx: heroIdx,
      _skipReactionCheck: true,
    });

    if (!ps.surpriseZones[heroIdx]) ps.surpriseZones[heroIdx] = [];
    ps.surpriseZones[heroIdx] = [cardName];

    inst.zone = ZONES.SURPRISE;
    inst.heroIdx = heroIdx;
    inst.zoneSlot = 0;
    inst.faceDown = true;
    inst.knownToOpponent = true;
    inst.ushabtiPlaced = true;
    inst.ushabtiTurn = gs.turn || 0;

    engine.log('ushabti_entomb', { card: cardName, player: ps.username, hero: ps.heroes?.[heroIdx]?.name });

    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'surprise', toHeroIdx: heroIdx,
      _skipReactionCheck: true,
    });

    engine.sync();
    await engine._delay(200);
    return true;
  },
};

function _getEligibleCreatures(gs, engine) {
  const targets = [];
  let cardDB;
  try {
    cardDB = engine ? engine._getCardDB() : (() => {
      const allCards = JSON.parse(
        require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8')
      );
      const db = {};
      allCards.forEach(c => { db[c.name] = c; });
      return db;
    })();
  } catch { return []; }

  for (let pi = 0; pi < 2; pi++) {
    const ps = gs.players[pi];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if ((ps.surpriseZones?.[hi] || []).length > 0) continue;

      for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
        const slot = (ps.supportZones[hi] || [])[si] || [];
        if (slot.length === 0) continue;
        const cardName = slot[0];
        const cd = cardDB[cardName];
        if (!cd || !hasCardType(cd, 'Creature')) continue;

        if (engine) {
          const inst = engine.cardInstances.find(c =>
            (c.owner === pi || c.controller === pi) && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si && c.name === cardName
          );
          if (inst?.faceDown) continue;
          targets.push({
            id: `equip-${pi}-${hi}-${si}`,
            type: 'equip',
            owner: pi,
            heroIdx: hi,
            slotIdx: si,
            cardName,
            cardInstance: inst,
          });
        } else {
          targets.push({ id: `equip-${pi}-${hi}-${si}` });
        }
      }
    }
  }

  return targets;
}
