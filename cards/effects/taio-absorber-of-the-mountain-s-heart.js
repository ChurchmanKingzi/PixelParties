// ═══════════════════════════════════════════
//  CARD EFFECT: "Taio, Absorber of the Mountain's Heart"
//  Ascended Hero — 600 HP / 120 ATK
//  Starting abilities (printed): Fighting 3 + Destruction Magic 3
//
//  Ascension condition (enforced by `taio-the-sun-fencer.js`):
//    • Base Taio is "Taio, the Sun Fencer"
//    • The Sun Sword equipped
//    • Has defeated an opp Hero with an Attack or Destruction Magic
//      Spell this game (persistent flag set by Sun Fencer's onHeroKO).
//
//  Effect (once per turn, during your turn):
//    When this Hero performs an Attack or Destruction Magic Spell,
//    it may immediately perform a Destruction Magic Spell or Attack
//    (whichever it didn't use) from your deck or hand as an
//    additional Action.
//
//  Wiring:
//    • Ascension bonus: `performAscensionBonus(['Fighting',
//      'Destruction Magic'])` tops the existing Fighting stack to
//      3 and installs Destruction Magic up to 3 in the next free
//      slot. Mirrors Arthor Inheritor / every other Ascended Hero
//      that uses the canonical engine helper.
//    • Trigger: `afterSpellResolved` — fires after Spell/Attack
//      resolution (parity with Bartas, Archibald, etc.). Gated to:
//        - own turn (`isMyTurn`),
//        - cast by THIS hero (`casterIdx + heroIdx` match),
//        - cardType Attack OR Spell with Destruction Magic school,
//        - `isSecondCast: false` (defense against re-entry — HOPT
//          already blocks but the flag keeps the intent obvious).
//    • Candidate pool: every Attack / DM Spell of the OPPOSITE type
//      in `mainDeck` + `hand` that this Hero meets the level req
//      for. Dedup BY NAME in the gallery (hand first; deck adds
//      uniques). The cast pulls the chosen name from hand if
//      available, else from deck (and shuffles).
//    • Prompt is cancellable — HOPT is claimed only on accept so a
//      decline doesn't burn the turn's slot.
//    • Resolution: synthesize a hand-zone CardInstance and fire
//      `onPlay` + `afterSpellResolved` exactly like
//      `engine.performImmediateAction`'s Spell/Attack branch.
//      `_immediateActionContext` + `_spellResolutionDepth` are
//      bumped so the cast resolves like a real additional Action
//      (no main-action consumption, end-turn gated). Pushed to
//      discard + untracked at the end.
//    • Wisdom (level-gap) cost is paid via
//      `getWisdomDiscardCost` + `actionPromptForceDiscard` — the
//      same contract Archibald and `performImmediateAction` use,
//      so a Spell that would normally need Wisdom coverage still
//      pays its cost here.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Taio, Absorber of the Mountain\'s Heart';
const HOPT_KEY  = 'taio-mountains-heart-followup';

