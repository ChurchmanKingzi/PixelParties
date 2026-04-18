// ═══════════════════════════════════════════
//  CARD EFFECT: "Mass Multiplication"
//  Spell (Magic Arts Lv1, Normal)
//  Pollution archetype.
//
//  Place 1 Pollution Token into your free Support
//  Zone to play this card.
//  Delete a card from your hand OR your discard pile
//  and add up to 3 copies of it from your deck to
//  your hand.
//
//  The chosen card is sent to the Deleted pile
//  (permanent) — it's not recoverable afterwards.
//
//  Gating:
//    • Card must have at least 1 copy in the deck
//      (otherwise it can't be multiplied). Cards
//      without any copies left in the deck are
//      filtered out of the gallery, and the spell
//      grays out in hand when no hand/discard card
//      has any deck copies.
//    • Counts as an "add from deck to hand" effect,
//      so it's blocked by hand-lock (the engine's
//      blockedByHandLock flag handles this) and
//      fires the ON_CARD_ADDED_TO_HAND hook for
//      every copy pulled — staggered one-by-one
//      with the standard deck-search animation so
//      each arrival is individually visible.
// ═══════════════════════════════════════════

const { placePollutionTokens, hasFreeZone } = require('./_pollution-shared');
const { HOOKS } = require('./_hooks');

const MAX_COPIES = 3;

/**
 * Build a count map (name → copies) of the caster's main deck. Used by both
 * spellPlayCondition (gray out when nothing multipliable) and onPlay (gallery
 * filter + copy limit).
 */
function deckCountMap(ps) {
  const map = {};
  for (const n of (ps?.mainDeck || [])) map[n] = (map[n] || 0) + 1;
  return map;
}

