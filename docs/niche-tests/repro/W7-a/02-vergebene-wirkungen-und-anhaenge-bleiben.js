'use strict';
// W7-a/02 · Welle 7 (Al, 14.10.2026): Die Regel „ruhende Passive" trifft NICHT
//   (a) Wirkungen, die die Karte schon an andere vergeben hat (Extra-Leben von Trial of Coolness/Divine Gift of Sacrifice auf einer
//       gefrorenen Damsel; Gous erteilter Schutz bei gefrorener Gou),
//   (b) Anhänge am gefrorenen Träger (Prophecy of Tempeste: Deckel 100).
// Kontrolle: das EIGENE Extra-Leben der gefrorenen Damsel ruht.
// Aufruf: node docs/niche-tests/repro/W7-a/02-vergebene-wirkungen-und-anhaenge-bleiben.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];

  // (a1) Damsel gefroren: ein VON AUSSEN vergebenes Extra-Leben wirkt, das eigene bleibt liegen
  {
    const t = await H.fresh({ heroes: [['Rescued Damsel Cecilia', ...fill], null], hp: 300 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const h = t.hero(0, 0); h.maxHp = 600; h.hp = 600;
    t.engine.addExtraLife(h, { by: 'Trial of Coolness' });        // vergeben: oben auf dem Stapel
    t.heroStatus(0, 0, 'frozen', { appliedTurn: t.gs.turn, duration: 3 });
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, h, 9999, 'spell'));
    R.check('Damsel gefroren + fremdes Extra-Leben: wiederbelebt', t.hp(0, 0) > 0, t.hp(0, 0));
    R.check('das eigene (ruhende) Extra-Leben der Damsel bleibt liegen', t.engine.countExtraLives(h) === 1 && h._extraLife?.by === 'Rescued Damsel Cecilia', { n: t.engine.countExtraLives(h), top: h._extraLife });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // (b) Prophecy of Tempeste: der Deckel gilt bei gefrorenem Träger weiter
  {
    const t = await H.fresh({ hand: [['Prophecy of Tempeste'], []], hp: 800 });
    t.grantFor(0, 0, 'Prophecy of Tempeste');
    t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0) || valid[0]).id];
    await t.play(0, 'Prophecy of Tempeste', { hero: 0, noGrant: true });
    t.heroStatus(0, 0, 'frozen');
    await t.engine.actionDealDamage({ name: 'T', owner: 1 }, t.hero(0, 0), 300, 'normal');
    R.check('Anhang am gefrorenen Träger: Deckel 100 gilt', 800 - t.hp(0, 0) === 100, 800 - t.hp(0, 0));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
