// ═══════════════════════════════════════════
//  CARD EFFECT: "White Sacrificial Bull"
//  Creature (Summoning Magic Lv1, 100 HP)
//
//  „While this Creature remains on the board, it is also treated as a Hero (but has no Ability or Support Zones)."
//
//  Der Bull tut sonst nichts — er ZÄHLT nur als Hero. Skript-Flagge `alsoTreatedAsHero`; `engine.zaehltAlsHeld(inst)` / `engine.heldKreaturen(pi)` sind die Leser.
//  Eingebunden ist das dort, wo „Hero" als Kartentyp gelesen wird und eine Kreatur als Teilnehmer in Frage kommt:
//    • Divine Gift of Sacrifice: der Bull kann als Opfer („Sacrifice a Hero originally controlled by you") und als Empfänger („another Hero you control") dienen;
//      geopfert wird er wie jede Kreatur (`opfereKreatur`: onCreatureSacrificed, Schutzfenster), sein max HP ersetzt das des Opfers.
//    • The Yeeting: der Bull ist ein zulässiger „Hero you control" (150 Schaden) und KEIN Ziel der „any card on the board that is not a Hero"-Wahl.
//    • Alle Sammler der „not a Hero"-Zielwahlen (Yeeting, Tengu Windstorm, Sun Beam, Sparkfly Worker/Queen, Wall Breaker, Antonia, Debt-O-Tron, Shishi, Coolness Overcharge,
//      Dive Bomblebee) lassen ihn aus.
//  Er ist weiterhin eine Kreatur (Zielwahlen für Kreaturen, Flächenschläge, Tod).
// ═══════════════════════════════════════════

module.exports = {
  alsoTreatedAsHero: true,
  activeIn: ['support'],
};
