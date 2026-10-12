'use strict';
// A01-pollution-18 · Null Zone endet am ANFANG des nächsten eigenen Zuges statt an dessen Ende
// Kartentext: „Until the end of your next turn, negate the effects of all Creatures and Heroes cannot use any Spells. This counts as a status effect. …“
// Konvention (cards/effects/disruption-ray.js, Kopfkommentar; Smoke Vial wurde darauf korrigiert): „until the end of your next turn“ heißt wörtlich: noch während des
//   GANZEN nächsten eigenen Zuges (T+2) wirksam, weg ab T+3 → `expiresAtTurn = gs.turn + 3, expiresForPlayer = Gegner`. Der ältere Muster „+2 / Wirker“ läuft zu
//   Beginn des eigenen nächsten Zuges ab (taugt nur für Fenster, die allein den Gegnerzug betreffen).
// Erwartung: Null Zone gespielt in Zug 5 (Sitz 0): im Gegnerzug 6 UND im eigenen Zug 7 sind Kreaturen negiert und Helden „nulled“ (kein Zauber); ab Zug 8 weg.
// Beobachtet: `null-zone.js` setzt `expiresAtTurn = gs.turn + 2, expiresForPlayer = pi` → alles endet beim Beginn von Zug 7. Die eigenen Helden/Kreaturen können im
//   eigenen nächsten Zug wieder Zauber wirken bzw. ihre Effekte nutzen.
// Aufruf: node docs/niche-tests/repro/A01-pollution/18-null-zone-endet-einen-zug-zu-frueh.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const HK = require('../../../../cards/effects/_hooks');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Null Zone', 'Fireball'], []] });
  const corgi = t.put(0, 0, 0, 'Royal Corgi');
  await t.play(0, 'Null Zone', { hero: 0 });
  R.check('Zug 5: Kreatur negiert, Held „nulled“', HK.isCreatureNegated(corgi) && !!t.hero(0, 0).statuses.nulled, { neg: HK.isCreatureNegated(corgi), st: Object.keys(t.hero(0, 0).statuses) });
  await t.endTurn();                                              // → Zug 6 (Sitz 1)
  R.check('Zug 6 (Gegner): Kreatur noch negiert, Held noch „nulled“', HK.isCreatureNegated(corgi) && !!t.hero(0, 0).statuses.nulled);
  await t.endTurn();                                              // → Zug 7 (Sitz 0, „your next turn“)
  R.check('Zug 7 (mein nächster Zug): Kreatur noch negiert', HK.isCreatureNegated(corgi), { zug: t.gs.turn, aktiv: t.gs.activePlayer });
  R.check('Zug 7: Held noch „nulled“ (kann keine Zauber wirken)', !!t.hero(0, 0).statuses.nulled, Object.keys(t.hero(0, 0).statuses));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
