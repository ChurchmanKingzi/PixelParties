'use strict';
// ═══════════════════════════════════════════
//  Stufenboni gestapelter Abilities (v1369)
//
//  Toughness (+100/+100/+200 HP) und Fighting (+10/+10/+20 ATK) geben je
//  KOPIE einen anderen Bonus — die dritte Kopie mehr als die ersten beiden.
//  Gemerkt wird der Bonus an der Instanz, die ihn gebracht hat
//  (`counters.<schluessel>`).
//
//  ★ Als Befund (Madame Guillotine): verliess eine BELIEBIGE Kopie den
//  Stapel, zog sie ihren eigenen Bonus ab — oft die +100 der ersten statt
//  der +200 der obersten. Aus Stufe 3 (+400) wurde so +300 statt +200, und
//  eine zurueckkehrende Kopie bekam als neue dritte wieder +200 dazu.
//  Richtig ist: ein Stapel von n Kopien verliert die Stufe n — also den
//  Bonus der OBERSTEN. Die abgehende Kopie tauscht ihren gemerkten Wert mit
//  der obersten, dann zieht sie deren Betrag ab.
// ═══════════════════════════════════════════

/**
 * @returns {number} der Betrag, der beim Abgang von `abgehend` abzuziehen ist.
 * Tauscht die gemerkten Werte, sodass die verbleibenden Kopien die unteren
 * Stufen tragen.
 */
function abgangsBetrag(engine, abgehend, schluessel) {
  if (!abgehend) return 0;
  const gleiche = (engine.cardInstances || []).filter(c =>
    c.name === abgehend.name && c.zone === abgehend.zone
    && c.owner === abgehend.owner && c.heroIdx === abgehend.heroIdx
    && c.zoneSlot === abgehend.zoneSlot && (c.counters?.[schluessel] || 0) > 0);
  let oberste = abgehend;
  for (const c of gleiche) {
    if ((c.counters[schluessel] || 0) > (oberste.counters?.[schluessel] || 0)) oberste = c;
  }
  const betrag = oberste.counters?.[schluessel] || 0;
  if (oberste !== abgehend) {
    oberste.counters[schluessel] = abgehend.counters?.[schluessel] || 0;
  }
  return betrag;
}

/**
 * 0-basierter Platz der Kopie `karte` im Stapel = Anzahl der gleichnamigen Kopien desselben Stapels, die ihren Bonus SCHON tragen
 * (`counters.<schluessel> > 0`), ohne `karte` selbst.
 *
 * ★ 25.10.2026 (Xal-Runde 5): `onPlay` rechnete den Platz als „Stapelhoehe - 1". Das stimmt nur, wenn die Kopien EINZELN nacheinander
 * ankommen. Kommen mehrere auf einmal (Aufstiegsbonus: erst alle Kopien legen, danach ihre `onPlay`; Aufwachen einer schlafenden
 * Support-Stapel nach Xalibur-Abgang), sah JEDE Kopie die volle Hoehe und gab den Bonus der obersten Stufe — Fighting 3 aus dem
 * Aufstiegsbonus brachte +60 ATK statt +40, Toughness 3 +600 HP statt +400. Die bereits versorgten Kopien zu zaehlen ist in beiden
 * Faellen richtig (wie schon `onGameStart`).
 */
function kopienIndex(engine, karte, schluessel) {
  if (!karte) return 0;
  return (engine.cardInstances || []).filter(c =>
    c !== karte && c.id !== karte.id && c.name === karte.name && c.zone === karte.zone
    && c.owner === karte.owner && c.heroIdx === karte.heroIdx && c.zoneSlot === karte.zoneSlot
    && (c.counters?.[schluessel] || 0) > 0).length;
}

module.exports = { abgangsBetrag, kopienIndex };
