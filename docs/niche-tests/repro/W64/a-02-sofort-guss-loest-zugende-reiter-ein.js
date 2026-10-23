'use strict';
// W64-a-02 · Ein Sofort-Guss (Zusatzaktion, Master's Plan, Silence-Bonus …) löst „Immediately end your turn afterwards" selbst ein
// Ursache (Teil des Bugreports „Zug nach Pillage abgeschnitten"): `_castSpellImmediately` ließ `gs._spellEndsTurn` stehen; die NÄCHSTE
// beliebige Aktion (z. B. die freie Ability Pillage) beendete dann den Zug.
// Erwartung: Tanuki Escape per Sofort-Guss beendet den Zug sofort, und kein Reiter bleibt zurück.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hp: 400, turn: 4, phase: 2, active: 0,
    hand: [['Tanuki Escape', 'ZZ Dummy', 'ZZ Dummy'], []], deck: [Array(20).fill('ZZ Dummy'), Array(20).fill('ZZ Dummy')] });
  t.grantFor(0, 0, 'Tanuki Escape');
  t.setDiscard(0, ['Rebelliokai Timid Tanuki']);
  const r = await t.run(() => t.engine._castSpellImmediately(0, 0, 'Tanuki Escape', { alsZusatzaktion: true, by: 'test' }));
  R.check('Sofort-Guss wurde gewirkt', r && r.cancelled === false, JSON.stringify(r));
  R.check('Reiter _spellEndsTurn bleibt nicht stehen', t.gs._spellEndsTurn === undefined, t.gs._spellEndsTurn);
  R.check('Der Zug des Wirkers ist beendet (Gegner am Zug)', t.gs.activePlayer === 1, `aktiv=${t.gs.activePlayer}`);
  R.finish();
})();
