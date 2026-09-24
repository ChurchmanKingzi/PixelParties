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

module.exports = { abgangsBetrag };
