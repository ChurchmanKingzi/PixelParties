// ═══════════════════════════════════════════
//  CARD EFFECT: "Archibald, the Archmage"
//  Hero (350 HP, 30 ATK)
//  Starting abilities: Wisdom + Wisdom
//
//  Once per turn, when Archibald's controller discards a Normal
//  Spell from their hand, the controller may immediately cast that
//  Spell as an additional Action with Archibald. The Spell's level
//  is temporarily increased by 1 for the duration of this cast.
//  Triggers on ANY discard, including during the opponent's turn —
//  Wisdom cost, Acid Rain delete, Magenta self-mill, Forced Discard,
//  etc. all count.
//
//  Eligibility uses the BOOSTED level: a Lv2 Normal Spell becomes
//  Lv3 for the level-requirement check, so Archibald only triggers
//  if his abilities can clear the boosted spell-school requirement.
//  E.g. with Wisdom 2, a discarded Lv1 Spell (boosted to Lv2) is
//  castable for 2 wisdom-cost discards. A discarded Lv2 Spell
//  (boosted to Lv3) exceeds Wisdom 2's coverage — no trigger.
//
//  Per-turn dupe ban: Archibald can never perform 2 of the same
//  Spell name in 1 game-turn. This applies to BOTH discard-trigger
//  casts and regular-from-hand casts uniformly. Enforced via
//  `canPlayCard` and via the discard hook's eligibility filter.
//
//  Batch-aware prompting (Wisdom-style multi-discard):
//  When the discard event fires inside a forced-discard BATCH (e.g.
//  another spell's Wisdom cost paying 2 cards), Archibald defers his
//  prompt — the eligible Normal Spells are queued, and once the
//  entire batch is paid the player is shown a single gallery (or a
//  yes/no confirm if only one of the batch's discards was eligible)
//  to pick which spell to cast (or decline). Mirrors how the engine
//  resolves multi-eligible chain reactions.
// ═══════════════════════════════════════════

const CARD_NAME       = 'Archibald, the Archmage';
const HOPT_KEY        = 'archibald-discard-cast';
const CAST_LIST_KEY   = '_archibaldSpellsCastThisTurn';
const QUEUE_KEY       = '_archibaldDiscardQueue';

/**
 * Build the eligibility predicate for a discarded spell. Returns the
 * boosted card data + cost if eligible, or null otherwise.
 *
 * Re-checked at prompt time so that anything that changed during a
 * forced-discard batch (Wisdom level shifting? unlikely but cheap to
 * re-validate) is reflected. Filters: alive + functional hero, not
 * already cast this turn, Normal Spell, level passes with +1 boost.
 */
function evaluateEligibility(engine, ps, hero, ctx, cardName) {
  if (!cardName) return null;
  const cardDB = engine._getCardDB();
  const cd = cardDB[cardName];
  if (!cd || cd.cardType !== 'Spell') return null;
  if ((cd.subtype || '').toLowerCase() !== 'normal') return null;

  if (!hero?.name || hero.hp <= 0) return null;
  if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return null;

  const cast = hero[CAST_LIST_KEY] || [];
  if (cast.includes(cardName)) return null;

  const boostedLevel = (cd.level || 0) + 1;
  const boostedCd = { ...cd, level: boostedLevel };
  if (!engine.heroMeetsLevelReq(ctx.cardOwner, ctx.cardHeroIdx, boostedCd)) return null;

  // Wisdom affordability gate. If the cast can ONLY clear the level
  // requirement via a Wisdom discard cost (which is the normal case
  // for Archibald — Wisdom is his only school), the player must
  // actually have enough cards in hand to pay it. Unlike a regular
  // hand-played spell, the discarded spell is ALREADY in the
  // discard pile here, so the full hand counts (no `-1` for the
  // "spell leaves hand on cast" adjustment that the regular spell-
  // play candidate filter uses). 0 cards in hand → no wisdom can
  // be paid → the cast is illegal.
  const wisdomCost = engine.getWisdomDiscardCost(ctx.cardOwner, ctx.cardHeroIdx, boostedCd);
  if (wisdomCost > 0 && ps.hand.length < wisdomCost) return null;

  return { cd, boostedCd, boostedLevel, wisdomCost };
}

/**
 * Cast a chosen spell with Archibald as the host hero. Pays Wisdom
 * cost (if any) for the boosted level, applies the level override
 * during the cast, fires onPlay + afterSpellResolved exactly the way
 * `performImmediateAction` does, and cleans up. The original copy of
 * the spell is left in the discard pile (it was already discarded by
 * the triggering source — pushing it again would duplicate).
 */
