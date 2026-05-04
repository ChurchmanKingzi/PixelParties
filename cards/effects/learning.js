// ═══════════════════════════════════════════
//  CARD EFFECT: "Learning"
//  Ability — Triggered free effect.
//
//  Once per turn, after this Hero used a Spell,
//  search the deck for a different Spell that
//  this Hero can actually use and immediately
//  cast it as an additional Action with this
//  Hero. Filters mirror the in-hand grayout —
//  Surprises and Reactions-without-proactivePlay
//  are excluded, level / Wisdom / hero-restriction
//  / spellPlayCondition gates are honored.
//
//  Tier behavior (cards.json text):
//   1) trigger = Magic Arts; search = Magic Arts.
//   2) trigger = Magic Arts; search = any school.
//   3) trigger = any;        search = any school.
//
//  Implementation notes:
//  • Hooks into `afterSpellResolved` and matches
//    `casterIdx === pi && heroIdx === this hero`.
//  • HOPT key per (player, hero, abilitySlot) so
//    two Learning instances on different heroes
//    fire independently each turn.
//  • Drives the searched Spell exactly the way
//    Cooldin's Area-tutor does: pull deck → hand
//    via the canonical helper (fires
//    ON_CARD_ADDED_TO_HAND), pay Wisdom cost
//    (Archibald-style — committed before chain),
//    open the reaction window, run onPlay +
//    afterSpellResolved synthetically. Discard
//    fallback if the Spell didn't place itself.
//  • Re-entry guarded — nested afterSpellResolved
//    from the searched Spell can't re-trigger
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
 * Build the deduped gallery of Spells in the player's deck that this
 * Hero could legally cast right now, excluding the triggering Spell's
 * name. School filter only applies at Lv1 (Magic Arts only). Wisdom
 * affordability is checked against the effective hand size AFTER the
 * triggering Spell finishes resolving (see `effectiveHandSize`).
 */
