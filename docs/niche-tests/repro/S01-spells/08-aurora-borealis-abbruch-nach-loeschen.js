'use strict';
// S01-08 · Aurora Borealis (Magic Arts 3): Abbruch der Zielwahl des ausgeführten Zaubers – die beiden anderen Zauber sind schon gelöscht
// Kartentext: „Choose up to 1/2/3 Spells with different names from your deck, reveal them and add them to your hand. If the user has Magic Arts 3, you may delete 2 of
//   your chosen Spells to immediately perform the third one as an additional Action with the user."
// Regel 23.9 (CARD_API): „Abbruch heißt: nichts ist passiert."
// Aufbau: Held 0 mit Magic Arts 3 + Destruction Magic 3; Deck: Fireball, Burning Finger, Boiling Oil, …. Wahl: alle drei; „Delete 2 …?" = ja; auszuführen: Fireball;
//   die Zielwahl von Fireball wird mit „Abbrechen" (null) beendet.
// Erwartet (eine Lesart): wer die Ausführung abbricht, verliert die beiden Zauber nicht (nichts ist passiert) – die drei Zauber bleiben auf der Hand.
// Beobachtet: Burning Finger und Boiling Oil sind gelöscht (`aurora-borealis.js` löscht VOR `_castSpellImmediately`), Fireball bleibt auf der Hand, kein Schaden.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Aurora Borealis'], []], deck: [['Fireball', 'Burning Finger', 'Boiling Oil', 'Fireball', 'Big Oopsie', H.INERT.creature], []],
    abilities: { 0: { 0: [['Magic Arts', 'Magic Arts', 'Magic Arts'], ['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], []] } } });
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: ['Fireball', 'Burning Finger', 'Boiling Oil'] }) });
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Aurora Borealis', answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Aurora Borealis', answer: () => ({ cardName: 'Fireball' }) });
  t.targetFn = () => null;                                   // Abbruch der Zielwahl von Fireball
  await t.play(0, 'Aurora Borealis', { hero: 0, noGrant: true });
  const hand = t.pile(0, 'hand'), del = t.pile(0, 'deletedPile');
  R.check('nach dem Abbruch der Ausführung sind keine Zauber gelöscht (nichts ist passiert)', del.length === 0, { hand, geloescht: del, hpGegner: t.hp(1, 0) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
