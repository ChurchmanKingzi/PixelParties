'use strict';
// R01-01 · Gold Trap fängt das automatische Rundeneinkommen des Gegners ab
// Kartentext: „Activate this Surprise when your opponent would gain Gold through an effect. You gain that Gold instead. Then, you may choose any Creature on the
//   board and add it to your hand."
// Ruling CARD_API.md ~Z. 18137-18147 (24.9.): „Nur das Rundeneinkommen trägt `_isResourceGain` … Monkees („through an effect") reagieren" nur auf EFFEKT-Gold,
//   nicht auf das Einkommen; `actionGainGold` kommentiert dasselbe (Z. 24069: „'through an effect' schliesst es ausdruecklich aus").
// Aufbau: Sitz 0 hat verdeckt Gold Trap (Held 0, Decay Magic 1), Sitz 1 ist am Zug-Wechsel dran (100 Gold je Seite).
// Schritte: 1. `t.endTurn()` (Sitz 0 beendet den Zug; Sitz 1 beginnt: Resource Phase, +4 Gold Rundeneinkommen).
// Erwartet: Gold Trap löst NICHT aus (kein Prompt), Sitz 1 hat 104 Gold, Sitz 0 100, die Surprise bleibt verdeckt liegen.
// Beobachtet: Prompt „Gold Trap", Sitz 0 hat 104, Sitz 1 100 – die Falle ist verbraucht.
// Ursache: `_engine.js` `actionGainGold` ~Z. 24089 ruft `_checkSurpriseOnResourceGain(playerIdx, hookCtx.amount)` ohne `_isResourceGain` zu beachten
//   (`_checkSurpriseOnResourceGain` ~Z. 31806 prüft es nicht; gold-trap.js `surpriseTrigger` auch nicht).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ gold: [100, 100] });
  t.putSurprise(0, 0, 'Gold Trap'); t.grantFor(0, 0, 'Gold Trap');
  await t.endTurn();
  R.check('Sitz 1 ist am Zug', t.gs.activePlayer === 1, t.gs.activePlayer);
  R.check('Gold Trap hat NICHT ausgelöst (kein Prompt)', !t.prompts.some(p => p.d.title === 'Gold Trap'), t.prompts.map(p => p.d.title));
  R.check('Sitz 1 hat sein Rundeneinkommen (104 Gold)', t.gs.players[1].gold === 104, t.gs.players[1].gold);
  R.check('Sitz 0 hat unverändert 100 Gold', t.gs.players[0].gold === 100, t.gs.players[0].gold);
  R.check('Gold Trap liegt weiter verdeckt in der Surprise Zone', t.gs.players[0].surpriseZones[0].includes('Gold Trap'), t.gs.players[0].surpriseZones);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
