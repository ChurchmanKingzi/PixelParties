// ═══════════════════════════════════════════
//  CARD EFFECT: "Glimpse of the Future"
//  Spell (Normal, Lv 0, Magic Arts) — Mini-Archetyp „the Future"
//
//  „When you draw this card as part of your starting hand: You may
//   immediately reveal it to draw 2 cards. Those cards count as part of
//   your starting hand."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Der Effekt hat KEINEN eigenen Spielzug: er laeuft im Startblatt-Fenster
//    der Engine (`processStartingHandDraw`) bzw. wenn die Karte ueber Traveler
//    from the Future als Starthand zaehlt. Die Karte selbst bleibt auf der
//    Hand (sie wird nur aufgedeckt — dem Gegner als Kartenbild gezeigt).
//  • „Those cards count as part of your starting hand": die gezogenen Karten
//    werden an die Startblatt-Auswertung zurueckgegeben (`counted`) — ein
//    weiteres Glimpse oder End of the Future darunter loest also ebenfalls aus.
//  • Als Zauber ist sie regulaer spielbar; der Spielzug selbst hat keinen
//    Effekt (der Kartentext kennt nur den Startblatt-Effekt).
// ═══════════════════════════════════════════

const CARD_NAME = 'Glimpse of the Future';

module.exports = {
  /** CPU: das Angebot immer annehmen. */
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
      const ok = await engine.promptStartingHandYesNo(pi, CARD_NAME,
        'You may immediately reveal it to draw 2 cards. Those cards count as part of your starting hand.',
        '👁️ Reveal & draw 2!');
      if (!ok) return null;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      const gezogen = await engine.actionDrawCards(pi, 2, { source: CARD_NAME });
      engine.log('glimpse_of_the_future', { player: ps.username, drawn: gezogen.map(c => c.name) });
      engine.sync();
      return { counted: gezogen.map(c => c.name) };
    },
  },

  hooks: {},
};
