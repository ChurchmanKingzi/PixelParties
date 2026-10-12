'use strict';
// C04-03 · Sleeping Beauty bietet dauerhaft übernommene Helden nicht zum Verlinken an
// Kartentext: „When you summon this Creature, choose a Hero you permanently control."
// Engine-Begriff: `engine.heroesControlledBy(pi, { permanentOnly: true })` (_engine.js:25684) liefert genau diese Helden – eigene Spalte ohne die abgegebenen
//   plus per `actionTakeHeroPermanently` (Paraseed Control u. ä.) übernommene Gegnerhelden.
// Erwartung: Ein von mir dauerhaft übernommener Gegnerheld (Seat 1, Held 0) steht in der Auswahl.
// Beobachtet: Es werden nur die drei eigenen Spaltenhelden angeboten.
// Ursache: cards/effects/sleeping-beauty.js `_eligibleLinkHeroes` (Z. 42) läuft nur über `gs.players[pi].heroes` (und `owner: pi` ist in `targets` fest verdrahtet).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Sleeping Beauty'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const ok = await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'test' }));
  R.check('Aufbau: Gegnerheld 1/0 dauerhaft übernommen', ok === true && t.engine.heroSideOf(1, t.hero(1, 0)) === 0, ok);
  let offered = null;
  t.targetFn = (valid) => { offered = valid.map(v => v.owner + ':' + v.heroIdx); return [valid[0].id]; };
  await t.play(0, 'Sleeping Beauty', { hero: 0 });
  R.check('Auswahl enthält den dauerhaft übernommenen Gegnerhelden (1:0)', !!offered && offered.includes('1:0'), offered);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
