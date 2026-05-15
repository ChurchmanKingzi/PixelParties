// ═══════════════════════════════════════════
//  CARD EFFECT: "Learning"
//  Ability — Triggered free effect.
//
//  Once per turn, during the player's own Action
//  Phase, after this Hero used a Spell, choose a
//  different Spell from the player's hand that this
//  Hero can actually use and immediately cast it as
//  an additional Action with this Hero. Filters
//  mirror the in-hand grayout — Surprises and
//  Reactions-without-proactivePlay are excluded,
//  level / Wisdom / hero-restriction /
//  spellPlayCondition gates are honored.
//
//  Tier behavior (cards.json text):
//   1) trigger = Magic Arts; choose = Magic Arts.
//   2) trigger = Magic Arts; choose = any school.
//   3) trigger = any;        choose = any school.
//
//  Action Phase restriction (added 2026-05-15):
//   The hook short-circuits unless `gs.currentPhase`
//   is PHASES.ACTION (3). Main Phase 1/2 casts no
//   longer trigger Learning. Because the chained
//   Spell is dispatched through the standard
//   `onAdditionalActionUsed` hook, it counts as the
//   player's next Action of the Action Phase —
//   "extra Action this Action Phase" grants from
//   cards like Torchure are spent on the chained
//   Spell rather than being saved for a fresh cast.
//
//  Hand-source rewrite (2026-05-15):
//   The chosen Spell now comes from the casting
//   player's HAND, not their deck. No deck-search
//   helper, no reveal modal, no shuffle. The
//   triggering Spell is excluded by both name AND
//   physical hand index — even with multiple copies
//   of the trigger's name in hand, only the still-
//   resolving instance is removed from the pool, and
//   any other instance is filtered by the "different
//   name" rule. Wisdom math is tightened: the chosen
//   Spell itself leaves hand to resolve before its
//   own Wisdom is paid, so the affordability gate is
//   `effHand - 1 >= wisdomCost`.
//
//  Direct-hand picker (2026-05-15):
//   The selection UI is the engine's `pickHandCard`
//   prompt — eligible hand slots are highlighted and
//   directly clickable, everything else (including
//   the still-resolving triggering Spell) is dimmed.
//   The only opt-out is the Cancel button; there is
//   no modal gallery and no single-Spell confirm
//   sub-prompt.
//
//  Implementation notes:
//  • Hooks into `afterSpellResolved` and matches
//    `casterIdx === pi && heroIdx === this hero`.
//  • HOPT key per (player, hero, abilitySlot) so
//    two Learning instances on different heroes
//    fire independently each turn.
//  • Drives the chosen Spell synthetically: locate
//    its hand instance, open the reaction window
//    (Anti Magic Shield etc. can still negate),
//    run onPlay + afterSpellResolved, then splice
//    and discard / leave on board (Areas, Forbidden
//    Zone, …). Wisdom is paid AFTER the splice so
//    the chosen Spell can't pay for itself, with
//    the triggering Spell's hand index excluded
//    from the eligible-fodder pool so it stays
//    intact for the outer doPlaySpell handler.
//  • Re-entry guarded — nested afterSpellResolved
//    from the chained Spell can't re-trigger
//    Learning thanks to both the HOPT and the
//    `_learningCasting` flag.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Learning';

/**
 * Effective Learning level for THIS instance — the stack length of the
 * ability slot it lives in. Performance copies stack into the same slot
 * as their base, so slot.length naturally counts them too.
 */
function learningLevelOf(ps, heroIdx, zoneSlot) {
  const slot = (ps.abilityZones?.[heroIdx] || [])[zoneSlot] || [];
  return slot.length || 0;
}

function isMagicArts(cd) {
  return cd?.spellSchool1 === 'Magic Arts' || cd?.spellSchool2 === 'Magic Arts';
}