async function castSpellAsArchibald(engine, ctx, hero, cardName, evalResult) {
  const gs = engine.gs;
  const { cd, boostedCd, boostedLevel } = evalResult;

  // Track the spell BEFORE casting so a nested discard re-trigger
  // (Wisdom cost during the cast) sees the dupe ban and skips.
  if (!hero[CAST_LIST_KEY]) hero[CAST_LIST_KEY] = [];
  if (!hero[CAST_LIST_KEY].includes(cardName)) hero[CAST_LIST_KEY].push(cardName);

  // ── Wisdom cost on the BOOSTED level ──
  // Archibald's only school is Wisdom, so almost every cast carries
  // a wisdom cost equal to the gap. Pay it BEFORE running onPlay so
  // it lands deterministically — same contract as the regular
  // doPlaySpell flow ("Wisdom is always paid even if the spell is
  // negated, interrupted, or fizzles").
  const wisdomCost = engine.getWisdomDiscardCost(ctx.cardOwner, ctx.cardHeroIdx, boostedCd);
  if (wisdomCost > 0) {
    gs._archibaldCasting = true;
    try {
      await engine.actionPromptForceDiscard(ctx.cardOwner, wisdomCost, {
        title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
      });
    } finally {
      delete gs._archibaldCasting;
    }
  }

  // Temporary per-card level override so any nested level check
  // mid-cast sees the boosted value.
  if (!hero.levelOverrideCards) hero.levelOverrideCards = {};
  const prevOverride = hero.levelOverrideCards[cardName];
  hero.levelOverrideCards[cardName] = boostedLevel;

  // Synthesize a cast-context instance. The original copy is
  // already in the discard pile — DO NOT push another copy when the
  // cast resolves.
  const synthInst = engine._trackCard(cardName, ctx.cardOwner, 'hand', ctx.cardHeroIdx, -1);
  gs._immediateActionContext = true;
  gs._archibaldCasting = true;
  gs._spellResolutionDepth = (gs._spellResolutionDepth || 0) + 1;
  const hadPriorLog = gs._spellDamageLog !== undefined;
  if (!hadPriorLog) gs._spellDamageLog = [];

  try {
    await engine.runHooks('onPlay', {
      _onlyCard: synthInst, playedCard: synthInst,
      cardName, zone: 'hand',
      heroIdx: ctx.cardHeroIdx,
      _skipReactionCheck: true,
    });

    if (!gs._spellNegatedByEffect) {
      const uniqueTargets = [];
      const seen = new Set();
      for (const t of (gs._spellDamageLog || [])) {
        if (!seen.has(t.id)) { seen.add(t.id); uniqueTargets.push(t); }
      }
      await engine.runHooks('afterSpellResolved', {
        spellName: cardName, spellCardData: cd,
        heroIdx: ctx.cardHeroIdx, casterIdx: ctx.cardOwner,
        damageTargets: uniqueTargets,
        isSecondCast: false,
        _skipReactionCheck: true,
      });
    }
  } catch (err) {
    console.error(`[Archibald] cast of "${cardName}" threw:`, err.message);
  } finally {
    gs._spellResolutionDepth = Math.max(0, (gs._spellResolutionDepth || 1) - 1);
    delete gs._immediateActionContext;
    delete gs._archibaldCasting;
    delete gs._spellNegatedByEffect;
    if (!hadPriorLog) delete gs._spellDamageLog;
    if (prevOverride === undefined) delete hero.levelOverrideCards[cardName];
    else hero.levelOverrideCards[cardName] = prevOverride;
    engine._untrackCard(synthInst.id);
  }

  engine.log('archibald_cast', {
    player: gs.players[ctx.cardOwner]?.username,
    spell: cardName,
    boostedLevel,
  });
  engine.sync();
}

/**
 * Process a candidate list of discarded spells: re-validate each,
 * claim HOPT, prompt the player (single confirm if one eligible,
 * card gallery if 2+), and cast the chosen spell.
 *
 * Used by both the single-discard path (length 1) and the batch path
 * (length N from the queue). When length > 1, the gallery includes
 * a "Don't cast" cancel option.
 */
