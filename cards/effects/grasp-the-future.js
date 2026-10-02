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
//    ein weiterer Starthand-Zauber). Beide Karten werden aufgedeckt und BLEIBEN es, bis sie die Hand verlassen (dem
//    Gegner als Bild gezeigt), UNABHAENGIG davon, ob das Deck eine Kopie hat.
//  • Gibt es eine Kopie im Deck, kommt sie aufgedeckt auf die Hand; sonst
//    bleibt es beim Aufdecken. Die geholte Karte zaehlt NICHT als Starthand
//    (der Text sagt das nur bei Glimpse und Traveler).
// ═══════════════════════════════════════════

const { skipIfSearchBlocked } = require('./_search-shared');

const CARD_NAME = 'Grasp the Future';

module.exports = {
  // Wirkt nur im Startblatt-Fenster; aus der Hand gespielt tut die Karte nichts → ausgegraut und fuer Friedhelm & Co. nicht waehlbar.
  neverPlayable: true,
  /** CPU: Angebot annehmen und die erste passende Handkarte waehlen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'confirm') return true;
    if (promptData.type === 'pickHandCard') {
      const hand = engine?.gs?.players?.[engine?._cpuPlayerIdx]?.hand || [];
      const idx = (promptData.eligibleIndices || [])[0];
      return idx == null ? undefined : { handIndex: idx, cardName: hand[idx] };
    }
    return undefined;
  },

  startingHand: {
    async resolve(engine, pi, opts = {}) {
      const ps = engine.gs.players[pi];
      if (!ps) return null;
      if (skipIfSearchBlocked(engine, pi, CARD_NAME)) return null;   // unter der Such-Sperre kein Angebot
      // Jede ANDERE Handkarte (nicht „Grasp the Future") ist waehlbar.
      const erlaubt = [];
      (ps.hand || []).forEach((n, idx) => { if (n !== CARD_NAME) erlaubt.push(idx); });
      if (erlaubt.length === 0) return null;

      const ok = await engine.promptStartingHandYesNo(pi, CARD_NAME,
        'You may immediately reveal it and another card in your hand. Search your deck for a copy of that card, reveal it and add it to your hand.',
        '👁️ Reveal!');
      if (!ok) return null;

      // Das bestehende Handkarten-Protokoll (`pickHandCard`).
      const wahl = await engine.promptGeneric(pi, {
        type: 'pickHandCard', title: CARD_NAME,
        description: 'Choose another card in your hand to reveal. A copy of it is searched from your deck.',
        eligibleIndices: erlaubt,
        cancellable: true,
        searchToHand: true, searchPile: 'deck',   // = suchAbfrage('deck')
      });
      if (!wahl || wahl.cancelled || wahl.handIndex == null || !erlaubt.includes(wahl.handIndex)) return null;
      const gewaehlt = ps.hand[wahl.handIndex];
      if (!gewaehlt) return null;

      // Beide Karten bleiben aufgedeckt, bis sie die Hand verlassen.
      engine.revealHandCopy(pi, CARD_NAME, opts.handIdx);
      engine.revealHandCopy(pi, gewaehlt, wahl.handIndex);
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
