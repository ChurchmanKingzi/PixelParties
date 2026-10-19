'use strict';
// W15b · C3 (S02-05, Flame Avalanche / Last Resort / Heat Wave) · Al, 16.10.2026: „Ja, prüfe nach aktuellem Kontrolleur!"
// Kartentext: „You cannot deal any other damage to targets your opponent controls the turn you activate this card."
// Auslegung: Die Sperre (`ps.damageLocked`) prüft bei Kreaturen und Helden den aktuellen KONTROLLEUR des Ziels (nicht Besitzer/Brettseite):
//   eine vom Gegner gestohlene/kontrollierte Kreatur oder ein gecharmter/übernommener Held ist ein Gegnerziel; eine EIGENE Kreatur auf der Gegnerseite (seitenfremd beschworen, „Elven Rider"-Muster)
//   ist keines; ein eigener Held unter Gegnerkontrolle ist aus Sicht des Wirkers ein Gegnerziel (gesperrt), ein von mir kontrollierter Gegnerheld nicht.
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  const src = { name: 'Probe', owner: 0, heroIdx: 0, controller: 0 };
  const hpv = (i) => i.counters.currentHp ?? 1000;   // ohne Treffer fehlt currentHp (= volle 1000 HP)

  R.section('Kreaturen (Flame Avalanche)');
  {
    const t = await H.fresh({ hand: [['Flame Avalanche'], []] });
    const X = t.put(0, 0, 0, H.INERT.big);   // gehört mir, vom Gegner kontrolliert
    const Y = t.put(1, 0, 0, H.INERT.big);   // gehört dem Gegner, von mir kontrolliert
    const Z = t.put(1, 1, 0, H.INERT.big);   // normale Gegnerkreatur
    const W = t.put(1, 2, 0, H.INERT.big);   // MEINE Kreatur auf der Gegnerseite (seitenfremd beschworen, Kontrolle bei mir)
    t.engine.markiereSeitenfremd(W, 0);
    await t.engine.actionStealCreature(1, X); await wait(250);
    await t.engine.actionStealCreature(0, Y); await wait(250);
    await t.play(0, 'Flame Avalanche', { hero: 0 });
    const v = [X, Y, Z, W].map(hpv);
    for (const i of [X, Y, Z, W]) await t.engine.actionDealCreatureDamage(src, i, 100, 'destruction_spell', { sourceOwner: 0 });
    const n = [X, Y, Z, W].map(hpv);
    R.check('normale Gegnerkreatur gesperrt', n[2] === v[2], [v[2], n[2]]);
    R.check('vom Gegner gestohlene (meine) Kreatur: Gegnerziel, gesperrt', n[0] === v[0], [v[0], n[0]]);
    R.check('von mir gestohlene Gegnerkreatur: kein Gegnerziel, nimmt Schaden', n[1] === v[1] - 100, [v[1], n[1]]);
    R.check('meine Kreatur auf der Gegnerseite (Kontrolle bei mir): kein Gegnerziel, nimmt Schaden', n[3] === v[3] - 100, [v[3], n[3]]);
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('Helden: dauerhafte Übernahme');
  {
    const t = await H.fresh({ hand: [['Flame Avalanche'], []] });
    await t.engine.actionTakeHeroPermanently(1, 0, 2);   // mein Held 2: Gegner kontrolliert
    await t.engine.actionTakeHeroPermanently(0, 1, 2);   // Gegnerheld 2: ich kontrolliere
    await t.play(0, 'Flame Avalanche', { hero: 0 });
    const [a, b, c] = [t.hp(0, 2), t.hp(1, 2), t.hp(1, 1)];
    for (const [s, h] of [[0, 2], [1, 2], [1, 1]]) await t.engine.actionDealDamage(src, t.hero(s, h), 100, 'destruction_spell');
    R.check('normaler Gegnerheld gesperrt', t.hp(1, 1) === c, [c, t.hp(1, 1)]);
    R.check('mein vom Gegner kontrollierter Held: gesperrt', t.hp(0, 2) === a, [a, t.hp(0, 2)]);
    R.check('von mir kontrollierter Gegnerheld: nimmt Schaden', t.hp(1, 2) === b - 100, [b, t.hp(1, 2)]);
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('Helden: Charme (temporäre Kontrolle)');
  {
    const t = await H.fresh({ hand: [['Flame Avalanche'], []] });
    t.hero(0, 2).charmedBy = 1;   // mein Held 2 ist vom Gegner gecharmt
    t.hero(1, 2).charmedBy = 0;   // Gegnerheld 2 von mir gecharmt
    await t.play(0, 'Flame Avalanche', { hero: 0 });
    const [a, b] = [t.hp(0, 2), t.hp(1, 2)];
    await t.engine.actionDealDamage(src, t.hero(0, 2), 100, 'destruction_spell');
    await t.engine.actionDealDamage(src, t.hero(1, 2), 100, 'destruction_spell');
    R.check('vom Gegner gecharmter eigener Held: gesperrt', t.hp(0, 2) === a, [a, t.hp(0, 2)]);
    R.check('von mir gecharmter Gegnerheld: nimmt Schaden', t.hp(1, 2) === b - 100, [b, t.hp(1, 2)]);
  }

  R.section('Last Resort teilt die Sperre');
  {
    const t = await H.fresh({ hand: [['Last Resort'], []] });
    const Y = t.put(1, 0, 0, H.INERT.big), X = t.put(0, 0, 0, H.INERT.big);
    await t.engine.actionStealCreature(0, Y); await wait(250);
    await t.engine.actionStealCreature(1, X); await wait(250);
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Last Resort', { hero: 0 });
    const [y0, x0] = [hpv(Y), hpv(X)];
    await t.engine.actionDealCreatureDamage(src, Y, 100, 'destruction_spell', { sourceOwner: 0 });
    await t.engine.actionDealCreatureDamage(src, X, 100, 'destruction_spell', { sourceOwner: 0 });
    R.check('Last Resort: von mir kontrollierte Kreatur nimmt Schaden, die vom Gegner kontrollierte nicht', hpv(Y) === y0 - 100 && hpv(X) === x0, { y: [y0, hpv(Y)], x: [x0, hpv(X)] });
  }

  R.section('Heat Wave nach Flame Avalanche (Zusammenspiel)');
  {
    const t = await H.fresh({ hand: [['Flame Avalanche', 'Heat Wave'], []] });
    const Y = t.put(1, 0, 0, H.INERT.big);   // Gegnerkreatur, von mir gestohlen = mein Ziel, vorverbrannt
    const Z = t.put(1, 1, 0, H.INERT.big);   // normale Gegnerkreatur, vorverbrannt
    const X = t.put(0, 1, 0, H.INERT.big);   // meine Kreatur, vom Gegner kontrolliert, vorverbrannt
    await t.engine.actionStealCreature(0, Y); await wait(250);
    await t.engine.actionStealCreature(1, X); await wait(250);
    for (const i of [Y, Z, X]) i.counters.burned = true;
    await t.play(0, 'Flame Avalanche', { hero: 0 });
    const v = [Y, Z, X].map(hpv);
    t.grantFor(0, 0, 'Heat Wave');
    const r = await t.play(0, 'Heat Wave', { hero: 0 });
    const n = [Y, Z, X].map(hpv);
    R.check('Heat Wave gespielt', r === true, r);
    R.check('von mir kontrollierte vorverbrannte Kreatur nimmt 150 trotz Sperre', n[0] === v[0] - 150, [v[0], n[0]]);
    R.check('vom Gegner kontrollierte vorverbrannte Kreatur (normal und gestohlen-von-mir-an-ihn) bleibt gesperrt', n[1] === v[1] && n[2] === v[2], { z: [v[1], n[1]], x: [v[2], n[2]] });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
