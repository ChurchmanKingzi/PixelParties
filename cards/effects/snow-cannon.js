// ═══════════════════════════════════════════
//  CARD EFFECT: "Snow Cannon"
//  Artifact (Normal) — Choose a target Hero
//  or Creature that isn't Immune. Freeze it
//  until the end of its owner's next turn.
//  Goes to discard after resolving.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isTargetingArtifact: true,
  animationType: null, // No destruction animation — just freezes

  canActivate(gs, playerIdx, engine) {
    return this.getValidTargets(gs, playerIdx, engine).length > 0;
  },

  // v327 (Als Report): Der Kartentext sagt "Choose a target Hero OR
  // CREATURE that isn't Immune" — angeboten wurden bisher nur Helden.
  // Gegnerische Kreaturen fehlten komplett. `engine` kommt als dritter
  // Parameter herein (gleiches Muster wie perfect-disguise.js); fehlt er
  // — etwa in einem Aufruf ohne Engine-Referenz — bleibt es beim alten
  // Verhalten mit Helden, statt zu werfen.
  getValidTargets(gs, playerIdx, engine) {
    const targets = [];
    const oppIdx = playerIdx === 0 ? 1 : 0;
    const ps = gs.players[oppIdx];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.immune) continue;
      if (hero.statuses?.frozen) continue;
      targets.push({
        id: `hero-${oppIdx}-${hi}`,
        type: 'hero',
        owner: oppIdx,
        heroIdx: hi,
        cardName: hero.name,
      });
    }

    // Gegnerische Kreaturen in den Support-Zonen. Kreatur-Status liegt
    // auf `inst.counters`, nicht auf `statuses`. Ob der Frost ueberhaupt
    // landen darf, entscheidet die Engine ueber
    // `canApplyCreatureStatus` — damit gelten Immunitaeten und Schilde
    // hier genauso wie beim tatsaechlichen Anwenden, statt sie hier ein
    // zweites Mal (und moeglicherweise abweichend) nachzubauen.
    if (engine) {
      const cardDB = engine._getCardDB ? engine._getCardDB() : {};
      for (const inst of (engine.cardInstances || [])) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== oppIdx) continue;
        if (inst.faceDown) continue;
        if (!hasCardType(cardDB[inst.name], 'Creature')) continue;
        if (inst.counters?.frozen) continue;
        if (typeof engine.canApplyCreatureStatus === 'function'
            && !engine.canApplyCreatureStatus(inst, 'frozen', { name: 'Snow Cannon' })) continue;
        targets.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip',
          owner: inst.owner,
          heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot,
          cardName: inst.name,
          cardInstance: inst,
        });
      }
    }
    return targets;
  },

  targetingConfig: {
    description: 'Select a Hero or Creature to Freeze.',
    confirmLabel: 'Freeze!',
    confirmClass: 'btn-info',
    exclusiveTypes: false,
    maxPerType: { hero: 1, equip: 1 },
    maxTotal: 1,
  },

  validateSelection(selected, validTargets) {
    if (!selected || selected.length !== 1) return false;
    const validIds = new Set(validTargets.map(t => t.id));
    return selected.every(id => validIds.has(id));
  },

  async resolve(engine, playerIdx, selectedIds, validTargets) {
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;
    if (target.type === 'hero') {
      await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', { appliedBy: playerIdx });
    } else {
      // Kreatur — Instanz bevorzugt aus dem Ziel, sonst ueber die Zone
      // nachschlagen (das Ziel kann eine ueber den Client gelaufene
      // Kopie ohne `cardInstance` sein).
      const inst = target.cardInstance
        || (engine.cardInstances || []).find(c => c.zone === 'support'
          && c.owner === target.owner && c.heroIdx === target.heroIdx
          && c.zoneSlot === target.slotIdx);
      if (!inst) return;
      await engine.applyCreatureStatus(inst, 'frozen', {
        source: { name: 'Snow Cannon', owner: playerIdx },
        appliedBy: playerIdx,
      });
    }
    engine.log('freeze', { target: target.cardName, by: 'Snow Cannon' });
  },
};
