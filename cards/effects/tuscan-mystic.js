// ═══════════════════════════════════════════
//  CARD EFFECT: "Tuscan Mystic"
//  Creature (Lv2, 100 HP, Summoning Magic)
//
//  "While you control this Creature, your opponent cannot activate
//   Potions.
//   Whenever you would draw a card from your Potion Deck, you may
//   reveal the top 2 cards of your Potion Deck and immediately resolve
//   one of them instead. Delete both revealed cards afterwards."
//
//  ── TEIL 1: DIE POTION-SPERRE ─────────────────────────────────────
//  Rein deklarativ ueber `blocksOpponentPotions`. Die Engine leitet
//  daraus `arePotionsLockedFor(pi)` ab, und die sechs Konsumenten
//  (Spielgate in server.js, drei CPU-Gates, zwei Zustandsversender
//  fuers Ausgrauen) lesen darueber.
//
//  BEWUSST NICHT `ps.potionLocked = true`: das ist ein PER-RUNDE-Flag
//  aus dem `potionLockAfterN`-Vertrag und wird erst beim Rundenwechsel
//  zurueckgesetzt. Stirbt Mystic mitten in der Runde, muss die Sperre
//  SOFORT wegfallen — deshalb abgeleitet statt gespeichert.
//
//  ── TEIL 2: DER AUFDECK-EFFEKT ────────────────────────────────────
//  ALS RULINGS (16.8.):
//   • Opt-in ("you may") — "sofort ausloesen" ist ein echter Nachteil,
//     den die Wahl aus zweien ausgleicht. Deshalb eine Abfrage.
//   • Die gewaehlte Karte wird SOFORT ausgeloest, nicht auf die Hand
//     genommen. Danach werden BEIDE aufgedeckten Karten geloescht.
//   • Laesst sich die gewaehlte Potion nicht ausloesen (Elixir of
//     Recovery ohne legales Ziel), fizzelt sie vollstaendig — und wird
//     trotzdem geloescht.
//   • Bei WENIGER ALS 2 Karten im Potion Deck wird der Effekt gar nicht
//     erst angeboten. Ein leeres Potion Deck sollte ohnehin nie zu
//     einem Zug kommen; die Pruefung faengt es sicherheitshalber ab.
//
//  WARUM DIE POTION HIER DIREKT AUFGELOEST WIRD:
//  Der normale Weg fuer eine Potion MIT Zielwahl geht ueber
//  `gs.potionTargeting` und einen Server-Rueckweg (`doConfirmPotion`).
//  Aus einem Kartenskript heraus ist der nicht erreichbar. Also der
//  gleiche Ablauf eine Ebene tiefer: Ziele vom Skript holen, ueber den
//  Engine-Kanal `promptEffectTarget` waehlen lassen, dann `resolve`
//  mit denselben Argumenten aufrufen, die `doConfirmPotion` uebergibt.
//  Potions ohne Zielwahl bekommen `resolve(engine, pi, [], [])` —
//  exakt wie im zielwahlfreien Serverzweig.
// ═══════════════════════════════════════════


const { loesePotionAus } = require('./_potion-shared');

const CARD_NAME = 'Tuscan Mystic';
const AUFDECKEN = 2;

module.exports = {
  activeIn: ['support'],

  // ── Teil 1 ── Engine-Vertrag, ausgewertet in `arePotionsLockedFor`.
  blocksOpponentPotions: true,

  hooks: {
    // ── Teil 2 ── `beforeDrawBatch` ist das Fenster VOR dem Zug: der
    // Kartentext sagt "instead", der reguläre Zug darf also gar nicht
    // erst stattfinden. `deckType: 'potion'` grenzt es ab.
    beforeDrawBatch: async (ctx) => {
      if (ctx.deckType !== 'potion') return;
      const pi = ctx.cardOwner;
      if (ctx.playerIdx !== pi) return;          // nur eigene Zuege
      if (!(ctx.amount > 0)) return;

      const engine = ctx._engine;
      const ps = engine.gs.players[pi];

      // ★ SIND MEINE POTIONS UEBERHAUPT AKTIVIERBAR? (Als Befund 17.8.)
      // Der Effekt loest eine Potion SOFORT aus — das ist eine
      // Aktivierung. Ist die gesperrt, waere das Angebot eine Falle:
      // beide Karten wuerden geloescht, ohne dass etwas passiert.
      //
      // Der Fall, den Al gefunden hat: BEIDE Spieler kontrollieren einen
      // Mystic. Meiner sperrt die Potions des Gegners, seiner sperrt
      // meine — also darf mein eigener Effekt nicht angeboten werden.
      // Dieselbe Abfrage faengt auch `potionLockAfterN` mit ab: wer
      // diese Runde schon sein Potion-Limit erreicht hat, darf ueber
      // Mystic keine weitere nachschieben.
      if (engine.arePotionsLockedFor(pi)) return;

      const deck = ps?.potionDeck || [];
      // Weniger als 2 Karten ⇒ gar nicht anbieten (Als Ruling).
      if (deck.length < AUFDECKEN) return;

      const oben = deck.slice(0, AUFDECKEN);

      const willIch = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Reveal the top ${AUFDECKEN} cards of your Potion Deck and immediately `
          + `resolve one of them instead of drawing? Both revealed cards are deleted afterwards.`,
        showCard: CARD_NAME,
        confirmLabel: '🔮 Reveal!',
        cancelLabel: 'Just draw',
        cancellable: true,
      });
      if (!willIch) return;

      // Aufdecken — beide Karten sind ab jetzt offen.
      engine._broadcastEvent('card_reveal', { cardName: oben[0], playerIdx: pi });
      engine._broadcastEvent('card_reveal', { cardName: oben[1], playerIdx: pi });

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: oben.map(name => ({ name, source: 'revealed' })),
        title: CARD_NAME,
        description: 'Choose 1 to resolve immediately. Both are deleted afterwards.',
        cancellable: false,
      });
      const gewaehlt = (wahl && typeof wahl.cardName === 'string' && oben.includes(wahl.cardName))
        ? wahl.cardName
        : oben[0];

      // Beide Karten VERLASSEN das Potion Deck, bevor irgendetwas
      // aufloest — sonst koennte der Effekt der gewaehlten Potion sie
      // selbst noch einmal ziehen.
      deck.splice(0, AUFDECKEN);
      engine.sync();

      let hatGewirkt = false;
      try {
        hatGewirkt = await loesePotionAus(engine, pi, gewaehlt);
      } catch (err) {
        // Fizzeln ist ein zulaessiger Ausgang (Als Ruling) — aber es
        // soll nicht still bleiben.
        console.warn(`[${CARD_NAME}] "${gewaehlt}" konnte nicht aufloesen: ${err.message}`);
        hatGewirkt = false;
      }

      // Beide geloescht — auch die aufgeloeste, auch eine gefizzelte.
      if (!ps.deletedPile) ps.deletedPile = [];
      for (const name of oben) {
        engine._broadcastEvent('play_pile_transfer', {
          owner: pi, cardName: name, from: 'potionDeck', to: 'deleted',
        });
        ps.deletedPile.push(name);
      }

      engine.log('tuscan_mystic_reveal', {
        card: CARD_NAME, player: ps.username,
        revealed: oben, resolved: gewaehlt, fizzled: !hatGewirkt,
      });

      // Der regulaere Zug entfaellt — "instead".
      ctx.setAmount(0);
      engine.sync();
    },
  },
};
