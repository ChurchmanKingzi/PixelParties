'use strict';
// S02-05 · „You cannot deal any other damage to targets your opponent controls this turn" (Flame Avalanche) – Sperre misst Besitz/Spalte statt Kontrolle
// Kartentext (Flame Avalanche): „Deal 150 damage to all targets your opponent controls. You cannot deal any other damage to targets your opponent controls this turn."
//   (Last Resort teilt den Mechanismus `ps.damageLocked`.)
// Erwartung (CARD_API.md „Kontrolle statt Seite"): nach dem Zauber ist weiterer Schaden an Zielen, die der GEGNER kontrolliert, auf 0 gesperrt –
//   auch an einer meiner Kreaturen/Helden, die der Gegner kontrolliert; Schaden an Zielen unter MEINER Kontrolle (z. B. gestohlene Gegnerkreatur) bleibt erlaubt.
// Beobachtet (Kreatur und Held gleich): Die Sperre prüft `inst.owner !== sourceOwner` (Kreatur) bzw. die physische Spalte des Helden:
//   ✗ Ziel in meiner Spalte, vom Gegner kontrolliert → Schaden geht durch;  ✗ Ziel in der Gegnerspalte, von mir kontrolliert → wird auf 0 gesperrt.
// Ursache: _engine.js ~8790–8800 (Held: `targetOwner !== srcOwner` über `players[pi].heroes.includes`) und ~46709 (Kreatur: `e.inst.owner !== e.sourceOwner`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const src = { name: 'Probe', owner: 0, heroIdx: 0, controller: 0 };
  {
    R.section('Kreaturen');
    const t = await H.fresh({ hand: [['Flame Avalanche'], []] });
    const X = t.put(0, 0, 0, H.INERT.big);   // gehört mir, vom Gegner kontrolliert
    const Y = t.put(1, 0, 0, H.INERT.big);   // gehört dem Gegner, von mir kontrolliert
    const Z = t.put(1, 1, 0, H.INERT.big);   // normale Gegnerkreatur
    await t.engine.actionStealCreature(1, X);
    await new Promise(r => setTimeout(r, 250));   // Steal-Kette (Reaktionsfenster) läuft kurz nach; sie sperrt Handkarten (_chainResolvingLock)
    await t.engine.actionStealCreature(0, Y);
    await new Promise(r => setTimeout(r, 250));   // Steal-Kette (Reaktionsfenster) läuft kurz nach; sie sperrt Handkarten (_chainResolvingLock)
    await t.play(0, 'Flame Avalanche', { hero: 0 });
    const hpv = (i) => i.counters.currentHp ?? 1000;   // W15b: ohne Treffer fehlt currentHp (= volle 1000 HP); sonst rechnete `y0 - 100` mit undefined
    const [x0, y0, z0] = [X, Y, Z].map(hpv);
    await t.engine.actionDealCreatureDamage(src, Z, 100, 'destruction_spell', { sourceOwner: 0 });
    await t.engine.actionDealCreatureDamage(src, X, 100, 'destruction_spell', { sourceOwner: 0 });
    await t.engine.actionDealCreatureDamage(src, Y, 100, 'destruction_spell', { sourceOwner: 0 });
    R.check('Kontrolle: normale Gegnerkreatur gesperrt', hpv(Z) === z0, [z0, hpv(Z)]);
    R.check('vom Gegner kontrollierte Kreatur ist gesperrt', hpv(X) === x0, [x0, hpv(X)]);
    R.check('von mir kontrollierte Kreatur ist NICHT gesperrt', hpv(Y) === y0 - 100, [y0, hpv(Y)]);
  }
  {
    R.section('Helden (dauerhafte Kontrolle, damit keine Charme-Immunität stört)');
    const t = await H.fresh({ hand: [['Flame Avalanche'], []] });
    await t.engine.actionTakeHeroPermanently(1, 0, 2);   // mein Held 2: Gegner kontrolliert
    await t.engine.actionTakeHeroPermanently(0, 1, 2);   // Gegnerheld 2: ich kontrolliere
    await t.play(0, 'Flame Avalanche', { hero: 0 });
    const [a, b, c] = [t.hp(0, 2), t.hp(1, 2), t.hp(1, 1)];
    await t.engine.actionDealDamage(src, t.hero(0, 2), 100, 'destruction_spell');
    await t.engine.actionDealDamage(src, t.hero(1, 2), 100, 'destruction_spell');
    await t.engine.actionDealDamage(src, t.hero(1, 1), 100, 'destruction_spell');
    R.check('Kontrolle: normaler Gegnerheld 1 gesperrt', t.hp(1, 1) === c, [c, t.hp(1, 1)]);
    R.check('mein vom Gegner kontrollierter Held 2 ist gesperrt', t.hp(0, 2) === a, [a, t.hp(0, 2)]);
    R.check('von mir kontrollierter Gegnerheld 2 ist NICHT gesperrt', t.hp(1, 2) === b - 100, [b, t.hp(1, 2)]);
  }
  R.finish();
})();
