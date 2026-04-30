// ═══════════════════════════════════════════
//  CARD EFFECT: "Life-Searcher from the Cosmic Depths"
//  Creature (Summoning Magic Lv3, Normal, 100 HP)
//  Cosmic Depths archetype.
//
//  ON-PLAY (only when summoned by a "Cosmic" card —
//  the summon source must include the literal
//  string "Cosmic" in its name): you may discard
//  a card to search your deck for any "Cosmic
//  Depths" card, reveal it, and add it to your
//  hand. Reads the `_summonedByCosmic` and
//  `_summonedBy` flags injected via hookExtras
//  by Arrival / The Cosmic Depths / etc.
//
//  ACTIVATED (HOPT, Main Phase, gated on ≥3
//  Change Counters across cards you control):
//  shuffle this Creature back into your deck and
//  search the deck for a "Cosmic Depths" Creature
//  EXACTLY 1 LEVEL HIGHER (Lv4) — placed silently
//  into the Support Zone Life-Searcher just left.
//  "Place" semantics: no on-summon hooks fire on
//  the upgraded creature. Lv4 is Invader from the
//  Cosmic Depths; Life-Searcher IS a Cosmic card,
//  so the Invader gate passes.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  COSMIC_DEPTHS_CREATURES, COSMIC_DEPTHS_ANY,
  changeCounterCardsOnSide, getChangeCounters,
  isCosmicCard, canSummonInvaderViaSource,
} = require('./_cosmic-shared');

const CARD_NAME = 'Life-Searcher from the Cosmic Depths';
const HOPT_PREFIX = 'life-searcher-shuffle';
const ANIM_PORTAL = 'cosmic_summon';

