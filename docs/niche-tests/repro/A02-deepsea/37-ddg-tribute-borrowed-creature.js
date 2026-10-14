'use strict';
// A02-deepsea-37 · Dark Deepsea God: eine per Succubus geliehene Gegnerkreatur als Tribut (Entscheidung Al 14.10.2026: „Auch geliehene Creatures sollen sogar möglich sein!")
//
// Kartentext (DDG): „You can only play this Creature by returning 2 or more Creatures whose combined original levels are 4 or higher and that were not summoned this turn
//   from your side of the board to your hand and placing it into one of their Support Zones."
// Aufbau: Seat 0: DDG auf der Hand, eigene Deepsea Werewolf (Lv2) in Held 0 / Slot 0. Seat 1: Deepsea Poltergeister (Lv2) in Held 1 / Slot 0, von Seat 0 geliehen
//   (Kontrolle bei mir, Brett beim Gegner; `_stealImmortal`). Ohne die geliehene Karte wäre der Tribut (Lv2) nicht ausreichend.
// Erwartung (NEUE Regel W5a): Die geliehene Kreatur steht in der Tributliste, DDG ist spielbar (Summe 4), die Poltergeister gehen auf die Hand des SPIELERS („to your hand", Sitz 0),
//   bleiben aber Eigentum des Besitzers (Sitz 1): wird sie dort abgelegt, landet sie in der Ablage von Sitz 1 (W3). Der Gegner bekommt sie nicht auf die Hand.
// (Vor Welle 5 erwartete das Repro das Gegenteil: geliehene Kreatur kein Tribut.)
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
  R.check('die geliehene Poltergeister steht in der Tributliste und DDG wurde gespielt', (tribut || []).includes('Deepsea Poltergeister') && r === true, { r, tribut });
  R.check('der Gegner bekommt seine Karte nicht auf die Hand; sie liegt auf der Hand des Spielers (Sitz 0)', !t.pile(1, 'hand').includes('Deepsea Poltergeister') && t.pile(0, 'hand').includes('Deepsea Poltergeister'), { hand1: t.pile(1, 'hand'), hand0: t.pile(0, 'hand') });
  R.check('Kartenbilanz sauber: Poltergeister weder verloren noch doppelt', [0, 1].reduce((n, sx) => n + ['hand', 'discardPile', 'mainDeck', 'deletedPile'].reduce((m, k) => m + t.pile(sx, k).filter(x => x === 'Deepsea Poltergeister').length, 0), 0) === 1, 0);
  // W3: als gestohlene Handkarte abgeworfen → Ablage des Besitzers
  await t.run(() => t.engine.actionDiscardHandCard(0, 'Deepsea Poltergeister', t.pile(0, 'hand').indexOf('Deepsea Poltergeister')));
  R.check('abgeworfen: Poltergeister liegt in der Ablage ihres Besitzers (Sitz 1), nicht in der von Sitz 0', t.pile(1, 'discardPile').includes('Deepsea Poltergeister') && !t.pile(0, 'discardPile').includes('Deepsea Poltergeister'), { a0: t.pile(0, 'discardPile'), a1: t.pile(1, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
