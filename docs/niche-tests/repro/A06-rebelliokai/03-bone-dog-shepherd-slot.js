'use strict';
// A06-rebelliokai-03 · Bone Dog + Shepherd: Bone Dog wird bezahlt, die Wiederbelebung fizzelt am Slot des Shepherd
// Kartentexte: Loyal Bone Dog: „…discard this card from your hand to revive that Creature immediately into the same
//   Support Zone it occupied." · Loyal Shepherd: „…when a "Loyal" Creature you control … is defeated by an opponent's
//   card or effect, you may immediately search your deck for a "Loyal" Creature with a different name and summon it
//   into the same Support Zone as an additional Action."
// Beobachtung: Bone Dog wird im Vor-Niederlage-Fenster bezahlt (Karte abgeworfen), die Wiederbelebung läuft aber ERST
//   NACH den Todes-Listenern (_engine.js `_wiederbelebungNachTod`, Platz belegt → fizzelt, v1360). Der Shepherd
//   (onCreatureDeath) füllt den Slot vorher → die Beagle bleibt tot, Bone Dog ist verbraucht, nur ein Ersatz-Loyal kommt.
// ENTSCHIEDEN (Al, Welle 10, Q38: „Ja, Bone Dog feuert zuerst“): die Wiederbelebung („immediately“) wird VOR den Todes-Triggern anderer Karten aufgelöst.
// Erwartung (früher Frage, Stufe C): „immediately revive" – soll die Wiederbelebung VOR den Todes-Triggern geschehen
//   (dann hätte Shepherd keinen freien Slot)? Zumindest sollte der Spieler vor der Bezahlung wissen, dass der Slot
//   noch von Shepherd besetzt werden kann.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const src = { name: 'Opp Source', owner: 1, heroIdx: 0 };
  const dog = 'Loyal Bone Dog';
  const t = await H.fresh({ hand: [[dog], []], deck: [['Loyal Terrier', 'Loyal Pinpom', ...Array(10).fill(H.INERT.creature)], []] });
  t.grantFor(0, 0, dog);
  const b = t.put(0, 0, 0, 'Loyal Beagle');
  t.put(0, 0, 1, 'Loyal Shepherd');
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Loyal Shepherd', answer: () => ({ cardName: 'Loyal Terrier' }) });
  await t.run(() => t.engine.actionDealCreatureDamage(src, b, 500, 'creature', { sourceOwner: 1 }));
  const dogPaid = !t.pile(0, 'hand').includes(dog);
  R.note('Ergebnis', { slot0: t.zone(0, 0, 0), dogDiscarded: dogPaid, discard: t.pile(0, 'discardPile'), logs: t.lg('creature_revive_fizzle') });
  R.check('Bone Dog wurde bezahlt UND die Beagle lebt (Wiederbelebung hat gewirkt)', !dogPaid || t.zone(0, 0, 0) === 'Loyal Beagle',
    { slot0: t.zone(0, 0, 0), dogPaid, discard: t.pile(0, 'discardPile') });
  R.check('Bone Dog feuert zuerst: Beagle lebt UND wurde bezahlt', dogPaid && t.zone(0, 0, 0) === 'Loyal Beagle', { slot0: t.zone(0, 0, 0), dogPaid });
  R.check('Shepherd fand den Platz belegt: kein Ersatz-Loyal (Terrier bleibt im Deck)', !t.zone(0, 0, 1).includes('Terrier') && t.pile(0, 'mainDeck').includes('Loyal Terrier')
    && ![0, 1, 2].some(z => t.zone(0, 0, z) === 'Loyal Terrier'), { deck: t.pile(0, 'mainDeck').slice(0, 3), z: [0, 1, 2].map(z => t.zone(0, 0, z)) });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  // Zerstörungsweg: dieselbe Reihenfolge
  const t2 = await H.fresh({ hand: [[dog], []], deck: [['Loyal Terrier', 'Loyal Pinpom', ...Array(10).fill(H.INERT.creature)], []] });
  t2.grantFor(0, 0, dog);
  const b2 = t2.put(0, 0, 0, 'Loyal Beagle');
  t2.put(0, 0, 1, 'Loyal Shepherd');
  t2.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Loyal Shepherd', answer: () => ({ cardName: 'Loyal Terrier' }) });
  await t2.run(() => t2.engine.actionDestroyCard(src, b2));
  R.check('Zerstören: Beagle lebt (Bone Dog zuerst) und Shepherd bekommt keinen Platz', t2.zone(0, 0, 0) === 'Loyal Beagle' && ![0, 1, 2].some(z => t2.zone(0, 0, z) === 'Loyal Terrier'), [0, 1, 2].map(z => t2.zone(0, 0, z)));
  R.check('Zerstören: keine Engine-Fehler / Zustand sauber', t2.errors.length === 0 && t2.audit().length === 0, [t2.errors, t2.audit()]);
  // Terrier-Todesbeobachter feuert trotzdem (die Beagle ist gestorben und wurde sofort wiederbelebt)
  const t3 = await H.fresh({ hand: [[dog], []] });
  t3.grantFor(0, 0, dog);
  const b3 = t3.put(0, 0, 0, 'Loyal Beagle');
  t3.put(0, 0, 1, 'Loyal Terrier');
  t3.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === 1); return x ? [x.id] : null; };
  const hp0 = t3.hp(1, 0) + t3.hp(1, 1) + t3.hp(1, 2);
  await t3.run(() => t3.engine.actionDealCreatureDamage(src, b3, 500, 'creature', { sourceOwner: 1 }));
  const hp1 = t3.hp(1, 0) + t3.hp(1, 1) + t3.hp(1, 2);
  R.check('Terrier-Todesbeobachter feuert trotz Sofort-Wiederbelebung (50 Schaden)', t3.zone(0, 0, 0) === 'Loyal Beagle' && hp0 - hp1 === 50, { hp: hp0 - hp1, slot0: t3.zone(0, 0, 0) });
  R.finish();
})();
