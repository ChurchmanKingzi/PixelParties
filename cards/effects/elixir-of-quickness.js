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
  // D1 (Regel von Al): der Zug IST die ganze Karte - unter der Zieh-Sperre (drawLocked) nicht spielbar; unter handLocked
  // markiert sie der Loader schon selbst (blockedByHandLock).
  blockedByDrawLock: true,

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
    // ★ Aus Crestinas Vorrat (`fromCreation`) gespielt: die Karte liegt in `ps.creationZone`, nicht in der Hand. Vorher wurde immer in der
    //   HAND gesucht — eine gleichnamige Handkopie wurde geloescht, die Vorratskopie blieb liegen (und war doppelt spielbar).
    const ausVorrat = !!(resolving && resolving.name === CARD_NAME && resolving.fromCreation);
    const quelle = (ausVorrat ? ps.creationZone : ps.hand) || [];
    let handIdx = -1;
    if (resolving && resolving.name === CARD_NAME) {
      let count = 0;
      for (let i = 0; i < quelle.length; i++) {
        if (quelle[i] === CARD_NAME) {
          count++;
          if (count === resolving.nth) { handIdx = i; break; }
        }
      }
    }
    if (handIdx < 0) handIdx = quelle.lastIndexOf(CARD_NAME);

    if (handIdx >= 0) {
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: CARD_NAME,
        from: ausVorrat ? 'creation' : 'hand', to: 'deleted',
        fromHandIdx: handIdx,
      });
      if (!ps.deletedPile) ps.deletedPile = [];
      if (ausVorrat) {
        // Vorratskarte: eine Karte des Spielers selbst (nie gestohlen, keine Herkunftsmarke); Instanz = Zone `creationZone` (wie Mana Absorbing Crystal).
        const inst = engine._findHandInstanceAt(pi, handIdx, true);
        quelle.splice(handIdx, 1);
        if (inst) engine._untrackCard(inst.id);
        ps.deletedPile.push(CARD_NAME);
      } else {
        engine.takeFromPileSync(ps, 'hand', handIdx);
        // Untrack the hand inst so post-splice scans don't re-find it.
        const inst = engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'hand' && c.name === CARD_NAME
        );
        if (inst) engine._untrackCard(inst.id);
        engine.handKartenBesitzerPs(ps, CARD_NAME).deletedPile.push(CARD_NAME);   // W3/W5a: Stapel des permanenten Besitzers
      }
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