/**
 * "Could the player normally cast this Spell from hand right now?" —
 * the in-hand grayout rule. Surprise subtype is never proactively
 * cast. Reaction subtype is only proactively castable if the script
 * exports `proactivePlay: true` (Cure, Burning Fuse, Deepsea Spores,
 * Juice, …).
 */
function isProactivelyCastable(cd, script) {
  const sub = (cd?.subtype || '').toLowerCase();
  if (sub === 'surprise') return false;
  if (sub === 'reaction' && !script?.proactivePlay) return false;
  return true;
}

/**
 * Effective hand size for any post-trigger Wisdom math. The hook fires
 * BEFORE the engine splices the triggering Spell from hand and BEFORE
 * its Wisdom is paid (server.js doPlaySpell ordering — splice/discard/
 * pay-wisdom all live AFTER `runHooks afterSpellResolved` returns), so
 * a raw `ps.hand.length` over-counts by one (the resolving Spell) plus
 * the triggering Spell's own Wisdom cost (the cards that are about to
 * be discarded as its payment).
 *
 * Example: hand = [SpellA, FodderB], SpellA's wisdom = 1.
 *   raw handLen = 2
 *   stillResolving = 1 (SpellA still in hand)
 *   triggeringWisdom = 1 (FodderB about to leave as wisdom)
 *   effective = 0  → no card free for Learning's own wisdom cost.
 */
function effectiveHandSize(engine, ps, pi, heroIdx, triggeringName, triggeringCd) {
  const handLen = (ps.hand || []).length;
  const triggeringWisdom = engine.getWisdomDiscardCost(pi, heroIdx, triggeringCd) || 0;
  const stillResolving = (ps._resolvingCard?.name === triggeringName
    && (ps.hand || []).indexOf(triggeringName) >= 0) ? 1 : 0;
  return Math.max(0, handLen - stillResolving - triggeringWisdom);
}

/**
 * Hand index of the still-resolving triggering Spell, so it's
 * excluded from both the picker's eligible-slot list and the
 * Wisdom-fodder pool. Returns -1 when the triggering Spell isn't
 * currently in hand (defensive — shouldn't happen at
 * `afterSpellResolved` time but keeps the iterators safe).
 */
function triggeringHandIndex(ps, triggeringName) {
  return (ps._resolvingCard?.name === triggeringName)
    ? (ps.hand || []).indexOf(triggeringName)
    : -1;
}

/**
 * Per-name eligibility test — pulled out of the index scan below so a
 * hand with duplicates only re-evaluates each distinct name once.
 * Returns true iff a hand copy of `name` is a legal Learning chain
 * target for this hero, with `wisdomPool` cards available to pay its
 * own discard cost.
 */
function isNameEligibleForLearning(engine, ps, pi, heroIdx, name, requireMagicArts, wisdomPool, heroScript, cardDB) {
  const cd = cardDB[name];
  if (!cd) return false;
  if (cd.cardType !== 'Spell') return false;
  if (requireMagicArts && !isMagicArts(cd)) return false;

  const script = loadCardEffect(name);
  if (!isProactivelyCastable(cd, script)) return false;

  if (!engine.heroMeetsLevelReq(pi, heroIdx, cd)) return false;

  const wisdomCost = engine.getWisdomDiscardCost(pi, heroIdx, cd);
  if (wisdomCost > 0 && wisdomPool < wisdomCost) return false;

  // Hero-level play restriction (e.g. Archibald's per-name dupe ban,
  // Bartas' attack restriction, …).
  if (heroScript?.canPlayCard
      && !heroScript.canPlayCard(engine.gs, pi, heroIdx, cd, engine)) return false;

  // Spell-side custom play condition (Flame Avalanche needs targets,
  // Forbidden Zone needs a free area zone, …).
  if (typeof script?.spellPlayCondition === 'function') {
    try {
      if (!script.spellPlayCondition(engine.gs, pi)) return false;
    } catch (err) {
      console.error(`[Learning] spellPlayCondition for ${name}:`, err.message);
      return false;
    }
  }
  return true;
}

