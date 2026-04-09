// ═══════════════════════════════════════════
//  CARD EFFECT: "Book of Doom"
//  Artifact — Choose up to N opponent targets
//  (where N = floor(your Gold / card cost)).
//  Total cost = card cost × number of targets.
//  All targets take 50 damage simultaneously.
//  Hard once per turn.
// ═══════════════════════════════════════════

const CARD_NAME = 'Book of Doom';
const DAMAGE_PER_TARGET = 50;

module.exports = {
  isTargetingArtifact: true,
  manualGoldCost: true,

  canActivate(gs, pi) {
    // HOPT check
    const hoptKey = `book-of-doom:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    // Gold check is handled by the server (checks cardData.cost before calling canActivate)
    return true;
  },

  getValidTargets(gs, pi, engine) {
    if (!engine) return [];
    const oppIdx = pi === 0 ? 1 : 0;
    // Both sides — the player can target any hero or creature on the board
    const ownHeroes = engine.getHeroTargets(pi);
    const ownCreatures = engine.getCreatureTargets(pi);
    const oppHeroes = engine.getHeroTargets(oppIdx);
    const oppCreatures = engine.getCreatureTargets(oppIdx);
    return [...ownHeroes, ...ownCreatures, ...oppHeroes, ...oppCreatures];
  },

  targetingConfig(gs, pi, cost) {
    const ps = gs.players[pi];
    const maxTargets = cost > 0 ? Math.floor((ps.gold || 0) / cost) : 99;
    return {
      description: `Select up to ${maxTargets} target${maxTargets !== 1 ? 's' : ''} to deal ${DAMAGE_PER_TARGET} damage each.`,
      confirmLabel: '📖 Unleash!',
      confirmClass: 'btn-danger',
      cancellable: true,
      dynamicCostPerTarget: cost,
      exclusiveTypes: false,
      maxPerType: { hero: 99, equip: 99 },
      maxTotal: maxTargets,
    };
  },

  validateSelection(selectedIds) {
    return selectedIds && selectedIds.length > 0;
  },

  animationType: 'none',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return { cancelled: true };

    const baseCost = engine._getCardDB()[CARD_NAME]?.cost || 1;
    const totalCost = baseCost * selectedIds.length;
    const ps = engine.gs.players[pi];

    // Gold check
    if ((ps.gold || 0) < totalCost) return;

    // Claim HOPT
    if (!engine.claimHOPT('book-of-doom', pi)) return;

    // Deduct gold
    ps.gold -= totalCost;
    engine.log('gold_spend', { player: ps.username, amount: totalCost, total: ps.gold });

    // Map selected IDs to targets
    const targets = selectedIds.map(id => validTargets.find(t => t.id === id)).filter(Boolean);
    if (targets.length === 0) return;

    // Fire explosion animations on all targets simultaneously
    for (const target of targets) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'equip' ? target.slotIdx : -1,
      });
    }

    await engine._delay(400);

    // Deal damage — heroes individually, creatures batched
    const creatureBatch = [];
    for (const target of targets) {
      if (target.type === 'hero') {
        const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero && hero.hp > 0) {
          const dummySource = engine._trackCard(CARD_NAME, pi, 'hand', -1, -1);
          await engine.actionDealDamage(dummySource, hero, DAMAGE_PER_TARGET, 'other');
          engine._untrackCard(dummySource.id);
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          creatureBatch.push({
            inst, amount: DAMAGE_PER_TARGET, type: 'other',
            source: { name: CARD_NAME, owner: pi, heroIdx: -1 },
            sourceOwner: pi, canBeNegated: true,
            isStatusDamage: false, animType: null,
          });
        }
      }
    }

    // Process all creature damage as a single batch
    if (creatureBatch.length > 0) {
      await engine.processCreatureDamageBatch(creatureBatch);
    }

    engine.sync();
    await engine._delay(400);
  },
};
