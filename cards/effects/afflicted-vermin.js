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

    // Mushroom spore animation on the target. Plays BEFORE the destroy
    // so the visual lands while the Creature is still rendered.
    engine._broadcastEvent('play_zone_animation', {
      type: 'mushroom_spore', owner: tOwner,
      heroIdx: tHeroIdx, zoneSlot: tSlot,
    });
    await engine._delay(500);

    // Insta-kill via the canonical engine path. `actionDestroyCard`
    // owns:
    //   • the Gate check (Defending the Gate, replacing the manual
    //     trigger that used to live here);
    //   • the zone-anchored `play_pile_transfer` flight that anchors
    //     to THIS slot (so duplicate-named Creatures fly from the
    //     right one);
    //   • the canonical death sequence: ON_CARD_LEAVE_ZONE → splice
    //     support slot → ON_CREATURE_DEATH (with the dying inst still
    //     tracked, zone='support', and `instId` stamped on the death
    //     payload) → flip zone → push to discard. This ordering is
    //     load-bearing — on-death listeners like Exploding Skull
    //     gate strictly on `death.instId === ctx.card.id` and would
    //     silently miss a death routed any other way.
    if (tInst) {
      await engine.actionDestroyCard(
        { name: 'Afflicted Vermin', owner: pi, heroIdx: ctx.cardHeroIdx },
        tInst,
        { fireCreatureDeath: true },
      );
    }

    engine.log('creature_destroyed', {
      card: tCardName, by: 'Afflicted Vermin',
      owner: tOwner, heroIdx: tHeroIdx, zoneSlot: tSlot,
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
