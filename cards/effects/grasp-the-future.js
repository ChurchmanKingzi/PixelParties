// ═══════════════════════════════════════════
//  CARD EFFECT: "Grasp the Future"
//  Spell (Normal, Lv 0, Magic Arts) — Mini-Archetyp „the Future"
//
//  „When you draw this card as part of your starting hand: You may
//   immediately reveal it and another card in your hand, except \"Grasp the
//   Future\". Search your deck for a copy of that card, reveal it, and add
//   it to your hand."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Startblatt-Fenster (siehe Glimpse of the Future). Gewaehlt wird eine
//    ANDERE Handkarte — jede ausser einer Kopie von „Grasp the Future" (auch
//    ein weiterer Starthand-Zauber). Beide Karten werden aufgedeckt (dem
//    Gegner als Bild gezeigt), UNABHAENGIG davon, ob das Deck eine Kopie hat.
//  • Gibt es eine Kopie im Deck, kommt sie aufgedeckt auf die Hand; sonst
//    bleibt es beim Aufdecken. Die geholte Karte zaehlt NICHT als Starthand
//    (der Text sagt das nur bei Glimpse und Traveler).
// ═══════════════════════════════════════════

const CARD_NAME = 'Grasp the Future';

module.exports = {
  /** CPU: Angebot annehmen und die erste passende Karte waehlen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'cardGallery') return undefined;
    const k = (promptData.cards || [])[0];
    return k ? { cardName: k.name, source: k.source } : undefined;
  },

  startingHand: {
    async resolve(engine, pi) {
      const ps = engine.gs.players[pi];
      if (!ps) return null;
      const andere = {};
      for (const n of ps.hand || []) if (n !== CARD_NAME) andere[n] = (andere[n] || 0) + 1;
      const namen = Object.keys(andere);
      if (namen.length === 0) return null;

      const ok = await engine.promptStartingHandYesNo(pi, CARD_NAME,
        'You may immediately reveal it and another card in your hand. Search your deck for a copy of that card, reveal it and add it to your hand.',
        '👁️ Reveal!');
      if (!ok) return null;

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
        description: 'Choose another card in your hand to reveal. A copy of it is searched from your deck.',
        cards: namen.map(n => ({ name: n, source: 'hand', count: andere[n] })),
        confirmLabel: '🔎 Reveal & search!', cancellable: true, cancelLabel: 'Cancel',
      });
      if (!wahl || wahl.cancelled || !andere[wahl.cardName]) return null;
      const gewaehlt = wahl.cardName;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      await engine.showTriggeredEffect(gewaehlt, { playerIdx: pi });
      const geholt = await engine.actionAddCardFromDeckToHand(pi, gewaehlt, { source: CARD_NAME, reveal: true });
      engine.log('grasp_the_future', { player: ps.username, revealed: gewaehlt, found: !!geholt });
      engine.sync();
      return null;
    },
  },

  hooks: {},
};