module.exports = {
  activeIn: ['hero'],

  async onAscensionBonus(engine, pi, heroIdx) {
    await engine.performAscensionBonus(pi, heroIdx, ['Fighting', 'Destruction Magic']);
  },

  hooks: {
    afterSpellResolved: async (ctx) => {
      if (ctx.isSecondCast) return;          // defense against trigger recursion
      if (!ctx.isMyTurn) return;
      if (ctx.casterIdx !== ctx.cardOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;

      const spellData = ctx.spellCardData;
      if (!spellData) return;
      const justCast = _classifyCast(spellData);
      if (!justCast) return;                 // not an Attack or DM Spell

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;

      // Don't fire if the HOPT is already spent — but don't CLAIM
      // it yet (we only burn the slot on accept, not on decline).
      const hoptStorageKey = `${HOPT_KEY}:${pi}`;
      if (gs.hoptUsed?.[hoptStorageKey] === gs.turn) return;

      // Build the candidate list — opposite type, from deck + hand,
      // playable by this Hero (level + school via heroMeetsLevelReq).
      const targetType = justCast === 'Attack' ? 'DMSpell' : 'Attack';
      const candidates = _collectCandidates(engine, pi, heroIdx, targetType);
      if (candidates.length === 0) return;

      const galleryCards = candidates.map(c => ({
        name: c.name, source: c.source,
      }));

      const result = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: galleryCards,
        title: CARD_NAME,
        description: `${hero.name} just performed ${justCast === 'Attack' ? 'an Attack' : 'a Destruction Magic Spell'}! `
          + `You may pick ${targetType === 'Attack' ? 'an Attack' : 'a Destruction Magic Spell'} `
          + 'from your deck or hand to perform as an additional Action.',
        cancelLabel: 'Skip',
        cancellable: true,
      });

      if (!result || result.cancelled || !result.cardName) return;

      // Resolve the pick. Hand takes priority over deck — if the
      // chosen name exists in both, we don't shuffle the deck
      // unnecessarily.
      const pickedName = result.cardName;
      const picked = candidates.find(c => c.name === pickedName && c.source === 'hand')
                  || candidates.find(c => c.name === pickedName);
      if (!picked) return;

      // Claim HOPT NOW (the prompt was accepted).
      engine.claimHOPT(HOPT_KEY, pi);

      await _castAsAdditionalAction(engine, pi, heroIdx, picked);
    },
  },
};

// ═══════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════

/** Returns 'Attack' | 'DMSpell' | null. */
function _classifyCast(cd) {
  if (!cd) return null;
  if (cd.cardType === 'Attack') return 'Attack';
  if (cd.cardType === 'Spell') {
    if (cd.spellSchool1 === 'Destruction Magic' || cd.spellSchool2 === 'Destruction Magic') {
      return 'DMSpell';
    }
  }
  return null;
}

/**
 * Test whether `cd` matches the requested follow-up `kind`.
 * 'Attack'   → cardType === 'Attack'
 * 'DMSpell'  → cardType === 'Spell' and either spellSchool is
 *              Destruction Magic.
 */
function _matchesKind(cd, kind) {
  if (!cd) return false;
  if (kind === 'Attack') return cd.cardType === 'Attack';
  return cd.cardType === 'Spell'
      && (cd.spellSchool1 === 'Destruction Magic' || cd.spellSchool2 === 'Destruction Magic');
}

/**
 * Build the deck+hand candidate list of opposite-type plays. Hand
 * entries first (deck dedup skips names already added from hand);
 * each entry is `{ name, source: 'hand' | 'deck' }`. Filter by
 * `heroMeetsLevelReq` so the player doesn't see un-castable picks.
 */
function _collectCandidates(engine, pi, heroIdx, kind) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const out = [];
  const seen = new Set();

  // Hand candidates — delegate to the canonical action-eligibility
  // helper. `getHeroEligibleActionCards` already runs the full gate
  // set (heroMeetsLevelReq + spellPlayCondition + Wisdom hand-cost +
  // Reaction-subtype gate + oncePerGame + per-hero action lock /
  // action limit), so we just intersect its hand-pool with the kind
  // filter. This is what fixes Flame Avalanche etc. from appearing
  // when their `spellPlayCondition` would refuse the cast.
  const handEligible = engine.getHeroEligibleActionCards(pi, heroIdx) || [];
  for (const name of handEligible) {
    if (seen.has(name)) continue;
    const cd = cardDB[name];
    if (!_matchesKind(cd, kind)) continue;
    seen.add(name);
    out.push({ name, source: 'hand' });
  }

  // Deck candidates — `getHeroEligibleActionCards` only walks hand,
  // so for the deck pool we replicate the same per-card gates
  // manually. Order mirrors the helper's checks so future additions
  // to the eligibility contract stay easy to backport here.
  for (const name of ps.mainDeck || []) {
    if (seen.has(name)) continue;
    const cd = cardDB[name];
    if (!cd) continue;
    if (!_matchesKind(cd, kind)) continue;
    const script = loadCardEffect(name);
    // Reaction subtype is not proactively castable unless opted in.
    if ((cd.subtype || '').toLowerCase() === 'reaction'
        && !script?.proactivePlay) continue;
    if (!engine.heroMeetsLevelReq(pi, heroIdx, cd)) continue;
    if (cd.cardType === 'Spell') {
      // Wisdom-cost affordability. For a deck card the cast doesn't
      // remove a slot from hand the way a hand-played Spell does,
      // so the full hand counts toward paying the cost.
      const wisdomCost = engine.getWisdomDiscardCost(pi, heroIdx, cd);
      if (wisdomCost > 0 && (ps.hand || []).length < wisdomCost) continue;
    }
    if (script?.oncePerGame) {
      const opgKey = script.oncePerGameKey || name;
      if (ps._oncePerGameUsed?.has(opgKey)) continue;
    }
    if (script?.spellPlayCondition
        && !script.spellPlayCondition(engine.gs, pi, engine)) continue;
    seen.add(name);
    out.push({ name, source: 'deck' });
  }
  return out;
}

