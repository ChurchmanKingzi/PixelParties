'use strict';
// W24 · N3-06 Absicherung: Suspicious Monster aus der Hand als Sofort-Aktion (performImmediateAction, `_isNormalSummon`) mit Opfer-Tausch legt genau EINE Kopie,
// Kartenbilanz 0 (der Tausch meldet „Platzierung erledigt" = beforeSummon false, die Engine legt nicht zusätzlich);
// Slave Trader deckt Suspicious Monster auf: keine zweite Kopie, kein Opfer, Bilanz 0 (Effekt-Beschwörung ohne `_isNormalSummon`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SM = 'Suspicious Monster';
  { // Sofort-Aktion mit Tausch
    const t = await H.fresh({ hand: [[SM], []] });
    for (let hi = 0; hi < 3; hi++) t.setAbilities(0, hi, [['Summoning Magic'], [], []]);
    t.put(0, 0, 1, 'Frolake').turnPlayed = 1;
    t.script.push({ match: d => d.type === 'heroAction', answer: () => ({ cardName: SM, handIndex: 0, zoneSlot: 2 }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ owner: d.zones[0].owner, heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0); t.reset();
    const vorher = t.census();
    const r = await t.run(() => t.engine.performImmediateAction(0, 0, { title: 'X', allowedCardTypes: ['Creature'] }));
    const kopien = t.inst(c => c.name === SM && c.zone === 'support').length;
    const bilanz = t.censusDiff(vorher, t.census());
    R.check('Sofort-Aktion: gespielt, genau eine Kopie auf dem Brett', r && r.played === true && kopien === 1, { r, kopien });
    R.check('Sofort-Aktion: Frolake als Opfer in der Ablage, Kartenbilanz 0', t.pile(0, 'discardPile').includes('Frolake') && bilanz.length === 0, { bilanz, ablage: t.pile(0, 'discardPile') });
    R.check('Sofort-Aktion: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  { // Slave Trader
    const t = await H.fresh({ deck: [[SM, ...Array(19).fill(H.INERT.creature)], Array(20).fill(H.INERT.creature)] });
    for (let hi = 0; hi < 3; hi++) t.setAbilities(0, hi, [['Summoning Magic'], [], []]);
    t.put(0, 2, 0, 'Slave Trader').turnPlayed = 1;
    t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ owner: d.zones[0].owner, heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0); t.reset();
    const vorher = t.census();
    await t.activateCreature(0, 2, 0);
    R.check('Slave Trader: genau eine Kopie, Trader bleibt, Bilanz 0, kein Audit-Fehler',
      t.inst(c => c.name === SM && c.zone === 'support').length === 1 && !!t.find('Slave Trader', 'support') && t.censusDiff(vorher, t.census()).length === 0 && t.errors.length === 0, { bilanz: t.censusDiff(vorher, t.census()), errors: t.errors });
  }
  R.finish();
})();
