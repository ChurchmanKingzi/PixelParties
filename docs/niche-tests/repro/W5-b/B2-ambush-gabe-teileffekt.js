'use strict';
// W5b-B2 (zu F01-02 / M02-18) · Ambush the Scout gegen „Karten in die Gegnerhand geben" – Entscheidung Al (Welle 5):
//   „Korrekt, nur die zu gebende geht aufs Deck. Das [Geschenk] zählt insgesamt nicht als negiert, sein one per game bleibt verbraucht."
// Ambush: „Negate that effect. Then, your opponent discards 2 cards …" (Rulings: negiert wird NUR der Teileffekt)
// Erwartung (Birthday Present UND Magic Lamp): die entfallene Gabe liegt wieder im Deck (Birthday: oben), die EIGENEN 2 Karten kommen auf die Hand des Wirkers,
//   das Geschenk selbst ist aufgelöst (Artefakt in der Ablage / Trank verbraucht), der Gegner hat Ambush gespielt; Kartenbilanz stimmt.
//   Charme Lv2 (once per turn): die negierte Aktivierung gilt als aufgelöst – der Einmal-Stempel bleibt verbraucht (Ruling „Ambush bleibt wie im Skript").
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [['Birthday Present'], ['Ambush the Scout', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler']],
      deck: [['Fireball', 'Beer', 'Coffee', 'ZZ Dummy', 'ZZ Dummy'], undefined] });
    t.grantFor(1, 0, 'Ambush the Scout');
    t.policy.confirm = true;
    const vorher = t.census();
    await t.play(0, 'Birthday Present', { hero: 0 });
    const hand0 = t.pile(0, 'hand'), deck0 = t.pile(0, 'mainDeck'), hand1 = t.pile(1, 'hand'), abl1 = t.pile(1, 'discardPile');
    const eigene = ['Fireball', 'Beer', 'Coffee'].filter(n => hand0.includes(n));
    R.check('Birthday Present: genau 2 der 3 aufgedeckten Karten liegen auf der Wirkerhand', eigene.length === 2, hand0);
    const gabe = ['Fireball', 'Beer', 'Coffee'].find(n => !hand0.includes(n));
    R.check('Birthday Present: die entfallene Gabe liegt oben im Deck', deck0[0] === gabe, { gabe, top: deck0.slice(0, 3) });
    R.check('Birthday Present: Gegner hat Ambush gespielt (Ablage)', abl1.includes('Ambush the Scout'), { abl1, hand1 });
    R.check('Birthday Present: Gegnerhand hat nichts bekommen', !hand1.includes(gabe), hand1);
    R.check('Birthday Present: Kartenbilanz stimmt', t.censusDiff(vorher, t.census()).filter(s => !/Birthday Present|Ambush|ZZ Filler/.test(s)).length === 0, t.censusDiff(vorher, t.census()));
    R.check('Birthday Present: keine Engine-Fehler, Audit leer', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await H.fresh({ hand: [['Magic Lamp'], ['Ambush the Scout', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler']], hp: 800, deck: [['Fighting', 'Toughness', 'Wealth', 'ZZ Dummy'], ['ZZ Dummy']], turn: 5 });
    t.setAbilities(1, 0, [['Decay Magic'], [], []]);
    t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: ['Fighting', 'Toughness', 'Wealth'] }) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: 'Toughness', source: d.cards[0].source }) });
    const vorher = t.census();
    await t.play(0, 'Magic Lamp', { hero: 0 });
    const hand0 = t.pile(0, 'hand'), deck0 = t.pile(0, 'mainDeck'), abl1 = t.pile(1, 'discardPile');
    R.check('Magic Lamp: Ambush negiert die Gabe (Voraussetzung)', abl1.includes('Ambush the Scout'), abl1);
    R.check('Magic Lamp: die eigenen 2 Karten (Fighting, Wealth) liegen auf der Wirkerhand', hand0.includes('Fighting') && hand0.includes('Wealth') && !hand0.includes('Toughness'), hand0);
    R.check('Magic Lamp: die Gabe (Toughness) bleibt im Deck, der Gegner bekommt nichts', deck0.includes('Toughness') && !t.pile(1, 'hand').includes('Toughness'), { deck0, h1: t.pile(1, 'hand') });
    R.check('Magic Lamp: Kartenbilanz stimmt', t.censusDiff(vorher, t.census()).filter(s => !/Magic Lamp|Ambush|ZZ Filler/.test(s)).length === 0, t.censusDiff(vorher, t.census()));
    R.check('Magic Lamp: keine Engine-Fehler, Audit leer', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await H.fresh({ hand: [[], ['Ambush the Scout', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler']], hp: 800 });
    t.setAbilities(0, 0, [['Charme', 'Charme'], [], []]);
    t.setAbilities(1, 0, [['Decay Magic'], [], []]);
    t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: 'ZZ Filler', handIndex: 1 }) });
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    const abl1 = t.pile(1, 'discardPile');
    R.check('Charme Lv2: Ambush hat die Aktivierung negiert (Voraussetzung)', abl1.includes('Ambush the Scout'), { abl1, h0: t.pile(0, 'hand') });
    const stempel = Object.keys(t.gs.hoptUsed || {}).filter(k => /charme/i.test(k));
    R.check('Charme Lv2: die negierte (aufgelöste) Aktivierung bleibt gestempelt – zweiter Versuch im selben Zug ist nicht möglich', stempel.length > 0, t.gs.hoptUsed);
    R.check('Charme Lv2: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
