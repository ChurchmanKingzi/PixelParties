'use strict';
// A06-rebelliokai-09 · Calamitusk und Chaorc Friendly Fireballer holen Karten aus Deck/Ablage trotz Knight-of-Kings-[B]-Sperre
// Kartentext Knight of Kings [B]: „… your opponent cannot move cards from their deck or discard pile to anywhere else
//   (but they can still draw)." (Engine-Vertrag `pileOutAllowed`, CARD_API.md „Stapel-Ausgangssperre … MANDATORY für direkte Splices")
// Beobachtung: Beide Skripte splicen selbst (`calamitusk-the-chaorc-war-chief.js:139`, `chaorc-friendly-fireballer.js:266/281`;
//   bekannte Altlast des v819-Sweeps, `scripts/no-splice-baseline.json`) und fragen `pileOutAllowed` nicht.
// Aufbau: Sitz 1 hält Board of Kings + Knight [B] + Rook [B]. Sitz 0: (a) Calamitusk tributiert und beschwört Cannon Fodder AUS DEM DECK,
//   (b) Friendly Fireballer holt (nach einem Opfer durch Pyre Grill Master) einen Fireball aus Deck/Ablage auf die Hand.
// Erwartung: gesperrt – kein Zug aus Deck/Ablage.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const lock = (t) => { t.putArea(1, 'Board of Kings'); t.put(1, 0, 0, 'Knight of Kings [B]'); t.put(1, 0, 1, 'Rook of Kings [B]'); };

  // (a) Calamitusk
  let t = await H.fresh({ deck: [['Chaorc Cannon Fodder', ...Array(10).fill(D)], []], heroes: [['Calamitusk, the Chaorc War Chief', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], []] });
  lock(t); t.setAbilities(0, 0, [['Summoning Magic']]);
  const trib = t.put(0, 0, 0, D); trib.turnPlayed = t.gs.turn - 1;
  t.targetFn = (valid) => [valid.find(v => v.slotIdx === 0 && v.type === 'equip').id];
  R.check('Aufbau: Deck von Sitz 0 ist gesperrt', t.engine.pileOutAllowed(0, 'deck') === false);
  await t.activateHero(0, 0, {});
  const fodderAufBrett = [0, 1, 2].some(z => t.zone(0, 0, z) === 'Chaorc Cannon Fodder');
  R.check('Calamitusk: Cannon Fodder kommt NICHT aus dem gesperrten Deck aufs Brett', !fodderAufBrett, [0, 1, 2].map(z => t.zone(0, 0, z)));
  R.check('(a) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  // (b) Friendly Fireballer
  t = await H.fresh({ deck: [['Fireball', ...Array(10).fill(D)], []], discard: [['Fireball'], []] });
  lock(t);
  t.put(0, 0, 0, 'Chaorc Friendly Fireballer');
  const v = t.put(0, 0, 1, D); v.turnPlayed = t.gs.turn - 1;
  const pyre = t.put(0, 0, 2, 'Chaorc Pyre Grill Master'); pyre.turnPlayed = t.gs.turn - 1;
  t.gs.currentPhase = 2; t.resetActions(0);
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Chaorc Pyre Grill Master', answer: () => ({ optionId: 'atk' }) });
  t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: d.options[0].id }) });
  t.targetFn = (valid) => { const x = valid.find(y => y.cardName === D); return [x ? x.id : valid[0].id]; };
  await t.activateCreature(0, 0, 2);
  R.check('Friendly Fireballer: kein Fireball aus gesperrtem Deck/Ablage auf die Hand', !t.pile(0, 'hand').includes('Fireball'), { hand: t.pile(0, 'hand'), deck: t.pile(0, 'mainDeck').length, discard: t.pile(0, 'discardPile') });
  R.check('(b) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
