'use strict';
// Steam Dwarfs (außer Dragon Pilot): „Whenever you discard 1 or more cards, this Creature's current and max HP are increased by 10 times the number of cards discarded.“
// Erwartung: je abgeworfener Karte +10 aktuelle & max HP, ohne Begrenzung pro Zug; Dragon Pilot bekommt keinen HP-Gewinn (Text nennt keinen).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Fireball', 'Fireball', 'Fireball', 'Fireball', 'Fireball'], []] });
  const d = t.put(0, 0, 1, 'Steam Dwarf Diver'); d.turnPlayed = 1;
  const gegner = t.put(1, 0, 1, 'Steam Dwarf Miner'); gegner.turnPlayed = 1;
  const pilot = t.put(0, 1, 1, 'Steam Dwarf Dragon Pilot'); pilot.turnPlayed = 1;
  t.policy.confirm = false;   // Pilot: Feuerball ablehnen
  const hp0 = d.counters?.maxHp ?? 50;
  await t.run(() => t.engine.actionPromptForceDiscard(0, 3, { source: 'Test', selfInflicted: true }));
  R.check('3 Karten → +30 max HP', d.counters.maxHp === hp0 + 30, { max: d.counters.maxHp });
  R.check('3 Karten → +30 aktuelle HP', d.counters.currentHp === hp0 + 30, { aktuell: d.counters.currentHp });
  await t.run(() => t.engine.actionPromptForceDiscard(0, 1, { source: 'Test', selfInflicted: true }));
  R.check('zweiter Abwurf im selben Zug: weitere +10 (kein Zuglimit)', d.counters.maxHp === hp0 + 40, { max: d.counters.maxHp });
  const zahlen = t.events.filter(e => e.ev === 'play_steam_hp');
  R.check('je Karte eine grüne „+10“ über dem Diver (4 Stück)', zahlen.length === 4 && zahlen.every(e => e.data.amount === 10 && e.data.zoneSlot === d.zoneSlot), { n: zahlen.length });
  R.check('Abwurf des Gegners zählt nicht', (gegner.counters?.maxHp ?? 50) === 50, { max: gegner.counters?.maxHp });
  R.check('Dragon Pilot: kein HP-Gewinn', (pilot.counters?.maxHp ?? 150) === 150, { max: pilot.counters.maxHp });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
