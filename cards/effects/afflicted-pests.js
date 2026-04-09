// ═══════════════════════════════════════════
//  CARD EFFECT: "Afflicted Pests"
//  Creature (Surprise) — Summoning Magic Lv1
//
//  Activate when the opponent equips or
//  attaches a card to a Hero.
//  Choose a non-Creature card in any Hero's
//  Support Zone and destroy it, then summon
//  this Creature.
//
//  While in Support Zone: once per turn, if
//  the Hero's Surprise Zone is empty, may
//  move itself back face-down into that
//  Surprise Zone (re-set).
// ═══════════════════════════════════════════

module.exports = {
  isSurprise: true,
  surpriseEquipTrigger: true,

  /**
   * Trigger condition: fires when the OPPONENT equips/attaches.
   * equipInfo: { equipOwner, equipHeroIdx, cardName, cardInstance }
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, equipInfo, engine) => {
    // Only trigger on opponent equips
    if (equipInfo.equipOwner === ownerIdx) return false;
    return true;
  },

  /**
   * On activation: prompt owner to pick a non-Creature card in any
   * Hero's Support Zone and destroy it with dark purple particles.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const cardDB = engine._getCardDB();

    // Build targets: all non-Creature, non-Token cards in ANY support zone (both sides)
    const targets = [];
    for (let pIdx = 0; pIdx < 2; pIdx++) {
      const ps = gs.players[pIdx];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (!ps.heroes[hi]?.name) continue;
        for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
          const slot = (ps.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) continue;
          const cardName = slot[0];
          const cd = cardDB[cardName];
          if (!cd) continue;
          // Exclude immovable cards (Divine Gift, etc.)
          const inst = engine.cardInstances.find(c =>
            c.owner === pIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
          );
          if (inst?.counters?.immovable) continue;
          if (inst?.faceDown) continue; // Face-down surprises are not targetable

          targets.push({
            id: `equip-${pIdx}-${hi}-${si}`,
            type: 'equip',
            owner: pIdx,
            heroIdx: hi,
            slotIdx: si,
            cardName,
            cardInstance: inst,
          });
        }
      }
    }

    if (targets.length === 0) return null; // No valid targets

    // Prompt the Pests owner to choose a target
    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: 'Afflicted Pests',
      description: 'Choose a card in any Support Zone to destroy.',
      confirmLabel: '🐛 Destroy!',
      confirmClass: 'btn-danger',
      cancellable: false,
      allowNonCreatureEquips: true,
      maxTotal: 1,
    });

    if (!selectedIds || selectedIds.length === 0) return null;

    const target = targets.find(t => t.id === selectedIds[0]);
    if (!target) return null;

    const tOwner = target.owner;
    const tHeroIdx = target.heroIdx;
    const tSlot = target.slotIdx;
    const tCardName = target.cardName;
    const tInst = target.cardInstance;
    const tPs = gs.players[tOwner];

    // Dark purple swarm animation on the target
    engine._broadcastEvent('play_zone_animation', {
      type: 'dark_swarm', owner: tOwner,
      heroIdx: tHeroIdx, zoneSlot: tSlot,
    });
    await engine._delay(500);

    // Fire onCardLeaveZone hook
    if (tInst) {
      await engine.runHooks('onCardLeaveZone', {
        _onlyCard: tInst, card: tInst, leavingCard: tInst,
        fromZone: 'support', fromHeroIdx: tHeroIdx,
        _skipReactionCheck: true,
      });
    }

    // Remove from support zone
    const supSlot = tPs.supportZones[tHeroIdx]?.[tSlot];
    if (supSlot) {
      const idx = supSlot.indexOf(tCardName);
      if (idx >= 0) supSlot.splice(idx, 1);
    }

    // Send to discard (original owner's pile)
    const discardPs = gs.players[tInst?.originalOwner ?? tOwner];
    if (discardPs) discardPs.discardPile.push(tCardName);

    // Untrack instance
    if (tInst) engine._untrackCard(tInst.id);

    engine.log('card_destroyed', {
      card: tCardName, by: 'Afflicted Pests',
      player: gs.players[pi]?.username,
    });

    // Fire onDiscard hook
    await engine.runHooks('onDiscard', {
      cardName: tCardName, discardedBy: pi,
      fromZone: 'support', fromHeroIdx: tHeroIdx,
      _skipReactionCheck: true,
    });

    engine.sync();
    await engine._delay(125);

    return null;
  },

  // ── Support Zone creature effect: re-set into Surprise Zone ──
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    return ctx._engine.canSurpriseCreatureReset(ctx);
  },

  async onCreatureEffect(ctx) {
    return ctx._engine.surpriseCreatureReset(ctx);
  },
};
