// ═══════════════════════════════════════════
//  CARD EFFECT: "Kassaran, Seer of Everything"
//  Hero — Multi-use Hero Effect
//
//  "You may up to 3 times per turn declare a card
//   name and reveal the top card of your deck. If
//   it has the declared name, add it to your
//   hand, otherwise negate this effect for the
//   rest of the turn. This effect ignores any
//   effects that would prevent you from drawing
//   cards."
//
//  Implementation notes:
//   • Multi-use vs. standard heroEffect — engine
//     auto-stamps HOPT on truthy return from
//     onHeroEffect, which would gate re-activation
//     to once per turn. We always return false to
//     skip that stamp, manage our own per-turn use
//     count on the hero (`_kassaranUsesThisTurn`),
//     and gate via `canActivateHeroEffect`. The
//     pending reveal/log are fired manually before
//     the false-return so opp still sees the
//     activation on the second & third uses.
//   • Mismatch lock-out — a wrong call sets
//     `_kassaranNegatedThisTurn` on the hero; the
//     activation gate refuses subsequent uses
//     until the next owner turn. Both flags clear
//     on `onTurnStart` for the owner.
//   • Hand-lock bypass — match path uses
//     `actionAddCardFromDeckToHand(.. _bypassHandLock: true)`
//     so Kazena / Pollution / future hand-locks
//     can't gate the matched draw. The effect
//     itself doesn't draw on mismatch, so no
//     bypass is needed there.
//   • Reveal channel — both match and miss fire a
//     `kassaran_reveal_flip` broadcast that drives
//     a custom client-side animation: the top card
//     flies to viewport center, flips face-up,
//     holds, then continues to the destination
//     (hand on match, back to deck top on miss).
//     The animation IS the stream — no popup, no
//     deck_search_add. The match path then mutates
//     hand state directly (with the
//     pileTransferToHandPending suppressor on the
//     client absorbing the auto-draw-anim that
//     would otherwise double-fire on the upcoming
//     hand-grew sync). The miss path pushes the
//     revealed name into `deckTopVisible` so the
//     card renders semi-transparently on top of
//     the deck pile (same Premonition mechanic).
// ═══════════════════════════════════════════

