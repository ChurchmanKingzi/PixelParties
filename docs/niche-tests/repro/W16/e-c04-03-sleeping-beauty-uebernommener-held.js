'use strict';
// W16e · C04-03 durchgespielt: Sleeping Beauty verlinkt einen DAUERHAFT übernommenen Gegnerhelden (Elana, Sitz 1 / Held 0) und leiht ihren Effekt.
// Erwartung: Link auf (Brettseite 1, Held 0); hat der Kontrolleur (Sitz 0) Elanas Effekt benutzt (Stempel des KONTROLLEURS), ist die Beauty aktivierbar;
// stirbt die Beauty, trifft der Todesschaden den verlinkten (übernommenen) Helden.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const ELANA = 'Elana, the Rocky Rebel';
  const t = await H.fresh({ heroes: [[null, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], [ELANA, null, null]], hand: [['Sleeping Beauty', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler'], []] });
  t.setAbilities(0, 1, [['Summoning Magic'], [], []]);
  const ok = await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'test' }));
  R.check('Aufbau: Elana (Sitz 1, Held 0) dauerhaft übernommen', ok === true && t.engine.heroSideOf(1, t.hero(1, 0)) === 0, ok);
  let angeboten = null;
  t.targetFn = (valid) => { angeboten = valid.map(v => v.owner + ':' + v.heroIdx); const v = valid.find(x => x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : [valid[0].id]; };
  await t.play(0, 'Sleeping Beauty', { hero: 1 });
  const sb = t.find('Sleeping Beauty', 'support');
  R.check('Beauty verlinkt den übernommenen Helden (Brettseite 1, Held 0)', !!sb && sb.counters._linkedHeroOwner === 1 && sb.counters._linkedHeroIdx === 0, { angeboten, c: sb && sb.counters });
  sb.turnPlayed = 1;
  if (!t.gs.hoptUsed) t.gs.hoptUsed = {};
  t.gs.hoptUsed[t.engine.heroHoptKey(ELANA, 0)] = t.gs.turn;     // Kontrolleur Sitz 0 hat Elanas Effekt benutzt
  t.setHand(0, ['ZZ Filler', 'ZZ Filler', 'ZZ Filler']);
  t.gs.activePlayer = 0; t.phase(2);
  const ar = await t.activateCreature(0, 1, sb.zoneSlot);
  R.check('Beauty ist aktivierbar und führt den geliehenen Effekt aus', ar === true, ar);
  const hpVor = t.hp(1, 0);
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, sb));
  R.check('Todesschaden (300) trifft den verlinkten übernommenen Helden', hpVor - t.hp(1, 0) === 300, { vor: hpVor, nach: t.hp(1, 0) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
