// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Skates"
//  Artifact (Equipment) — Active equip effect.
//  Once per turn, move a Creature from the
//  equipped Hero's Support Zone to an adjacent
//  ally Hero's free Support Zone.
// ═══════════════════════════════════════════

module.exports = {
  equipEffect: true,

  /**
   * Can activate when equipped hero has 1+ Creatures AND
   * 1+ adjacent ally heroes have 1+ free Support Zones.
   */
  canActivateEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;
    if (!ps) return false;

    // Check for 1+ creatures on this hero
    const hasCreature = _getCreaturesOnHero(ps, heroIdx, engine).length > 0;
    if (!hasCreature) return false;

    // Check for 1+ adjacent heroes with free zones
    return _getAdjacentFreeZones(ps, heroIdx).length > 0;
  },

  async onEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;
    if (!ps) return false;

    // Suppress card reveal until effect is confirmed
    const savedReveal = gs._pendingCardReveal;
    delete gs._pendingCardReveal;

    const creatures = _getCreaturesOnHero(ps, heroIdx, engine);
    if (creatures.length === 0) return false;
    const freeZones = _getAdjacentFreeZones(ps, heroIdx);
    if (freeZones.length === 0) return false;

    // Single combined prompt — client handles two-step click flow
    const result = await engine.promptGeneric(pi, {
      type: 'skatesMove',
      title: 'Slippery Skates',
      ownerIdx: pi,
      heroIdx,
      creatures: creatures.map(c => ({ zoneSlot: c.zoneSlot, name: c.name })),
      destZones: freeZones.map(z => ({ heroIdx: z.heroIdx, slotIdx: z.slotIdx })),
      cancellable: true,
    });

    if (!result || result.cancelled) return false;
    const srcSlot = result.creatureSlot;
    const destHeroIdx = result.destHeroIdx;
    const destSlot = result.destSlot;
    if (srcSlot == null || destHeroIdx == null || destSlot == null) return false;

    // Verify source creature still exists
    const srcCards = (ps.supportZones[heroIdx] || [])[srcSlot] || [];
    if (srcCards.length === 0) return false;
    const inst = engine.cardInstances.find(ci =>
      ci.owner === pi && ci.zone === 'support' && ci.heroIdx === heroIdx && ci.zoneSlot === srcSlot
    );
    if (!inst) return false;

    // Verify destination is still free
    if (((ps.supportZones[destHeroIdx] || [])[destSlot] || []).length > 0) return false;

    // Fire the card reveal now
    if (savedReveal) {
      gs._pendingCardReveal = savedReveal;
      engine._firePendingCardReveal();
    }

    // Suppress damage numbers for the creature leaving its zone
    engine._broadcastEvent('creature_zone_move', { owner: pi, heroIdx, zoneSlot: srcSlot });

    // Remove from source
    const srcSlotArr = (ps.supportZones[heroIdx] || [])[srcSlot] || [];
    const srcIdx = srcSlotArr.indexOf(inst.name);
    if (srcIdx >= 0) srcSlotArr.splice(srcIdx, 1);

    // Animate slide (reuse Slippery Fridge's play_card_transfer)
    engine._broadcastEvent('play_card_transfer', {
      sourceOwner: pi,
      sourceHeroIdx: heroIdx,
      sourceZoneSlot: srcSlot,
      targetOwner: pi,
      targetHeroIdx: destHeroIdx,
      targetZoneSlot: destSlot,
      cardName: inst.name,
      duration: 600,
      particles: null,
    });
    engine.sync();
    await engine._delay(500);

    // Place into destination
    if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
    if (!ps.supportZones[destHeroIdx][destSlot]) ps.supportZones[destHeroIdx][destSlot] = [];
    ps.supportZones[destHeroIdx][destSlot].push(inst.name);

    // Update card instance
    inst.heroIdx = destHeroIdx;
    inst.zoneSlot = destSlot;

    engine.sync();

    // Fire onCardEnterZone for the moved card
    await engine.runHooks('onCardEnterZone', {
      _onlyCard: inst, enteringCard: inst,
      toZone: 'support', toHeroIdx: destHeroIdx,
      _skipReactionCheck: true,
    });

    engine.log('slippery_skates_move', {
      card: inst.name,
      fromHero: ps.heroes[heroIdx]?.name || '?',
      toHero: ps.heroes[destHeroIdx]?.name || '?',
      player: ps.username,
    });

    engine.sync();
    return true;
  },
};

/**
 * Get all Creatures on a hero's support zones.
 */
function _getCreaturesOnHero(ps, heroIdx, engine) {
  const result = [];
  const cardDB = engine._getCardDB();
  for (let zi = 0; zi < (ps.supportZones[heroIdx] || []).length; zi++) {
    const slot = (ps.supportZones[heroIdx] || [])[zi] || [];
    if (slot.length === 0) continue;
    const name = slot[0];
    const cd = cardDB[name];
    if (!cd || cd.cardType !== 'Creature') continue;
    const inst = engine.cardInstances.find(c =>
      c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === zi && c.name === name
    );
    if (!inst || inst.faceDown) continue;
    result.push({ name, zoneSlot: zi, inst });
  }
  return result;
}

/**
 * Get free Support Zones on adjacent heroes.
 * Adjacency: hero 0↔1, hero 1↔2 (hero 0 and 2 are NOT adjacent).
 */
function _getAdjacentFreeZones(ps, heroIdx) {
  const adjacent = [];
  if (heroIdx > 0) adjacent.push(heroIdx - 1);
  if (heroIdx < 2) adjacent.push(heroIdx + 1);

  const result = [];
  for (const hi of adjacent) {
    const hero = ps.heroes?.[hi];
    if (!hero?.name) continue;
    for (let zi = 0; zi < 3; zi++) {
      if (((ps.supportZones[hi] || [])[zi] || []).length === 0) {
        result.push({ heroIdx: hi, slotIdx: zi });
      }
    }
  }
  return result;
}
