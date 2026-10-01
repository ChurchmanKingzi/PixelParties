// ═══════════════════════════════════════════
//  CARD EFFECT: "Ghazma, the Worm Feeder"
//  Hero (400 HP / 70 ATK, Decay Magic + Occultism)
//
//  „Creatures that are defeated are deleted. At the end of every turn, the turn
//   player's deleted Creatures that were not deleted this turn are shuffled back
//   into their owner's deck. Then, the turn player draws that many cards (max 2)."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „Creatures that are defeated are deleted": gilt GLOBAL (beide Seiten, alle
//    Kreaturen), solange mindestens ein lebender, nicht negierter Ghazma im Spiel ist.
//    Skript-Flag `defeatedCreaturesAreDeleted`; die Engine liest es ueber
//    `_gefalleneKreaturenGeloescht()` in BEIDEN Todespfaden (Schadens-Batch und
//    Zerstoerung). Besiegt = in den Geloescht-Stapel des BESITZERS; „deleted from
//    anywhere"-Rettungen (Ash Worms, `beforeDelete`) greifen dabei.
//  • „At the end of every turn": jeder Zugende (eigenes wie gegnerisches), einmal je
//    Zug, auch wenn zwei Ghazmas im Spiel sind. „The turn player's deleted
//    Creatures" = die Kreaturen im Geloescht-Stapel des Spielers, der am Zug war;
//    „not deleted this turn" = sie kamen VOR diesem Zug in den Stapel — je KARTE
//    ueber Zeitstempel (`ps._deletedStamps`, `engine._geloeschtZuege`), nicht ueber Namen. Sie werden in das Deck ihres
//    Besitzers (= dieser Stapel) gemischt, danach zieht der Spieler am Zug so viele
//    Karten, hoechstens 2.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Ghazma, the Worm Feeder';
const MAX_ZIEHEN = 2;

module.exports = {
  activeIn: ['hero'],
  defeatedCreaturesAreDeleted: true,

  hooks: {
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs.result) return;
      // Einmal je Zug, egal wie viele Ghazmas lauschen.
      if (gs._ghazmaZugende === gs.turn) return;
      const pi = gs.activePlayer;
      const ps = gs.players[pi];
      if (!ps) return;
      gs._ghazmaZugende = gs.turn;

      const db = engine._getCardDB();
      // Je KARTE: ein Eintrag zaehlt, wenn er VOR diesem Zug in den Stapel kam (Zeitstempel
      // `ps._deletedStamps`) — Namensvergleiche versagen, wenn eine gleichnamige Karte im selben
      // Zug den Stapel verlaesst und eine neue hineinkommt.
      const zuege = engine._geloeschtZuege(pi);
      const indizes = [];
      (ps.deletedPile || []).forEach((n, k) => {
        const cd = db[n];
        if (cd && hasCardType(cd, 'Creature') && zuege[k] < gs.turn) indizes.push(k);
      });
      const zurueck = [];
      for (let k = indizes.length - 1; k >= 0; k--) {
        const [n] = ps.deletedPile.splice(indizes[k], 1);
        zurueck.unshift(n);
      }
      if (zurueck.length === 0) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      for (const n of zurueck) {
        ps.mainDeck.push(n);
        engine._pileFlight(pi, n, 'deleted', 'deck');
      }
      engine.shuffleDeck(pi, 'main');
      engine.log('ghazma_shuffle_back', { player: ps.username, cards: zurueck });
      engine.sync();

      const n = Math.min(MAX_ZIEHEN, zurueck.length);
      await engine.actionDrawCards(pi, n, { source: CARD_NAME });
      engine.sync();
    },
  },
};
