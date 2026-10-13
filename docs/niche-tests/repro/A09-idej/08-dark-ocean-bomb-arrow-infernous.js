'use strict';
// A09-08 · Bomb Arrow und Infernous Demon verursachen ihren Kreaturenschaden als 'destruction_spell' – Dark Ocean lässt ihn durch
// Kartentext Dark Ocean: „… Creatures take no damage, except from Attacks and Spells."   (Als Ruling 5.8., _engine.js ~46286: es kommen NUR 'attack' und 'destruction_spell' durch)
// Kartentext Bomb Arrow (Artifact): „… deal 100 damage to [a Creature your opponent controls]."   Infernous Demon (Creature): „… deal 50 damage to it 3 times."
// CARD_API „SCHADENSTYPEN": Kreatureneffekt = 'creature' („Faustregel: 'creature', außer der Kartentext sagt ausdrücklich etwas anderes"), Artefakt = 'artifact'; 'destruction_spell' = „Schaden eines Zaubers. NICHT für Kreatureneffekte".
// Aufbau: Seed 1234. Dark Ocean liegt in der Area-Zone von Sitz 1. Seite 1: Kreatur(en) als Opfer.
//   (a) Seite 0: Held 0 mit Fighting 1, Hand [Bomb Arrow, Attack]; Attack + Bomb Arrow, Bomb-Ziel = Opfer-Kreatur.
//   (b) Seite 0: Bouldor Demon (Slot 0), Infernous Demon im Deck; Bouldor wird zerstört -> Infernous wird platziert (Bonus 50 x3 auf die Opfer-Kreatur).
// Erwartet: Dark Ocean blockt beide Schäden (Kontrolle: Elven Archers 'creature'-Schaden wird geblockt) – die Opfer-Kreaturen bleiben unverletzt.
// Beobachtet: Bomb Arrow macht 100, Infernous 3 x 50 Schaden; kein "dark_ocean_damage_blocked"-Log.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  R.section('Kontrolle: Elven Archer (Typ creature) mit und ohne Dark Ocean');
  for (const ocean of [false, true]) {
    const t = await H.fresh({ hand: [[], []], gold: [100, 100] });
    if (ocean) t.putArea(1, 'Dark Ocean');
    const v = t.put(1, 0, 0, H.INERT.big);
    const a = t.put(0, 0, 0, 'Elven Archer'); a.turnPlayed = 1;     // keine Beschwörungsmüdigkeit
    t.targetFn = (valid) => { const x = valid.find(q => q.type === 'equip' && q.owner === 1); return x ? [x.id] : null; };
    t.phase(2);                                                      // Kreatureneffekte laufen in der Main Phase
    await t.activateCreature(0, 0, 0);
    const hp = v.counters.currentHp ?? 1000;
    R.check('Kontrolle: Archer-Schaden (50) ' + (ocean ? 'wird von Dark Ocean geblockt' : 'kommt ohne Dark Ocean an'), ocean ? hp === 1000 : hp === 950, hp);
  }
  R.section('Bomb Arrow');
  {
    const t = await H.fresh({ hand: [['Bomb Arrow', 'Attack'], []], gold: [100, 100] });
    t.setAbilities(0, 0, [['Fighting'], [], []]);
    t.putArea(1, 'Dark Ocean');
    const v = t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => {
      const eq = valid.find(x => x.type === 'equip' && x.owner === 1);
      if (t.targets.length === 1 && eq) return [eq.id];            // 1. Wahl: Bomb-Arrow-Ziel
      return [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    };
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Bomb Arrow: 100 Schaden an der Kreatur wird von Dark Ocean geblockt', (v.counters.currentHp ?? 1000) === 1000, v.counters.currentHp);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('Infernous Demon (Platzierungs-Bonus)');
  {
    const t = await H.fresh({ hand: [[], []], gold: [100, 100], deck: [['Infernous Demon', ...Array(15).fill(H.INERT.creature)], Array(10).fill(H.INERT.creature)] });
    t.putArea(1, 'Dark Ocean');
    const bouldor = t.put(0, 0, 0, 'Bouldor Demon');
    const v = t.put(1, 0, 0, H.INERT.big);
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Bouldor Demon' && /defeated/.test(d.message || ''), answer: () => ({ confirmed: true }) });
    t.targetFn = (valid) => { const x = valid.find(q => q.type === 'equip' && q.owner === 1); return x ? [x.id] : null; };
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, bouldor));
    R.check('Infernous Demon wurde platziert (Voraussetzung)', t.zone(0, 0, 0) === 'Infernous Demon', t.zone(0, 0, 0));
    R.check('Infernous: 3 x 50 Schaden werden von Dark Ocean geblockt', (v.counters.currentHp ?? 1000) === 1000, v.counters.currentHp);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
