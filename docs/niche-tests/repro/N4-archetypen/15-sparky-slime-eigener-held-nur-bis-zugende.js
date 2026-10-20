'use strict';
// N4-archetypen-15 · Sparky Slime: der eigene Held ist nur bis zum Ende des laufenden Zuges negiert, nicht „until your next turn"
// Kartentext (Sparky Slime): „When you summon this Creature, choose any target on the board and negate its effects and Abilities until your next turn. This counts as a negative status effect."
// Erwartung: Bis zum Beginn des nächsten eigenen Zuges negiert – für JEDES Ziel. Bei einer eigenen Kreatur stimmt das (Z5 → noch negiert zu Beginn von Z6 des Gegners, weg bei Z7),
//   beim gegnerischen Helden ebenso. Beim EIGENEN Helden ist die Negierung schon zu Beginn des Gegnerzuges (Z6) weg.
// Beobachtet: sparky-slime.js ruft `addHeroStatus('negated', { appliedBy })` ohne Dauer; der Heldenstatus tickt zum Zugende des KONTROLLEURS des Helden ab – beim eigenen Helden also noch am Ende desselben
//   Zuges. (Icy Slime löst dieselbe Lage mit `frostDauer(...)`: eigenes Ziel 2, gegnerisches 1; Sparky Slime kennt für Helden nichts Entsprechendes.)
// Gegenprobe: gegnerischer Held und eigene Kreatur bleiben bis zum Beginn von Z7 negiert.
const H = require('../../lib/h.js');
async function lauf(ziel) {
  const t = await H.fresh({ hand: [['Sparky Slime'], ['ZZ Filler']], deckSize: 30 });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const ec = t.put(0, 1, 0, H.INERT.big); ec.turnPlayed = 1;
  t.targetFn = (valid) => [(ziel === 'eigene-kreatur' ? valid.find(v => v.type === 'equip' && v.owner === 0 && v.cardName === H.INERT.big)
    : ziel === 'eigener-held' ? valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1)
    : valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 1)).id];
  await t.play(0, 'Sparky Slime', { hero: 0, slot: 0 });
  const neg = () => ziel === 'eigene-kreatur' ? !!ec.counters.negated : ziel === 'eigener-held' ? !!t.hero(0, 1).statuses.negated : !!t.hero(1, 1).statuses.negated;
  const z5 = neg();
  await t.endTurn();                // Beginn Zug 6 (Gegner)
  const z6 = neg();
  await t.endTurn();                // Beginn Zug 7 (eigener nächster Zug)
  const z7 = neg();
  return { t, z5, z6, z7 };
}
(async () => {
  const R = H.runner();
  for (const ziel of ['eigene-kreatur', 'gegner-held']) {
    const r = await lauf(ziel);
    R.check(`Gegenprobe ${ziel}: negiert in Z5 und Z6, frei zu Beginn von Z7`, r.z5 && r.z6 && !r.z7, r);
  }
  const e = await lauf('eigener-held');
  R.check('Aufbau: der eigene Held ist nach dem Beschwören negiert (Z5)', e.z5, e.z5);
  R.check('eigener Held bleibt auch im Gegnerzug (Z6) negiert, bis zum nächsten eigenen Zug (Z7)', e.z6 && !e.z7, { z6: e.z6, z7: e.z7 });
  R.check('keine Engine-Fehler', e.t.errors.length === 0, e.t.errors);
  R.finish();
})();
