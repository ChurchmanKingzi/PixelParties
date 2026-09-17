// ═══════════════════════════════════════════
//  CARD EFFECT: „The Thing in the Ship"
//  Creature (Normal, Decay Magic / Summoning Magic Lv2, 100 HP)
//
//  "While this Creature remains on the board, neither player can
//   activate the active effects of their Abilities."
//
//  ── FAST NICHTS DAVON STEHT HIER ──────────────────────────────────
//  Die Karte meldet sich mit EINEM Flag an; die Arbeit macht der
//  Engine-Riegel `abilityActivationBlocked()`. Grund ist derselbe wie
//  bei „Energy Aura": eine Ability-Aktivierung hat mehrere Wege
//  (freie Aktivierung, Aktions-Aktivierung, jeweils eigen/gecharmt/
//  geliehen), und eine Karte, die sich das selbst zusammensucht,
//  verpasst zuverlaessig einen davon.
//
//  ── WAS EIN „AKTIVER EFFEKT" IST ──────────────────────────────────
//  ★ Al 14.9.: „Active effects of Abilities sind solche wie Alchemy,
//  Charme etc." — also die, die man ANKLICKT. Das steht nicht in den
//  Kartendaten, laesst sich aber an der Bauform des Skripts ablesen:
//
//    `onFreeActivate`  → freie Aktivierung (Alchemy, Charme, Trade …)
//    `onActivate`      → kostet eine Aktion (Adventurousness)
//
//  Passive Abilities (Toughness, Resistance, Interference) haben nur
//  `hooks` und bleiben unberuehrt — sie werden ja auch nicht
//  „aktiviert". Heute trifft die Sperre 18 der 41 Abilities.
//
//  ★ NICHT `actionCost` als Merkmal nehmen: das bedeutet nur „kostet
//  eine Aktion" und traegt genau EINE Ability (Adventurousness).
//  Alchemy und Charme sind FREIE Aktivierungen und waeren durchs Netz
//  gefallen.
//
//  ── „NEITHER PLAYER" ──────────────────────────────────────────────
//  Die Sperre gilt fuer BEIDE Seiten, auch fuer den Besitzer. Der
//  Riegel fragt deshalb nur, OB so eine Kreatur auf dem Brett liegt,
//  nicht wem sie gehoert. Verdeckte Surprises zaehlen nicht mit.
//
//  ── „WHILE … REMAINS ON THE BOARD" ────────────────────────────────
//  Rein zustandsgebunden: keine Hooks, kein Aufraeumen beim Abgang.
//  Verlaesst die Kreatur das Brett, findet der Riegel sie nicht mehr
//  und die Sperre ist im selben Moment weg.
// ═══════════════════════════════════════════

module.exports = {
  // ★ Der Engine-Vertrag. Mehr braucht die Karte nicht.
  blocksAbilityActivation: true,
};
