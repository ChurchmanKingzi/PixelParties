// ═══════════════════════════════════════════
//  CARD EFFECT: "Tanuki Escape"
//  Spell (Support Magic Lv0, Normal)
//  Archetype: Rebelliokai
//
//  Effect:
//    Delete 1 "Rebelliokai Timid Tanuki" from
//    your discard pile to play this card. Shuffle
//    up to as many cards from your hand as you
//    have "Rebelliokai" Creatures with different
//    names in your discard pile back into your
//    deck (max 3). Then, search your deck for up
//    to that many cards with different names,
//    reveal them and add them to your hand.
//    Immediately end your turn afterwards.
//
//  House clarifications (per user spec):
//    • Cost (delete Timid Tanuki) is paid AT THE
//      START of onPlay, BEFORE any selection
//      prompts. Tanuki Escape has no target step —
//      its commitment point is the chain-reaction
//      window. Once chains resolve, onPlay fires
//      and the cost is locked in. If the Spell is
//      negated mid-chain, onPlay never runs and
//      the Tanuki stays in discard.
//    • The deleted Tanuki does NOT count toward
//      the bounce-budget scaling (count happens
//      after the cost is paid).
//
//  Wiring:
//    • `spellPlayCondition` gates on a Timid Tanuki
//      sitting in the controller's discard pile.
//      Spell is Lv0 Support Magic — any Hero with
//      Support Magic 0+ can cast.
//    • Cost lives inside `onPlay` (no
//      `payActivationCost`); paid via
//      `payRebelliokaiCost` which performs the
//      visible discard→deleted flying-card
//      animation before resuming the rest of the
//      effect.
//    • Step 1 — direct in-hand click selection via
//      `handPick` (the Leadership / mulligan UX). The
//      player toggles cards in their actual hand
//      strip; selection is by index so picking two
//      copies of the same card name removes two
//      copies (rule: "up to N cards", not "up to N
//      distinct names"). `actionMulliganCards`
//      performs the canonical hand → deck flight
//      animation and the per-card splice, and
//      shuffles afterward.
//    • Step 2 — `cardGalleryMulti` over the player's
//      deck, with name-distinct collapsing AND a
//      filter excluding any names that were just
//      shuffled back (rule: "with different names
//      from each other and from the cards you
//      shuffled back"). Each pick routes through
//      `actionAddCardFromDeckToHand` which fires
//      ON_CARD_ADDED_TO_HAND + the deck-search
//      reveal modal for the opponent.
//    • Step 3 — unconditional turn-end. The Spell
//      sets `gs._spellEndsTurn = true`; server.js's
//      `doPlaySpell` checks this flag right after
//      `_releaseSpellDepth()` and calls
//      `advanceToPhase(pi, PHASES.END)` from there.
//      Calling advanceToPhase from inside onPlay
//      would short-circuit on the
//      `_spellResolutionDepth > 0` guard (the very
//      mechanism that prevents premature turn-ends
//      while a spell is mid-resolve), so the actual
//      advance has to be deferred to the post-
//      resolution window.
// ═══════════════════════════════════════════

const {
  countDifferentRebelliokaiInDiscard,
  isRebelliokaiCreature,
  payRebelliokaiCost,
} = require('./_rebelliokai-shared');

const CARD_NAME    = 'Tanuki Escape';
const COST_NAME    = 'Rebelliokai Timid Tanuki';
const MAX_BOUNCE   = 3;

