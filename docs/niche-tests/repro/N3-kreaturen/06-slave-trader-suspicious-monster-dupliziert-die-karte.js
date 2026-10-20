'use strict';
// N3-06 · Slave Trader deckt „Suspicious Monster" auf: die Karte steht danach ZWEIMAL auf dem Brett, der Slave Trader wird als Opfer abgelegt
// Kartentext (Slave Trader): „… reveal the top card of your deck. If it is a Creature, immediately summon it as an additional Action with any of your Heroes, if possible."
// Kartentext (Suspicious Monster): „You may sacrifice a Creature you control that was not summoned this turn to summon this Creature as an additional Action into the same Support Zone."
//   → das Opfer ist ein WAHLWEG der Hand-Beschwörung auf einen BELEGTEN Platz; auf einem freien Platz ist es eine normale Beschwörung (Kopfkommentar des Skripts: „Free-slot drop → normal Action summon").
// Erwartet: Slave Trader beschwört den Monster in eine freie Zone; es gibt GENAU EINE Karte auf dem Brett, der Slave Trader bleibt liegen.
// Beobachtet: Die Engine setzt den Monster in die freie Zone UND `beforeSummon` fragt (zweite Zonenwahl) nach einem Opfer und führt den „atomaren Tausch" aus (`sacrificeSwapAtomar`,
//   `ps._placementConsumedByCard` wird nur vom Server-Handspielweg beachtet): Slave Trader (Opfer) in der Ablage, Monster ein zweites Mal im Platz des Opfers → 1 Karte, 2 Kopien auf dem Brett.
// Ursache: cards/effects/suspicious-monster.js `beforeSummon` (Z. 459-466) → `sacrificeSwapAtomar` (Z. 186) ohne Prüfung `ctx._isNormalSummon` / ohne Rücksicht darauf, dass die Engine den Platz selbst legt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SM = 'Suspicious Monster';
  async function lauf(mitOpfer) {
    const t = await H.fresh({ deck: [[SM, ...Array(19).fill(H.INERT.creature)], Array(20).fill(H.INERT.creature)] });
    for (let hi = 0; hi < 3; hi++) t.setAbilities(0, hi, [['Summoning Magic'], [], []]);
    const st = t.put(0, 2, 0, 'Slave Trader'); st.turnPlayed = 1;
    if (!mitOpfer) { /* nur der Slave Trader selbst ist ein mögliches Opfer */ }
    t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ owner: d.zones[0].owner, heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0); t.reset();
    const vorher = t.census();
    const r = await t.activateCreature(0, 2, 0);
    const kopien = t.inst(c => c.name === SM && c.zone === 'support').length;
    return { r, kopien, slaveTraderOnBoard: !!t.find('Slave Trader', 'support'), ablage: t.pile(0, 'discardPile'), bilanz: t.censusDiff(vorher, t.census()), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')), errors: t.errors, audit: t.audit() };
  }
  // Gegenprobe: eine normale Kreatur obenauf wird genau einmal beschworen, der Slave Trader bleibt
  {
    const t = await H.fresh({ deck: [['Frolake', ...Array(19).fill(H.INERT.creature)], Array(20).fill(H.INERT.creature)] });
    for (let hi = 0; hi < 3; hi++) t.setAbilities(0, hi, [['Summoning Magic'], [], []]);
    t.put(0, 2, 0, 'Slave Trader').turnPlayed = 1;
    t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ owner: d.zones[0].owner, heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
    await t.activateCreature(0, 2, 0);
    R.check('Gegenprobe: Frolake obenauf → genau eine Frolake auf dem Brett, Slave Trader bleibt', t.inst(c => c.name === 'Frolake' && c.zone === 'support').length === 1 && !!t.find('Slave Trader', 'support'));
  }
  const x = await lauf();
  R.check('Suspicious Monster obenauf → genau EINE Kopie auf dem Brett', x.kopien === 1, x);
  R.check('Slave Trader wurde nicht geopfert (liegt nicht in der Ablage)', x.slaveTraderOnBoard && !x.ablage.includes('Slave Trader'), x);
  R.check('Kartenbilanz stimmt (kein +1 Suspicious Monster)', !x.bilanz.some(e => e.startsWith(SM)), x.bilanz);
  R.check('keine Engine-Fehler', x.errors.length === 0, x.errors);
  R.finish();
})();
