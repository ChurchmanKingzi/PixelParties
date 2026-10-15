'use strict';
// A02-deepsea-03 · Arrival from the Cosmic Depths: die auf die Gegenseite platzierte Kreatur gehört (und endet) beim Gegner
//
// Kartentext (Arrival): „Choose a "Cosmic Depths" Creature from your deck and place it into the free Support Zone of a Hero
// your opponent controls. Then, choose a "Cosmic Depths" Creature 1 level higher … and summon it with a Hero you control …"
// Vorbild/Konvention: Powder Keg (`powder-keg.js` Z. 30–45, 301–304): Kreatur steht auf der Gegenseite, aber `originalOwner` = Wirker,
//   damit der Leichnam in die Ablage des Wirkers geht („Gestohlene/fremd platzierte Karten gehen in die Ablage ihres Besitzers").
// WELLE 9: Al hat den Ist-Stand bestätigt („funktioniert wie gewollt“) – die Prüfungen unten sind umgestellt. Alte Erwartung (überholt): Die Karte stammt aus MEINEM Deck; stirbt sie, landet sie in MEINER Ablage.
// Beobachtet: `inst.owner = inst.controller = inst.originalOwner = Gegner` → die Karte aus meinem Deck landet in der ABLAGE DES GEGNERS
//   (und könnte per Deepsea Castle/Shapeshift des Gegners sogar auf SEINE Hand zurückgeholt werden, weil er sie kontrolliert).
//   Außerdem zählt der Analyzer dort „your opponent draws" aus Sicht des Gegners, also MEINE Züge.
// Ursache: `arrival-from-the-cosmic-depths.js` ruft `summonCreatureWithHooks(firstName, oi, …)` ohne `originalOwner`-Korrektur (Powder Keg setzt sie nach).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const AN = 'Analyzer from the Cosmic Depths', GA = 'Gatherer from the Cosmic Depths';
  const t = await H.fresh({ hand: [['Arrival from the Cosmic Depths'], []], deck: [[AN, GA, H.INERT.creature, H.INERT.creature], [H.INERT.creature, H.INERT.creature, H.INERT.creature]] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic']]);
  t.targetFn = (valid) => [valid[0].id];
  await t.play(0, 'Arrival from the Cosmic Depths', { hero: 0 });
  const an = t.find(AN, 'support');
  R.check('Vorbedingung: Analyzer liegt auf der Gegenseite', an && an.owner === 1 && t.gs.players[1].supportZones[0][0][0] === AN, an && an.owner);
  R.note('Analyzer owner/controller/originalOwner', [an.owner, an.controller, an.originalOwner]);
  await t.run(() => t.engine.actionDrawCards(0, 1));
  R.note('Analyzer-Counter nach EIGENEM Ziehen des Spielers (Gegner-Analyzer zählt „your opponent draws")', an.counters.changeCounter || 0);
  await t.run(() => t.engine.actionDestroyCard({ name: 'Src', owner: 0 }, an));
  // Welle 9 (Al, 15.10.2026, Q8): „Das funktioniert wie gewollt.“ – Platz + Kontrolle + Ablage beim Gegner sind Absicht; das Repro prüft jetzt diesen Ist-Stand (früher: Ablage beim Wirker).
  R.check('Welle 9: Die platzierte Karte endet in der Ablage des Gegners (gewollt)', t.pile(1, 'discardPile').includes(AN), { meine: t.pile(0, 'discardPile'), gegner: t.pile(1, 'discardPile') });
  R.check('Welle 9: Sie liegt nicht in meiner Ablage', !t.pile(0, 'discardPile').includes(AN), t.pile(0, 'discardPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  // Folge: weil der Gegner die Kreatur kontrolliert, kann er sie mit Shapeshift auf SEINE Hand nehmen (Zugabe einer Karte aus meinem Deck)
  const t2 = await H.fresh({ hand: [['Arrival from the Cosmic Depths'], ['Shapeshift', H.INERT.creature]], deck: [[AN, GA, H.INERT.creature, H.INERT.creature], [H.INERT.creature, H.INERT.creature, H.INERT.creature]] });
  t2.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic']]);
  t2.targetFn = (valid) => [valid[0].id];
  await t2.play(0, 'Arrival from the Cosmic Depths', { hero: 0 });
  const an2 = t2.find(AN, 'support'); an2.turnPlayed = 1; t2.targetFn = null;
  t2.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  t2.script.push({ match: d => d.type === 'pickHandCard', answer: () => { const i = t2.pile(1, 'hand').indexOf(H.INERT.creature); return { cardName: H.INERT.creature, handIndex: i, selectedCards: [{ cardName: H.INERT.creature, handIndex: i }] }; } });
  await t2.play(1, 'Shapeshift', { hero: 0 });
  R.check('Welle 9: Der Gegner kontrolliert die Kreatur und kann sie per Shapeshift auf seine Hand holen (gewollt)', t2.pile(1, 'hand').includes(AN), t2.pile(1, 'hand'));
  R.finish();
})();