const CARD_NAME = 'Kassaran, Seer of Everything';
const MAX_USES_PER_TURN = 3;

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  /**
   * Gate: hero alive (engine pre-checks), used < 3 times this turn,
   * not negated this turn, deck has at least 1 card to reveal.
   * Engine's standard alive / not-frozen / not-stunned / HOPT checks
   * still apply on top — HOPT is never stamped (we always return
   * false), so it never gates us out.
   */
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    const hero = ctx.attachedHero;
    if (!hero) return false;
    if (hero._kassaranNegatedThisTurn) return false;
    if ((hero._kassaranUsesThisTurn || 0) >= MAX_USES_PER_TURN) return false;
    // Hand-locked is NOT a gate here — Kassaran's text "ignores any
    // effects that would prevent you from drawing cards" means he
    // activates regardless. The match-path bypass (below) is what
    // actually carries the card through the lock.
    return (ps.mainDeck || []).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const hero = ctx.attachedHero;
    if (!ps || !hero) return false;
    if ((ps.mainDeck || []).length === 0) return false;
    if (hero._kassaranNegatedThisTurn) return false;
    if ((hero._kassaranUsesThisTurn || 0) >= MAX_USES_PER_TURN) return false;

    // ── Step 1: declare a card name (Luck's cardNamePicker UI) ─────
    // Filter to main-deck-eligible card types — only Spell / Attack /
    // Creature can sit on top of the deck, so showing the player
    // Heroes / Abilities / Potions / Tokens would just be noise.
    const cardDB = engine._getCardDB();
    const allNames = Object.keys(cardDB).filter(n => {
      const cd = cardDB[n];
      if (!cd) return false;
      const ct = cd.cardType;
      return ct === 'Spell' || ct === 'Attack' || ct === 'Creature';
    }).sort((a, b) => a.localeCompare(b));

    const result = await engine.promptGeneric(pi, {
      type: 'cardNamePicker',
      title: CARD_NAME,
      description: 'Declare a Card name. The top of your deck will be revealed; matching it adds the card to your Hand, missing negates this effect for the rest of the turn.',
      cardNames: allNames,
      cancellable: true,
    });
    if (!result || result.cancelled || !result.cardName) {
      // Cancelled before committing — no use spent, no HOPT stamped.
      return false;
    }
    const declared = result.cardName;

    // The activator has now committed to the declaration. Fire the
    // pending hero-effect reveal + log here so opp sees Kassaran
    // activated on EVERY use (the false-return below would otherwise
    // delete both server-side without firing).
    engine._firePendingCardReveal();

    // Spend the use.
    hero._kassaranUsesThisTurn = (hero._kassaranUsesThisTurn || 0) + 1;

    const topCard = ps.mainDeck[0];
    const matched = (topCard === declared);

    engine.log('kassaran_declare', {
      player: ps.username, declared, revealed: topCard, matched,
      use: hero._kassaranUsesThisTurn,
    });

    // Broadcast the flip animation to both clients BEFORE mutating
    // any state. The client's match-path handler bumps the
    // `pileTransferToHandPending` suppressor as soon as the event
    // arrives, so the upcoming hand-grew sync (below) doesn't trigger
    // its own auto-draw animation on top of our custom one.
    // `toHandIdx` is the index where the new card will live after the
    // push (= current hand length); the client uses it to target the
    // exact landing slot AND to hide that slot via `bounceReturnHidden`
    // so the freshly-rendered card doesn't pop in mid-flight.
    // Animation duration on the client is 2000ms — keep the engine
    // delay matched so state mutation lands roughly when the card
    // visually settles into the destination.
    engine._broadcastEvent('kassaran_reveal_flip', {
      owner: pi, cardName: topCard, outcome: matched ? 'match' : 'miss',
      toHandIdx: matched ? ps.hand.length : -1,
    });
    await engine._delay(2000);

    if (matched) {
      // ── Match: card moves from deck to hand ──
      // Done inline rather than via actionAddCardFromDeckToHand so
      // the helper's deck_search_add broadcast / deckSearchReveal
      // popup don't fire on top of our custom flip animation. The
      // hand-lock bypass is intrinsic to this path: we're not calling
      // through any helper that gates on `handLocked`. Hooks that
      // matter (ON_CARD_ADDED_TO_HAND for tutor-reactive cards) are
      // fired manually below.
      ps.mainDeck.shift();
      if (ps.deckTopVisible && ps.deckTopVisible.length > 0) ps.deckTopVisible.shift();
      ps.hand.push(topCard);
      const inst = engine._trackCard(topCard, pi, 'hand');
      engine.log('kassaran_match', { player: ps.username, card: topCard });
      await engine.runHooks('onCardAddedToHand', {
        playerIdx: pi, card: inst, cardName: topCard,
      });
    } else {
      // ── Miss: card stays on deck, becomes publicly known ──
      // Push the revealed name into deckTopVisible (Premonition's
      // shared mechanic) so both players keep seeing the top card
      // semi-transparently after the flip animation completes.
      if (!ps.deckTopVisible) ps.deckTopVisible = [];
      if (ps.deckTopVisible.length === 0) ps.deckTopVisible.push(topCard);
      else if (ps.deckTopVisible[0] !== topCard) ps.deckTopVisible[0] = topCard;

      // Lock Kassaran out for the rest of the turn — `canActivate-
      // HeroEffect` checks this flag.
      hero._kassaranNegatedThisTurn = true;
    }

    engine.sync();

    // Always return false so the engine doesn't stamp the standard
    // hero-effect HOPT — we manage uses ourselves. The pending
    // reveal/log were fired above, so the false-return only suppresses
    // the HOPT stamp.
    return false;
  },

  hooks: {
    /**
     * Reset per-turn state at the start of the OWNER's turn. The
     * negation lock-out runs "for the rest of the turn", so it lifts
     * when the next own-turn begins; same scoping as the use counter.
     */
    onTurnStart: (ctx) => {
      if (ctx.activePlayer !== ctx.cardOriginalOwner) return;
      const hero = ctx.attachedHero;
      if (!hero) return;
      if (hero._kassaranUsesThisTurn) delete hero._kassaranUsesThisTurn;
      if (hero._kassaranNegatedThisTurn) delete hero._kassaranNegatedThisTurn;
    },
  },
};