module.exports = {
  placesPollutionTokens: true,
  // "Add from deck to hand" effect — respect the hand-lock debuff. Engine's
  // validateActionPlay rejects the cast entirely when this is set and the
  // caster's hand is locked, matching the gray-out state.
  blockedByHandLock: true,

  spellPlayCondition(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if (!hasFreeZone(gs, pi)) return false;

    // At least one card the player could pick (hand excluding this spell, or
    // discard pile) must also have ≥1 copy still in the deck.
    const deckCounts = deckCountMap(ps);

    // Hand: we need to eventually be able to pick "some other card" — this
    // spell takes itself out when played, so a second hand card is needed
    // unless the source is in discard.
    for (const n of (ps.hand || [])) {
      if (n === 'Mass Multiplication') continue;
      if ((deckCounts[n] || 0) > 0) return true;
    }
    for (const n of (ps.discardPile || [])) {
      if ((deckCounts[n] || 0) > 0) return true;
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // ── Pay cost: 1 Pollution Token FIRST ──
      await placePollutionTokens(engine, pi, 1, 'Mass Multiplication', { promptCtx: ctx });

      // ── Build the gallery ──
      // Include a hand/discard card only if it has at least one copy still
      // in the deck — otherwise it can't be multiplied, so offering it would
      // be misleading. Dedupe + annotate with source so deletion is unambiguous.
      const deckCounts = deckCountMap(ps);

      const handCountMap = {};
      for (const name of (ps.hand || [])) {
        if (name === ctx.cardName) continue; // Exclude the Mass Multiplication we're playing
        if ((deckCounts[name] || 0) === 0) continue; // No deck copies → not multipliable
        handCountMap[name] = (handCountMap[name] || 0) + 1;
      }
      const discardCountMap = {};
      for (const name of (ps.discardPile || [])) {
        if ((deckCounts[name] || 0) === 0) continue;
        discardCountMap[name] = (discardCountMap[name] || 0) + 1;
      }

      const gallery = [];
      for (const [name, count] of Object.entries(handCountMap)) {
        gallery.push({ name, source: 'hand', count });
      }
      for (const [name, count] of Object.entries(discardCountMap)) {
        gallery.push({ name, source: 'discard', count });
      }
      gallery.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));

      if (gallery.length === 0) {
        engine.log('mass_multiplication_fizzle', {
          player: ps.username, reason: 'no_source_card',
        });
        return;
      }

      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: 'Mass Multiplication',
        description: 'Delete a card from your hand or discard pile. Up to 3 copies will be pulled from your deck.',
        cancellable: true,
      });
      if (!picked || picked.cancelled) {
        gs._spellCancelled = true;
        return;
      }

      const chosenName = picked.cardName;
      const chosenSource = picked.source || 'hand';

      // ── Resolve the actual source pile for the chosen card ──
      // Prefer the picked pile, fall back to the other if the card somehow
      // drifted between prompt-open and resolve (extremely unlikely here,
      // since nothing else runs between them, but defensive).
      let actualSource = null;
      if (chosenSource === 'hand' && ps.hand.includes(chosenName)) actualSource = 'hand';
      else if (chosenSource === 'discard' && ps.discardPile.includes(chosenName)) actualSource = 'discard';
      else if (ps.hand.includes(chosenName)) actualSource = 'hand';
      else if (ps.discardPile.includes(chosenName)) actualSource = 'discard';
      if (!actualSource) {
        engine.log('mass_multiplication_fizzle', {
          player: ps.username, reason: 'chosen_card_missing',
        });
        return;
      }

      // ══════════════════════════════════════════════════════════════
      //  STAGGERED CLEANUP — visualize each move before the draws start.
      //  Auto-hand-to-pile animations fire only when the hand shrinks
      //  AND the destination pile grows within one sync burst. Doing
      //  Mass Multiplication's move and the source-card move in ONE sync
      //  confuses that detection (the discard pile can net-zero if MM is
      //  added at the same time the chosen source is removed from it),
      //  so we do them in two separate sync+delay steps. The
      //  discard→deleted case can't be auto-detected at all (the system
      //  watches hand→pile, not pile→pile), so that one broadcasts a
      //  custom `play_pile_transfer` event.
      // ══════════════════════════════════════════════════════════════

      // ── Move 1: Mass Multiplication → discard ──
      // Do this manually so it's visibly out before the draws start.
      // Clearing `_resolvingCard` afterwards makes the server's standard
      // post-`onPlay` cleanup no-op on this card (getResolvingHandIndex
      // returns -1 → hand-splice and discard-push branches skipped). The
      // fallback `_untrackCard` in that block is idempotent with ours.
      const selfIdx = ps.hand.indexOf(ctx.cardName);
      if (selfIdx >= 0) {
        ps.hand.splice(selfIdx, 1);
        if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
        ps.discardPile.push(ctx.cardName);
        engine._untrackCard(ctx.card.id);
      }
      ps._resolvingCard = null;
      engine.sync();
      await engine._delay(450); // Let the hand → discard auto-animation play.

      // ── Move 2: Source card → deleted pile ──
      // Hand-sourced: splice from hand and push to deleted — the client's
      // auto-animation picks this up (hand shrank, deleted grew).
      // Discard-sourced: fire the custom pile-to-pile animation first
      // since the client can't infer discard→deleted from state diff.
      if (actualSource === 'discard') {
        engine._broadcastEvent('play_pile_transfer', {
          owner: pi, cardName: chosenName, from: 'discard', to: 'deleted',
        });
        const idx = ps.discardPile.indexOf(chosenName);
        if (idx >= 0) ps.discardPile.splice(idx, 1);
      } else {
        const idx = ps.hand.indexOf(chosenName);
        if (idx >= 0) ps.hand.splice(idx, 1);
      }
      if (!ps.deletedPile) ps.deletedPile = [];
      ps.deletedPile.push(chosenName);

      engine.log('mass_multiplication_delete', {
        player: ps.username, card: chosenName, from: actualSource,
      });

      engine.sync();
      await engine._delay(450); // Let the source → deleted animation play.

      // ── Pull up to 3 copies from the deck, ONE BY ONE ──
      // Hand-lock might have been applied mid-effect by a reaction chain,
      // so we re-check per-iteration before each add. Matches the engine's
      // own actionDrawCards treatment of handLocked as a hard stop.
      const deck = ps.mainDeck || [];
      const targetCount = Math.min(MAX_COPIES, deckCounts[chosenName] || 0);
      let added = 0;
      for (let k = 0; k < targetCount; k++) {
        if (ps.handLocked) {
          engine.log('mass_multiplication_handlock', { player: ps.username, remaining: targetCount - k });
          break;
        }
        // Find the next copy in the deck (scan from the end for stable
        // behavior when the same card is duplicated).
        const copyIdx = deck.lastIndexOf(chosenName);
        if (copyIdx < 0) break;

        deck.splice(copyIdx, 1);
        ps.hand.push(chosenName);
        added++;

        // Deck-search reveal animation for THIS copy, then yield so each
        // card visibly arrives one after another.
        engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: pi });
        engine.log('card_added_to_hand', {
          card: chosenName, player: ps.username, by: 'Mass Multiplication',
        });

        // Fire the generic "card was added to hand from deck" hook per
        // arrival so future tutor-reactive cards can plug in cleanly.
        const inst = engine._trackCard(chosenName, pi, 'hand');
        await engine.runHooks(HOOKS.ON_CARD_ADDED_TO_HAND, {
          playerIdx: pi, card: inst, cardName: chosenName,
          source: 'Mass Multiplication', _skipReactionCheck: true,
        });

        engine.sync();
        if (k < targetCount - 1) await engine._delay(500);
      }

      if (added > 0) {
        // Shuffle the deck since we removed specific entries.
        engine.shuffleDeck(pi, 'main');
      }

      engine.log('mass_multiplication', {
        player: ps.username, card: chosenName, copies: added,
      });
      engine.sync();

      // Reveal the chosen card to the opponent (deck-search convention).
      if (added > 0) {
        const oi = pi === 0 ? 1 : 0;
        await engine.promptGeneric(oi, {
          type: 'deckSearchReveal',
          cardName: chosenName,
          searcherName: ps.username,
          title: 'Mass Multiplication',
          cancellable: false,
        });
      }
    },
  },
};
