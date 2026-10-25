'use strict';
// W75 · Audit P5 · Darion × Wall Breaker General Ralzish / Vena, the Bounty Huntress — Heldeneffekte, die EINE Karte vom Brett schicken — im Stapel trifft die Wahl genau die gewaehlte Karte (Absicherung, war schon korrekt).
// Kartentexte: Ralzish „…you may choose any card on the board that is not a Hero and send it to the discard pile."; Vena „…eine Karte aus seinen Support Zones auf die Ablage" (Confiscate).
// Erwartet: Stapel Club / Blade / Crown, gewaehlt wird die MITTLERE (Blade): nur Blade wandert in die Ablage, Club und Crown bleiben; gegnerischer UND eigener Stapel (Ralzish), gegnerischer Stapel (Vena).
// Aufruf: node docs/niche-tests/repro/W75/h-P5-07-ralzish-vena-waehlen-gewaehlte-karte.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite, hi, slot) {
  const ps = t.gs.players[seite];
  ps.supportZones[hi][slot] = [];
  return NAMEN.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();

  for (const eigene of [false, true]) {
    R.section(`Ralzish, ${eigene ? 'eigener' : 'gegnerischer'} Darion-Stapel`);
    const seite = eigene ? 0 : 1, hi = eigene ? 1 : 0;
    const t = await H.fresh({ active: 0, heroes: eigene ? [['Wall Breaker General Ralzish', D, null], [F, null, null]] : [['Wall Breaker General Ralzish', null, null], [D, null, null]],
      hand: [[F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    t.put(0, 0, 0, 'ZZ Dummy'); t.put(0, 0, 1, 'ZZ Dummy');   // genau 2 Kreaturen bei Ralzish
    const insts = stapel(t, seite, hi, 1);
    t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: insts[1].id }) });
    t.targetFn = (valid) => [valid.find(x => x.type === 'equip' && x.owner === seite && x.slotIdx === 1 && x.heroIdx === hi).id];
    const r = await t.activateHero(0, 0);
    await t.drain();
    const zone = t.gs.players[seite].supportZones[hi][1];
    R.check('Effekt gewirkt', r === true, r);
    R.check('nur die mittlere Karte (Blade) wurde abgeraeumt', JSON.stringify(zone) === JSON.stringify([NAMEN[0], NAMEN[2]]) && t.pile(seite, 'discardPile').includes(NAMEN[1]), [zone, t.pile(seite, 'discardPile')]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Vena, Confiscate im gegnerischen Darion-Stapel');
  {
    const t = await H.fresh({ active: 0, heroes: [['Vena, the Bounty Huntress', null, null], [D, null, null]], hand: [[F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const insts = stapel(t, 1, 0, 1);
    t.gs.players[1].heroes[0]._bountyBy = 0;
    t.script.push({ match: d => d.type === 'optionPicker' && /Vena/.test(d.title), answer: () => ({ optionId: 'discard' }) });
    t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: insts[1].id }) });
    t.targetFn = (valid) => [valid[0].id];
    const r = await t.activateHero(0, 0);
    await t.drain();
    const zone = t.gs.players[1].supportZones[0][1];
    R.check('Effekt gewirkt', r === true, r);
    R.check('nur die mittlere Karte (Blade) wurde konfisziert', JSON.stringify(zone) === JSON.stringify([NAMEN[0], NAMEN[2]]) && t.pile(1, 'discardPile').includes(NAMEN[1]), [zone, t.pile(1, 'discardPile')]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
