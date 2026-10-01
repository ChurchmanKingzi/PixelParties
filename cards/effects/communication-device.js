// ═══════════════════════════════════════════
//  CARD EFFECT: "Communication Device"
//  Artifact (Equipment, Kosten 2)
//
//  „All Heroes you control equipped with a "Communication Device" can use
//   any Spells any other Hero you control with a "Communication Device"
//   equipped to it can use."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Der Effekt sitzt zentral in der Engine: `_kommunikationsGeraetSets`
//    haengt der Stufenpruefung (`heroMeetsLevelReq` / Wisdom-Kosten ueber
//    `_getCandidateAbilityZoneSets`) je anderem, dauerhaft kontrolliertem,
//    lebenden Helden mit Geraet dessen Ability-Zonen als weiteren Kandidaten
//    an. Nie summiert: es genuegt EINE Quelle.
//  • Empfaenger: jeder von mir kontrollierte Held mit Geraet — AUCH ein nur
//    geliehener (Charme, Styx, Golden Apple …). Das Geraet darf ueber den
//    Kontroll-Equip-Weg an solche Helden angelegt werden, sofern deren
//    Support Zones nicht voll/gesperrt sind. Quelle: nur dauerhaft
//    kontrollierte Helden (eigene Spalte / `permaControlBy`), wie
//    vorgegeben.
//  • „can use any Spells": gemeint ist die Stufen-/Schulenpruefung. Stufen-
//    ermaessigungen und Zustaende (Betaeubt, Negiert …) des Casters gelten
//    unveraendert.
// ═══════════════════════════════════════════

module.exports = {
  isEquip: true,
  // Passive Karte ohne Ziele („All Heroes …" ist keine Mehrfachtreffer-Wirkung).
  neverMultiTarget: true,
};