/**
 * Pull the chosen card from its source pile and resolve it as an
 * additional Action with Taio. Mirrors `performImmediateAction`'s
 * Spell/Attack branch — the only deviation is the optional `deck`
 * source (splice from `mainDeck` + shuffle reveal).
 *
 * Wisdom (level-gap) cost is paid BEFORE `onPlay` runs so a
 * mid-cast turn-end can't skip it. The card is NOT pushed back to
 * hand on cancel — Mountain's Heart's prompt is the commitment
 * point. The synth-inst is untracked + the card pushed to discard
 * regardless of how onPlay terminates.
 */
async function _castAsAdditionalAction(engine, pi, heroIdx, picked) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const cardDB = engine._getCardDB();
  const cardName = picked.name;
  const cardData = cardDB[cardName];
  if (!cardData) return;

  // Pull from source pile.
  if (picked.source === 'hand') {
    const idx = ps.hand.indexOf(cardName);
    if (idx < 0) return;                   // raced — bail
    ps.hand.splice(idx, 1);
  } else {
    const idx = ps.mainDeck.indexOf(cardName);
    if (idx < 0) return;
    ps.mainDeck.splice(idx, 1);
    engine._broadcastEvent('deck_search_add', { cardName, playerIdx: pi });
    engine.shuffleDeck(pi, 'main');
    // Reveal to opp — standard etiquette for deck-search casts.
    const oi = pi === 0 ? 1 : 0;
    try {
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });
    } catch { /* opp side may not be promptable in puzzle/CPU — best-effort */ }
  }

  const inst = engine._trackCard(cardName, pi, 'hand', heroIdx, -1);

  // Wisdom cost (Spells only — Attacks don't carry one).
  if (cardData.cardType === 'Spell') {
    const wisdomCost = engine.getWisdomDiscardCost(pi, heroIdx, cardData);
    if (wisdomCost > 0) {
      await engine.actionPromptForceDiscard(pi, wisdomCost, {
        title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
      });
    }
  }

  gs._immediateActionContext = true;
  const hadPriorLog = gs._spellDamageLog !== undefined;
  if (!hadPriorLog) gs._spellDamageLog = [];
  gs._spellResolutionDepth = (gs._spellResolutionDepth || 0) + 1;

  try {
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst, cardName,
      zone: 'hand', heroIdx, _skipReactionCheck: true,
    });
    delete gs._immediateActionContext;

    if (!gs._spellNegatedByEffect) {
      const uniqueTargets = [];
      const seenIds = new Set();
      for (const t of (gs._spellDamageLog || [])) {
        if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
      }
      await engine.runHooks('afterSpellResolved', {
        spellName: cardName, spellCardData: cardData,
        heroIdx, casterIdx: pi,
        damageTargets: uniqueTargets,
        // Mark as second-cast so this card's own trigger ignores
        // it — belt-and-suspenders alongside the HOPT.
        isSecondCast: true,
        _skipReactionCheck: true,
      });
    }
    if (!hadPriorLog) delete gs._spellDamageLog;
    delete gs._spellNegatedByEffect;
  } finally {
    gs._spellResolutionDepth = Math.max(0, (gs._spellResolutionDepth || 1) - 1);
  }

  ps.discardPile.push(cardName);
  engine._untrackCard(inst.id);
  engine.log('taio_mountains_heart_followup', {
    player: ps.username, card: cardName, source: picked.source,
  });
  engine.sync();
}