/**
 * Hand indices the player is allowed to click during the Learning
 * pick prompt. Each eligible slot is highlighted in the hand UI;
 * dimmed slots include the still-resolving triggering Spell, any
 * same-name copies of the trigger, non-Spell cards, and Spells the
 * Hero can't legally cast right now. School filter only applies at
 * Lv1 (Magic Arts only). Wisdom affordability is checked against the
 * effective hand size AFTER the triggering Spell finishes resolving
 * (see `effectiveHandSize`), minus one for the chosen Spell itself
 * (which leaves hand before paying its own cost).
 */
function getEligibleHandIndices(engine, ps, pi, heroIdx, level, triggeringName, triggeringCd) {
  const cardDB = engine._getCardDB();
  const hero = ps.heroes?.[heroIdx];
  const heroScript = hero?.name ? loadCardEffect(hero.name) : null;

  const requireMagicArts = level <= 1;
  const effHand = effectiveHandSize(engine, ps, pi, heroIdx, triggeringName, triggeringCd);
  // `effHand` already subtracts the still-resolving triggering Spell
  // and its Wisdom cost. The chosen Spell itself will leave hand to
  // resolve BEFORE its own Wisdom is paid, so it can't fund its own
  // discard — that's the extra `-1` baked into the per-name gate.
  const wisdomPool = Math.max(0, effHand - 1);
  const triggerIdx = triggeringHandIndex(ps, triggeringName);

  const cache = new Map();
  const out = [];

  for (let i = 0; i < (ps.hand || []).length; i++) {
    if (i === triggerIdx) continue;
    const name = ps.hand[i];
    if (name === triggeringName) continue;
    let ok = cache.get(name);
    if (ok === undefined) {
      ok = isNameEligibleForLearning(engine, ps, pi, heroIdx, name, requireMagicArts, wisdomPool, heroScript, cardDB);
      cache.set(name, ok);
    }
    if (ok) out.push(i);
  }
  return out;
}

/**
 * Indices in the player's hand that are valid Wisdom-payment fodder
 * for a Learning cast. Excludes the still-resolving triggering Spell
 * (its instance is owned by the outer doPlaySpell handler — letting
 * the player pick it as Learning's Wisdom would orphan the tracked
 * instance and double-discard the name).
 */
function wisdomPayableIndices(ps, triggeringName) {
  const out = [];
  const skipName = ps._resolvingCard?.name === triggeringName ? triggeringName : null;
  let skipped = false;
  for (let i = 0; i < (ps.hand || []).length; i++) {
    if (skipName && !skipped && ps.hand[i] === skipName) {
      skipped = true; // Skip exactly one instance of the resolving spell
      continue;
    }
    out.push(i);
  }
  return out;
}

/**
 * Drive the chosen hand Spell through chain → onPlay → afterSpellResolved.
 * Mirrors `doPlaySpell` ordering: spell stays in hand through the
 * reaction chain and onPlay (so effects that read `ps.hand` see it),
 * then splice → discard → pay Wisdom. Wisdom is paid AFTER the
 * chosen Spell leaves hand so it can't be self-discarded, AND with
 * the triggering Spell's hand index excluded so it can't be siphoned
 * away from the outer handler that owns its lifecycle.
 */
