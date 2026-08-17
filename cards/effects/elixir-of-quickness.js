// ═══════════════════════════════════════════
//  CARD EFFECT: "Elixir of Quickness"
//  Potion — Draw 3 cards. Deleted after use.
//  No restrictions, no discard requirement.
// ═══════════════════════════════════════════

// Als Ruling 16.8. ("Tuscan Artist"): ist der 2er-/3er-Zug der EINZIGE
// Nutzen dieser Karte, wird sie gesperrt statt wirkungslos zu feuern.
// Die Auslegung steht in `_draw-block-shared.js`.
const { drawWouldBeBlocked } = require('./_draw-block-shared');

const CARD_NAME = 'Elixir of Quickness';

module.exports = {
  isPotion: true,

  // Der Zug IST die ganze Karte — ohne ihn bleibt nichts uebrig.
  canActivate(gs, pi, engine) {
    return !drawWouldBeBlocked(engine, pi, 3);
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;

    // ── Manual hand → deleted flight BEFORE the draws ──
    // Standard Potion handling splices the Potion from hand AFTER
    // `resolve` returns. For a draw Potion, that ordering breaks the
    // client's diff-based hand→deleted animation: each `actionDrawCards`
    // sync ratchets `prevCount` upward (3 → 4 → 5 → 6), and the
    // post-resolve splice then triggers a hand-shrink animation whose
    // per-slot rect logic walks from `prevCount - 1` (rightmost = a
    // just-drawn card) — so the visible flight either originates from
    // the wrong slot or doesn't render at all. Same pattern documented
    // in the discard-then-draw-animation-gotcha memory.
    //
    // Fix: pull the Potion out ourselves BEFORE drawing — broadcast
    // the explicit `play_pile_transfer`, splice from hand, push to
    // deletedPile, sync+delay so the flight visibly lands. Then draw.
    // The server's post-resolve splice then no-ops (getResolvingHandIndex
    // returns -1) and skips its own deletedPile push — which would
    // otherwise duplicate-add the card. Mirrors the Lunatic-Cycle
    // pattern: explicit broadcast + state mutation + sync/delay BEFORE
    // any hand-grow operation.
    const resolving = ps._resolvingCard;
    let handIdx = -1;
    if (resolving && resolving.name === CARD_NAME) {
      let count = 0;
      for (let i = 0; i < (ps.hand || []).length; i++) {
        if (ps.hand[i] === CARD_NAME) {
          count++;
          if (count === resolving.nth) { handIdx = i; break; }
        }
      }
    }
    if (handIdx < 0) handIdx = (ps.hand || []).lastIndexOf(CARD_NAME);

    if (handIdx >= 0) {
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: CARD_NAME,
        from: 'hand', to: 'deleted',
        fromHandIdx: handIdx,
      });
      ps.hand.splice(handIdx, 1);
      // Untrack the hand inst so post-splice scans don't re-find it.
      const inst = engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'hand' && c.name === CARD_NAME
      );
      if (inst) engine._untrackCard(inst.id);
      if (!ps.deletedPile) ps.deletedPile = [];
      ps.deletedPile.push(CARD_NAME);
      // Clear the resolver pointer so the server's post-resolve splice
      // logic doesn't try to re-find / re-splice the (now-deleted) card.
      ps._resolvingCard = null;
      engine.sync();
      await engine._delay(450);
    }

    // Draw 3 cards
    await engine.actionDrawCards(pi, 3);
  },
};
