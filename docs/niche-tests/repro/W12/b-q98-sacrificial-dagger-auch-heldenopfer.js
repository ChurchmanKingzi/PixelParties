// W12b · Q98 (F02-18) · Sacrificial Dagger: auch geopferte HELDEN lösen aus – aber nicht der HP-Tod
// Al: „Auch Heroes" (+ Welle 12: ein Held, der durch HP-Verlust stirbt, ist kein Opfer).
// Erwartung: (a) Divine Gift of Sacrifice (Held 1 geopfert) → Dagger bietet den Schlag an, Schaden = ATK des Trägers; (b) Held stirbt durch Schaden → KEIN Angebot;
//   (c) Gegner opfert seinen Helden → mein Dagger löst NICHT aus (nicht „you sacrifice"); (d) Kreaturenopfer löst weiter aus (Regression); (e) Einmal pro Zug: der zweite Opfer-Auslöser
//   im selben Zug bietet nichts mehr an, wenn der erste angenommen wurde. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const DAGGER = 'Sacrificial Dagger';
(async () => {
  const R = H.runner();
  const angebote = (t) => t.targets.filter(x => /Sacrificial Dagger/.test(JSON.stringify(x))).length;
  async function aufbau() {
    const t = await H.fresh({ hand: [[DAGGER, 'Divine Gift of Sacrifice'], []], gold: [100, 100] });
    await t.play(0, DAGGER, { hero: 0 });
    t.reset();
    return t;
  }
  { // (a)
    const t = await aufbau();
    const hp = t.hp(1, 0); let wahl = 0;
    t.targetFn = (valid, cfg) => {
      wahl++;
      if (cfg && /Sacrificial Dagger/.test(cfg.title || '')) { const v = valid.find(q => q.type === 'hero' && q.owner === 1 && q.heroIdx === 0); return v ? [v.id] : null; }
      const idx = wahl === 1 ? 1 : 2;
      const v = valid.find(q => q.type === 'hero' && q.owner === 0 && q.heroIdx === idx);
      return v ? [v.id] : [valid[0].id];
    };
    const r = await t.play(0, 'Divine Gift of Sacrifice', { hero: 2 });
    R.check('(a) Held 1 geopfert', r === true && t.hp(0, 1) === 0, { r, hps: [0, 1, 2].map(i => t.hp(0, i)) });
    R.check('(a) Dagger-Schlag auf das Heldenopfer: Gegner-Held verliert die ATK des Trägers', hp - t.hp(1, 0) === t.hero(0, 0).atk && t.hero(0, 0).atk > 0, { dmg: hp - t.hp(1, 0), atk: t.hero(0, 0).atk });
    R.check('(a) keine Engine-Fehler / sauberer Zustand', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (b) HP-Tod
    const t = await aufbau();
    let dolch = 0;
    t.targetFn = (valid, cfg) => { if (cfg && /Sacrificial Dagger/.test(cfg.title || '')) dolch++; return null; };
    const hp = t.hp(1, 0);
    await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1 }, t.gs.players[0].heroes[1], 5000, 'spell'));
    R.check('(b) Held 1 durch HP-Verlust gestorben', t.hp(0, 1) === 0, t.hp(0, 1));
    R.check('(b) HP-Tod ist kein Opfer: Dagger bietet nichts an, kein Schaden', dolch === 0 && t.hp(1, 0) === hp, { dolch, hp1: t.hp(1, 0) });
  }
  { // (c) Gegner opfert seinen Helden
    const t = await aufbau();
    let dolch = 0;
    t.targetFn = (valid, cfg) => { if (cfg && /Sacrificial Dagger/.test(cfg.title || '')) dolch++; return null; };
    const hp = t.hp(0, 0);
    await t.run(() => t.engine.actionDefeatHero({ name: 'Test', owner: 1, controller: 1 }, t.gs.players[1].heroes[1], { isSacrifice: true, respectFirstTurnProtection: false }));
    R.check('(c) Gegner-Held 1 geopfert', t.hp(1, 1) === 0, t.hp(1, 1));
    R.check('(c) Opfer des GEGNERS löst meinen Dagger nicht aus', dolch === 0 && t.hp(0, 0) === hp, { dolch });
  }
  { // (d) Kreaturenopfer (Regression) + (e) einmal pro Zug
    const t = await aufbau();
    const c1 = t.put(0, 1, 0, H.INERT.creature), c2 = t.put(0, 1, 1, H.INERT.creature);
    let dolch = 0;
    t.targetFn = (valid, cfg) => { if (cfg && /Sacrificial Dagger/.test(cfg.title || '')) { dolch++; const v = valid.find(q => q.type === 'hero' && q.owner === 1 && q.heroIdx === 0); return v ? [v.id] : null; } return null; };
    await t.run(() => t.engine.opfereKreatur(c1, { name: 'Test', owner: 0 }));
    R.check('(d) Kreaturenopfer löst den Dagger weiter aus', dolch === 1, { dolch });
    await t.run(() => t.engine.opfereKreatur(c2, { name: 'Test', owner: 0 }));
    R.check('(e) zweites Opfer im selben Zug: Einmal-pro-Zug, kein weiteres Angebot', dolch === 1, { dolch });
    await t.run(() => t.engine.actionDefeatHero({ name: 'Test', owner: 0, controller: 0 }, t.gs.players[0].heroes[2], { isSacrifice: true, respectFirstTurnProtection: false }));
    R.check('(e) auch ein Heldenopfer im selben Zug teilt sich das Einmal-pro-Zug', dolch === 1, { dolch });
    R.check('(d)/(e) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
