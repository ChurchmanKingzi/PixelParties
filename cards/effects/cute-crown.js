// ═══════════════════════════════════════════
//  CARD EFFECT: „Cute Crown"
//  Artifact (Equipment)
//
//  Kein eigener Effekt im Skript — die Karte wirkt ueber ihre
//  Kartendaten. Diese Datei traegt allein die Seitenbindung:
//  „Equip this card to a Hero you control." Ohne sie gilt die
//  Hausvorgabe „Ausruestung darf an beide Seiten" (Al, 5.9.: der
//  Kartentext ist bindend). Siehe `equipOwnSideOnly` in CARD_API.md.
// ═══════════════════════════════════════════

module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,
};
