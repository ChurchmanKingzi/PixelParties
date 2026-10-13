'use strict';
// C01-creatures-10 · Angler Angel erhöht bei Flächenschlägen über `ctx.aoeHit` nur das ERSTE getroffene Ziel (nicht den ganzen Schlag)
// Kartentext Angler Angel: „All damage your other Creatures inflict with their effects is increased by 50."
// Ruling 20.8. (Kopf von angler-angel.js): „Angler erhoeht nur die erste Schadens-Instanz jeder Creature … Gangsters Schaden wird aber alles auf einmal
//   zugefuegt, waere also komplett erhoeht." Ein Flächenschlag (alle Ziele gleichzeitig) ist EINE Instanz => alle Ziele +50.
// Aufbau: Seed 1234. Sitz 0: Angler Angel + Cavalry (bzw. Yuki-Onna mit 2 Hearts of Ice). Sitz 1: eine große Kreatur in Held 0.
// Erwartung: Gangster Angel (Gegenprobe) trifft alle Ziele mit 10+50. Cavalry (50 auf Held + alle Kreaturen seiner Zonen): Held 100, Kreatur 100.
//   Yuki-Onna (100 auf alle Ziele): alle Helden und Kreaturen 150.
// Beobachtet: Cavalry: Held 100, Kreatur 50. Yuki-Onna: nur Held 0 bekommt 150, Held 1/2 und die Kreatur 100.
// Ursache: `ctx.aoeHit` -> `engine.actionAoeHit(cardInst, …)` -> `dealDamageToTargets(quelle = CardInstance, …)` (_engine.js ~45812): Helden werden mit der CardInstance als Quelle getroffen
//   (angler-angel.js `istInstanzObjekt` => keine Gruppierung, jeder Treffer claimt die Rundensperre `angler-boost:<id>` einzeln), Kreaturen mit einem frischen `quellObjekt`.
//   Nur der erste Claim gelingt. Gangster Angel baut selbst EIN Literal-Quellobjekt und ist deshalb nicht betroffen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const AA = 'Angler Angel';
  {
    R.section('Gegenprobe: Gangster Angel (10 + 50 auf alle Ziele)');
    const t = await H.fresh({});
    t.put(0, 0, 0, 'Gangster Angel').turnPlayed = 1; t.put(0, 1, 0, AA).turnPlayed = 1;
    const c = t.put(1, 0, 0, H.INERT.big);
    t.gs.currentPhase = 2;
    await t.activateCreature(0, 0, 0);
    R.check('Gangster: Helden alle 60, Kreatur 60', [0, 1, 2].every(i => 800 - t.hp(1, i) === 60) && 1000 - c.counters.currentHp === 60, { h: [800 - t.hp(1,0), 800 - t.hp(1,1), 800 - t.hp(1,2)], k: 1000 - c.counters.currentHp });
  }
  {
    R.section('Cavalry + Angler (50 auf Held und Kreatur der Zone)');
    const t = await H.fresh({});
    t.put(0, 0, 0, 'Cavalry').turnPlayed = 1; t.put(0, 1, 0, AA).turnPlayed = 1;
    const c = t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.gs.currentPhase = 2;
    await t.activateCreature(0, 0, 0);
    const held = 800 - t.hp(1, 0), kreatur = 1000 - c.counters.currentHp;
    R.note('Cavalry', { held, kreatur });
    R.check('Held UND Kreatur bekommen +50 (je 100)', held === 100 && kreatur === 100, { held, kreatur });
  }
  {
    R.section('Yuki-Onna (2 Hearts, 100 auf alle Gegner-Ziele) + Angler');
    const t = await H.fresh({ hand: [['Cold-Hearted Yuki-Onna'], []] });
    t.put(0, 0, 0, 'Heart of Ice'); t.put(0, 0, 1, 'Heart of Ice'); t.put(0, 1, 0, AA).turnPlayed = 1;
    const c = t.put(1, 0, 0, H.INERT.big);
    t.grantFor(0, 2, 'Cold-Hearted Yuki-Onna');
    t.targetFn = (valid) => valid.map(v => v.id);
    await t.play(0, 'Cold-Hearted Yuki-Onna', { hero: 2, slot: 0 });
    const h = [800 - t.hp(1, 0), 800 - t.hp(1, 1), 800 - t.hp(1, 2)], k = 1000 - c.counters.currentHp;
    R.note('Yuki-Onna', { helden: h, kreatur: k });
    R.check('alle Ziele dieses Schlags +50 (je 150)', h.every(x => x === 150) && k === 150, { h, k });
  }
  {
    R.section('Assault Eagle (100 auf 2 Kreaturen + 1 Held in EINEM Schlag) + Angler');
    const t = await H.fresh({});
    t.put(0, 0, 0, 'Assault Eagle').turnPlayed = 1; t.put(0, 1, 0, AA).turnPlayed = 1;
    const c1 = t.put(1, 0, 0, H.INERT.big), c2 = t.put(1, 1, 0, H.INERT.big);
    let calls = 0;
    t.targetFn = (valid) => { calls++; if (calls === 1) return [c1, c2].map(c => valid.find(v => v.owner === 1 && v.heroIdx === c.heroIdx && v.type !== 'hero').id).concat([valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]); return []; };
    t.gs.currentPhase = 2;
    await t.activateCreature(0, 0, 0);
    const k = [1000 - c1.counters.currentHp, 1000 - c2.counters.currentHp], h = 800 - t.hp(1, 0);
    R.note('Eagle (erste Salve)', { kreaturen: k, held: h });
    R.check('alle drei Ziele des einen Schlags +50 (je 150)', k[0] === 150 && k[1] === 150 && h === 150, { k, h });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
