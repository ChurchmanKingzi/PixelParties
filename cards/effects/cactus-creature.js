// ═══════════════════════════════════════════
//  CARD EFFECT: "Cactus Creature"
//  Creature (Surprise) — Summoning Magic Lv0
//
//  Activate when a target the owner controls
//  would be affected by a negative status.
//  Redirect the status to any other target
//  on the board (friend or foe, hero or
//  creature), then summon this Creature.
//
//  While in Support Zone: once per turn, if
//  the Hero's Surprise Zone is empty, may
//  move itself back face-down into that
//  Surprise Zone (re-set).
// ═══════════════════════════════════════════

const { hasCardType, STATUS_EFFECTS, getNegativeStatuses } = require('./_hooks');

module.exports = {
  isSurprise: true,
  surpriseStatusTrigger: true,

  /**
   * Trigger condition: a target the owner controls would receive
   * a negative status effect.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, statusInfo, engine) => {
    // Only trigger for our own targets
    if (statusInfo.targetOwner !== ownerIdx) return false;
    // Only negative statuses
    const def = STATUS_EFFECTS[statusInfo.statusName];
    if (!def?.negative) return false;
    // Check at least 1 valid redirect target exists (own targets, excluding original)
    const sName = statusInfo.statusName;
    const sOpts = statusInfo.opts || {};
    const newStacks = sOpts.addStacks || sOpts.stacks || 1;
    const ps = gs.players[ownerIdx];
    const cardDB = engine._getCardDB();
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (ownerIdx === statusInfo.targetOwner && hi === statusInfo.targetHeroIdx) continue;
      if (hero.statuses?.[sName]) {
        if (sName === 'poisoned') {
          if (newStacks > (hero.statuses.poisoned?.stacks || 1)) return true;
        }
      } else {
        return true;
      }
      // Check creatures on this hero
      for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
        const slot = (ps.supportZones[hi] || [])[si] || [];
        if (slot.length === 0) continue;
        const cd = cardDB[slot[0]];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        const inst = engine.cardInstances.find(c =>
          c.owner === ownerIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
        );
        if (inst?.counters?.[sName]) {
          if (sName === 'poisoned' && newStacks > (inst.counters.poisonStacks || 1)) return true;
        } else {
          return true;
        }
      }
    }
    return false; // No valid redirect targets
  },

  /**
   * On activation: prompt owner to pick any other target on the board.
   * Return { redirect } so the engine applies the status there instead.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const cardDB = engine._getCardDB();

    if (sourceInfo.telekinesis) {
      // ── Telekinesis mode: pick a status-afflicted own target, bounce statuses to another ──
      const negStatuses = getNegativeStatuses();
      const ps = gs.players[pi];

      // Step 1: find all own targets with negative statuses
      const sources = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        const heroStatuses = negStatuses.filter(s => hero.statuses?.[s]);
        if (heroStatuses.length > 0) {
          sources.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: hero.name, statuses: heroStatuses, isHero: true });
        }
        for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
          const slot = (ps.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) continue;
          const cn = slot[0];
          const cd = cardDB[cn];
          if (!cd || !hasCardType(cd, 'Creature')) continue;
          const inst = engine.cardInstances.find(c => c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si);
          if (!inst || inst.faceDown) continue;
          const creatureStatuses = negStatuses.filter(s => inst.counters?.[s]);
          if (creatureStatuses.length > 0) {
            sources.push({ id: `equip-${pi}-${hi}-${si}`, type: 'equip', owner: pi, heroIdx: hi, slotIdx: si, cardName: cn, cardInstance: inst, statuses: creatureStatuses, isHero: false });
          }
        }
      }
      if (sources.length === 0) return null;

      // Step 2: pick source
      const srcIds = await engine.promptEffectTarget(pi, sources, {
        title: 'Cactus Creature', description: 'Choose a target to move statuses FROM:',
        confirmLabel: '🌵 Select Source', cancellable: false, allowNonCreatureEquips: true, maxTotal: 1,
      });
      if (!srcIds || srcIds.length === 0) return null;
      const src = sources.find(t => t.id === srcIds[0]);
      if (!src) return null;

      // Step 3: find eligible redirect targets (can receive at least 1 of the statuses)
      const redirectTargets = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (src.isHero && src.heroIdx === hi) continue; // Exclude source
        const canReceive = src.statuses.some(s => !hero.statuses?.[s] || (s === 'poisoned'));
        if (canReceive) {
          redirectTargets.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: hero.name });
        }
        for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
          const slot = (ps.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) continue;
          const cn = slot[0];
          const cd = cardDB[cn];
          if (!cd || !hasCardType(cd, 'Creature')) continue;
          const inst = engine.cardInstances.find(c => c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si);
          if (!inst || inst.faceDown) continue;
          if (!src.isHero && src.heroIdx === hi && src.slotIdx === si) continue; // Exclude source
          const canReceiveC = src.statuses.some(s => !inst.counters?.[s] || (s === 'poisoned'));
          if (canReceiveC) {
            redirectTargets.push({ id: `equip-${pi}-${hi}-${si}`, type: 'equip', owner: pi, heroIdx: hi, slotIdx: si, cardName: cn, cardInstance: inst });
          }
        }
      }
      if (redirectTargets.length === 0) return null;

      // Step 4: pick redirect target
      const tgtIds = await engine.promptEffectTarget(pi, redirectTargets, {
        title: 'Cactus Creature', description: `Move statuses to which target?`,
        confirmLabel: '🌵 Redirect!', confirmClass: 'btn-success', cancellable: false, allowNonCreatureEquips: true, maxTotal: 1,
      });
      if (!tgtIds || tgtIds.length === 0) return null;
      const tgt = redirectTargets.find(t => t.id === tgtIds[0]);
      if (!tgt) return null;

      // Step 5: animations
      if (src.type === 'hero') engine._broadcastEvent('play_zone_animation', { type: 'cactus_burst', owner: pi, heroIdx: src.heroIdx, zoneSlot: -1 });
      else engine._broadcastEvent('play_zone_animation', { type: 'cactus_burst', owner: pi, heroIdx: src.heroIdx, zoneSlot: src.slotIdx });
      if (tgt.type === 'hero') engine._broadcastEvent('play_zone_animation', { type: 'cactus_burst', owner: pi, heroIdx: tgt.heroIdx, zoneSlot: -1 });
      else engine._broadcastEvent('play_zone_animation', { type: 'cactus_burst', owner: pi, heroIdx: tgt.heroIdx, zoneSlot: tgt.slotIdx });
      await engine._delay(400);

      // Step 6: move statuses
      for (const sName of src.statuses) {
        // Remove from source
        if (src.isHero) {
          const hero = ps.heroes[src.heroIdx];
          if (hero?.statuses?.[sName]) delete hero.statuses[sName];
        } else {
          const inst = src.cardInstance;
          if (inst?.counters?.[sName]) delete inst.counters[sName];
        }
        // Apply to target (if eligible)
        if (tgt.type === 'hero') {
          const hero = ps.heroes[tgt.heroIdx];
          if (hero && (!hero.statuses?.[sName] || sName === 'poisoned')) {
            await engine.addHeroStatus(pi, tgt.heroIdx, sName, { _skipReactionCheck: true });
          }
        } else {
          const inst = tgt.cardInstance;
          if (inst && engine.canApplyCreatureStatus(inst, sName)) {
            inst.counters[sName] = 1;
          }
        }
      }

      engine.log('status_redirected', { status: src.statuses.join(', '), from: src.cardName, to: tgt.cardName, by: 'Cactus Creature (Telekinesis)' });
      engine.sync();
      await engine._delay(125);
      return null;
    }

    // ── Normal trigger mode: redirect incoming status ──
    const origOwner = sourceInfo.targetOwner;
    const origHeroIdx = sourceInfo.targetHeroIdx;
    const statusLabel = STATUS_EFFECTS[sourceInfo.statusName]?.label || sourceInfo.statusName;

    const statusName = sourceInfo.statusName;
    const statusOpts = sourceInfo.opts || {};
    const newPoisonStacks = statusOpts.addStacks || statusOpts.stacks || 1;

    // Build targets: only targets controlled by the Cactus owner, excluding original target
    // Filter out targets that already have the status (except poison with fewer stacks)
    const targets = [];
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      // Exclude original target
      if (pi === origOwner && hi === origHeroIdx) continue;
      // Check if hero can receive this status
      if (hero.statuses?.[statusName]) {
        // Already has this status — only allow poison if new stacks would be higher
        if (statusName === 'poisoned') {
          const currentStacks = hero.statuses.poisoned?.stacks || 1;
          if (newPoisonStacks <= currentStacks) continue;
        } else {
          continue; // Already has this non-stackable status
        }
      }
      targets.push({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi,
        heroIdx: hi,
        cardName: hero.name,
      });
      // Add creatures on this hero
      for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
        const slot = (ps.supportZones[hi] || [])[si] || [];
        if (slot.length === 0) continue;
        const cardName = slot[0];
        const cd = cardDB[cardName];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        const inst = engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
        );
        if (inst?.faceDown) continue; // Face-down surprises are not targetable
        // Check if creature already has this status
        if (inst?.counters?.[statusName]) {
          if (statusName === 'poisoned') {
            const currentStacks = inst.counters.poisonStacks || 1;
            if (newPoisonStacks <= currentStacks) continue;
          } else {
            continue;
          }
        }
        targets.push({
          id: `equip-${pi}-${hi}-${si}`,
          type: 'equip',
          owner: pi,
          heroIdx: hi,
          slotIdx: si,
          cardName,
          cardInstance: inst,
        });
      }
    }

    if (targets.length === 0) return null;

    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: 'Cactus Creature',
      description: `Redirect ${statusLabel} to which target you control?`,
      confirmLabel: '🌵 Redirect!',
      confirmClass: 'btn-success',
      cancellable: false,
      allowNonCreatureEquips: true,
      maxTotal: 1,
    });

    if (!selectedIds || selectedIds.length === 0) return null;

    const target = targets.find(t => t.id === selectedIds[0]);
    if (!target) return null;

    // Cactus animation on original target (hero)
    engine._broadcastEvent('play_zone_animation', {
      type: 'cactus_burst', owner: origOwner,
      heroIdx: origHeroIdx, zoneSlot: -1,
    });
    // Cactus animation on new target
    if (target.type === 'hero') {
      engine._broadcastEvent('play_zone_animation', {
        type: 'cactus_burst', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: -1,
      });
    } else {
      engine._broadcastEvent('play_zone_animation', {
        type: 'cactus_burst', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
      });
    }
    await engine._delay(400);

    engine.log('status_redirected', {
      status: sourceInfo.statusName,
      from: gs.players[origOwner]?.heroes?.[origHeroIdx]?.name,
      to: target.cardName,
      by: 'Cactus Creature',
    });

    engine.sync();
    await engine._delay(125);

    return { redirect: target };
  },

  // ── Support Zone creature effect: re-set into Surprise Zone ──
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    return ctx._engine.canSurpriseCreatureReset(ctx);
  },

  // Telekinesis: check if any own target has a negative status
  canTelekinesisActivate(engine, ownerIdx) {
    const gs = engine.gs;
    const ps = gs.players[ownerIdx];
    if (!ps) return false;
    const negStatuses = getNegativeStatuses();
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (negStatuses.some(s => hero.statuses?.[s])) return true;
      for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
        const slot = (ps.supportZones[hi] || [])[si] || [];
        if (slot.length === 0) continue;
        const inst = engine.cardInstances.find(c =>
          c.owner === ownerIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
        );
        if (inst && !inst.faceDown && negStatuses.some(s => inst.counters?.[s])) return true;
      }
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    return ctx._engine.surpriseCreatureReset(ctx);
  },
};
