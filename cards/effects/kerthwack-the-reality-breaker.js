// ═══════════════════════════════════════════
//  CARD EFFECT: "Kerthwack, the Reality Breaker"
//  Hero — 400 HP / 40 ATK — Alchemy + Magic Arts
//
//  „When this is one of your starting Heroes, your Potion Deck may contain
//   any card, but only up to 2 copies of each card. Copies of cards played
//   in your Potion Deck, except Potions, do not count towards the number of
//   copies of those cards in your deck."
//
//  ── NUR DECKBAU ───────────────────────────────────────────────────
//  Der ganze Text ist eine Deckbauregel; im Spiel tut diese Karte nichts
//  (die Karten im Potion Deck kommen ueber das gewohnte Ziehen aus dem
//  Potion Deck — Alchemy & Co. — auf die Hand, jede Karte wie ein Potion).
//  Die Regel steht NICHT hier, sondern in der Tabelle `PERMISSIONS` in
//  `public/potion-deck-clauses.js` (Client und Server lesen dieselbe Datei):
//
//   • ERLAUBNIS, KEIN VERBOT: Potions duerfen weiter ins Potion Deck; es
//     kommen nur andere Karten dazu (je Name hoechstens 2). Die Kartenzahl
//     bleibt 0 oder 5–15.
//   • Kopien im Potion Deck zaehlen — ausser Potions — NICHT zu den Kopien im
//     Deck (`countInDeck` in app-shared.jsx): 4 Kopien im Main Deck UND 2 im
//     Potion Deck sind erlaubt. Potions zaehlen immer: mit Nicolas im Team
//     gilt weiter „hoechstens 15 Potions, 2 Kopien je Potion ueber beide Decks".
//   • Mit Chaos-Diamond oder Pinta im Team gilt allein deren STRENGE Klausel
//     (genau 15 passende Karten, je Name 1x, Gesamtlevel ≤ 15). Kerthwack
//     schliesst sie nicht aus, ueberschreibt sie aber auch nicht — nur sorgt er
//     dafuer, dass deren Karten nicht zu den Main-Deck-Grenzen zaehlen.
//   • Seitenwechsel (Bo3/Bo5): verlaesst Kerthwack das Team, duerfen im Potion
//     Deck nur noch Karten liegen, die dann noch hineindurfen (Potions) — die
//     uebrigen muessen erst heraus (`swapPotionDeckProblem`).
//
//  Neu ist kein Spiellauf-Code; die Zieh-Sperre der strengen Klausel-Helden
//  (`_potion-deck-hero-shared.js`) gilt fuer Kerthwack ausdruecklich NICHT: er
//  darf aus dem Potion Deck ziehen.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],
  hooks: {},
};