async function resolveTrigger(ctx, candidateNames) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const ps = gs.players[ctx.cardOwner];
  if (!ps) return;
  const hero = ctx.attachedHero;
  if (!hero) return;

  // Re-entry guard — Archibald's own cast machinery sets this flag
  // around the wisdom-cost discards it triggers, so any Normal Spell
  // discarded as part of THAT can't kick off another resolveTrigger.
  if (gs._archibaldCasting) return;

  // Filter to currently-eligible spells (re-evaluate at prompt time).
  // Dedupe by name — a player who discards two copies of the same
  // Normal Spell still gets only one gallery entry (and once cast,
  // the dupe ban naturally blocks the second).
  const seen = new Set();
  const eligible = [];
  for (const name of candidateNames) {
    if (seen.has(name)) continue;
    const ev = evaluateEligibility(engine, ps, hero, ctx, name);
    if (!ev) continue;
    seen.add(name);
    eligible.push({ name, ev });
  }
  if (eligible.length === 0) return;

  // Reserve once-per-turn slot up front so a recursive trigger fired
  // by the cast itself can't double-fire. Refunded on decline.
  if (!engine.claimHOPT(HOPT_KEY, ctx.cardOwner)) return;

  let picked = null;
  if (eligible.length === 1) {
    // Single-target — yes/no confirm prompt.
    const { name, ev } = eligible[0];
    const confirmed = await engine.promptGeneric(ctx.cardOwner, {
      type: 'confirm',
      title: CARD_NAME,
      message: `${name} was just discarded — cast it as an additional Action with ${hero.name}? (Level becomes ${ev.boostedLevel}.)`,
      showCard: name,
      confirmLabel: '✨ Cast!',
      cancelLabel: 'No',
      cancellable: true,
    });
    if (confirmed) picked = eligible[0];
  } else {
    // Multi-target — gallery prompt with cancel, mirroring the
    // chain-reaction multi-pick UI (engine `_promptReactionsForChain`).
    const cards = eligible.map(({ name, ev }) => ({
      name, source: 'discard',
      // boostedLevel is informational — the gallery's badge formatter
      // ignores unknown keys but cost / level / count are honoured.
      level: ev.boostedLevel,
    }));
    const result = await engine.promptGeneric(ctx.cardOwner, {
      type: 'cardGallery',
      cards,
      title: CARD_NAME,
      description: `${eligible.length} discarded Normal Spells are eligible — pick one to cast as an additional Action with ${hero.name} (level becomes +1), or decline.`,
      cancelLabel: "Don't cast",
      cancellable: true,
    });
    if (result && !result.cancelled && result.cardName) {
      picked = eligible.find(e => e.name === result.cardName);
    }
  }

  if (!picked) {
    // Refund the HOPT — we never actually used the trigger.
    if (gs.hoptUsed) delete gs.hoptUsed[`${HOPT_KEY}:${ctx.cardOwner}`];
    return;
  }

  await castSpellAsArchibald(engine, ctx, hero, picked.name, picked.ev);
}

module.exports = {
  activeIn: ['hero'],

  /**
   * Block regular-play of any Spell whose name Archibald has already
   * performed this turn (either via the discard trigger or via a
   * previous normal cast).
   */
  canPlayCard(gs, pi, heroIdx, cardData /*, engine */) {
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero) return true;
    if (cardData?.cardType !== 'Spell') return true;
    const cast = hero[CAST_LIST_KEY] || [];
    return !cast.includes(cardData.name);
  },

  hooks: {
    /** Reset per-turn cast list at every turn boundary. */
    onTurnStart: (ctx) => {
      const hero = ctx.attachedHero;
      if (hero) hero[CAST_LIST_KEY] = [];
    },

    /**
     * Bookkeeping for the dupe ban. Records every Spell Archibald
     * himself just resolved — discard-trigger casts ALSO populate
     * this list pre-emptively (see castSpellAsArchibald) so a nested
     * trigger inside the same resolution can't double-fire.
     */
    afterSpellResolved: (ctx) => {
      if (ctx.casterIdx !== ctx.cardOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      const sd = ctx.spellCardData;
      if (!sd || sd.cardType !== 'Spell') return;
      const hero = ctx.attachedHero;
      if (!hero) return;
      if (!hero[CAST_LIST_KEY]) hero[CAST_LIST_KEY] = [];
      if (!hero[CAST_LIST_KEY].includes(ctx.spellName)) {
        hero[CAST_LIST_KEY].push(ctx.spellName);
      }
    },

    /**
     * THE per-card trigger. Either resolves immediately (single-
     * discard contexts like Magenta's mill, Cool Repair's recover,
     * or any non-batched discard) or queues for the batch-end hook
     * below if a forced-discard batch is in flight.
     */
    onDiscard: async (ctx) => {
      if (!ctx._fromHand) return;
      if (ctx.playerIdx !== ctx.cardOwner) return;
      const cardName = ctx.discardedCardName || ctx.cardName;
      if (!cardName) return;

      const engine = ctx._engine;
      const gs = engine.gs;

      // Re-entry guard — same one castSpellAsArchibald uses.
      if (gs._archibaldCasting) return;

      // Inside a forced-discard batch: defer. The batch-end hook
      // (onForcedDiscardBatchEnd) will sweep the queue and prompt
      // ONCE for whichever spells turn out to be eligible.
      if ((gs._batchDiscardDepth || 0) > 0) {
        if (!ctx.card.counters[QUEUE_KEY]) ctx.card.counters[QUEUE_KEY] = [];
        ctx.card.counters[QUEUE_KEY].push(cardName);
        return;
      }

      // Single-discard path — process this one card's eligibility now.
      await resolveTrigger(ctx, [cardName]);
    },

    /**
     * Fired by the engine after the OUTERMOST forced-discard batch
     * finishes. We sweep whatever this Archibald instance queued
     * during the batch and prompt with a gallery if 2+ eligible,
     * confirm if 1, nothing if 0.
     */
    onForcedDiscardBatchEnd: async (ctx) => {
      const queue = ctx.card.counters?.[QUEUE_KEY];
      if (!queue || queue.length === 0) return;
      // Drain the queue regardless of outcome so a future batch
      // can't accidentally consume stale entries.
      delete ctx.card.counters[QUEUE_KEY];
      await resolveTrigger(ctx, queue);
    },
  },
};
