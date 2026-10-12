'use strict';
// C01-creatures-03 · Black Marketeer: „1 pro Spiel" wird von Effekt-Platzierungen (Forceful Revival) umgangen
// Kartentext: „When you play this Creature, you may choose up to 5 cards from your discard pile, shuffle them back into your deck and gain 4 Gold per card. …
//   You can only summon 1 "Black Marketeer" per game."
// Skript-Kopf (black-marketeer.js): „Klausel 3 zaehlt JEDE Beschwoerung von ueberall, auch durch Effekte — nicht nur das regulaere Ausspielen aus der Hand."
// Aufbau: Sitz 0 hat seinen Marketeer schon beschworen (ps._marketeerSummoned) UND einen auf dem Brett; ein zweiter Marketeer liegt in der Ablage.
//   Held 0 hat Fighting Lv3; Forceful Revival (Attack, „Choose a level 1 or lower Creature from your discard pile and place it …") holt ihn zurueck.
// Erwartung: Der zweite Marketeer ist KEINE erlaubte Beschwoerung (Platzieren zaehlt als Effekt-Beschwoerung, Ruling 8.9.) -> er wird nicht angeboten bzw. nicht platziert.
// Beobachtet: Er wird platziert (2 Marketeers auf dem Brett) und seine On-Play-Klausel (Recycling + Gold) feuert ein zweites Mal.
// Ursache: black-marketeer.js nutzt `canSummon` (nur Hand-/Galerie-Filter, `isCreatureSummonable`) statt `beforeSummon`; `actionPlaceCreature` und Forceful Revival
//   (`_eligibleCreatureNames`) fragen `canSummon` nicht. Gegenprobe: Crum/Albrecht („You can only control 1") nutzen `beforeSummon` und werden korrekt abgewiesen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ discard: [['Black Marketeer', 'Fireball'], []], hand: [['Forceful Revival'], []] });
  const ps = t.gs.players[0];
  t.put(0, 1, 0, 'Black Marketeer'); t.find('Black Marketeer', 'support').turnPlayed = 1;
  ps._marketeerSummoned = true;
  t.setAbilities(0, 0, [['Fighting', 'Fighting', 'Fighting'], [], []]);
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Forceful Revival', answer: () => ({ cardName: 'Black Marketeer' }) });
  const gold0 = ps.gold;
  await t.play(0, 'Forceful Revival', { noGrant: true });
  const n = t.inst(c => c.name === 'Black Marketeer' && c.zone === 'support').length;
  R.check('nur 1 Black Marketeer auf dem Brett (2. Beschwoerung/Platzierung verboten)', n === 1, { aufDemBrett: n });
  R.check('On-Play-Klausel feuert nicht ein zweites Mal (Recycling-Galerie nie geoeffnet)', !t.prompts.some(p => p.d.type === 'cardGalleryMulti' && p.d.title === 'Black Marketeer'), t.prompts.map(p => p.d.type + ':' + (p.d.title || '')));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
