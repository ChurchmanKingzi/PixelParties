'use strict';
// A06-rebelliokai-03 · Bone Dog + Shepherd: Bone Dog wird bezahlt, die Wiederbelebung fizzelt am Slot des Shepherd
// Kartentexte: Loyal Bone Dog: „…discard this card from your hand to revive that Creature immediately into the same
//   Support Zone it occupied." · Loyal Shepherd: „…when a "Loyal" Creature you control … is defeated by an opponent's
//   card or effect, you may immediately search your deck for a "Loyal" Creature with a different name and summon it
//   into the same Support Zone as an additional Action."
// Beobachtung: Bone Dog wird im Vor-Niederlage-Fenster bezahlt (Karte abgeworfen), die Wiederbelebung läuft aber ERST
//   NACH den Todes-Listenern (_engine.js `_wiederbelebungNachTod`, Platz belegt → fizzelt, v1360). Der Shepherd
//   (onCreatureDeath) füllt den Slot vorher → die Beagle bleibt tot, Bone Dog ist verbraucht, nur ein Ersatz-Loyal kommt.
// Erwartung (Frage, Stufe C): „immediately revive" – soll die Wiederbelebung VOR den Todes-Triggern geschehen
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
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
