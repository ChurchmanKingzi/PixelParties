'use strict';
// A01-pollution-19 · Null Zone überspringt bereits (kürzer) negierte Kreaturen und verlängert deren Negation nicht
// Kartentext: „Until the end of your next turn, negate the effects of all Creatures …“ – „all Creatures“, ohne Ausnahme.
// Aufbau: eine Kreatur ist durch einen anderen Effekt NUR bis zum Ende dieses Zuges negiert (z. B. die von Soul Shard Ka beschworene Kreatur, oder eine per Necromancy
//   zurückgeholte – deren Negation endet zum nächsten eigenen Zugbeginn). Danach wirkt der Spieler Null Zone.
// Erwartung: auch diese Kreatur bleibt bis zum Ende der Null-Zone-Dauer negiert (insbesondere im Gegnerzug direkt danach).
// Beobachtet: `null-zone.js` überspringt Kreaturen mit `isCreatureNegated(inst)` („Already negated/nulled — skip“). Die kürzere Negation läuft zum Zugende ab, im Gegnerzug
//   ist die Kreatur wieder voll wirksam, obwohl Null Zone sie bis nach dem nächsten eigenen Zug negieren sollte.
// Aufruf: node docs/niche-tests/repro/A01-pollution/19-null-zone-verlaengert-vorab-negierte-nicht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const HK = require('../../../../cards/effects/_hooks');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Null Zone'], []] });
  const vorab = t.put(0, 0, 0, 'Royal Corgi');
  await t.run(() => t.engine.actionNegateCreature(vorab, 'Soul Shard Ka', { expiresAtTurn: t.gs.turn + 1, expiresForPlayer: 1, buffKey: 'soul_shard_ka_negated', selfInflicted: true }));
  const frisch = t.put(0, 0, 1, 'Royal Corgi');
  await t.play(0, 'Null Zone', { hero: 0 });
  R.check('Zug 5: beide Kreaturen negiert', HK.isCreatureNegated(vorab) && HK.isCreatureNegated(frisch));
  await t.endTurn();                                              // Gegnerzug 6
  R.check('Zug 6 (Gegnerzug): die frisch genullte Kreatur ist negiert (Kontrolle)', HK.isCreatureNegated(frisch));
  R.check('Zug 6: auch die vorab nur kurz negierte Kreatur ist durch Null Zone weiter negiert', HK.isCreatureNegated(vorab), vorab.counters);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
