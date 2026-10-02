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
//    from the Future als Starthand zaehlt. Die Karte bleibt auf der
//    Hand und bleibt AUFGEDECKT, bis sie die Hand verlaesst (dauerhafte Aufdeckung).
//  • „Those cards count as part of your starting hand": die gezogenen Karten
//    werden an die Startblatt-Auswertung zurueckgegeben (`counted`) — ein
//    weiteres Glimpse oder End of the Future darunter loest also ebenfalls aus.
//  • Als Zauber ist sie regulaer spielbar; der Spielzug selbst hat keinen
//    Effekt (der Kartentext kennt nur den Startblatt-Effekt).
// ═══════════════════════════════════════════

const CARD_NAME = 'Glimpse of the Future';

module.exports = {
  // Wirkt nur im Startblatt-Fenster; aus der Hand gespielt tut die Karte nichts → ausgegraut und fuer Friedhelm & Co. nicht waehlbar.
  neverPlayable: true,
  /** CPU: das Angebot annehmen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'confirm') return true;
    return undefined;
  },

  startingHand: {
    async resolve(engine, pi, opts = {}) {
      const ps = engine.gs.players[pi];
      if (!ps) return null;
      const ok = await engine.promptStartingHandYesNo(pi, CARD_NAME,
        'You may immediately reveal it to draw 2 cards. Those cards count as part of your starting hand.',
        '👁️ Reveal & draw 2!');
      if (!ok) return null;
      engine.revealHandCopy(pi, CARD_NAME, opts.handIdx);   // DIESE Kopie bleibt aufgedeckt, bis sie die Hand verlaesst
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      const gezogen = await engine.actionDrawCards(pi, 2, { source: CARD_NAME });
      engine.markLastStartingCounted(pi, gezogen.length);   // zaehlen als Starthand
      engine.log('glimpse_of_the_future', { player: ps.username, drawn: gezogen.map(c => c.name) });
      engine.sync();
      return { counted: gezogen.map(c => c.name) };
    },
  },

  hooks: {},
};