function getEligibleDeckSpells(engine, ps, pi, heroIdx, level, triggeringName, triggeringCd) {
  const cardDB = engine._getCardDB();
  const hero = ps.heroes?.[heroIdx];
  const heroScript = hero?.name ? loadCardEffect(hero.name) : null;

  const requireMagicArts = level <= 1;
  const effHand = effectiveHandSize(engine, ps, pi, heroIdx, triggeringName, triggeringCd);

  const seen = new Set();
  const out = [];

  for (const name of (ps.mainDeck || [])) {
    if (seen.has(name)) continue;
    if (name === triggeringName) continue;
    const cd = cardDB[name];
    if (!cd) continue;
    if (cd.cardType !== 'Spell') continue;
    if (requireMagicArts && !isMagicArts(cd)) continue;

    const script = loadCardEffect(name);
    if (!isProactivelyCastable(cd, script)) continue;

    if (!engine.heroMeetsLevelReq(pi, heroIdx, cd)) continue;

    // Wisdom affordability gate. After the triggering Spell finishes,
    // the player has `effHand` cards left. Learning's flow then pulls
    // the searched Spell from deck → hand → splice (so the searched
    // Spell itself can't pay its own wisdom) → pay wisdom → resolve.
    // So the wisdom-payable pool size is exactly `effHand`.
    const wisdomCost = engine.getWisdomDiscardCost(pi, heroIdx, cd);
    if (wisdomCost > 0 && effHand < wisdomCost) continue;

    // Hero-level play restriction (e.g. Archibald's per-name dupe ban,
    // Bartas' attack restriction, …).
    if (heroScript?.canPlayCard
        && !heroScript.canPlayCard(engine.gs, pi, heroIdx, cd, engine)) continue;

    // Spell-side custom play condition (Flame Avalanche needs targets,
    // Forbidden Zone needs a free area zone, …).
    if (typeof script?.spellPlayCondition === 'function') {
      try {
        if (!script.spellPlayCondition(engine.gs, pi)) continue;
      } catch (err) {
        console.error(`[Learning] spellPlayCondition for ${name}:`, err.message);
        continue;
      }
    }

    seen.add(name);
    out.push({ name, source: 'deck' });
  }
  // Stable alphabetical order for the gallery.
  out.sort((a, b) => a.name.localeCompare(b.name));
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
 * Drive the searched Spell through chain → onPlay → afterSpellResolved.
 * Mirrors `doPlaySpell` ordering: spell stays in hand through the
 * reaction chain and onPlay (so effects that read `ps.hand` see it),
 * then splice → discard → pay Wisdom. Wisdom is paid AFTER the
 * searched Spell leaves hand so it can't be self-discarded, AND with
 * the triggering Spell's hand index excluded so it can't be siphoned
 * away from the outer handler that owns its lifecycle.
 */
async function castLearningSpell(engine, pi, heroIdx, hero, cardName, abilityZoneSlot, triggeringName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const cardDB = engine._getCardDB();
  const cd = cardDB[cardName];
  if (!cd) return false;

  // ── Step 1: pull from deck → hand (canonical helper, fires
  // ON_CARD_ADDED_TO_HAND, deck-search reveal modal to opp). ──
  if ((ps.mainDeck || []).indexOf(cardName) < 0) return false;
  const ok = await engine.actionAddCardFromDeckToHand(pi, cardName, {
    source: CARD_NAME,
    reveal: true,
    shuffle: true,
  });
  if (!ok) return false;
  if (ps.hand.lastIndexOf(cardName) < 0) return false;

  // The helper tracked an instance for us — find the LATEST tracked
  // copy (cardInstances appends, so iterate in reverse to grab the
  // freshly added one even if the player already held a same-name copy).
  let handInst = null;
  for (let i = engine.cardInstances.length - 1; i >= 0; i--) {
    const c = engine.cardInstances[i];
    if (c.zone === 'hand' && c.owner === pi && c.name === cardName) {
      handInst = c;
      break;
    }
  }
  // Anchor the searched copy to the casting hero. `actionAddCardFromDeckToHand`
  // tracks with `heroIdx = -1`, but spells that read `ctx.cardHeroIdx` in
  // their `onPlay` (Burning Finger, etc.) need the casting hero's index —
  // matching how `doPlaySpell` tracks normal hand-played spells.
  // Without this, those spells short-circuit on `ps.heroes[-1] = undefined`
  // and silently fizzle while still costing Wisdom.
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

  /** Pay Wisdom for the searched Spell, excluding the resolving
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
    const i = ps.hand.lastIndexOf(cardName);
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
  // instance from Step 1 is the synth instance the hooks operate on. ──
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

  const ix = ps.hand.lastIndexOf(cardName);
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
    // the searched Spell to discard so the deck-search isn't refunded.
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

      const eligible = getEligibleDeckSpells(engine, ps, pi, heroIdx, level, triggeringName, sd);
      if (eligible.length === 0) return;

      // Claim HOPT BEFORE the prompt — when Learning is stacked in this
      // slot, every copy is its own listener and would otherwise re-prompt
      // after the player cancelled the first gallery (claiming HOPT only
      // on confirm meant "cancel" had to be pressed once per stack copy).
      // Claiming up-front means a cancel is final for the slot this turn,
      // matching the player's intuition that one cancel = one decline.
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      // Confirm prompt — single confirm if 1 eligible, gallery if 2+.
      let pickedName = null;
      if (eligible.length === 1) {
        const onlyName = eligible[0].name;
        const confirmed = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          message: `Search your deck for ${onlyName} and cast it as an additional Action with ${hero.name}?`,
          showCard: onlyName,
          confirmLabel: '📚 Cast!',
          cancelLabel: 'No',
          cancellable: true,
        });
        if (confirmed) pickedName = onlyName;
      } else {
        const result = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: eligible,
          title: CARD_NAME,
          description: `Search your deck for a Spell to cast as an additional Action with ${hero.name}.`,
          confirmLabel: '📚 Cast!',
          cancellable: true,
        });
        if (result && !result.cancelled && result.cardName) pickedName = result.cardName;
      }

      if (!pickedName) return;

      // Re-validate against live state (the prompt is async — Wisdom
      // hand could have shrunk, name could have left the deck via a
      // chained reaction, etc.). Wisdom check uses the same effective
      // hand size the eligibility filter used.
      if ((ps.mainDeck || []).indexOf(pickedName) < 0) return;
      const cardDB = engine._getCardDB();
      const cd = cardDB[pickedName];
      if (!cd || cd.cardType !== 'Spell') return;
      if (level <= 1 && !isMagicArts(cd)) return;
      if (pickedName === triggeringName) return;
      if (!engine.heroMeetsLevelReq(pi, heroIdx, cd)) return;
      const wisdomCost = engine.getWisdomDiscardCost(pi, heroIdx, cd);
      const effHand = effectiveHandSize(engine, ps, pi, heroIdx, triggeringName, sd);
      if (wisdomCost > 0 && effHand < wisdomCost) return;

      await castLearningSpell(engine, pi, heroIdx, hero, pickedName, abilityZoneSlot, triggeringName);
    },
  },
};
