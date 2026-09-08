// ═══════════════════════════════════════════
//  CARD EFFECT: "Xal, the Animated Armor"
//  Hero — 450 HP / 80 ATK — Infiltration, Training
//
//  „You may place Abilities into the Support Zones of this Hero. This
//   Hero can have up to 6 different Abilities attached to it.\"
//
//  Wie es haengt
//  ─────────────
//  Der ganze Mechanismus sitzt in der Engine und wird ueber EIN Flag
//  angefordert: `abilitiesInSupportZones: true`. Daran haengen (v767)
//
//    • `engine.heroAcceptsAbilitiesInSupport(pi, heroIdx)` — liest das
//      Flag am Helden UND an seinen Artefakten, damit Xalibur denselben
//      Weg nutzen kann, ohne dass hier etwas doppelt steht;
//    • `engine.heroSupportAbilityStacks(pi, heroIdx)` — liefert die
//      Ability-Stapel aus den Support Zones in der Form einer
//      Ability-Zone (Stapelhoehe = Level);
//    • `_getCandidateAbilityZoneSets` und
//      `effectiveSchoolLevelForCaster` haengen sie an die echten Zonen
//      an. Damit zaehlen sie fuer JEDE Levelpruefung und jede
//      schulskalierende Karte, ohne dass ein einziger Aufrufer davon
//      wissen muss.
//
//  Regeln, wie Al sie festgelegt hat (5.9.):
//    • Die Support-Zonen sind vollwertige Ability-Zonen: Abilities
//      duerfen dort STAPELN und Level aufbauen.
//    • Ein Ability-Stapel BELEGT die Zone — daneben passt keine
//      Creature mehr.
//    • Stirbt Xal und werden seine Abilities geloescht (Spirit of the
//      Super-Killing Knife), trifft das auch die Abilities in seinen
//      Support Zones. Das erledigt `deleteHero`, das eine Ability in
//      einer Support Zone als Ability behandelt und loescht statt
//      abzulegen.
//
//  „up to 6 DIFFERENT Abilities\": drei Ability-Zonen plus drei
//  Support-Zonen. Die Beschraenkung auf verschiedene Namen ergibt sich
//  aus der Platzierungsregel — ein zweiter Stapel desselben Namens
//  entsteht nie, weil gleichnamige Karten auf den vorhandenen Stapel
//  wandern.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  /** Der eine Schalter — alles Weitere macht die Engine. */
  abilitiesInSupportZones: true,

  cpuMeta: {
    // Kein Schaden, kein Status: der Wert liegt in den Zonen.
    dealsDamage: false,
  },
};
