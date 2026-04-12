// ═══════════════════════════════════════════
//  CARD EFFECT: "Healing Potion"
//  Potion (Normal) — Choose any target (either
//  player's) with current HP < max HP and heal
//  it for 200 HP.
//
//  Animation: red/green hearts and pluses rising
//  from the healed target.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isPotion: true,
  isTargetingArtifact: true,

  canActivate(gs, pi, engine) {
    // Need at least one target with HP < maxHP on either side
    for (let p = 0; p < 2; p++) {
      const ps = gs.players[p];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (hero?.name && hero.hp > 0 && hero.hp < hero.maxHp) return true;
      }
    }
    // Check creatures too
    if (engine) {
      const cardDB = engine._getCardDB();
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support' || inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        const maxHp = inst.counters?.maxHp ?? cd.hp ?? 0;
        const curHp = inst.counters?.currentHp ?? maxHp;
        if (curHp > 0 && curHp < maxHp) return true;
      }
    }
    return false;
  },

  getValidTargets(gs, pi, engine) {
    const targets = [];
    const cardDB = engine ? engine._getCardDB() : {};

    // Heroes from BOTH sides with HP < maxHP
    for (let p = 0; p < 2; p++) {
      const ps = gs.players[p];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.hp >= hero.maxHp) continue;
        targets.push({
          id: `hero-${p}-${hi}`, type: 'hero', owner: p, heroIdx: hi, cardName: hero.name,
        });
      }
    }

    // Creatures from BOTH sides with HP < maxHP
    if (engine) {
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support' || inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        const maxHp = inst.counters?.maxHp ?? cd.hp ?? 0;
        const curHp = inst.counters?.currentHp ?? maxHp;
        if (curHp <= 0 || curHp >= maxHp) continue;
        targets.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
        });
      }
    }

    return targets;
  },

  targetingConfig: {
    description: 'Choose a target to heal for 200 HP.',
    confirmLabel: '💚 Heal!',
    confirmClass: 'btn-success',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'healing_hearts',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return false;

    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return false;

    const gs = engine.gs;

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero?.name || hero.hp <= 0) return false;

      // Play healing animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'healing_hearts', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
      });
      await engine._delay(400);

      await engine.actionHealHero(
        { name: 'Healing Potion', owner: pi },
        hero, 200
      );
    } else if (target.type === 'equip' && target.cardInstance) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'healing_hearts', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
      });
      await engine._delay(400);

      await engine.actionHealCreature(
        { name: 'Healing Potion', owner: pi },
        target.cardInstance, 200
      );
    }

    engine.log('healing_potion', {
      player: gs.players[pi].username,
      target: target.cardName,
      amount: 200,
    });

    engine.sync();
    return true;
  },
};
