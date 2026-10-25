'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Cuberto, Supreme Lord of Edges"
//  Hero — 400 HP, 40 ATK, Training / Training
//
//  „When this is one of your Starting Heroes during a Cube Draft game, you may swap up to 5 of your drafted cards for any other cards during deck-building, but you have to choose
//   cards with different names."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  Kein Spieleffekt — die Karte wirkt im DECKBAU des Cube Drafts (`cube_build_state` / `cube_draft_ready`, `CubeDraftBuildScreen` in public/app-main.jsx, Prüfung `validateDraftedDeck`):
//  • Nur wenn Cuberto im Deck als STARTHELD steht (`deck.heroes`), darf getauscht werden: bis zu `max` (5) Karten des gedrafteten Pools gegen beliebige andere Karten (`swaps`:
//    [{ from, to }]). Die neuen Karten (`to`) müssen UNTEREINANDER verschiedene Namen tragen; `to` ist nie ein Held und nie derselbe Name wie `from`. Jeder Tausch verbraucht EINE
//    Kopie von `from` aus dem Pool und fügt EINE Kopie von `to` hinzu.
//  • Nimmt man Cuberto als Starthelden wieder heraus, verfallen alle Tausche: die eingetauschten Karten werden im Deck wieder zu ihren Ursprungskarten (die Oberfläche ersetzt sie, der
//    Server prüft ohne Cuberto gegen den unveränderten Pool). Setzt man ihn wieder ein, darf man neu wählen — auch andere Karten.
//  • Der Tauschplan liegt im Entwurf des Spielers (Browser) und im eingereichten Deck (`deck.cubertoSwaps`); der Server hält ihn nicht dauerhaft.
// ═══════════════════════════════════════════

module.exports = {
  cubeDraftSwap: { max: 5, verschiedeneNamen: true },
  hooks: {},
};
