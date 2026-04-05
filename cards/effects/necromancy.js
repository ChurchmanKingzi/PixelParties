// ═══════════════════════════════════════════
//  CARD EFFECT: "Necromancy"
//  Ability — Action-costing activation (HOPT).
//  Choose a Creature from your discard pile
//  with level ≤ Necromancy level that this Hero
//  can summon (spell school check), and place it
//  into a free Support Zone of this Hero.
//  The Creature's effects are negated until the
//  start of your next turn.
//  Animation: purple dark magic with skulls.
// ═══════════════════════════════════════════

// ─── HELPERS ─────────────────────────────

/**
 * Count a hero's ability level for a given spell school.
 * Mirrors the standard server-side summoning eligibility check.
 * Performance copies count toward the base ability's school.
 */
function countAbilityLevel(ps, heroIdx, school) {
  let count = 0;
  for (const slot of (ps.abilityZones[heroIdx] || [])) {
    if (!slot || slot.length === 0) continue;
    const base = slot[0];
    for (const ab of slot) {
      if (ab === school) count++;
      else if (ab === 'Performance' && base === school) count++;
    }
  }
  return count;
}

/**
 * Check if a hero can summon a creature based on spell school requirements.
 */
function heroCanSummon(ps, heroIdx, creatureData) {
  const level = creatureData.level || 0;
  if (creatureData.spellSchool1 && countAbilityLevel(ps, heroIdx, creatureData.spellSchool1) < level) return false;
  if (creatureData.spellSchool2 && countAbilityLevel(ps, heroIdx, creatureData.spellSchool2) < level) return false;
  return true;
}

/**
 * Get free base support zones (slots 0–2) for a specific hero.
 */
function getFreeZones(ps, heroIdx) {
  const hero = ps.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return [];
  const zones = [];
  const supZones = ps.supportZones[heroIdx] || [];
  for (let s = 0; s < 3; s++) {
    if ((supZones[s] || []).length === 0) {
      zones.push({ heroIdx, slotIdx: s, label: `${hero.name} — Support ${s + 1}` });
    }
  }
  return zones;
}

/**
 * Get eligible creatures from discard pile for necromancy.
 * Must be a Creature with level ≤ necromancyLevel that
 * the hero can summon (spell school check).
 */
function getEligibleCreatures(engine, pi, heroIdx, necromancyLevel) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const result = [];
  for (const cardName of (ps.discardPile || [])) {
    if (seen.has(cardName)) continue;
    const cd = cardDB[cardName];
    if (!cd || cd.cardType !== 'Creature') continue;
    if ((cd.level || 0) > necromancyLevel) continue;
    if (!heroCanSummon(ps, heroIdx, cd)) continue;
    seen.add(cardName);
    result.push({ name: cardName, source: 'discard' });
  }
  return result;
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,
  noDefaultFlash: true, // Skip the generic gold sparkle — Necromancy plays its own animation

  /**
   * Pre-check: can this hero activate Necromancy right now?
   * Requires eligible creatures in discard AND a free support zone.
   */
  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = ctx.players[pi];
    if (!ps) return false;
    if (getFreeZones(ps, heroIdx).length === 0) return false;
    return getEligibleCreatures(engine, pi, heroIdx, level).length > 0;
  },

  /**
   * Execute: gallery picker → zone picker → summon + negate.
   * Returns false if cancelled (don't claim HOPT).
   */
  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];

    // Build eligible creature list
    const eligible = getEligibleCreatures(engine, pi, heroIdx, level);
    if (eligible.length === 0) return false;

    // Check free zones
    const freeZones = getFreeZones(ps, heroIdx);
    if (freeZones.length === 0) return false;

    // Step 1: Gallery picker — choose a creature from discard
    const selected = await ctx.promptCardGallery(eligible, {
      title: 'Necromancy',
      description: `Choose a Lv ${level} or lower Creature from your discard pile to summon.`,
      cancellable: true,
    });
    if (!selected) return false; // Cancelled — don't claim HOPT

    const creatureName = selected.cardName;

    // Step 2: Zone picker — choose a free support zone (auto-pick if only one)
    let chosenZone;
    const currentFreeZones = getFreeZones(ps, heroIdx);
    if (currentFreeZones.length === 0) return false;
    if (currentFreeZones.length === 1) {
      chosenZone = currentFreeZones[0];
    } else {
      const picked = await ctx.promptZonePick(currentFreeZones, {
        title: 'Necromancy',
        description: `Place ${creatureName} into a Support Zone.`,
        cancellable: true,
      });
      if (!picked) return false; // Cancelled — don't claim HOPT
      chosenZone = currentFreeZones.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx) || currentFreeZones[0];
    }

    // ── Effect resolves here ──

    // Play dark magic skull animation on the Necromancy ability zone
    const necroSlotIdx = ctx.card.zoneSlot;
    engine._broadcastEvent('play_zone_animation', {
      type: 'necromancy_summon', owner: pi,
      heroIdx, zoneSlot: -1,
    });
    // Also play on the target support zone
    engine._broadcastEvent('play_zone_animation', {
      type: 'necromancy_summon', owner: pi,
      heroIdx: chosenZone.heroIdx, zoneSlot: chosenZone.slotIdx,
    });
    await engine._delay(800);

    // Remove creature from discard pile
    const discardIdx = ps.discardPile.indexOf(creatureName);
    if (discardIdx < 0) return false; // Safety — card no longer in discard
    ps.discardPile.splice(discardIdx, 1);

    // Place into support zone
    const hi = chosenZone.heroIdx;
    const si = chosenZone.slotIdx;
    if (!ps.supportZones[hi]) ps.supportZones[hi] = [[], [], []];
    ps.supportZones[hi][si] = [creatureName];

    // Track card instance
    const inst = engine._trackCard(creatureName, pi, 'support', hi, si);

    // Apply negation until start of controller's next turn
    // Current turn = gs.turn (pi's turn), next pi turn = gs.turn + 2
    engine.actionNegateCreature(inst, 'Necromancy', {
      expiresAtTurn: gs.turn + 2,
      expiresForPlayer: pi,
    });

    engine.log('necromancy', {
      player: ps.username, creature: creatureName, level,
      heroIdx: hi, zoneSlot: si,
    });

    // Emit summon effect glow
    engine._broadcastEvent('summon_effect', { owner: pi, heroIdx: hi, zoneSlot: si, cardName: creatureName });

    // Fire on-summon hooks (but effects are negated, so most won't trigger)
    await engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName: creatureName, zone: 'support', heroIdx: hi, zoneSlot: si });
    await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: hi });

    // Necromancy summon counts as an additional action
    await engine.runHooks('onActionUsed', {
      actionType: 'creature', source: 'Necromancy', playerIdx: pi,
      cardName: creatureName, heroIdx: hi,
      _skipReactionCheck: true,
    });
    await engine.runHooks('onAdditionalActionUsed', {
      actionType: 'creature', source: 'Necromancy', playerIdx: pi,
      cardName: creatureName, heroIdx: hi,
      _skipReactionCheck: true,
    });

    engine.sync();
    return true;
  },
};
