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
//  2. Reihenfolge waehlen: je Platz eine Galerie, von oben nach unten; die letzte
//     Karte ergibt sich von selbst. Die Reihenfolge ist OHNE „oeffentlich sichtbar"
//     (`deckTopVisible` bleibt leer) — der Gegner sieht nichts.
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
    if (promptData.type === 'cardGallery') return { cardName: promptData.cards?.[0]?.name };
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
        const rest = ps.mainDeck.slice(0, n);
        const geordnet = [];
        while (rest.length > 1) {
          const wahl = await engine.promptGeneric(pi, {
            type: 'cardGallery',
            cards: [...new Set(rest)].map(name => ({ name, source: 'deck', count: rest.filter(x => x === name).length })),
            title: CARD_NAME, source: CARD_NAME,
            description: `Put these cards back in any order. Choose the card for position ${geordnet.length + 1} of ${n} (position 1 is drawn next).`,
            confirmLabel: '📚 Place', confirmClass: 'btn-info',
            cancellable: false,
          });
          const name = wahl?.cardName;
          const i = name ? rest.indexOf(name) : -1;
          geordnet.push(...rest.splice(i >= 0 ? i : 0, 1));
        }
        geordnet.push(...rest);
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
