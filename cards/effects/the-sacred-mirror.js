// ═══════════════════════════════════════════
//  CARD EFFECT: "The Sacred Mirror"
//  Artifact (Cost 0)
//
//  „If you have 4 copies of this card in your deck, your deck may contain up
//   to 80 cards. If you play this card while there are more than 60 cards in
//   your deck, draw 2 cards."
//
//  • DECKBAU: `mainDeckMax` / `isDeckLegal` / `canAddCard` in app-shared.jsx
//    und `mainDeckSizeOk` in server.js (Main Deck 60 bis 80 Karten bei 4 Kopien).
//  • IM KAMPF: „in your deck" = der Nachziehstapel. Hat er mehr als 60 Karten,
//    zieht der Spieler 2. Sonst bewirkt die Karte nichts → sie ist dann nicht
//    spielbar (`canActivate`, Grauton), statt eine Aktion zu verschwenden.
//  • Wie beim Sacred Jewel zieht sie nicht unter Zieh-/Handsperren.
// ═══════════════════════════════════════════

const CARD_NAME = 'The Sacred Mirror';
const SCHWELLE = 60;

module.exports = {
  blockedByHandLock: true,
  blockedByDrawLock: true,

  canActivate(gs, pi) {
    return (gs?.players?.[pi]?.mainDeck || []).length > SCHWELLE;
  },

  async resolve(engine, pi) {
    const ps = engine.gs.players[pi];
    if (!ps || (ps.mainDeck || []).length <= SCHWELLE) return { cancelled: true };
    await engine.actionDrawCards(pi, 2, { source: CARD_NAME });
    engine.log('sacred_mirror_draw', { player: ps.username });
    engine.sync();
  },
};
