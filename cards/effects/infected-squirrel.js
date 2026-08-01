// ═══════════════════════════════════════════
//  CARD EFFECT: "Infected Squirrel"
//  Creature — 20 HP (level 0)
//
//  Kartentext:
//    "This Creature ON THE BOARD also counts as
//     a 'Deepsea' Creature. You may add this
//     Creature back to your hand for the effect
//     of a 'Deepsea' Creature from your hand the
//     turn it was summoned, but if you do, you
//     cannot summon or place other Creatures for
//     the rest of the turn afterwards."
//
//  Umsetzung (1.8. überarbeitet)
//  ────────────────────────────
//  Die Mechanik lebt weiterhin im Deepsea-
//  Bounce-Place-Fluss (`_deepsea-shared.js`) —
//  die Karte hat keinen eigenen aktivierbaren
//  Effekt. NEU ist, dass sie ihre Sonderregeln
//  SELBST DEKLARIERT, statt dort dreimal per
//  `name === 'Infected Squirrel'` hartkodiert zu
//  sein. Damit gibt es eine Wahrheitsquelle, und
//  eine zweite Karte mit derselben Regel bräuchte
//  keine Änderung am Shared-Modul.
//
//  Die `is*`-Präfixe sind Absicht: der Loader
//  erkennt Skripte unter anderem an Karten-Typ-
//  Flags dieser Form (wie isEquip / isPotion /
//  isReaction). Ohne sie hatte dieses Skript gar
//  keinen erkennbaren Vertrag und wurde verworfen
//  ("has no hooks, effects, or card type flags").
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  // ── "ON THE BOARD also counts as a Deepsea Creature" ──────────────
  // Gilt AUSSCHLIESSLICH für die Instanz in einer Support Zone.
  // Vorher lieferte `isDeepseaCreature` für diesen Namen bedingungslos
  // true — die Karte galt damit auch im DECK (Deepsea Witchs Suche), im
  // DISCARD (Deepsea Bats' Wiederbelebung) und auf der HAND (Deepsea
  // Primordiums Grant-Filter) als Deepsea. Der Kartentext beschränkt
  // die Zugehörigkeit ausdrücklich auf das Feld.
  isDeepseaOnBoard: true,

  // ── "the turn it was summoned" ────────────────────────────────────
  // Bounce-Ziele müssen sonst mindestens eine Runde gelegen haben
  // (`turnPlayed < gs.turn`). Diese Karte ist die Ausnahme.
  isDeepseaBounceableSameTurn: true,

  // ── "…but if you do, you cannot summon or place other Creatures" ──
  // Der Preis, gesetzt NACH der Platzierung (sonst blockierte der Lock
  // die eintauschende Deepsea-Kreatur selbst). Greift nur, wenn die
  // Ausnahme oben tatsächlich genutzt wurde, also beim Bounce in der
  // Beschwörungsrunde — ein späterer Bounce ist regulär und kostenlos.
  locksSummonsWhenBouncedSameTurn: true,
};
