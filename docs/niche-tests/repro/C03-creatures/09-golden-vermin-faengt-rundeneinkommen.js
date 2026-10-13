'use strict';
// C03-creatures-09 · Golden Vermin fängt das automatische Rundeneinkommen (4 Gold) ab, obwohl der Text „through an effect" sagt
// Kartentext: „Up to 5 times per turn, when you would gain Gold through an effect, you may draw 1 card instead."
// Ruling (Als 8.8., `_engine.js` `actionGainGold`): „through an effect" schließt das Rundeneinkommen der Resource Phase (`_isResourceGain`) ausdrücklich aus;
//   Monkees, Bonded Companion Humby, Royal Treasury, Golden Ladybug prüfen deshalb `ctx._isResourceGain`.
// Aufbau: Sitz 0: Golden Vermin; zwei `t.endTurn()` bis zum Zugbeginn von Sitz 0 (Resource Phase mit 4 Gold Einkommen). Rückfrage mit Ja (Harness-Standard).
// Erwartung: Keine Vermin-Rückfrage beim Einkommen; Sitz 0 erhält 4 Gold.
// Beobachtet: Rückfrage „Draw 1 card instead of gaining 4 Gold? (1/5 uses this turn)"; mit Ja gibt es eine Karte statt der 4 Gold des Rundeneinkommens.
// Ursache: cards/effects/golden-vermin.js `onResourceGain` prüft `ctx._isResourceGain` nicht (vgl. wealth.js:32, royal-treasury.js:71).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ deckSize: 30 });
  const v = t.put(0, 0, 0, 'Golden Vermin'); v.turnPlayed = 1;
  await t.endTurn();
  t.reset();
  const g0 = t.gs.players[0].gold;
  await t.endTurn();
  const dg = t.gs.players[0].gold - g0;
  const vermin = t.prompts.filter(p => p.d.title === 'Golden Vermin').map(p => p.d.message);
  R.note('Rückfragen', vermin);
  R.check('keine Vermin-Rückfrage beim Rundeneinkommen', vermin.length === 0, vermin);
  R.check('Rundeneinkommen kommt als Gold an (4)', dg === 4, dg);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
