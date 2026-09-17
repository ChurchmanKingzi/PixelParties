// ═══════════════════════════════════════════
//  CARD EFFECT: „Ifrit"
//  Creature (Normal, Summoning Magic Lv2, 80 HP)
//
//  "This Creature cannot be summoned from anywhere, except your hand.
//   The damage of all «Armageddon» Spells any player activates is
//   increased by 100. This Creature is unaffected by «Armageddon»."
//
//  ── ① „CANNOT BE SUMMONED … EXCEPT FROM YOUR HAND" ───────────────
//  Sperrt jeden Beschwoerungsweg, der NICHT die Hand ist: aus dem Deck,
//  aus der Ablage, aus dem Geloeschten, ueber Wiederbelebung.
//
//  ★ ABER NICHT DAMUS' „PLACE". Er LEGT sie hin, er beschwoert sie
//  nicht — und ausdruecklich „from your hand", also selbst dann
//  erlaubt, wenn man „place" als Beschwoerung lesen wollte.
//
//  ── ② „+100 DAMAGE … ANY PLAYER ACTIVATES" ───────────────────────
//  ★ ANY PLAYER — der Aufschlag gilt auch, wenn der GEGNER Armageddon
//  wirkt. Ifrit ist kein reiner Vorteil; sie macht den Weltuntergang
//  fuer BEIDE toedlicher.
//  ★ Und er ist KUMULATIV: jede Ifrit auf dem Brett bringt ihre eigenen
//  +100 mit, gleich auf welcher Seite sie liegt. Beides folgt woertlich
//  aus dem Text, gezaehlt wird deshalb ueber BEIDE Seiten.
//  Gelesen wird der Aufschlag von „Armageddon" selbst
//  (`armageddonBonus`), damit die Rechnung an EINER Stelle steht.
//
//  ── ③ „UNAFFECTED BY «ARMAGEDDON»" ───────────────────────────────
//  Ifrit nimmt keinen Armageddon-Schaden. Der Vertrag
//  `immuneToSourceNames` haengt an der Karte und fragt beim
//  Schadenszugang nach dem Namen der Quelle.
// ═══════════════════════════════════════════

const { ARMAGEDDON } = require('./_apocalypse-shared');

const CARD_NAME = 'Ifrit';

module.exports = {
  activeIn: ['hand', 'support'],

  // ① Nur aus der Hand beschwoerbar.
  summonOnlyFromHand: true,

  // ③ Kein Schaden aus „Armageddon" — Namensstamm, damit eine spaetere
  // Variante („Armageddon II") automatisch mitzaehlt.
  immuneToSourceNames: [ARMAGEDDON],

  // ② Jede Ifrit erhoeht den Armageddon-Schaden um 100, egal wessen.
  armageddonBonus: 100,
};
