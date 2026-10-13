'use strict';
// M02-02 · Muscle Training: Held mit vollem Fighting-Stapel (Lv3) und freier Ability-Zone – die Fighting-Karte verschwindet aus dem Deck
// Kartentext: „Search your deck for a copy of Fighting and attach it to the user as an additional attachment."
// Erwartung: Entweder wird Muscle Training nicht gespielt/angeboten (kein Platz für Fighting: ein zweiter Fighting-Stapel ist nicht erlaubt,
//   `engine.abilityZielZone` liefert dafür -1) oder die Karte wird abgebrochen und kommt zurück auf die Hand, ohne dass das Deck verändert wird
//   (Regel 23.9: Abbruch = nichts ist passiert). Auf keinen Fall darf eine Karte verloren gehen.
// Beobachtet: `heroCanAcceptFighting` (muscle-training.js:31) akzeptiert JEDE freie Zone, auch wenn schon ein voller Fighting-Stapel existiert.
//   `spellPlayCondition` ist wahr, `onPlay` zieht Fighting per `takeFromPile` aus dem Deck (Z. 135), `abilityZielZone` liefert -1,
//   und `if (targetZone < 0) return;` (Z. 143) lässt die Karte stillschweigend verschwinden: weder Hand, Deck, Ablage, Gelöscht noch Brett.
//   Muscle Training selbst geht in die Ablage, die Aktion ist verbraucht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], []], hp: 800, deck: [['Fighting', H.INERT.creature, H.INERT.creature], []] });
  t.setAbilities(0, 1, [['Fighting', 'Fighting', 'Fighting'], [], []]);   // Rick: Fighting Lv3 in Zone 0, Zonen 1+2 frei
  t.setHand(0, ['Muscle Training']);
  const vorher = t.census();
  const r = await t.play(0, 'Muscle Training', { hero: 1, noGrant: true });
  const nachher = t.census();
  const diff = t.censusDiff(vorher, nachher).filter(x => !x.startsWith('Muscle Training'));
  R.note('Ergebnis', { r, ability: t.gs.players[0].abilityZones[1], deck: t.pile(0, 'mainDeck'), ablage: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
  R.check('Kartenbilanz: keine Karte verschwunden (außer Muscle Training selbst bewegt)', diff.length === 0, diff);
  R.check('Fighting-Stapel hat nicht mehr als 3 Karten und es gibt keine zweite Fighting-Zone', t.gs.players[0].abilityZones[1].filter(z => z[0] === 'Fighting').length === 1, t.gs.players[0].abilityZones[1]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
