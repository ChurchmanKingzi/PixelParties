'use strict';
// C04-02 · Sleeping Beauty: „You can only activate the effect of "Sleeping Beauty" once per turn." gilt nur je Exemplar
// Kartentext: „… You can only activate the effect of "Sleeping Beauty" once per turn."
// Konvention im Code (gleiche Satzform bei Bishop of Kings, Loyal Pinpom, Rebelliokai Oblivious Oni, Greatmaw Shark, Realmniversal Emperor – letzteres als
//   Ruling 12.9. in CARD_API.md „Das Once-per-turn ist HART … je SPIELER einmal je Zug, nicht je Instanz"): name-weit pro Spieler (`claimHOPT` / `gs.hoptUsed`).
// Erwartung: von zwei Sleeping Beauties darf in einem Zug nur eine ihren Effekt benutzen.
// Beobachtet: beide aktivieren (der Heldeneffekt von Elana läuft dann insgesamt dreimal in einem Zug: einmal Elana, zweimal Beauty).
// Ursache: cards/effects/sleeping-beauty.js hat kein `claimHOPT`; es gilt nur der Instanz-Stempel `creature-effect:<id>` der Engine.
// ACHTUNG: wegen C04-01 (alter HOPT-Schlüssel) muss der Test den alten Schlüssel als Hilfsstempel setzen, sonst wäre schon die erste Beauty nicht aktivierbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const ELANA = 'Elana, the Rocky Rebel';
  const t = await H.fresh({ heroes: [[ELANA, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
  const put = (slot) => { const i = t.put(0, 1, slot, 'Sleeping Beauty'); i.turnPlayed = 1; i.counters._linkedHeroOwner = 0; i.counters._linkedHeroIdx = 0; return i; };
  const b1 = put(0), b2 = put(1);
  t.setHand(0, ['ZZ Filler', 'ZZ Filler', 'ZZ Filler']);
  t.gs.activePlayer = 0; t.phase(2);
  const hr = await t.activateHero(0, 0, {});
  t.gs.hoptUsed[`hero-effect:${ELANA}:0:0`] = t.gs.turn;   // Hilfsstempel für C04-01
  R.check('Aufbau: Elana hat ihren Effekt benutzt', hr === true, hr);
  const a1 = await t.activateCreature(0, 1, 0);
  const a2 = await t.activateCreature(0, 1, 1);
  R.check('erste Beauty aktiviert (Aufbau)', a1 === true, a1);
  R.check('zweite Beauty darf im selben Zug NICHT mehr aktivieren (once per turn, name-weit)', a2 !== true, { a1, a2 });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
