'use strict';
// C04-04 · Spirit of the Shattered Trident: "Use the Action" ist eine kostenlose Beschwörung, wenn ein ANDERER Held die Aktion schon verbraucht hat
// Kartentext: „You may delete an Artifact equipped to the summoner to make summoning this Creature count as an additional Action."
//   (Ohne Löschung kostet die Beschwörung die normale Aktion – die Aktionsphase kennt genau EINE Aktion, unabhängig vom Helden.)
// Aufbau: Seat 0, Aktionsphase. Held 0 beschwört eine Dummy-Kreatur (verbraucht die Aktion, echter Weg). Held 1 trägt das Trident, Spirit auf der Hand.
// Erwartung: Der Spirit ist nur mit Löschung des Tridents (Zusatzaktion) beschwörbar; sagt der Spieler „Use the Action", gibt es keine Aktion mehr
//   → Beschwörung abgelehnt (genau wie bei einer normalen Kreatur, die zur Kontrolle ebenfalls abgelehnt wird).
// Beobachtet: Der Spirit steht ohne Löschung auf dem Brett, das Trident bleibt, Held 1 wird als „gehandelt" verbucht, Phase springt auf Main 2:
//   die Beschwörung war eine zweite, kostenlose Aktion.
// Ursache: cards/effects/spirit-of-the-shattered-trident.js:127-128: `hatteAktion = currentPhase === 3 && !(ps.heroesActedThisTurn).includes(heroIdx)` prüft nur den
//   BESCHWÖRENDEN Helden; die Aktionsphase ist aber eine Aktion je Spieler (vgl. Potion Juggler `aktionFrei`: `heroesActedThisTurn.length === 0`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TR = 'Shattered Trident, Treasure of the Deepsea';
  const SP = 'Spirit of the Shattered Trident';
  const t = await H.fresh({ hand: [[SP, 'ZZ Dummy', 'ZZ Dummy Big'], []] });
  t.put(0, 1, 0, TR);                                   // Held 1 trägt das Trident
  const r0 = await t.play(0, 'ZZ Dummy', { hero: 0 });  // Held 0 verbraucht die Aktion
  R.check('Aufbau: Held 0 hat gehandelt', r0 === true && t.gs.players[0].heroesActedThisTurn.includes(0), t.gs.players[0].heroesActedThisTurn);
  const ref = await t.play(0, 'ZZ Dummy Big', { hero: 1, keepActions: true, slot: 1 });
  R.check('Referenz: eine normale Kreatur mit Held 1 wird jetzt abgelehnt (keine Aktion mehr)', ref === false, ref);
  t.script.push({ match: d => d.type === 'confirm' && /Delete an Artifact/.test(d.message || ''), answer: () => ({ confirmed: false }) });   // „Use the Action"
  const r = await t.play(0, SP, { hero: 1, keepActions: true, slot: 2 });
  const onBoard = !!t.find(SP, 'support');
  // W16e: Ist die Aktion verbraucht, ist die Loeschung PFLICHT (kein „Use the Action"-Angebot): der Spirit steht nur, wenn das Trident
  // als Kosten der Zusatzaktion fiel (Held 1 nicht als gehandelt verbucht); ohne Loeschung darf er nie auf dem Brett stehen.
  const gefragt = t.prompts.some(p => p.d.type === 'confirm' && /Delete an Artifact/.test(p.d.message || ''));
  R.check('Spirit steht nur gegen Loeschung des Tridents (Zusatzaktion bezahlt), kein „Use the Action"-Angebot', !gefragt && (!onBoard || (!t.zone(0, 1, 0) && !t.gs.players[0].heroesActedThisTurn.includes(1))), { r, onBoard, gefragt, trident: !!t.zone(0, 1, 0), acted: t.gs.players[0].heroesActedThisTurn, phase: t.gs.currentPhase });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
