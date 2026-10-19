'use strict';
// W16e · C04-06 durchgespielt: Powder Keg in die Spalte eines Helden, den der GEGNER kontrolliert (eigener Held, vom Gegner gecharmt).
// Erwartung: Fass steht in MEINER Spalte (Brettseite 0), der Gegner führt es, die Leiche geht in MEINE Ablage, der Todes-AoE trifft die anderen Zonen
// derselben Spalte (150 Schaden auf die eigene Kreatur in Zone 1).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Powder Keg'], []] });
  for (let hi = 0; hi < 3; hi++) for (let si = 0; si < 3; si++) t.put(1, hi, si, H.INERT.creature);   // Gegnerspalte voll
  const opfer = t.put(0, 2, 1, H.INERT.creature);                                                        // meine Kreatur in Zone 1 von Held 2
  t.engine.actionStealHero(1, 0, 2, { sourceName: 'test' });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 2).id];
  const r = await t.play(0, 'Powder Keg', {});
  const keg = t.find('Powder Keg', 'support');
  R.check('Fass liegt in meiner Spalte (Held 2)', r === true && !!keg && keg.owner === 0 && keg.heroIdx === 2, keg && { o: keg.owner, h: keg.heroIdx, r });
  R.check('der Gegner führt das Fass, Besitzerin ist die Spielerin', !!keg && keg.controller === 1 && keg.originalOwner === 0, keg && { c: keg.controller, oo: keg.originalOwner });
  const hp0 = opfer.counters.currentHp ?? 200;
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'test', owner: 1, heroIdx: 0 }, keg, 5, 'spell'));
  R.check('Todes-AoE trifft die andere Zone der Spalte', (opfer.counters.currentHp ?? 200) === hp0 - 150, opfer.counters.currentHp);
  R.check('Leiche in MEINER Ablage', t.pile(0, 'discardPile').includes('Powder Keg') && !t.pile(1, 'discardPile').includes('Powder Keg'), [t.pile(0, 'discardPile'), t.pile(1, 'discardPile')]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.finish();
})();
