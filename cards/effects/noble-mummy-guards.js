// ═══════════════════════════════════════════
//  CARD EFFECT: "Noble Mummy Guards"
//  Creature (Surprise) — Summoning Magic Lv0
//
//  Activate when the opponent attaches an
//  Ability to a Hero that already has 1+
//  other Abilities.
//  Choose a different Ability on that Hero
//  and bounce the top card back to the
//  owner's hand.
//
//  While in Support Zone: once per turn, if
//  the Hero's Surprise Zone is empty, may
//  move itself back face-down into that
//  Surprise Zone (re-set).
// ═══════════════════════════════════════════

module.exports = {
  isSurprise: true,
  surpriseAbilityTrigger: true,

  canTelekinesisActivate(engine, ownerIdx) {
    const oppIdx = ownerIdx === 0 ? 1 : 0;
    const oppPs = engine.gs.players[oppIdx];
    if (!oppPs) return false;
    for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
      const hero = oppPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const abZones = oppPs.abilityZones[hi] || [];
      if (abZones.some(z => (z || []).length > 0)) return true;
    }
    return false;
  },

  /**
   * Trigger condition: opponent attaches an Ability to a Hero
   * that already has 1+ OTHER Abilities attached.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, abilityInfo, engine) => {
    // Only trigger on opponent ability attachments
    if (abilityInfo.attachOwner === ownerIdx) return false;
    // Check that the hero has at least 1 other ability besides the new one
    const attachPs = gs.players[abilityInfo.attachOwner];
    const abZones = attachPs?.abilityZones?.[abilityInfo.attachHeroIdx] || [];
    let otherAbilityCount = 0;
    for (let z = 0; z < abZones.length; z++) {
      const slot = abZones[z] || [];
      if (slot.length === 0) continue;
      // Check if this slot contains the newly attached ability
      const inst = abilityInfo.cardInstance;
      if (inst && inst.zoneSlot === z && slot.includes(abilityInfo.cardName)) {
        // This slot contains the new ability — only count as "other" if there are other slots too
        // If the new ability was STACKED onto an existing ability, the slot had abilities before
        if (slot.length > 1) otherAbilityCount++; // Pre-existing stack
        continue;
      }
      otherAbilityCount++;
    }
    return otherAbilityCount >= 1;
  },

  /**
   * On activation: pick a different Ability on the same Hero and
   * bounce its top card back to the owner's hand.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oppIdx = pi === 0 ? 1 : 0;

    let attachOwner, attachHeroIdx, attachedInst;

    if (sourceInfo.telekinesis) {
      // Telekinesis mode: let player pick any opponent hero with abilities
      const oppPs = gs.players[oppIdx];
      const heroTargets = [];
      for (let hi = 0; hi < (oppPs?.heroes || []).length; hi++) {
        const hero = oppPs.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        const abZones = oppPs.abilityZones[hi] || [];
        const hasAbilities = abZones.some(z => (z || []).length > 0);
        if (!hasAbilities) continue;
        heroTargets.push({ id: `hero-${oppIdx}-${hi}`, type: 'hero', owner: oppIdx, heroIdx: hi, cardName: hero.name });
      }
      if (heroTargets.length === 0) return null;

      let selectedHeroIdx;
      if (heroTargets.length === 1) {
        selectedHeroIdx = heroTargets[0].heroIdx;
      } else {
        const selectedIds = await engine.promptEffectTarget(pi, heroTargets, {
          title: 'Noble Mummy Guards',
          description: 'Choose an opponent Hero to bounce an Ability from:',
          confirmLabel: '💨 Target',
          maxTotal: 1,
          cancellable: false,
        });
        if (!selectedIds || selectedIds.length === 0) return null;
        const target = heroTargets.find(t => t.id === selectedIds[0]);
        if (!target) return null;
        selectedHeroIdx = target.heroIdx;
      }
      attachOwner = oppIdx;
      attachHeroIdx = selectedHeroIdx;
      attachedInst = null;
    } else {
      attachOwner = sourceInfo.attachOwner;
      attachHeroIdx = sourceInfo.attachHeroIdx;
      attachedInst = sourceInfo.cardInstance;
    }

    const attachPs = gs.players[attachOwner];
    const attachedCardName = sourceInfo.cardName;

    // Build options: ability slots on the target hero, excluding the newly attached one
    const abZones = attachPs?.abilityZones?.[attachHeroIdx] || [];
    const options = [];
    for (let z = 0; z < abZones.length; z++) {
      const slot = abZones[z] || [];
      if (slot.length === 0) continue;
      // Skip the slot that contains the newly attached ability (if it's the only card there)
      if (attachedInst && attachedInst.zoneSlot === z && slot.length === 1) continue;
      // If the new ability was stacked, the top card IS the new one — pick a different slot
      if (attachedInst && attachedInst.zoneSlot === z) continue;
      const topCard = slot[slot.length - 1];
      options.push({
        id: `ability-${z}`,
        label: `${topCard} (Lv${slot.length})`,
        description: `Return ${topCard} to its owner's hand.`,
        zoneIdx: z,
        topCardName: topCard,
        color: '#cc8844',
      });
    }

    if (options.length === 0) return null;

    let selectedZoneIdx;
    if (options.length === 1) {
      // Auto-select if only one option
      selectedZoneIdx = options[0].zoneIdx;
    } else {
      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: 'Noble Mummy Guards',
        description: 'Choose an Ability to return to hand:',
        options,
        cancellable: false,
      });

      if (!choice || choice.cancelled) return null;
      const selected = options.find(o => o.id === choice.optionId);
      if (!selected) return null;
      selectedZoneIdx = selected.zoneIdx;
    }

    const slot = abZones[selectedZoneIdx];
    if (!slot || slot.length === 0) return null;
    const bouncedCardName = slot[slot.length - 1];

    // Find the card instance for the top ability
    const bouncedInst = engine.cardInstances.find(c =>
      c.owner === attachOwner && c.zone === 'ability' &&
      c.heroIdx === attachHeroIdx && c.zoneSlot === selectedZoneIdx &&
      c.name === bouncedCardName
    );

    // Fan animation on the ability zone
    engine._broadcastEvent('play_zone_animation', {
      type: 'fan_blow', owner: attachOwner,
      heroIdx: attachHeroIdx, zoneSlot: selectedZoneIdx,
      zoneType: 'ability',
    });
    await engine._delay(500);

    // Remove top card from ability slot
    slot.pop();

    // Fire onCardLeaveZone hook
    if (bouncedInst) {
      await engine.runHooks('onCardLeaveZone', {
        _onlyCard: bouncedInst, card: bouncedInst, leavingCard: bouncedInst,
        fromZone: 'ability', fromHeroIdx: attachHeroIdx,
        _skipReactionCheck: true,
      });
      engine._untrackCard(bouncedInst.id);
    }

    // Return to original owner's hand
    const originalOwner = bouncedInst?.originalOwner ?? attachOwner;
    const returnPs = gs.players[originalOwner];
    if (returnPs) {
      returnPs.hand.push(bouncedCardName);
    }

    const heroName = attachPs.heroes?.[attachHeroIdx]?.name || 'Hero';
    engine.log('ability_bounced', {
      card: bouncedCardName, hero: heroName,
      by: 'Noble Mummy Guards', player: gs.players[pi]?.username,
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
