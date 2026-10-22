'use strict';
// W49a · Punkt 1 · Al, 22.10.2026: „Elixir of Strength soll 150 statt 100 Bonus-Schaden gewähren."
// Kartentext (data/cards.json, wörtlich): „Choose a Hero you control. The next time that Hero hits exactly 1 target with an Attack, that Attack's damage is increased by 150 and cannot be reduced or negated."
// Geprüft (beide Sitze): Kartentext, Buff-Tooltip (_hooks.js), Zielwahl-Beschreibung; echter Spielweg (Trank trinken → Attack) = ATK + 150, trotz Cloudy
// unreduzierbar, Buff danach verbraucht; Kreaturenziel ebenso; Mehrziel-Attack feuert nicht (Welle 13/Q138 unverändert); Exit 0 = korrekt.
const fs = require('fs');
const path = require('path');
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const WURZEL = path.join(__dirname, '..', '..', '..', '..');
(async () => {
  const R = H.runner();
  const karten = JSON.parse(fs.readFileSync(path.join(WURZEL, 'data', 'cards.json'), 'utf8'));
  const liste = Array.isArray(karten) ? karten : (karten.cards || Object.values(karten));
  const k = liste.find(c => c.name === 'Elixir of Strength');
  R.check('Kartentext wörtlich (150)', k && k.effect === "Choose a Hero you control. The next time that Hero hits exactly 1 target with an Attack, that Attack's damage is increased by 150 and cannot be reduced or negated.", k && k.effect);
  const hooks = fs.readFileSync(path.join(WURZEL, 'cards', 'effects', '_hooks.js'), 'utf8');
  R.check('Buff-Tooltip empowered_strike nennt 150', /empowered_strike:[^\n]*increased by 150 and cannot/.test(hooks) && !/empowered_strike:[^\n]*increased by 100/.test(hooks));
  const skript = require('../../../../cards/effects/elixir-of-strength.js');
  R.check('Zielwahl-Beschreibung nennt +150', /\+150/.test(skript.targetingConfig.description), skript.targetingConfig.description);

  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const hand = (...n) => (me === 0 ? [n, []] : [[], n]);
    { const t = await H.fresh({ hand: hand('Elixir of Strength', 'Attack'), hp: 2000, active: me });
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
      await t.play(me, 'Elixir of Strength');
      t.hero(op, 0).buffs = { cloudy: { damageMultiplier: 0.5 } };   // Cloudy dürfte den Bonus-Treffer nicht kürzen
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
      const atk = t.hero(me, 0).atk, vor = t.hp(op, 0);
      await t.play(me, 'Attack', { hero: 0 });
      R.check('Attack nach Elixir: ATK + 150, unreduzierbar trotz Cloudy', vor - t.hp(op, 0) === atk + 150, { atk, dmg: vor - t.hp(op, 0) });
      R.check('Buff verbraucht', !t.hero(me, 0).buffs?.empowered_strike, Object.keys(t.hero(me, 0).buffs || {}));
      R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }

    { const t = await H.fresh({ hand: hand('Elixir of Strength', 'Attack'), hp: 2000, active: me });
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
      await t.play(me, 'Elixir of Strength');
      const c = t.put(op, 0, 0, H.INERT.big);
      t.targetFn = (v) => [v.find(x => x.type !== 'hero' && x.owner === op).id];
      const atk = t.hero(me, 0).atk;
      await t.play(me, 'Attack', { hero: 0 });
      R.check('Kreaturenziel: ATK + 150', 1000 - (c.counters?.currentHp ?? 1000) === atk + 150, { atk, hp: c.counters?.currentHp });
      R.check('Kreaturenziel: Buff verbraucht', !t.hero(me, 0).buffs?.empowered_strike); }

    { const t = await H.fresh({ hand: hand('Elixir of Strength', 'Whirlwind Strike'), hp: 2000, active: me });
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
      await t.play(me, 'Elixir of Strength');
      t.put(op, 0, 0, H.INERT.creature); t.put(op, 1, 0, H.INERT.creature);
      t.targetFn = (v) => v.filter(x => x.type === 'hero' && x.owner === op).slice(0, 2).map(x => x.id);
      const vor = [t.hp(op, 0), t.hp(op, 1)], atk = t.hero(me, 0).atk;
      await t.play(me, 'Whirlwind Strike', { hero: 0 });
      R.check('Gegenprobe Mehrziel (4 Ziele): kein Bonus, Buff bleibt', vor[0] - t.hp(op, 0) === atk && vor[1] - t.hp(op, 1) === atk && !!t.hero(me, 0).buffs?.empowered_strike, { atk, d: [vor[0] - t.hp(op, 0), vor[1] - t.hp(op, 1)] }); }
  }
  R.finish();
})();
