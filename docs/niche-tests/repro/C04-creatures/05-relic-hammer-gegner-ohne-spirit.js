'use strict';
// C04-05 · Spirit of the Relic Hammer: „each player" – der Gegner ohne eigenen Spirit bekommt keine Haste
// Kartentext: „The first Creature each player summons during each of their turns may use its active effects the turn it is summoned."
// Erwartung (wörtlich): Die erste Kreatur, die JEDER Spieler in seinem Zug beschwört, darf im Beschwörungszug aktivieren – auch die des Gegners, wenn
//   nur ein Hammer-Spirit auf dem Brett liegt (Kopfkommentar im Skript: „beschwoert der Gegner in seinem Zug, greift es bei ihm").
// Beobachtet: Seat 0 (Spirit-Besitzer) bekommt Haste auf die erste Kreatur ✓; Seat 1 ohne eigenen Spirit bekommt keine (`_hasHaste` fehlt).
// Ursache: cards/effects/spirit-of-the-relic-hammer.js:108: `if (!spiritSteht(engine, besitzer)) return;` – „Steht bei ihm keiner, hilft ihm auch keiner".
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SPR = 'Spirit of the Relic Hammer';
  const t = await H.fresh({ hand: [['Sky Shaman', 'Sky Shaman'], ['Sky Shaman']] });
  const sp = t.put(0, 2, 0, SPR); sp.turnPlayed = 1;
  await t.play(0, 'Sky Shaman', { hero: 0, slot: 0 });
  const s0 = t.engine.cardInstances.find(c => c.name === 'Sky Shaman' && c.zone === 'support' && c.owner === 0);
  R.check('Aufbau: erste Kreatur des Spirit-Besitzers hat Haste', !!s0.counters._hasHaste, s0.counters);
  await t.endTurn();
  t.gs.activePlayer = 1; t.phase(3); t.resetActions(1);
  await t.play(1, 'Sky Shaman', { hero: 0, slot: 0, keepActions: true });
  const s1 = t.engine.cardInstances.find(c => c.name === 'Sky Shaman' && c.zone === 'support' && c.owner === 1);
  R.check('erste Kreatur des Gegners (ohne eigenen Spirit) hat ebenfalls Haste („each player")', !!(s1 && s1.counters._hasHaste), s1 && s1.counters);
  const act1 = await t.run(() => { t.phase(2); return t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: 0, zoneSlot: 0 }); });
  R.check('…und darf im Beschwörungszug aktivieren', act1 === true, act1);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
