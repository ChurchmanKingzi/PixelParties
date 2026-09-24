'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Philosopher's Stone"  (v1361)
//  Artifact — Reaction, Cost 4
//
//  "Play this card immediately when you would draw a card from your Potion
//   Deck. Search your Potion Deck for a card, reveal it and add it to your
//   hand instead."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  · Fenster: `_checkPotionDrawHandReactions` (Engine, v1361) — laeuft in
//    `actionDrawFromPotionDeck` nach `beforeDrawBatch` (Tuscan Mystic hat
//    also Vorrang: ersetzt er den Zug, gibt es keinen mehr zu ersetzen).
//    Gold, Hand-Spielsperre und Wirker wie bei jeder Hand-Reaktion.
//  · „a card … instead": EIN Zug wird ersetzt. Zieht ein Effekt mehrere,
//    darf eine zweite Kopie den zweiten ersetzen; der Rest wird normal
//    gezogen.
//  · Die gesuchte Karte ist KEIN Zug („add it to your hand"): kein
//    `onDraw`, keine Surprise-Zug-Pruefung — aber `onCardAddedToHand`
//    (Analyzer, Gatherer …) und die Aufdeckung fuer den Gegner.
//  · Suche → die Such-Sperre greift (`blockedBySearchLock`). Nur eine Art
//    Karte (oder gar keine) im Potion Deck → nicht angeboten (Als Vorgabe
//    24.9.: die Suche braechte nichts gegenueber dem Zug). Danach wird das Potion Deck gemischt.
//  · Bild: die gesuchte Karte fliegt glitzernd aus dem Potion Deck auf die
//    Hand (`flightStyle: 'glitzer'`, wie Relic in the Sky).
// ═══════════════════════════════════════════

const CARD_NAME = "Philosopher's Stone";

function galerie(ps) {
  const zaehler = new Map();
  for (const n of (ps?.potionDeck || [])) zaehler.set(n, (zaehler.get(n) || 0) + 1);
  return [...zaehler.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: 'potionDeck', count }));
}

module.exports = {
  isPotionDrawReaction: true,
  blockedBySearchLock: true,
  // Nur ueber das Fenster spielbar — in der Hand gedimmt.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  potionDrawReactionCondition(gs, pi) {
    const ps = gs.players[pi];
    if (!ps || ps.handLocked) return false;
    // v1362 (Als Vorgabe): liegt nur EINE Art Karte im Potion Deck, ist die
    // Suche dasselbe wie der Zug — die Stone waere verschenkt (4 Gold und
    // eine Karte) und wird gar nicht erst angeboten.
    return new Set(ps.potionDeck || []).size >= 2;
  },

  async potionDrawReactionResolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const karten = galerie(ps);
    if (karten.length === 0) {
      await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'no_target' });
      return;
    }
    let gewaehlt = karten[0].name;
    if (karten.length > 1) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
        searchToHand: true,
        description: 'Search your Potion Deck for a card, reveal it and add it to your hand.',
        cards: karten, confirmLabel: '💎 Take', cancellable: false,
      });
      if (wahl?.cardName && karten.some(k => k.name === wahl.cardName)) gewaehlt = wahl.cardName;
    }

    const genommen = await engine.takeFromPile(pi, 'potionDeck', gewaehlt, {
      source: CARD_NAME, toHand: true, shuffle: true,
    });
    if (!genommen) {
      await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'search_blocked' });
      return;
    }
    const endGroesse = ps.hand.length + 1;
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: gewaehlt, from: 'potionDeck', to: 'hand',
      toHandIdx: endGroesse - 1, finalHandSize: endGroesse, flightStyle: 'glitzer',
    });
    engine.sync();
    await engine._delay(650);
    ps.hand.push(gewaehlt);
    const inst = engine._trackCard(gewaehlt, pi, 'hand');
    // „reveal it": beiden zeigen, der Gegner bekommt die Such-Aufdeckung.
    engine._broadcastEvent('card_reveal', { cardName: gewaehlt, playerIdx: pi });
    const oi = pi === 0 ? 1 : 0;
    engine.noteKnownCard?.(oi, gewaehlt, 'hand');
    engine.log('philosophers_stone', { player: ps.username, card: CARD_NAME, target: gewaehlt });
    await engine.runHooks('onCardAddedToHand', {
      playerIdx: pi, card: inst, cardName: gewaehlt, _skipReactionCheck: true,
    });
    engine.sync();
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal', searchToHand: true,
      cardName: gewaehlt, searcherName: ps.username, title: CARD_NAME, cancellable: false,
    });
  },
};