module.exports = {
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Hand-locked debuff blocks the tutor step (and conceptually the
    // whole effect — the deck-search step is core, mulligan-style
    // shuffle-back also implies hand contents). Grey out in hand.
    if (ps.handLocked) return false;

    const ds = ps.discardPile || [];
    // Cost: at least 1 Tanuki must be in discard to delete.
    const tanukiCount = ds.filter(n => n === COST_NAME).length;
    if (tanukiCount === 0) return false;

    // Bounce-budget feasibility: after deleting one Tanuki, the
    // remaining discard must still contain at least one differently-
    // named Rebelliokai Creature (so the player can shuffle ≥ 1 card
    // back — the new minSelect-1 floor on the hand-pick prompt).
    //   • 2+ Tanukis in discard ⇒ post-cost still has ≥ 1 (Tanuki
    //     itself), regardless of other Rebelliokai. Spell viable.
    //   • exactly 1 Tanuki ⇒ post-cost loses Tanuki entirely; need at
    //     least one OTHER Rebelliokai Creature in the discard.
    if (tanukiCount >= 2) return true;
    return ds.some(n => n !== COST_NAME && isRebelliokaiCreature(n, engine));
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // ── Step 0: pay the cost upfront ──
      // No target step exists for Tanuki Escape, so the chain-reaction
      // window IS the cancellation point. By the time onPlay runs, the
      // Spell is committed — pay the cost before any further prompts.
      // Defensive re-check: a parallel reaction during chain resolution
      // could have shifted the discard pile.
      if ((ps.discardPile || []).indexOf(COST_NAME) < 0) {
        gs._spellCancelled = true;
        return;
      }
      await payRebelliokaiCost(engine, pi, COST_NAME, { source: CARD_NAME });

      // Snap budget AFTER cost was paid — the deleted Tanuki doesn't
      // count toward its own bounce total.
      const budget = Math.min(
        MAX_BOUNCE,
        countDifferentRebelliokaiInDiscard(ps, engine),
      );

      // ── Step 1: shuffle up to `budget` hand cards back into deck ──
      // Direct in-hand click selection (Leadership / mulligan style).
      // `handPick` lets the player click cards in their actual hand
      // strip rather than fishing through a modal gallery. The Spell
      // is already committed (cost paid above), so the prompt is non-
      // cancellable — the player commits 0..cap picks via Confirm.
      // `actionMulliganCards` performs the canonical hand→deck flight
      // animation + per-card splice + post-mulligan shuffle (potions
      // route to the potion deck automatically; only the main-deck
      // fraction interacts with the tutor step).
      let shuffledNames = [];
      if (budget > 0 && (ps.hand || []).length > 0) {
        const cap = Math.min(budget, ps.hand.length);
        const eligibleIndices = ps.hand.map((_, i) => i);
        const handPick = await engine.promptGeneric(pi, {
          type:           'handPick',
          title:          CARD_NAME,
          description:    `Click 1 to ${cap} card${cap === 1 ? '' : 's'} in your hand to shuffle back into your deck.`,
          eligibleIndices,
          maxSelect:      cap,
          minSelect:      1,
          confirmLabel:   '🌀 Shuffle Back',
          cancellable:    false,
        });
        if (handPick && Array.isArray(handPick.selectedCards)) {
          // handPick returns [{ handIndex, cardName }, ...]. Sort by
          // descending handIndex so any name-based splices in the
          // mulligan helper still resolve to the right slot if duplicate
          // names exist (peel right-to-left).
          shuffledNames = [...handPick.selectedCards]
            .sort((a, b) => b.handIndex - a.handIndex)
            .map(s => s.cardName);
        }
      }

      if (shuffledNames.length > 0) {
        await engine.actionMulliganCards(pi, shuffledNames);
        await engine._delay(280);
      }

      // ── Step 2: tutor up to `tutorBudget` differently-named cards ──
      // The rule ties this count to "that many" — i.e. the count actually
      // shuffled back, NOT the original `budget`. If the player chose 0
      // shuffles, they tutor 0 cards (Spell still resolves, cost paid).
      const tutorBudget = shuffledNames.length;
      if (tutorBudget > 0) {
        const cardDB = engine._getCardDB();
        const shuffledSet = new Set(shuffledNames);
        const counts = {};
        for (const cn of (ps.mainDeck || [])) {
          if (!cardDB[cn]) continue;
          // Exclude names just shuffled back (rule: tutored names must
          // differ from each shuffled-back name as well as from each
          // other — `cardGalleryMulti` handles different-from-each-other
          // implicitly via name-collapsed gallery entries).
          if (shuffledSet.has(cn)) continue;
          counts[cn] = (counts[cn] || 0) + 1;
        }
        const deckGallery = Object.entries(counts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, count]) => ({ name, source: 'deck', count }));

        if (deckGallery.length > 0) {
          const cap = Math.min(tutorBudget, deckGallery.length);
          // Mandatory step — by this point the player has already
          // committed to N shuffle-backs. The tutor count is locked to
          // their earlier choice; they pick from 0 to `cap` Creatures
          // (or none, by confirming an empty selection).
          const pickDeck = await engine.promptGeneric(pi, {
            type:         'cardGalleryMulti',
            cards:        deckGallery,
            selectCount:  cap,
            minSelect:    0,
            title:        CARD_NAME,
            description:  `Choose up to ${cap} card${cap === 1 ? '' : 's'} with different names from your deck to add to your hand.`,
            confirmLabel: '🦝 Search!',
            cancellable:  false,
          });
          if (pickDeck && Array.isArray(pickDeck.selectedCards)) {
            for (const name of pickDeck.selectedCards.slice(0, cap)) {
              await engine.actionAddCardFromDeckToHand(pi, name, {
                source: CARD_NAME,
                reveal: true,
              });
            }
            engine.shuffleDeck(pi, 'main');
            engine.sync();
          }
        }
      }

      engine.log('tanuki_escape', {
        player:   ps.username,
        shuffled: shuffledNames.length,
        tutored:  tutorBudget,
      });

      // ── Step 3: request a turn-end after resolution. ──
      // We can't call `advanceToPhase` directly here — its guard short-
      // circuits while `_spellResolutionDepth > 0`, which is the entire
      // duration of onPlay. Instead we set a flag the server-side
      // post-resolution path checks (see `doPlaySpell` in server.js,
      // immediately after `_releaseSpellDepth()`). That path advances
      // to PHASES.END once the spell finishes resolving — matching the
      // rule's "Immediately end your turn afterwards".
      gs._spellEndsTurn = true;
      engine.sync();
    },
  },
};
