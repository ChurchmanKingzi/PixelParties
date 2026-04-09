// ═══════════════════════════════════════════
//  CARD EFFECT: "Silent Water Mizune"
//  Hero — Surprise synergy
//
//  Soft once per turn: Send a Surprise you
//  control to the discard pile to draw 1 card.
//  +1 card if the hero had the right abilities.
//  +1 card if the surprise was face-up.
// ═══════════════════════════════════════════

const { hasCardType, ZONES } = require('./_hooks');

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  /**
   * Can activate if the player controls 1+ Surprise cards
   * (face-down in surprise/support zones, or face-up surprise creatures).
   */
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    return _getSurpriseTargets(engine, pi).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;

    const targets = _getSurpriseTargets(engine, pi);
    if (targets.length === 0) return false;

    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: 'Silent Water Mizune',
      description: 'Choose a Surprise to destroy and draw cards.',
      confirmLabel: '🌊 Flush!',
      confirmClass: 'btn-danger',
      cancellable: true,
      allowNonCreatureEquips: true,
      maxTotal: 1,
    });

    if (!selectedIds || selectedIds.length === 0) return false;

    const target = targets.find(t => t.id === selectedIds[0]);
    if (!target) return false;

    const cardName = target.cardName;
    const wasFaceUp = target.wasFaceUp;
    const heroIdx = target.heroIdx;
    const heroOwner = target.heroOwnerIdx;
    const inst = target.cardInstance;
    const cardData = engine._getCardDB()[cardName];
    const isSurpriseCreature = cardData && hasCardType(cardData, 'Creature');

    // Whirlpool animation
    if (target.zoneType === 'surprise') {
      engine._broadcastEvent('play_zone_animation', {
        type: 'whirlpool', owner: heroOwner,
        heroIdx, zoneSlot: -1, zoneType: 'surprise',
      });
    } else {
      engine._broadcastEvent('play_zone_animation', {
        type: 'whirlpool', owner: heroOwner,
        heroIdx, zoneSlot: target.zoneSlot,
      });
    }
    await engine._delay(700);

    // Remove from zone
    const ps = gs.players[heroOwner];
    if (target.zoneType === 'surprise') {
      const sz = ps.surpriseZones?.[heroIdx] || [];
      const idx = sz.indexOf(cardName);
      if (idx >= 0) sz.splice(idx, 1);
    } else {
      // Support zone
      const supSlot = ps.supportZones?.[heroIdx]?.[target.zoneSlot];
      if (supSlot) {
        const idx = supSlot.indexOf(cardName);
        if (idx >= 0) supSlot.splice(idx, 1);
      }
      // Suppress damage numbers
      engine._broadcastEvent('creature_zone_move', { owner: heroOwner, heroIdx, zoneSlot: target.zoneSlot });
    }

    // Fire hooks for face-up Surprise Creatures (counts as creature death)
    if (wasFaceUp && isSurpriseCreature && inst) {
      const deathInfo = {
        name: cardName, owner: heroOwner,
        originalOwner: inst.originalOwner ?? heroOwner,
        heroIdx, zoneSlot: target.zoneSlot ?? 0,
      };
      await engine.runHooks('onCardLeaveZone', {
        card: inst, leavingCard: inst,
        fromZone: target.zoneType, fromHeroIdx: heroIdx,
        _skipReactionCheck: true,
      });
      await engine.runHooks('onCreatureDeath', {
        creature: deathInfo, source: { name: 'Silent Water Mizune' },
        _skipReactionCheck: true,
      });
    } else if (inst) {
      await engine.runHooks('onCardLeaveZone', {
        card: inst, leavingCard: inst,
        fromZone: target.zoneType, fromHeroIdx: heroIdx,
        _skipReactionCheck: true,
      });
    }

    // Send to discard
    const discardPs = gs.players[inst?.originalOwner ?? heroOwner];
    if (discardPs) discardPs.discardPile.push(cardName);
    if (inst) engine._untrackCard(inst.id);

    engine.log('surprise_destroyed', {
      card: cardName, by: 'Silent Water Mizune',
      player: gs.players[pi]?.username,
    });

    engine.sync();
    await engine._delay(200);

    // Draw 1 card (always)
    let drawCount = 1;

    // Bonus: was the surprise on a hero with the right abilities to activate it?
    const hero = ps.heroes?.[heroIdx];
    if (hero && cardData) {
      const level = cardData.level || 0;
      if (level === 0 && !cardData.spellSchool1) {
        // No requirement — always qualifies
        drawCount++;
      } else if (level > 0 || cardData.spellSchool1) {
        const abZones = hero.statuses?.negated ? [] : (ps.abilityZones?.[heroIdx] || []);
        let qualifies = true;
        if (cardData.spellSchool1 && engine.countAbilitiesForSchool(cardData.spellSchool1, abZones) < level) qualifies = false;
        if (cardData.spellSchool2 && engine.countAbilitiesForSchool(cardData.spellSchool2, abZones) < level) qualifies = false;
        if (qualifies) drawCount++;
      }
    }

    // Bonus: was the surprise face-up?
    if (wasFaceUp) drawCount++;

    // Draw cards
    for (let i = 0; i < drawCount; i++) {
      await engine.actionDrawCards(pi, 1);
      engine.sync();
      if (i < drawCount - 1) await engine._delay(200);
    }

    engine.sync();
    return true;
  },
};

/**
 * Build target list of all Surprise cards on the player's side.
 * Includes: surprise zones, face-up surprise creatures, face-down Bakhm surprises.
 */
function _getSurpriseTargets(engine, playerIdx) {
  const gs = engine.gs;
  const ps = gs.players[playerIdx];
  if (!ps) return [];
  const targets = [];
  const cardDB = engine._getCardDB();

  // Regular surprise zones
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const sz = ps.surpriseZones?.[hi] || [];
    if (sz.length === 0) continue;
    const cardName = sz[0];
    const inst = engine.cardInstances.find(c =>
      c.owner === playerIdx && c.zone === ZONES.SURPRISE && c.heroIdx === hi && c.name === cardName
    );
    targets.push({
      id: `surprise-${playerIdx}-${hi}`,
      type: 'surprise',
      owner: playerIdx,
      heroIdx: hi,
      cardName,
      cardInstance: inst,
      wasFaceUp: inst ? !inst.faceDown : false,
      zoneType: 'surprise',
      zoneSlot: -1,
      heroOwnerIdx: playerIdx,
    });
  }

  // Support zone cards with Surprise subtype (face-up creatures or face-down Bakhm surprises)
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
      const slot = (ps.supportZones[hi] || [])[si] || [];
      if (slot.length === 0) continue;
      const cardName = slot[0];
      const cd = cardDB[cardName];
      if (!cd || (cd.subtype || '').toLowerCase() !== 'surprise') continue;
      const inst = engine.cardInstances.find(c =>
        c.owner === playerIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si && c.name === cardName
      );
      targets.push({
        id: `equip-${playerIdx}-${hi}-${si}`,
        type: 'equip',
        owner: playerIdx,
        heroIdx: hi,
        slotIdx: si,
        cardName,
        cardInstance: inst,
        wasFaceUp: inst ? !inst.faceDown : true,
        zoneType: 'support',
        zoneSlot: si,
        heroOwnerIdx: playerIdx,
      });
    }
  }

  return targets;
}