function totalChangeCountersOnSide(engine, pi) {
  let total = 0;
  for (const t of changeCounterCardsOnSide(engine, pi)) total += t.count;
  return total;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  // ── ON-PLAY trigger (only via Cosmic card summons) ──
  hooks: {
    onPlay: async (ctx) => {
      // Self-only — onPlay fires for any played card; gate on this inst.
      if (ctx.playedCard?.id !== ctx.card.id) return;
      // Must be summoned BY a Cosmic card (literal "Cosmic" in name).
      // The summoning script passes _summonedByCosmic + _summonedBy in
      // hookExtras; we read either as a fallback.
      const byCosmic = ctx._summonedByCosmic
        || (typeof ctx._summonedBy === 'string' && isCosmicCard(ctx._summonedBy));
      if (!byCosmic) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      if ((ps.hand || []).length === 0) return;

      // Search-target check: any Cosmic Depths card present in the deck.
      const eligible = (ps.mainDeck || []).filter(n => COSMIC_DEPTHS_ANY.has(n));
      if (eligible.length === 0) return;

      // Optional ("you may") — discard cost requires a confirm.
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Discard a card to search your deck for any "Cosmic Depths" card?`,
        showCard: CARD_NAME,
        confirmLabel: '🌌 Discard & Search',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Pay the discard cost (player picks the card to discard).
      await engine.actionPromptForceDiscard(pi, 1, {
        title: `${CARD_NAME} — Discard 1`,
        source: CARD_NAME,
        selfInflicted: true,
      });

      // Re-check post-discard (the discard could have nuked the deck-
      // search target via a discard-replaces-something hook — defensive).
      const stillEligible = (ps.mainDeck || []).filter(n => COSMIC_DEPTHS_ANY.has(n));
      if (stillEligible.length === 0) {
        engine.log('life_searcher_fizzle', { player: ps.username, reason: 'no_target_post_discard' });
        return;
      }

      // Build deduped gallery of CD cards in deck.
      const counts = {};
      for (const n of stillEligible) counts[n] = (counts[n] || 0) + 1;
      const gallery = Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));

      const pick = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: 'Choose a "Cosmic Depths" card to add to your hand.',
        cancellable: false,
      });
      if (!pick?.cardName) return;
      const chosen = pick.cardName;
      const idx = (ps.mainDeck || []).indexOf(chosen);
      if (idx < 0) return;

      ps.mainDeck.splice(idx, 1);
      ps.hand.push(chosen);
      const inst = engine._trackCard(chosen, pi, 'hand');

      engine._broadcastEvent('deck_search_add', { cardName: chosen, playerIdx: pi });
      engine.log('life_searcher_search', { player: ps.username, card: chosen });

      // Universal tutor signal so other hand-add reactors fire.
      await engine.runHooks('onCardAddedToHand', {
        playerIdx: pi, card: inst, cardName: chosen,
      });

      engine.shuffleDeck(pi);
      engine.sync();

      const oi = pi === 0 ? 1 : 0;
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: chosen,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });
    },
  },

  // ── ACTIVATED EFFECT — shuffle back, place lvl+1 in same slot ──
  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = inst.controller ?? inst.owner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // Gate: ≥3 Change Counters across cards we control.
    if (totalChangeCountersOnSide(engine, pi) < 3) return false;

    // Engine HOPT (creature-effect:${id}) handles the once-per-turn
    // gate naturally. No script-level HOPT needed.

    // Need a lvl+1 (= Lv4) CD Creature in deck. Lv4 is Invader, and
    // Life-Searcher IS a Cosmic card, so the Invader gate passes.
    const cardDB = engine._getCardDB();
    const myLvl = cardDB[CARD_NAME]?.level ?? 3;
    const targetLvl = myLvl + 1;
    const upgrades = (ps.mainDeck || []).filter(n => {
      if (!COSMIC_DEPTHS_CREATURES.has(n)) return false;
      const cd = cardDB[n];
      if (!cd || (cd.level ?? 0) !== targetLvl) return false;
      return canSummonInvaderViaSource(n, CARD_NAME);
    });
    if (upgrades.length === 0) return false;
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const pi = inst.controller ?? inst.owner;
    const ps = gs.players[pi];
    if (!ps) return false;

    if (totalChangeCountersOnSide(engine, pi) < 3) return false;

    const cardDB = engine._getCardDB();
    const myLvl = cardDB[CARD_NAME]?.level ?? 3;
    const targetLvl = myLvl + 1;
    const upgrades = (ps.mainDeck || []).filter(n => {
      if (!COSMIC_DEPTHS_CREATURES.has(n)) return false;
      const cd = cardDB[n];
      if (!cd || (cd.level ?? 0) !== targetLvl) return false;
      return canSummonInvaderViaSource(n, CARD_NAME);
    });
    if (upgrades.length === 0) return false;

    const counts = {};
    for (const n of upgrades) counts[n] = (counts[n] || 0) + 1;
    const gallery = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    const pick = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: `Shuffle ${CARD_NAME} back into your deck, then place a Lv${targetLvl} "Cosmic Depths" Creature into the same Support Zone.`,
      cancellable: true,
    });
    if (!pick?.cardName) return false;
    const chosen = pick.cardName;
    if (!upgrades.includes(chosen)) return false;

    // Snapshot Life-Searcher's position BEFORE removing from board.
    const sameHero = inst.heroIdx;
    const sameSlot = inst.zoneSlot;

    // ── Phase 1: Remove Life-Searcher from board, fire onCardLeaveZone,
    //             shuffle into deck ─────────────────────────────────
    const slotArr = (ps.supportZones?.[sameHero] || [])[sameSlot] || [];
    const lsIdx = slotArr.indexOf(CARD_NAME);
    if (lsIdx >= 0) slotArr.splice(lsIdx, 1);

    // Suppress damage-number for the disappearing creature.
    engine._broadcastEvent('creature_zone_move', {
      owner: inst.owner, heroIdx: sameHero, zoneSlot: sameSlot,
    });

    await engine.runHooks('onCardLeaveZone', {
      _onlyCard: inst, card: inst, leavingCard: inst,
      fromZone: 'support',
      fromOwner: inst.owner, fromHeroIdx: sameHero, fromZoneSlot: sameSlot,
      _skipReactionCheck: true,
    });

    engine._untrackCard(inst.id);
    ps.mainDeck.push(CARD_NAME);
    engine.shuffleDeck(pi);

    engine.log('life_searcher_shuffle', { player: ps.username });
    engine.sync();
    await engine._delay(300);

    // ── Phase 2: Place upgrade in the same slot (may have been filled
    //             by another effect mid-resolve) ──────────────────────
    const occupied = ((ps.supportZones?.[sameHero] || [])[sameSlot] || []).length > 0;
    if (occupied) {
      engine.log('life_searcher_fizzle', { player: ps.username, reason: 'slot_occupied' });
      return true;
    }

    const upIdx = (ps.mainDeck || []).indexOf(chosen);
    if (upIdx < 0) {
      engine.log('life_searcher_fizzle', { player: ps.username, reason: 'no_upgrade_post_shuffle' });
      return true;
    }
    ps.mainDeck.splice(upIdx, 1);

    engine._broadcastEvent('deck_search_add', { cardName: chosen, playerIdx: pi });
    engine._broadcastEvent('play_zone_animation', {
      type: ANIM_PORTAL, owner: pi, heroIdx: sameHero, zoneSlot: sameSlot,
    });
    await engine._delay(500);

    // REAL SUMMON — "place" in card text means "summon regardless of
    // level" AND "any Hero's Support Zone (alive/dead/Frozen/Stunned/
    // negated/Bound)". `isPlacement: true` declares this so the engine
    // bypasses the normal-summoning incapacitation gates. Life-Searcher
    // IS a Cosmic card by name, so the cosmic flag is set both for
    // Invader's by-Cosmic gate (the Lv4 upgrade pool includes Invader)
    // and for Cosmic Manipulation's deck-summon reaction window.
    await engine.summonCreatureWithHooks(chosen, pi, sameHero, sameSlot, {
      source: CARD_NAME,
      isPlacement: true,
      hookExtras: {
        _summonedBy: CARD_NAME,
        _summonedByCosmic: true,
        _summonedFromDeck: true,
      },
    });

    engine.log('life_searcher_upgrade', {
      player: ps.username, upgrade: chosen, slot: sameSlot,
    });
    engine.sync();
    return true;
  },
};
