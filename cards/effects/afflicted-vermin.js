// ═══════════════════════════════════════════
//  CARD EFFECT: "Afflicted Vermin"
//  Creature (Surprise) — Summoning Magic Lv1
//
//  Activate when either player summons a
//  Creature (requires 1+ other Creatures
//  already on board).
//  Choose a different Creature and defeat it
//  (insta-kill, not damage), then summon
//  this Creature.
//
//  While in Support Zone: once per turn, if
//  the Hero's Surprise Zone is empty, may
//  move itself back face-down into that
//  Surprise Zone (re-set).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isSurprise: true,
  surpriseSummonTrigger: true,

  /**
   * Trigger condition: either player summons a Creature while 1+ OTHER
   * creatures are already on the board.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, summonInfo, engine) => {
    const cardDB = engine._getCardDB();
    let otherCreatureCount = 0;
    for (let pi = 0; pi < 2; pi++) {
      const ps = gs.players[pi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
          const slot = (ps.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) continue;
          const cd = cardDB[slot[0]];
          if (!cd || !hasCardType(cd, 'Creature')) continue;
          // Don't count the just-summoned creature
          const inst = engine.cardInstances.find(c =>
            c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
          );
          if (inst && summonInfo.cardInstance && inst.id === summonInfo.cardInstance.id) continue;
          otherCreatureCount++;
        }
      }
    }
    return otherCreatureCount >= 1;
  },

  /**
   * On activation: prompt owner to pick any Creature on the board
   * EXCEPT the newly summoned one, and insta-kill it.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const cardDB = engine._getCardDB();
    const summonedInstId = sourceInfo.cardInstance?.id;

    // Build targets: all Creatures on board except the newly summoned one
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
          if (!cd || !hasCardType(cd, 'Creature')) continue;
          const inst = engine.cardInstances.find(c =>
            c.owner === pIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
          );
          // Exclude the newly summoned creature
          if (inst && summonedInstId && inst.id === summonedInstId) continue;
          // Exclude immovable creatures
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

    if (targets.length === 0) return null;

    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: 'Afflicted Vermin',
      description: 'Choose a Creature to defeat.',
      confirmLabel: '🍄 Defeat!',
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

    // Mushroom spore animation on the target
    engine._broadcastEvent('play_zone_animation', {
      type: 'mushroom_spore', owner: tOwner,
      heroIdx: tHeroIdx, zoneSlot: tSlot,
    });
    await engine._delay(500);

    // Insta-kill: remove from support zone, discard, fire death hooks
    const deathInfo = {
      name: tCardName, owner: tOwner,
      originalOwner: tInst?.originalOwner ?? tOwner,
      heroIdx: tHeroIdx, zoneSlot: tSlot,
    };

    const supSlot = tPs.supportZones[tHeroIdx]?.[tSlot];
    if (supSlot) {
      const idx = supSlot.indexOf(tCardName);
      if (idx >= 0) supSlot.splice(idx, 1);
    }

    // Suppress damage numbers for this creature move
    engine._broadcastEvent('creature_zone_move', { owner: tOwner, heroIdx: tHeroIdx, zoneSlot: tSlot });

    const discardPs = gs.players[deathInfo.originalOwner];
    if (discardPs) discardPs.discardPile.push(tCardName);
    if (tInst) engine._untrackCard(tInst.id);

    engine.log('creature_destroyed', {
      card: tCardName, by: 'Afflicted Vermin',
      owner: tOwner, heroIdx: tHeroIdx, zoneSlot: tSlot,
    });

    // Fire leave zone and creature death hooks
    if (tInst) {
      await engine.runHooks('onCardLeaveZone', {
        card: tInst, leavingCard: tInst,
        fromZone: 'support', fromHeroIdx: tHeroIdx,
        _skipReactionCheck: true,
      });
    }
    await engine.runHooks('onCreatureDeath', {
      creature: deathInfo, source: { name: 'Afflicted Vermin' },
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
