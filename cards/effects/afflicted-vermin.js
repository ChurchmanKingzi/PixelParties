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


module.exports = {
  isSurprise: true,
  surpriseSummonTrigger: true,

  /**
   * Trigger condition: either player summons a Creature while 1+ OTHER
   * creatures are already on the board.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, summonInfo, engine) => {
    let otherCreatureCount = 0;
    const summonedId = summonInfo?.cardInstance?.id;
    for (let pi = 0; pi < 2; pi++) {
      for (const t of engine.getCreatureTargets(pi)) {
        if (summonedId && t.cardInstance?.id === summonedId) continue;
        otherCreatureCount++;
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
    const summonedInstId = sourceInfo.cardInstance?.id;

    // Build targets: all Creatures on board except the newly summoned
    // one. `engine.getCreatureTargets` already iterates every Support
    // Zone regardless of host-Hero state (creatures are independent of
    // their Hero) and filters to actual Creatures including Artifact-
    // Creature hybrids. Vermin-specific filters layer on top.
    const targets = [];
    for (let pIdx = 0; pIdx < 2; pIdx++) {
      for (const t of engine.getCreatureTargets(pIdx)) {
        const inst = t.cardInstance;
        if (inst && summonedInstId && inst.id === summonedInstId) continue;
        if (inst?.counters?.immovable) continue;
        if (inst?.faceDown) continue;
        targets.push(t);
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
  // PACMAN reset: moving back face-down has no measurable in-turn
  // impact, so the MCTS rollout always scores it as "do nothing" and
  // refuses to commit. The actual value (re-triggering as a Surprise
  // when the opponent next summons) is on a future turn the rollout
  // doesn't simulate. Force-commit so the CPU actually plays the
  // archetype as designed.
  cpuMeta: { alwaysCommit: true },

  canActivateCreatureEffect(ctx) {
    return ctx._engine.canSurpriseCreatureReset(ctx);
  },

  async onCreatureEffect(ctx) {
    return ctx._engine.surpriseCreatureReset(ctx);
  },
};
