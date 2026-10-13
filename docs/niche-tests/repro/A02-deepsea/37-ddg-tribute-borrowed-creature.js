'use strict';
// A02-deepsea-37 · Dark Deepsea God: eine per Succubus geliehene Gegnerkreatur zählt als Tribut „von meiner Seite des Bretts"
//
// Kartentext (DDG): „You can only play this Creature by returning 2 or more Creatures whose combined original levels are 4 or higher and that were not summoned this turn
//   from your side of the board to your hand and placing it into one of their Support Zones."
// Aufbau: Seat 0: DDG auf der Hand, eigene Deepsea Werewolf (Lv2) in Held 0 / Slot 0. Seat 1: Deepsea Poltergeister (Lv2) in Held 1 / Slot 0, von Seat 0 geliehen
//   (Kontrolle bei mir, Brett beim Gegner; `_stealImmortal`). Ohne die geliehene Karte wäre der Tribut (Lv2) nicht ausreichend.
// Erwartung: Die geliehene Kreatur steht auf der Seite des Gegners und ist kein zulässiger Tribut; DDG ist nicht spielbar (Summe 2 < 4), jedenfalls wird sie nicht
//   als Tribut angeboten und der Gegner bekommt seine Karte nicht auf diesem Weg zurück.
// Beobachtet: Die Tributliste enthält Werewolf UND Poltergeister; DDG wird gespielt (Summe 4), die Poltergeister wandern auf die HAND DES GEGNERS, DDG landet in der Werewolf-Zone.
// Ursache: `dark-deepsea-god.js` `_collectTributeCandidates` nimmt `engine.getSacrificableCreatures(pi)` (Kontrolle, `_engine.js` ~Z. 26471) statt der Kreaturen auf der eigenen Seite.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Dark Deepsea God'], []], deck: [Array(10).fill(H.INERT.creature)] });
  const mine = t.put(0, 0, 0, 'Deepsea Werewolf'); mine.turnPlayed = 1;
  const theirs = t.put(1, 1, 0, 'Deepsea Poltergeister'); theirs.turnPlayed = 1;
  await t.run(() => t.engine.actionStealCreature(0, theirs, { damageImmune: true, sourceName: 'Deepsea Succubus' }));
  let tribut = null;
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
  t.targetFn = (valid, cfg) => { tribut = valid.filter(v => v.type === 'equip').map(v => v.cardName); return valid.filter(v => v.type === 'equip').map(v => v.id); };
  const r = await t.play(0, 'Dark Deepsea God', { hero: 0, slot: 1, noGrant: true });
  R.check('die geliehene Poltergeister steht nicht in der Tributliste', !(tribut || []).includes('Deepsea Poltergeister'), { r, tribut });
  R.check('der Gegner bekommt seine Karte nicht als „mein Tribut" auf die Hand', !t.pile(1, 'hand').includes('Deepsea Poltergeister'), { hand1: t.pile(1, 'hand'), hand0: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
