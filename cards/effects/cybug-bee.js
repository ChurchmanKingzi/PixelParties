// ═══════════════════════════════════════════
//  CARD EFFECT: "Cybug BEE"
//  Creature (Summoning Magic Lv1, Surprise) — 10 HP
//
//  "Activate this Surprise when your opponent would add a card from
//   their deck to their hand by deleting 1 "Magnetic Glove" from
//   your hand or deck. Add the card your opponent searched to your
//   hand instead and place this Creature into one of the user's
//   free Support Zones. When this Creature is defeated, add a
//   "Magnetic Glove" from your discard pile to your hand."
//
//  Mechanics
//  ─────────
//   • Pre-search interrupt: hooks the engine's pre-deck-search
//     Surprise window (`surpriseBeforeOppDeckSearchTrigger`). Fires
//     INSIDE `actionAddCardFromDeckToHand` BEFORE the searched card
//     is spliced from opp's deck. Returning
//     `{ searchRedirected: true }` from `onSurpriseActivate` aborts
//     the original tutor — the Cybug BEE script moved the card to
//     its controller's hand itself, so the original caller does
//     nothing further.
//   • Activation cost: delete 1 "Magnetic Glove" from controller's
//     hand (preferred) or deck. The trigger gate refuses to prompt
//     without an available copy.
//   • Cross-side card transfer: opp's mainDeck → controller's hand,
//     animated via a zone-anchored `play_pile_transfer` with
//     `fromOwner`/`toOwner`. Opp's deck is reshuffled after the
//     splice — matches the search-and-reveal convention used by
//     every other deck-search path.
//   • Placement: standard Creature-Surprise — the engine's
//     `_activateSurprise` disposition places Cybug BEE into the
//     host Hero's first free Support Zone after `onSurpriseActivate`
//     returns.
//   • On-death recovery: pull 1 Magnetic Glove from discard to
//     hand, filtered to THIS specific Cybug BEE instance via
//     `instId` so multiple Cybugs don't trigger each other.
//   • Telekinesis disallowed: no real triggering search to redirect.
// ═══════════════════════════════════════════

const { ZONES } = require('./_hooks');
const { deleteCybugFuel, recoverCybugFuel, hasCybugFuel } = require('./_cybug-shared');

const CARD_NAME = 'Cybug BEE';
const FUEL_CARD = 'Magnetic Glove';

module.exports = {
  isSurprise: true,
  activeIn: ['surprise', 'support'],

  canTelekinesisActivate: false,

  /**
   * Trigger: opp is about to add a named card from their deck to
   * their hand AND the controller can pay the Magnetic Glove cost.
   */
  surpriseBeforeOppDeckSearchTrigger(gs, ownerIdx, heroIdx, searchInfo, engine) {
    if (!searchInfo || searchInfo.searcher === ownerIdx) return false;
    if (!searchInfo.cardName) return false;
    // Hand-locked controllers can't fulfil "add the card to your
    // hand instead" — refuse to prompt so cost isn't wasted.
    if (gs.players[ownerIdx]?.handLocked) return false;
    return hasCybugFuel(gs, ownerIdx, FUEL_CARD);
  },

  /**
   * Pay the Magnetic Glove cost → steal the searched card from opp's
   * deck into the controller's hand. Returning
   * `{ searchRedirected: true }` aborts opp's tutor.
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return null;

    const searchedCard = sourceInfo?.cardName;
    const oppIdx = sourceInfo?.searcher;
    if (!searchedCard || oppIdx == null || oppIdx === pi) return null;
    const oppPs = gs.players[oppIdx];
    if (!oppPs) return null;

    // Hand-lock guard — `surpriseBeforeOppDeckSearchTrigger` already
    // rejects when locked, but a race (Friendship Lv1 etc. locking
    // mid-prompt) could leave us mismatched. Bail BEFORE paying so
    // no Magnetic Glove is wasted on a redirect that can't land.
    if (ps.handLocked) return null;

    // Pay cost first — if a race emptied the Magnetic Glove between
    // the trigger and now, refuse the steal cleanly so the original
    // search still resolves.
    const paid = await deleteCybugFuel(engine, pi, FUEL_CARD);
    if (!paid) return null;

    // Locate the named card in opp's deck (the caller's
    // `actionAddCardFromDeckToHand` already verified presence, but
    // re-check defensively).
    const deckIdx = (oppPs.mainDeck || []).indexOf(searchedCard);
    if (deckIdx < 0) return null;

    // Cross-side flight: opp's deck pile → my hand. The renderer
    // looks up the deck rect on opp's side (fromOwner) and the
    // hand rect on my side (toOwner), so the card visibly travels
    // across the table.
    //
    // BOTH `toHandIdx` AND `finalHandSize` are required for the
    // renderer's hand-landing projection to compute the correct
    // final slot position (the hand re-centers when a card is
    // added). Without `toHandIdx` the lookup falls back to the
    // hand container's geometric centre — the card visually lands
    // at the middle of the row instead of at its actual new slot.
    // The card is pushed to the END of the hand, so the landing
    // index is `ps.hand.length` BEFORE the push.
    const toHandIdx = (ps.hand?.length || 0);
    engine._broadcastEvent('play_pile_transfer', {
      fromOwner: oppIdx, toOwner: pi,
      cardName: searchedCard,
      from: 'deck', to: 'hand',
      toHandIdx,
      finalHandSize: toHandIdx + 1,
    });

    // Splice from opp's deck, push to controller's hand, track the
    // inst as an in-hand card on the controller's side.
    oppPs.mainDeck.splice(deckIdx, 1);
    if (oppPs.deckTopVisible && oppPs.deckTopVisible.length > 0
        && deckIdx === 0) {
      oppPs.deckTopVisible.shift();
    }
    if (!ps.hand) ps.hand = [];
    ps.hand.push(searchedCard);
    engine._trackCard(searchedCard, pi, ZONES.HAND);

    // Shuffle opp's deck post-search (standard search ritual).
    engine.shuffleDeck(oppIdx, 'main');

    engine.log('cybug_bee_steal', {
      player: ps.username,
      card: searchedCard,
      from: oppPs.username,
    });
    engine.sync();

    return { searchRedirected: true };
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || !ctx.card) return;
      if (death.instId !== ctx.card.id) return;
      const pi = death.owner;
      await recoverCybugFuel(ctx._engine, pi, FUEL_CARD, CARD_NAME);
    },
  },
};
