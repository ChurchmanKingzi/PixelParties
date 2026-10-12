// A08-05 · Aufstieg hebt die Max-HP eines per Paraseed Control übernommenen Helden über den Deckel 100
//
// Kartentext Paraseed Control: „… Revive that Hero. Its current and max HP become 100 and cannot be increased in any way. You take permanent control of that Hero."
// Kartentext Flamebathed Waflav: „You must play this Hero from your hand on top of a "Waflav" Hero you control by removing 2 Evolution Counters from it."
//   (Aufstieg = der Held bekommt die Differenz der gedruckten Max-HP, `_engine.js performAscension`: 400 → 450 = +50.)
//
// Aufbau: Sitz 1: Waflav (6 Evolution Counters, 20 HP) mit einer Paraseed von Sitz 0 → Gift tötet ihn zu Beginn von Sitz 1s Zug;
//   Sitz 0 hält Paraseed Control, übernimmt den Helden (100/100, maxHpCapped 100). Später steigt Sitz 0 mit Flamebathed Waflav auf.
// Erwartung: „cannot be increased in any way" → Max-HP bleiben ≤ 100 (und HP ≤ Max-HP).
// Beobachtet: `performAscension` schreibt `hero.maxHp`/`hero.hp` direkt (`_engine.js:49285`); `maxHpCapped` wird nur in `increaseMaxHp`
//   geprüft (`_engine.js:10508`). Ergebnis 150/150. (Bloom, the Continent Corruptor löscht den Deckel absichtlich, `…continent-corruptor.js:83`.)
// Aufruf: node docs/niche-tests/repro/A08-pacman/05-paraseed-control-hp-deckel-vs-aufstieg.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const { syncAllParaseedPoison } = require('../../../../cards/effects/_paraseed-shared.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  const WAF = 'Waflav, the Metamorphing Monstrosity';
  const t = await H.fresh({ heroes: [null, [WAF, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief']], hand: [[], []], deck: [[F, F, F, F, F, F, F, F], [F, F, F, F, F, F, F, F]] });
  const w = t.hero(1, 0); w.hp = 20; w.maxHp = 400; w._evolutionCounters = 6;
  const p = t.put(1, 0, 0, 'Paraseed'); p.controller = 0; p.turnPlayed = 1;
  await t.run(() => syncAllParaseedPoison(t.engine));
  t.engine.handZugangSync(0, 'Paraseed Control');
  t.script.push({ match: d => d && d.type === 'optionPicker' && /casts Paraseed Control/.test(d.description || ''), answer: () => ({ optionId: 'hero-0' }) });
  await t.endTurn();                       // Zug 6: Gift tötet den Waflav, Paraseed Control übernimmt ihn
  R.check('Aufbau: Waflav gehört dauerhaft Sitz 0, 100/100, Deckel 100', w.permaControlBy === 0 && w.hp === 100 && w.maxHp === 100 && w.maxHpCapped === 100, { perma: w.permaControlBy, hp: w.hp, max: w.maxHp, cap: w.maxHpCapped });
  await t.endTurn();                       // Zug 7: Sitz 0 am Zug
  t.engine.handZugangSync(0, 'Flamebathed Waflav');
  t.gs.activePlayer = 0; t.phase(2); t.reset();
  const idx = t.pile(0, 'hand').indexOf('Flamebathed Waflav');
  const r = await t.run(() => t.engine.performAscension(0, 0, 'Flamebathed Waflav', idx, { heroOwner: 1 }));
  R.check('Aufstieg lief durch', !!(r && r.success) && w.name === 'Flamebathed Waflav', { r, name: w.name });
  R.check('Max-HP bleiben unter dem Deckel 100 („cannot be increased in any way")', w.maxHp <= 100, { hp: w.hp, maxHp: w.maxHp });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
