'use strict';
// W16e · F01-04 Gegenprobe: Die Klinge sperrt das erneute Einfrieren einer KREATUR nur für den Folgezug (Zug 5 gefroren, Zug 7 gesperrt, Zug 9 wieder möglich).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Blade of the Frostbringer', 'Attack', 'Attack', 'Attack'], []], deck: [Array(20).fill('ZZ Dummy'), Array(20).fill('ZZ Dummy')] });
  await t.play(0, 'Blade of the Frostbringer', { hero: 0 });
  const c = t.put(1, 0, 0, H.INERT.big);
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1 && v.heroIdx === 0 && v.slotIdx === 0).id];
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Zug 5: gefroren', !!c.counters.frozen, c.counters);
  await t.endTurn(); await t.endTurn();
  t.addHand(0, 'Attack');
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Zug 7: nicht erneut gefroren', !c.counters.frozen, c.counters);
  await t.endTurn(); await t.endTurn();
  t.addHand(0, 'Attack');
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Zug ' + t.gs.turn + ': wieder einfrierbar', !!c.counters.frozen, c.counters);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
