'use strict';
// W12 / Q113 (H02-heroes-07) · Ida, the Adept of Destruction: ignoriert Schadensimmunität, NICHT die absolute Effektimmunität der Cardinal Beasts
// (Al: „Nein, da diese immun gegen *alle Arten von Effekten* sind, nicht nur gegen Schaden; Ida kommt 'nur' durch Schadensimmunität durch.")
// Absicherungs-Repro (Ist-Zustand): (a) Rockfall von Ida trifft Cardinal Beast Baihu nicht; (b) Idas Zauber durchschlägt die Schadensimmunität Anti Magic
// am gegnerischen Helden (gleicher Zauber ohne Ida wird geblockt). Exit 0 = korrekt.
const H = require('../../lib/h.js');
const IDA = 'Ida, the Adept of Destruction';
(async () => {
  const R = H.runner();
  {   // (a)
    const t = await H.fresh({ heroes: [[IDA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Rockfall'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const baihu = t.put(1, 0, 0, 'Cardinal Beast Baihu');
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1); return v ? [v.id] : null; };
    const hp0 = baihu.counters.currentHp ?? H.DB['Cardinal Beast Baihu'].hp;
    const r = await t.play(0, 'Rockfall', { hero: 0 });
    const hp1 = baihu.counters.currentHp ?? H.DB['Cardinal Beast Baihu'].hp;
    R.check('(a) Rockfall gespielt', r === true, r);
    R.check('(a) Baihu bleibt unversehrt', hp0 === hp1, { hp0, hp1 });
    R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (b) Ida durchschlägt Anti Magic am Helden
    const t = await H.fresh({ heroes: [[IDA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fireball'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    await t.engine.actionAddBuff(t.hero(1, 0), 1, 0, 'magic_immune', { level: 3 });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const hp = t.hp(1, 0);
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('(b) Idas Fireball durchschlägt Anti Magic (150)', hp - t.hp(1, 0) === 150, hp - t.hp(1, 0));
    R.check('(b) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (b') Kontrolle: derselbe Zauber ohne Ida wird geblockt
    const t = await H.fresh({ hand: [['Fireball'], []] });
    await t.engine.actionAddBuff(t.hero(1, 0), 1, 0, 'magic_immune', { level: 3 });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const hp = t.hp(1, 0);
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('(b\') Kontrolle: ohne Ida blockt Anti Magic', t.hp(1, 0) === hp, hp - t.hp(1, 0));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
