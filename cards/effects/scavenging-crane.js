// ═══════════════════════════════════════════
//  CARD EFFECT: "Scavenging Crane"
//  Creature (Summoning Magic Lv 0, 50 HP)
//
//  „When you summon this Creature, look at the top 5 cards of your deck and
//   put them back in any order. You may shuffle your deck afterwards. Then,
//   draw 1 card."
//
//  (Text gegenueber der Vorlage geaendert — Als Vorgabe 2.10.: am Ende „Then, draw 1 card".)
//
//  ── ABLAUF ────────────────────────────────────────────────────────
//  1. Die obersten bis zu 5 Karten sehen (nur der Spieler selbst — kein Reveal).
//  2. Reihenfolge waehlen: Dialog `cardReorder` — alle Karten in einer Reihe, Platz 1 (links) = als naechstes
//     gezogen, Umsortieren per Drag & Drop, „Confirm"; danach fliegen die Karten sichtbar (nur fuer den Spieler) in
//     INVERSER Reihenfolge (5, 4, 3, 2, 1) aufs Deck. Die Reihenfolge ist NICHT oeffentlich (`deckTopVisible` bleibt leer).
//  3. „You may shuffle": Ja/Nein; Ja mischt das ganze Deck (die Reihenfolge ist dann hinfaellig).
//  4. „Then, draw 1 card": eine Karte ziehen (auch wenn gemischt wurde).
//  Beschwoerung, nicht Platzierung (`isPlacement` loest nichts aus).
// ═══════════════════════════════════════════

const CARD_NAME = 'Scavenging Crane';
const ANZAHL = 5;

module.exports = {
  // CPU: Reihenfolge belassen (erste Karte), nicht mischen.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'cardReorder') return { order: (promptData.cards || []).map((_, k) => k) };
    if (promptData.type === 'confirm') return { confirmed: false };
    return undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      if (ctx.playedCard?.id !== ctx.card?.id || ctx.card.zone !== 'support') return;
      if (ctx.card.counters?.isPlacement) return;   // platziert ≠ beschworen
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // ── 1.+2. Die obersten Karten ansehen und ordnen ──
      const n = Math.min(ANZAHL, (ps.mainDeck || []).length);
      if (n > 1) {
        const oben = ps.mainDeck.slice(0, n);
        // Ein Dialog (`engine.promptDeckReorder`): Drag & Drop, Confirm, danach fliegen die Karten (nur fuer den Spieler sichtbar)
        // in INVERSER Reihenfolge aufs Deck.
        const { top: geordnet } = await engine.promptDeckReorder(pi, pi, oben, {
          title: CARD_NAME,
          description: 'Drag the cards into the order you want to put them back on your deck. Position 1 (left) is drawn next.',
        });
        engine.reorderDeck(pi, geordnet, { source: CARD_NAME });
      }
      engine.log('scavenging_crane_look', { player: ps.username, count: n });

      // ── 3. „You may shuffle your deck afterwards" ──
      if ((ps.mainDeck || []).length > 1) {
        const ja = await engine.promptGeneric(pi, {
          type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
          message: 'Shuffle your deck?',
          confirmLabel: '🔀 Shuffle', cancelLabel: 'No',
          cancellable: true,
        });
        if (engine._confirmSaidYes(ja)) engine.shuffleDeck(pi);
      }

      // ── 4. „Then, draw 1 card" ──
      await engine.actionDrawCards(pi, 1, { source: CARD_NAME });
      engine.sync();
    },
  },
};
