// ═══════════════════════════════════════════
//  CARD EFFECT: "Lethe, the Forgetful Fixer"
//  Hero — 400 HP / 40 ATK (Divinity + Necromancy)
//
//  "This Hero cannot perform Actions if a target you control was
//   defeated since the end of your last turn. You may spend your
//   Action to summon up to 3 Creatures from your discard pile with
//   this Hero, but negate their effects for the rest of the turn."
//
//  ── Passive: action lock ────────────────────────────────────────
//  A per-player tracker `ps._letheTargetDefeated` is set whenever a
//  target the controller controls (Hero OR Creature) is defeated. It
//  is cleared at the END of the controller's turn — that's the "end
//  of your last turn" reset boundary, so:
//    • a controlled target dying during the opponent's turn (or
//      during the controller's own turn) keeps the flag set;
//    • the flag persists into the controller's next turn and lifts
//      only when that turn ends.
//  While the flag is set, every Lethe the controller owns gets
//  `_actionLockedTurn = gs.turn` — the engine's centralized "this
//  Hero cannot perform any Action this turn" gate (covers Spell /
//  Attack / Creature plays, action-cost Abilities, Attacks, AND the
//  alt-summon below, which is itself an Action). Set at the
//  controller's turn start, and also re-applied the instant a
//  controlled target dies mid-turn so the rest of the turn is locked.
//
//  ── Alt action: discard revival ─────────────────────────────────
//  `heroEffect` + `heroEffectActionCost: true` — the server's
//  hero-effect path consumes the Action slot AND already refuses
//  activation while `_actionLockedTurn === gs.turn`, so the lock
//  above naturally blocks this too (consistent with "cannot perform
//  Actions"). Up to 3 Creatures are pulled from the discard pile
//  into Lethe's free Support Zones; each is negated "for the rest of
//  the turn" (expires at the start of the opponent's next turn).
//  The discard pool is restricted to Creatures Lethe could summon
//  normally — standard summon gating via `heroMeetsLevelReq` (her
//  Summoning-Magic level + Divinity / Wisdom gap coverage) plus
//  per-card summonability (strict cardType === 'Creature',
//  uniqueness / per-turn caps / Cardinal locks).
// ═══════════════════════════════════════════

const CARD_NAME = 'Lethe, the Forgetful Fixer';

// ─── HELPERS ─────────────────────────────────────────────────────

/** Lethe heroes the player owns (loop — defensive vs. multi-copy). */
function forEachLethe(ps, fn) {
  const heroes = ps?.heroes || [];
  for (let hi = 0; hi < heroes.length; hi++) {
    const h = heroes[hi];
    if (h?.name === CARD_NAME) fn(h, hi);
  }
}

/**
 * Lock every Lethe `ps` owns for the current turn. Sets the engine's
 * generic action lock (`_actionLockedTurn`) AND a Lethe-specific
 * marker (`_letheActionLocked`) so the UI can show a status badge
 * that means specifically "locked by Lethe's OWN effect" (a generic
 * `_actionLockedTurn` set by some opponent card is a different thing
 * and must NOT show this badge). Both auto-expire — they only count
 * while they equal `gs.turn`.
 */
function lockLethe(ps, gs) {
  forEachLethe(ps, (h) => {
    h._actionLockedTurn = gs.turn;
    h._letheActionLocked = gs.turn;
  });
}

/** Free base Support Zones (slots 0–2) for a specific hero. */
function freeZoneSlots(ps, heroIdx) {
  const slots = [];
  const sup = ps.supportZones?.[heroIdx] || [];
  for (let s = 0; s < 3; s++) {
    if ((sup[s] || []).length === 0) slots.push(s);
  }
  return slots;
}

