'use strict';
// W16e · F03-02 Gegenprobe: Die Sun Sword stempelt/entstempelt nach Kontrolle, rührt aber fremde Frost-Immunität nicht an:
// eine Kreatur MIT eigener Frost-Immunität (Mischief Militia SnowItAll) bleibt auch nach dem Abgang des Schwertes immun; eine gewöhnliche verliert sie.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SS = 'The Sun Sword';
  const t = await H.fresh({ hand: [[SS], []] });
  const eigen = t.put(0, 1, 0, H.INERT.big);
  eigen.counters.freeze_immune = 1;                       // eigene Immunität (wie SnowItAll)
  const normal = t.put(0, 1, 1, H.INERT.big);
  await t.play(0, SS, { hero: 0, slot: 0 });
  R.check('Schwert liegt: beide immun', !!eigen.counters.freeze_immune && !!normal.counters.freeze_immune, [eigen.counters, normal.counters]);
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, t.find(SS, 'support')));
  R.check('Schwert weg: gewöhnliche Kreatur wieder einfrierbar', !normal.counters.freeze_immune, normal.counters);
  R.check('Schwert weg: eigene Immunität bleibt', !!eigen.counters.freeze_immune, eigen.counters);
  R.check('Held 0 verliert den Schwert-Stempel', !t.hero(0, 0).statuses.freeze_immune, t.hero(0, 0).statuses);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
