'use strict';
// W64-a-01 · Ein Zugende-Reiter (`gs._spellEndsTurn`) darf den Zug, in dem er entstand, nicht überleben
// Bugreport (Tester): „Mein Zug 3 wurde nach Pillage abgeschnitten, alle weiteren Züge wurden übersprungen."
// Ursache (Teil): `gs._spellEndsTurn` wird nur vom Server-Pfad der setzenden Aktion eingelöst und nie zurückgesetzt. Blieb er stehen,
// beendete die NÄCHSTE beliebige Aktion (hier: die freie Ability Pillage) den Zug des falschen Spielers.
// Erwartung: Nach zwei Zugwechseln ist der Marker weg, und Pillage lässt den Zug offen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({
    heroes: [['Codumbus, the Clueless Voyager', 'Jean, the Pillaging Knight', 'Champion, the Stormbringer'],
             ['Tharx, the Never-Losing General', 'Klaus, the Cult Leader', 'Ingo, Investor of Evil']],
    hp: 400, turn: 2, phase: 2, active: 0,
    deck: [Array(30).fill('ZZ Dummy'), Array(30).fill('ZZ Dummy')],
  });
  t.setAbilities(0, 1, [['Pillage', 'Pillage', 'Pillage'], [], []]);
  t.gs._spellEndsTurn = true;       // Rest einer früheren Aktion
  t.gs._pendingActionBurn = { pi: 1, heroIdx: 0 };
  await t.endTurn();
  await t.endTurn();
  R.check('Marker _spellEndsTurn ist nach den Zugwechseln weg', t.gs._spellEndsTurn === undefined, t.gs._spellEndsTurn);
  R.check('Marker _pendingActionBurn ist nach den Zugwechseln weg', t.gs._pendingActionBurn === undefined);
  await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 1, zoneIdx: 0 }));
  R.check('Pillage beendet den Zug nicht', t.gs.activePlayer === 0 && t.gs.currentPhase !== 5, `aktiv=${t.gs.activePlayer} phase=${t.gs.currentPhase}`);
  R.finish();
})();