/** Deduplicated, summon-legal Creature gallery from the discard pile. */
function discardCreatureGallery(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const counts = {};
  for (const name of (ps.discardPile || [])) {
    if (counts[name] != null) { counts[name]++; continue; }
    const cd = cardDB[name];
    // Strict Creature check — same design rule as Necromancy /
    // Forceful Revival: discard-revival never counts hybrid
    // Artifact-Creatures.
    if (!cd || cd.cardType !== 'Creature') continue;
    // Standard Creature summon gating: Lethe must actually be able to
    // summon it with her Summoning-Magic level (+ Divinity / Wisdom
    // gap coverage). `heroMeetsLevelReq` is the same engine path a
    // normal hand-summon uses — it consults the Creature's spell
    // school + level against this Hero's ability stacks and lets
    // Divinity cover the gap for Creature plays.
    if (!engine.heroMeetsLevelReq(pi, heroIdx, cd)) continue;
    // Honour per-card summonability (uniqueness, per-turn caps,
    // Cardinal locks). `_bypassBeforeSummon` matches Necromancy —
    // beforeSummon-paid costs aren't run on a discard revival.
    if (!engine.isCreatureSummonable(name, pi, heroIdx, { _bypassBeforeSummon: true })) continue;
    counts[name] = 1;
  }
  return Object.keys(counts)
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name, source: 'discard', count: counts[name] }));
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // The alt-summon explicitly "spend your Action" — it consumes the
  // Action resource (server gates this on `_actionLockedTurn`, so the
  // passive lock blocks it too).
  heroEffectActionCost: true,
  // Keep the bookkeeping hooks (defeat tracking + lock refresh) firing
  // even while Lethe is Frozen / Stunned / Negated so the
  // since-last-turn window stays accurate regardless of status.
  bypassStatusFilter: true,

  // ── Alt action gate ──────────────────────────────────────────────
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = ctx.attachedHero;
    if (!hero?.name || hero.hp <= 0) return false;
    // Locked out by the passive — don't even offer it (the server
    // would refuse anyway, this just keeps the UI honest).
    if (hero._actionLockedTurn === gs.turn) return false;
    if (freeZoneSlots(gs.players[pi], heroIdx).length === 0) return false;
    return discardCreatureGallery(engine, pi, heroIdx).length > 0;
  },

  /**
   * Summon up to 3 Creatures from discard into Lethe's free Support
   * Zones, each negated for the rest of the turn. Returns false on a
   * no-commit cancel so the server refunds the spent Action.
   */
  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;

    const maxPicks = Math.min(3, freeZoneSlots(ps, heroIdx).length);
    if (maxPicks === 0) return false;

    let picksTaken = 0;
    while (picksTaken < maxPicks) {
      const free = freeZoneSlots(ps, heroIdx);
      if (free.length === 0) break;

      const gallery = discardCreatureGallery(engine, pi, heroIdx);
      if (gallery.length === 0) break;

      const slotLabel = `${picksTaken + 1}/${maxPicks}`;
      const choice = await ctx.promptCardGallery(gallery, {
        title: CARD_NAME,
        description: `Choose a Creature from your discard pile to summon with ${ctx.heroName()} (${slotLabel}). Its effects are negated for the rest of the turn.${picksTaken > 0 ? ' Cancel to stop.' : ''}`,
        confirmLabel: '⚰️ Revive',
        confirmClass: 'btn-info',
        cancellable: true,
      });
      if (!choice?.cardName) {
        // Nothing committed yet → bail so the Action is refunded.
        if (picksTaken === 0) return false;
        break;
      }

      const creatureName = choice.cardName;
      const discardIdx = ps.discardPile.indexOf(creatureName);
      if (discardIdx < 0) break; // Safety — gone from discard.

      const slotIdx = free[0];

      // Dark-magic revival visual on the target Support Zone.
      engine._broadcastEvent('play_zone_animation', {
        type: 'necromancy_summon', owner: pi, heroIdx, zoneSlot: slotIdx,
      });
      await engine._delay(650);

      ps.discardPile.splice(discardIdx, 1);
      if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
      ps.supportZones[heroIdx][slotIdx] = [creatureName];

      const inst = engine._trackCard(creatureName, pi, 'support', heroIdx, slotIdx);

      // Tick the per-turn summon counter — same rationale as
      // Necromancy: this path bypasses summonCreature/actionPlaceCreature
      // so first-summon-this-turn gates would otherwise miss it.
      ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

      // Negate "for the rest of the turn": clears at the start of the
      // opponent's next turn (gs.turn + 1 / expiresForPlayer = opp).
      // Applied BEFORE the onPlay fire so the summoned Creature's own
      // on-summon effect is filtered out by the runHooks zone-status
      // check (matches Necromancy).
      engine.actionNegateCreature(inst, CARD_NAME, {
        expiresAtTurn: gs.turn + 1,
        expiresForPlayer: oppIdx,
        selfInflicted: true,
      });

      engine._broadcastEvent('summon_effect', {
        owner: pi, heroIdx, zoneSlot: slotIdx, cardName: creatureName,
      });

      const summonExtras = { _summonedFromDiscard: true };
      await engine.runHooks('onPlay', {
        _onlyCard: inst, playedCard: inst,
        cardName: creatureName, zone: 'support',
        heroIdx, zoneSlot: slotIdx, ...summonExtras,
      });
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx,
        ...summonExtras,
      });

      engine.log('lethe_revive', {
        player: ps.username, creature: creatureName,
        heroIdx, zoneSlot: slotIdx, negated: true,
      });
      picksTaken++;
    }

    if (picksTaken === 0) return false;
    engine.sync();
    return true;
  },

  hooks: {
    /**
     * Controller's turn start: if a controlled target was defeated
     * since the end of the controller's last turn, lock every Lethe
     * for the whole turn.
     */
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const controller = ctx.cardController ?? ctx.cardOwner;
      if (ctx.activePlayer !== controller) return;
      const ps = gs.players[controller];
      if (!ps?._letheTargetDefeated) return;
      lockLethe(ps, gs);
      engine.sync();
    },

    /**
     * Controller's turn end: reset the since-last-turn window. Deaths
     * after this point (opponent's turn, then the controller's next
     * turn) re-arm the lock.
     */
    onTurnEnd: async (ctx) => {
      const controller = ctx.cardController ?? ctx.cardOwner;
      if (ctx.activePlayer !== controller) return;
      const ps = ctx._engine.gs.players[controller];
      if (ps) delete ps._letheTargetDefeated;
    },

    /** A Creature the controller controls was defeated. */
    onCreatureDeath: async (ctx) => {
      const dead = ctx.creature;
      if (!dead) return;
      const side = dead.controller ?? dead.owner;
      _markDefeat(ctx, side);
    },

    /** A Hero the controller controls was defeated. */
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const dyingHero = ctx.hero;
      if (!dyingHero?.name) return;
      let side = -1;
      for (let p = 0; p < 2 && side < 0; p++) {
        if ((engine.gs.players[p]?.heroes || []).includes(dyingHero)) side = p;
      }
      if (side < 0) return;
      _markDefeat(ctx, side);
    },
  },
};

/**
 * Record that a target controlled by `side` was defeated. If `side`
 * is this Lethe's controller, set the tracker; and if it is currently
 * that controller's own turn, lock every Lethe immediately so the
 * rest of the turn is action-locked too.
 */
function _markDefeat(ctx, side) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const controller = ctx.cardController ?? ctx.cardOwner;
  if (side !== controller) return;
  const ps = gs.players[controller];
  if (!ps) return;
  ps._letheTargetDefeated = true;
  if (gs.activePlayer === controller) {
    lockLethe(ps, gs);
  }
}