async function castLearningSpell(engine, pi, heroIdx, hero, cardName, abilityZoneSlot, triggeringName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const cardDB = engine._getCardDB();
  const cd = cardDB[cardName];
  if (!cd) return false;

  // ── Locate the chosen Spell in hand ──
  // Skip the triggering Spell's hand position so a same-name copy of
  // the trigger (which the eligibility filter already excludes by
  // name) can never be silently grabbed in its place. Iterate forward
  // so multi-copy hands consume the first available instance — order
  // doesn't matter functionally, but it keeps animations predictable.
  const triggerIdx = triggeringHandIndex(ps, triggeringName);
  let handIdx = -1;
  for (let i = 0; i < ps.hand.length; i++) {
    if (i === triggerIdx) continue;
    if (ps.hand[i] === cardName) { handIdx = i; break; }
  }
  if (handIdx < 0) return false;

  // ── Action-Phase action-counter bookkeeping ──
  // Learning is gated to the Action Phase, so the chained Spell is
  // the player's next Action of the phase. Mirror the increment the
  // server's `doPlaySpell` performs for normal Action-Phase casts:
  // bump `_actionsPlayedThisPhase` and, when this bump crosses into
  // slot #2, consume any pending `_bonusMainActions` (Torchure's
  // grant). That makes the chained Spell occupy the second-Action
  // slot — Torchure's bonus is spent on Learning's cast rather than
  // being saved for an extra free cast later in the phase.
  // Done AFTER the hand-locate succeeds: same commit timing as the
  // server (post-hero-cost, pre-chain) — once we've claimed the card
  // the cast is committed and counts even if the reaction chain negates.
  if (gs.currentPhase === 3) {
    ps._actionsPlayedThisPhase = (ps._actionsPlayedThisPhase || 0) + 1;
    if (ps._actionsPlayedThisPhase === 2 && (ps._bonusMainActions || 0) > 0) {
      ps._bonusMainActions = 0;
    }
  }

  // Locate the engine's tracked instance for the chosen Spell. The
  // chosen card has been in hand since it was dealt, so a hand
  // instance already exists; we just need to bind it to the casting
  // hero for `ctx.cardHeroIdx` reads inside the Spell's onPlay
  // (Burning Finger, etc.). The eligibility filter already required
  // `cardName !== triggeringName`, so the triggering Spell's tracked
  // instance can't collide here — name match is unambiguous.
  let handInst = null;
  for (let i = engine.cardInstances.length - 1; i >= 0; i--) {
    const c = engine.cardInstances[i];
    if (c.zone === 'hand' && c.owner === pi && c.name === cardName) {
      handInst = c;
      break;
    }
  }
  // Anchor the chosen copy to the casting hero. Without this, Spells
  // that read `ctx.cardHeroIdx` short-circuit on
  // `ps.heroes[-1] = undefined` and silently fizzle while still
  // costing Wisdom.
  if (handInst) handInst.heroIdx = heroIdx;

  // ── Flash on Learning's slot before resolution. ──
  engine._broadcastEvent('ability_activated', {
    owner: pi, heroIdx, zoneIdx: abilityZoneSlot,
  });

  // ── Step 2: reaction window (spell still in hand — Anti Magic
  // Shield / The Master's Plan can negate). ──
  const chainResult = await engine.executeCardWithChain({
    cardName, owner: pi, heroIdx, cardType: cd.cardType, goldCost: 0,
  });

  const wisdomCost = engine.getWisdomDiscardCost(pi, heroIdx, cd);

  /** Find the chosen Spell's current hand position, skipping the
   *  triggering Spell's slot so a same-name copy of the trigger is
   *  never accidentally spliced. Returns -1 when the chosen Spell
   *  has already left hand (placed itself via onPlay, etc.). */
  const findChosenInHand = () => {
    const tIdx = triggeringHandIndex(ps, triggeringName);
    for (let i = 0; i < (ps.hand || []).length; i++) {
      if (i === tIdx) continue;
      if (ps.hand[i] === cardName) return i;
    }
    return -1;
  };

  /** Pay Wisdom for the chosen Spell, excluding the resolving
   *  triggering Spell from the eligible pool. Mirrors doPlaySpell's
   *  "pay AFTER spell leaves hand" rule. */
  const paySearchedWisdom = async () => {
    if (wisdomCost <= 0) return;
    const eligibleIndices = wisdomPayableIndices(ps, triggeringName);
    gs._learningCasting = pi;
    try {
      await engine.actionPromptForceDiscard(pi, wisdomCost, {
        title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
        eligibleIndices,
      });
    } finally {
      delete gs._learningCasting;
    }
  };

  if (chainResult.negated) {
    const i = findChosenInHand();
    if (i >= 0) ps.hand.splice(i, 1);
    ps.discardPile.push(cardName);
    if (handInst) engine._untrackCard(handInst.id);
    await paySearchedWisdom();
    engine.log('learning_spell_negated', {
      player: ps.username, spell: cardName, hero: hero.name,
    });
    return true;
  }

  // ── Step 3: run onPlay / afterSpellResolved. The spell is still
  // physically in hand here (mirrors doPlaySpell). The hand-tracked
  // instance located above is the synth instance the hooks operate on. ──
  gs._immediateActionContext = true;
  gs._learningCasting = pi;
  gs._spellResolutionDepth = (gs._spellResolutionDepth || 0) + 1;
  const hadPriorLog = gs._spellDamageLog !== undefined;
  if (!hadPriorLog) gs._spellDamageLog = [];

  try {
    await engine.runHooks('onPlay', {
      _onlyCard: handInst, playedCard: handInst,
      cardName, zone: 'hand', heroIdx,
      _skipReactionCheck: true,
    });

    if (!gs._spellNegatedByEffect) {
      const uniqueTargets = [];
      const seenIds = new Set();
      for (const t of (gs._spellDamageLog || [])) {
        if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
      }
      await engine.runHooks('afterSpellResolved', {
        spellName: cardName, spellCardData: cd,
        heroIdx, casterIdx: pi,
        damageTargets: uniqueTargets,
        isSecondCast: false,
        _skipReactionCheck: true,
      });
    }
  } catch (err) {
    console.error(`[Learning] cast of "${cardName}" threw:`, err.message);
  } finally {
    gs._spellResolutionDepth = Math.max(0, (gs._spellResolutionDepth || 1) - 1);
    delete gs._immediateActionContext;
    delete gs._learningCasting;
    delete gs._spellNegatedByEffect;
    if (!hadPriorLog) delete gs._spellDamageLog;
  }

  // ── Step 4: splice + discard (or keep on board), then pay Wisdom. ──
  const cancelled = !!gs._spellCancelled;
  const placed = !!gs._spellPlacedOnBoard;
  delete gs._spellCancelled;
  delete gs._spellPlacedOnBoard;

  const ix = findChosenInHand();
  if (ix >= 0) ps.hand.splice(ix, 1);

  if (placed) {
    // Spell placed itself (Areas, Forbidden Zone, …). Whatever zone it
    // moved to owns the instance now — leave it tracked. The hand copy
    // is gone; the placed instance was retracked by the spell's own
    // onPlay handler.
    if (handInst) engine._untrackCard(handInst.id);
  } else if (!cancelled) {
    ps.discardPile.push(cardName);
    if (handInst) engine._untrackCard(handInst.id);
  } else {
    // Cancelled mid-prompt — Archibald-style: HOPT was already claimed
    // when the gallery confirmed, treat it as a fizzled cast and send
    // the chosen Spell to discard so the play isn't refunded.
    ps.discardPile.push(cardName);
    if (handInst) engine._untrackCard(handInst.id);
  }

  await paySearchedWisdom();

  // Treat as additional Action so any onAdditionalActionUsed listeners
  // (Wisdom carryover hooks, etc.) compose normally.
  await engine.runHooks('onAdditionalActionUsed', {
    actionType: 'spell', source: CARD_NAME,
    playerIdx: pi, cardName, heroIdx,
    _skipReactionCheck: true,
  });

  engine.log('learning_cast', {
    player: ps.username, spell: cardName, hero: hero.name, heroIdx,
  });
  engine.sync();
  return true;
}

