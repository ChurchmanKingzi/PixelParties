// ═══════════════════════════════════════════
//  CARD EFFECT: "Tuscan Prisoner"
//  Creature (Lv2, 100 HP, Summoning Magic)
//
//  "While you control this Creature, you are
//   unaffected by all effects that would end
//   your turn."
//
//  ── ALS RULING (16.8.): AUCH DIE EIGENEN ──
//  "All effects" heisst woertlich alle — auch die selbst gewaehlten.
//  Das macht Prisoner ausdruecklich STAERKER als Blackstache, der nur
//  gegnerische Quellen abwehrt. Folgen, die Al bewusst in Kauf nimmt:
//
//   • Gigantisaur Chimera und Gate to the Armory werden strikt besser
//     (Zusatzaktion ohne den Zugende-Preis).
//   • Cooldins Sprung in die End Phase entfaellt, sein Area-Effekt
//     bleibt.
//   • Doom Prophecy, Tanuki Escape, Spontaneous Reappearance,
//     Rebelliokai Terror Tengu und Phoenix Bombardment enden den Zug
//     nicht mehr.
//   • Terror kann den Zug nicht mehr erzwingen.
//
//  ── AUSDRUECKLICH NICHT GESCHUETZT: DER AUFSTIEG ──────────────────
//  ALS RULING (16.8.): der Aufstieg beendet den Zug als GRUNDMECHANIK,
//  nicht als Karteneffekt. "All effects that would end your turn"
//  meint Karteneffekte — Prisoner schuetzt davor also nicht. Der
//  Aufstiegs-Sprung in server.js (`ascend_hero`) markiert sich
//  deshalb mit `baseMechanic: true` und laeuft am Riegel vorbei.
//  Dass mehrere Waflav-Formen "Ascending this Hero does not end your
//  turn" tragen, ist kein Gegenbeleg: das sind Ausnahmen VON der
//  Grundmechanik, keine Karteneffekte, die einen Zug beenden.
//
//  ── WIE ES DURCHGESETZT WIRD ──────────────────────────────────────
//  Das Skript ist ein reiner Zustandsmarker, wie Blackstache. Die
//  Fahne `immuneToAllTurnEnd` liest die Engine an zwei Stellen:
//
//   1. `advanceToPhase(pi, END)` — jeder nicht-manuelle Sprung ans
//      Zugende. Dort laufen Chimera, Gate, Cooldin, Terror Tengu,
//      Flashbang, die drei `_spellEndsTurn`-Stellen und der
//      Aufstiegs-Sprung zusammen. Der Knopf des Spielers gibt
//      `manual: true` mit und bleibt deshalb unberuehrt — Prisoner
//      sperrt einen NICHT im eigenen Zug ein.
//   2. `_checkTerrorThreshold` — Terrors Zwangsende laeuft an
//      `advanceToPhase` VORBEI (server.js ruft `runPhase(5)` direkt),
//      wird aber eine Ebene frueher abgefangen, sodass
//      `_terrorForceEndTurn` gar nicht erst gesetzt wird.
//
//  "While you control this Creature" prueft das Skript nicht selbst:
//  `_turnEndImmuneCardOnSide` spiegelt die Stilllegungsregeln des
//  Hook-Verteilers (negated / nulled / stunned / frozen /
//  magic_silenced / verdeckt) und liest den KONTROLLEUR, nicht den
//  Besitzer — eine gestohlene Kopie schuetzt den Dieb.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  // Engine-Vertrag, ausgewertet in `_turnEndImmuneCardOnSide`
  // (`_engine.js`). Quellenunabhaengig — anders als Blackstaches
  // `immuneToOpponentTurnEnd`, das nur gegnerische Quellen abwehrt.
  immuneToAllTurnEnd: true,

  hooks: {},
};
