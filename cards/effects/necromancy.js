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
 * Kept ONLY for the cpuMeta attachment-scoring branch below — the
 * live activation path now defers to `engine.heroMeetsLevelReq`, which
 * applies the full gap-coverage stack (Divinity, Wisdom paid coverage,
 * per-hero overrides, MAC, Lethe stamps via `pileSide`, …) instead of
 * the strict school count this helper used to perform.
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
    // Strict `cardType === 'Creature'` — Necromancy summons from the
    // discard pile, and per the design rule "anything summoning from
    // the discard pile should not count Artifact-Creatures" (Powder
    // Keg etc.), hybrids are deliberately excluded from the revival
    // pool. Sibling cards Glorious Rebirth, Forceful Revival, and
    // Cardinal Beast Xuanwu use the same strict check for the same
    // reason.
    if (!cd || cd.cardType !== 'Creature') continue;
    // Effective level (Whoolmoth-style rebates + any future
    // hand-active reducer that keys on card name). `pileSide: 'discard'`
    // picks up Lethe's per-pile +1 stamps applied to Creatures present
    // during prior Lethe-Necromancy resolutions — the +1 stacks against
    // BOTH the Necromancy level cap (here) and the school requirement
    // (`heroMeetsLevelReq` below, which is also stamp-aware).
    const effLvl = engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' });
    if (effLvl > necromancyLevel) continue;
    // Full Hero-summon eligibility — defers to the centralized engine
    // gate (Divinity-free / Wisdom-paid gap coverage, per-hero
    // overrides, MAC, etc.), matching every other Creature-revival
    // path. The local strict "school count ≥ printed level" check that
    // used to live here predated Divinity / Wisdom on Creatures and
    // silently blocked perfectly legal high-level revivals from any
    // Hero whose host abilities relied on gap coverage to cast.
    if (!engine.heroMeetsLevelReq(pi, heroIdx, cd, { pileSide: 'discard' })) continue;
    // Per-card summoning condition (canSummon). Without this, per-turn
    // summon limits ("you can only summon 1 Deepsea Primordium per
    // turn"), uniqueness gates (Cute Phoenix), and sacrifice tributes
    // are all bypassed by Necromancy — the player could revive a
    // Primordium they already summoned this turn.
    // `_bypassBeforeSummon: true` tells cards whose summonability
    // depends on a `beforeSummon`-paid cost (King Trex's auto-
    // sacrifice path) to apply the STRICT per-Hero rule here, since
    // Necromancy bypasses beforeSummon entirely.
    if (!engine.isCreatureSummonable(cardName, pi, heroIdx, { _bypassBeforeSummon: true })) continue;
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
      // Uses the EFFECTIVE level so Whoolmoth-style reducers and Lethe
      // pile stamps stay consistent with the live activation path
      // (which routes through `engine.heroMeetsLevelReq` at line 91).
      // Each declared spell school must be covered by the Hero's stack
      // (Performance copies count via the engine helper).
      const heroCanSummon = (cd, source) => {
        const opts = source === 'discard' ? { pileSide: 'discard' } : {};
        const cLvl = engine.effectiveCardLevel(cd, pi, opts);
        if (cd.spellSchool1) {
          if (engine.countAbilitiesForSchool(cd.spellSchool1, abZones) < cLvl) return false;
        }
        if (cd.spellSchool2) {
          if (engine.countAbilitiesForSchool(cd.spellSchool2, abZones) < cLvl) return false;
        }
        return true;
      };

      // Effective level applies — Whoolmoth-style reducers may push
      // a printed Lv5 card to 0 and make it summonable. Discard reads
      // pick up Lethe per-pile stamps via the pileSide opt-in.
      let summonable = 0;
      for (const name of (ps.discardPile || [])) {
        const cd = cardDB[name];
        if (!cd || cd.cardType !== 'Creature') continue;
        if (engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' }) > necroLevel) continue;
        if (!heroCanSummon(cd, 'discard')) continue;
        summonable++;
      }

      let latent = 0;
      if ((ps.mainDeck?.length || 0) >= 22) {
        for (const name of ps.mainDeck) {
          const cd = cardDB[name];
          if (!cd || cd.cardType !== 'Creature') continue;
          if (engine.effectiveCardLevel(cd, pi) > necroLevel) continue;
          if (!heroCanSummon(cd, 'deck')) continue;
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
    // Per-hero Necromancy lock — once a Hero with a per-turn limit
    // override (Lethe, 3/turn) has used Necromancy this turn, it is
    // pinned to that Hero for the rest of the turn. Other Necromancy
    // Heroes on the same side are silenced even though `clearHOPT` has
    // released the global slot. Stored as a `{ turn, heroName }` so it
    // auto-expires when the turn ticks.
    const lock = ps._necromancyLockedToHero;
    if (lock && lock.turn === engine.gs.turn) {
      const hostName = ps.heroes?.[heroIdx]?.name;
      if (hostName && lock.heroName && hostName !== lock.heroName) return false;
    }
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
    // Capture the highest Lethe pile-stamp for this name BEFORE the
    // reconcile that the next stamp read would trigger, so the bonus
    // follows the Creature onto the board instead of being silently
    // dropped from the per-name occurrence array.
    const _letheBonus = engine.consumeLetheStamp(pi, creatureName);

    // Place into support zone
    const hi = chosenZone.heroIdx;
    const si = chosenZone.slotIdx;
    if (!ps.supportZones[hi]) ps.supportZones[hi] = [[], [], []];
    ps.supportZones[hi][si] = [creatureName];

    // Track card instance
    const inst = engine._trackCard(creatureName, pi, 'support', hi, si);
    if (_letheBonus > 0) {
      inst.counters = inst.counters || {};
      inst.counters._letheLevelBonus = _letheBonus;
    }

    // Permanently stamp this instance as "summoned by Necromancy" so
    // Holy Selection (and any future card that gates on this) can
    // identify Necromancy-revived Creatures on the board. The stamp
    // lives on the inst.counters object — survives turn changes,
    // control flips, status changes; dies only with the instance
    // itself (a destroy / discard returns the Creature to its name in
    // the pile, and a re-summon creates a fresh inst with no stamp,
    // matching "the CURRENT body was Necromancy-summoned" semantics).
    inst.counters = inst.counters || {};
    inst.counters._summonedByNecromancy = true;

    // Tick the per-turn summon counter. Other "summon from outside the
    // board" paths (Raise the Minions, Skeleton Necromancer, Thep, Soul
    // Shard Khet) all route through `summonCreature` / `actionPlaceCreature
    // {countAsSummon: true}` which bumps this counter automatically.
    // Necromancy bypasses both helpers (direct discard-splice + _trackCard
    // because the negation + summoning-sickness paths need the inst before
    // hooks fire), so without an explicit bump here the counter stays at 0
    // and "first-summon-this-turn" gates (Aggressive Town Guard's
    // inherent additional Action, Harpyformer's same gate, etc.) wrongly
    // believe no Creature was summoned yet.
    ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

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
      await engine.actionNegateCreature(inst, 'Necromancy', {
        expiresAtTurn: gs.turn + 2,
        expiresForPlayer: pi,
        selfInflicted: true,
      });
    }
    if (vacarnBypass) {
      // Lift summoning sickness so the Skeleton can fire its active
      // effect this turn ("may use their active effects the turn
      // they're summoned"). Mark the inst with the Haste flag —
      // engine-side creature-effect summoning-sickness gates honor
      // `counters._hasHaste`. `turnPlayed` stays at the real summon
      // turn so "was summoned this turn" reads (Alice the Puppeteer
      // Girl, Hive's Crown, Singing's exclude-fresh filter, etc.)
      // correctly recognize the Creature as a fresh summon.
      if (!inst.counters) inst.counters = {};
      inst.counters._hasHaste = true;
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

    // Generic Necromancy lock — pin this turn's Necromancy slot to the
    // activating Hero. Default HOPT already prevents a second Necromancy
    // on the same player this turn; this lock only matters if a Hero
    // script chooses to clear that HOPT (Lethe — 3 uses/turn). The lock
    // then enforces "only the same Hero may re-activate" via
    // `canFreeActivate` above. Stamped with `turn` so it auto-expires.
    const _hostHero = ps.heroes?.[heroIdx];
    if (_hostHero?.name) {
      ps._necromancyLockedToHero = { turn: gs.turn, heroName: _hostHero.name };
    }

    // Generic per-Necromancy-resolution hook. Cards that extend or
    // alter Necromancy (Lethe — 3 uses/turn + stamp wave) listen here
    // so they don't have to be referenced by name from this file.
    // `hostHeroName` is deliberately NOT named `heroName` — the engine's
    // hook ctx already exposes a same-named METHOD (returns the LISTENER's
    // own hero name) and it would shadow this payload field on spread.
    await engine.runHooks('onNecromancyResolved', {
      playerIdx: pi,
      hostHeroIdx: heroIdx,
      hostHeroName: _hostHero?.name || null,
      level,
      summonedCreature: creatureName,
      _skipReactionCheck: true,
    });

    engine.sync();
    return true;
  },
};