module.exports = {
  activeIn: ['ability'],

  hooks: {
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) return;

      // Only this Hero's own spell casts, on this player's own turn —
      // "additional Action" only makes sense inside the player's own
      // action window (Cure / Burning Fuse / other proactive Reactions
      // can fire on opp's turn, but Learning's bonus cast can't be
      // performed there).
      if (gs.activePlayer !== pi) return;
      if (ctx.casterIdx !== pi) return;
      if (ctx.heroIdx !== heroIdx) return;
      if (gs._spellNegatedByEffect) return;

      // Action Phase restriction — Learning only triggers off Spells
      // cast in the player's own Action Phase (currentPhase === 3).
      // Main Phase 1/2 Spell casts (Reaction-subtype proactives,
      // Wisdom-cost-zero pre-action utility, …) no longer chain.
      // Casts inside another card's `_immediateActionContext` (e.g.
      // a Learning chain itself, performImmediateAction Spell, etc.)
      // already get filtered out by the `_learningCasting` re-entry
      // guard below.
      if (gs.currentPhase !== 3) return;

      // Re-entry guard — Learning's own cast machinery sets this so
      // the inner spell's afterSpellResolved can't re-trigger Learning
      // mid-resolution. The flag is the caster's player index (0 is
      // valid), so use `!= null` not truthy.
      if (gs._learningCasting != null) return;

      const sd = ctx.spellCardData;
      if (!sd || sd.cardType !== 'Spell') return;
      const triggeringName = ctx.spellName;
      if (!triggeringName) return;

      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const abilityZoneSlot = ctx.card.zoneSlot;
      const level = learningLevelOf(ps, heroIdx, abilityZoneSlot);
      if (level <= 0) return;

      // Trigger predicate: Lv1/Lv2 require the trigger Spell to be
      // Magic Arts; Lv3 accepts any school.
      if (level <= 2 && !isMagicArts(sd)) return;

      // HOPT — per-instance (player + hero + ability slot).
      const hoptKey = `learning:${pi}:${heroIdx}:${abilityZoneSlot}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      const eligibleIndices = getEligibleHandIndices(engine, ps, pi, heroIdx, level, triggeringName, sd);
      if (eligibleIndices.length === 0) return;

      // Claim HOPT BEFORE the prompt — when Learning is stacked in this
      // slot, every copy is its own listener and would otherwise re-prompt
      // after the player cancelled the first picker (claiming HOPT only
      // on confirm meant "cancel" had to be pressed once per stack copy).
      // Claiming up-front means a cancel is final for the slot this turn,
      // matching the player's intuition that one cancel = one decline.
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      // Direct hand-click picker — eligible hand slots are highlighted
      // and clickable; everything else is dimmed. Cancel button is the
      // opt-out. No modal gallery / single-Spell confirm — the player
      // picks straight from their actual hand.
      const result = await engine.promptGeneric(pi, {
        type: 'pickHandCard',
        title: CARD_NAME,
        description: `Choose a Spell from your hand to cast as an additional Action with ${hero.name}.`,
        eligibleIndices,
        cancellable: true,
      });
      if (!result || result.cancelled || result.handIndex == null) return;

      const pickedName = result.cardName || ps.hand[result.handIndex];
      if (!pickedName) return;

      // Re-validate against live state (the prompt is async — the
      // chosen Spell could have left hand via a chained reaction,
      // Wisdom fodder could have shrunk, etc.). Recompute the eligible
      // set and confirm the picked Spell is still in it; this catches
      // both "slot vanished" and "Wisdom no longer affordable" with
      // one check and stays in sync with the picker's filter logic.
      const liveEligible = getEligibleHandIndices(engine, ps, pi, heroIdx, level, triggeringName, sd);
      const stillEligible = liveEligible.some(i => ps.hand[i] === pickedName);
      if (!stillEligible) return;

      await castLearningSpell(engine, pi, heroIdx, hero, pickedName, abilityZoneSlot, triggeringName);
    },
  },
};
