'use strict';
// S02-01 · Healing Melody heilt nach BESITZ statt nach KONTROLLE
// Kartentext (Healing Melody): „Heal all targets you control for 100/150/200 HP."
// Erwartung (CARD_API.md „Kontrolle statt Seite", Styx 28.9.): geheilt werden alle Ziele, die der Wirker KONTROLLIERT –
//   (a) eine vom Gegner gestohlene Kreatur, die ich kontrolliere, wird geheilt;
//   (b) meine eigene Kreatur, die der Gegner gestohlen hat, wird NICHT geheilt;
//   (c) mein eigener Held, den der Gegner gerade kontrolliert (Charme), wird NICHT geheilt.
// Beobachtet: (a) ✗ nicht geheilt, (b) ✗ geheilt, (c) ✗ geheilt. Ursache: healing-melody.js sammelt Kreaturen über `c.owner === pi` auf
//   `ps.supportZones` und Helden über `ps.heroes` (nur der Gegnerseite wird `charmedBy === pi` zusätzlich genommen).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    R.section('(a) von mir kontrollierte, gestohlene Kreatur (controller=0, owner=1)');
    const t = await H.fresh({ hand: [['Healing Melody'], []] });
    const mine = t.put(0, 0, 0, H.INERT.creature); mine.counters.currentHp = 100;
    const theirs = t.put(1, 0, 0, H.INERT.creature); theirs.counters.currentHp = 100;
    t.engine.actionStealCreature(0, theirs);
    await t.play(0, 'Healing Melody', { hero: 0 });
    R.check('Kontrollprobe: eigene Kreatur geheilt', mine.counters.currentHp > 100, mine.counters.currentHp);
    R.check('(a) gestohlene Kreatur, die ich kontrolliere, wird geheilt', theirs.counters.currentHp > 100, theirs.counters.currentHp);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    R.section('(b) meine Kreatur, die der Gegner kontrolliert (controller=1, owner=0)');
    const t = await H.fresh({ hand: [['Healing Melody'], []] });
    const mine = t.put(0, 0, 0, H.INERT.creature); mine.counters.currentHp = 100;
    t.engine.actionStealCreature(1, mine);
    await t.play(0, 'Healing Melody', { hero: 0 });
    R.check('(b) vom Gegner kontrollierte Kreatur wird NICHT geheilt', mine.counters.currentHp === 100, mine.counters.currentHp);
  }
  {
    R.section('(c) mein Held 1, vom Gegner kontrolliert (Charme)');
    const t = await H.fresh({ hand: [['Healing Melody'], []] });
    t.hero(0, 0).hp = 300; t.hero(0, 1).hp = 300;
    t.engine.actionStealHero(1, 0, 1);
    await t.play(0, 'Healing Melody', { hero: 0 });
    R.check('Kontrollprobe: Held 0 geheilt', t.hp(0, 0) > 300, t.hp(0, 0));
    R.check('(c) vom Gegner kontrollierter Held wird NICHT geheilt', t.hp(0, 1) === 300, t.hp(0, 1));
  }
  R.finish();
})();
