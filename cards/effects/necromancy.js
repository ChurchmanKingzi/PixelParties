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
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if ((cd.level || 0) > necromancyLevel) continue;
    if (!heroCanSummon(ps, heroIdx, cd)) continue;
    // Per-card summoning condition (canSummon). Without this, per-turn
    // summon limits ("you can only summon 1 Deepsea Primordium per
    // turn"), uniqueness gates (Cute Phoenix), and sacrifice tributes
    // are all bypassed by Necromancy — the player could revive a
    // Primordium they already summoned this turn.
    if (!engine.isCreatureSummonable(cardName, pi, heroIdx)) continue;
    seen.add(cardName);
    result.push({ name: cardName, source: 'discard' });
  }
  return result;
}

// ─── CARD MODULE ─────────────────────────

const { hasCardType } = require('./_hooks');

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,
  noDefaultFlash: true, // Skip the generic gold sparkle — Necromancy plays its own animation

  // CPU per-hero attachment scoring. Necromancy's value is entirely
  // gated on the host Hero's Summoning Magic level (the cap on which
  // Creatures from discard the activation can revive) AND on whose
  // school requirements those Creatures actually meet via the host's
  // existing ability stacks. Without this hook, `scoreAbilityPlacement`
  // sees Necromancy as "no school unlocks, no scaling" and ranks
  // every Hero ~equally — the CPU would slap Necromancy onto whichever
  // Hero won the random tiebreak even when only one of them can host
  // a summon-from-discard.
  //
  // Score formula: each Creature in OWN discard the host could summon
  // post-attach is worth +50 (≈ a free Creature on the board next
  // activation). Latent fuel — Creatures still in deck the host could
  // summon if they reach the discard pile — adds +10 per match,
  // gated at deck.length ≥ 22 so the bonus isn't free-rolling into
  // deck-out territory.
  cpuMeta: {
    attachmentBonus(engine, pi, heroIdx) {
      const ps = engine.gs.players?.[pi];
      if (!ps) return 0;
      const abZones = ps.abilityZones?.[heroIdx] || [];
      // Necromancy's revive cap = stack level on this Hero AFTER the
      // pending attach (= existing-stack + 1).
      let necroLevel = 0;
      for (const slot of abZones) {
        if (!slot) continue;
        if (slot[0] === 'Necromancy') necroLevel = Math.max(necroLevel, slot.length);
      }
      necroLevel += 1;
      if (necroLevel <= 0) return 0;

      const cardDB = engine._getCardDB();

      // Predicate: could THIS host summon `cd` right now (post-attach)?
      // Mirrors `heroCanSummon` from the live activation path: each
      // declared spell school must be covered by the Hero's stack of
      // that school (Performance copies count via the engine helper).
      // The level cap from Necromancy is applied separately below.
      const heroCanSummon = (cd) => {
        const cLvl = cd.level || 0;
        if (cd.spellSchool1) {
          if (engine.countAbilitiesForSchool(cd.spellSchool1, abZones) < cLvl) return false;
        }
        if (cd.spellSchool2) {
          if (engine.countAbilitiesForSchool(cd.spellSchool2, abZones) < cLvl) return false;
        }
        return true;
      };

      let summonable = 0;
      for (const name of (ps.discardPile || [])) {
        const cd = cardDB[name];
        if (!cd || cd.cardType !== 'Creature') continue;
        if ((cd.level || 0) > necroLevel) continue;
        if (!heroCanSummon(cd)) continue;
        summonable++;
      }

      let latent = 0;
      if ((ps.mainDeck?.length || 0) >= 22) {
        for (const name of ps.mainDeck) {
          const cd = cardDB[name];
          if (!cd || cd.cardType !== 'Creature') continue;
          if ((cd.level || 0) > necroLevel) continue;
          if (!heroCanSummon(cd)) continue;
          latent++;
        }
      }

      return summonable * 50 + latent * 10;
    },
  },

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

    // Apply negation until start of controller's next turn — UNLESS the
    // summoned Creature opts out via `bypassNecromancyNegation: true`
    // (Soul Shards). Without this opt-out, the standard runHooks
    // `negated`-zone filter silently swallows the Soul Shard's
    // discard-trigger onPlay, defeating the whole archetype. The flag
    // is checked via the loaded card script so the immunity is purely
    // archetype-driven, not per-summon-source.
    //
    // Vacarn, the Dark Goblin Necromancer ALSO bypasses both the
    // negation and the summoning-sickness gate, but ONLY for Skeleton
    // Creatures he himself revives. Detected here by checking the
    // host hero's name and the summoned card's Skeleton-tribal status
    // (which `_skeleton-shared.isSkeletonCreature` already handles
    // including the "treated as Skeleton" overrides).
    const summonedScript = require('./_loader').loadCardEffect(creatureName);
    const skipNegate = summonedScript?.bypassNecromancyNegation === true;
    const hostHero = ps.heroes?.[heroIdx];
    let vacarnBypass = false;
    if (hostHero?.name === 'Vacarn, the Dark Goblin Necromancer' && hostHero.hp > 0) {
      const { isSkeletonCreature } = require('./_skeleton-shared');
      if (isSkeletonCreature(creatureName, engine)) vacarnBypass = true;
    }
    if (!skipNegate && !vacarnBypass) {
      // Current turn = gs.turn (pi's turn), next pi turn = gs.turn + 2
      engine.actionNegateCreature(inst, 'Necromancy', {
        expiresAtTurn: gs.turn + 2,
        expiresForPlayer: pi,
      });
    }
    if (vacarnBypass) {
      // Lift summoning sickness so the Skeleton can fire its active
      // effect this turn ("may use their active effects the turn
      // they're summoned"). Engine-side creature-effect HOPT gate
      // checks `inst.turnPlayed === currentTurn`; setting it to the
      // previous turn lets the gate read the creature as not-fresh.
      inst.turnPlayed = (gs.turn || 0) - 1;
    }

    engine.log('necromancy', {
      player: ps.username, creature: creatureName, level,
      heroIdx: hi, zoneSlot: si, negated: !skipNegate,
    });

    // Emit summon effect glow
    engine._broadcastEvent('summon_effect', { owner: pi, heroIdx: hi, zoneSlot: si, cardName: creatureName });

    // Fire on-summon hooks. `_summonedFromDiscard` and
    // `_summonedByNecromancy` flags let archetype-trigger creatures
    // (Soul Shards) detect that this is a discard-pile revival and
    // fire their unique effects accordingly. `_necromancyLevel` is
    // the stack size, used by Soul Shard Ka to gate its "level
    // 0/1/2 or lower" search at level − 1. Negated creatures' hooks
    // still get filtered out by the runHooks zone-status check, but
    // Soul Shards skip the negation above so their hooks run.
    const summonExtras = {
      _summonedFromDiscard: true,
      _summonedByNecromancy: true,
      _necromancyLevel: level,
    };
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst,
      cardName: creatureName, zone: 'support',
      heroIdx: hi, zoneSlot: si,
      ...summonExtras,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: hi,
      ...summonExtras,
    });

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
