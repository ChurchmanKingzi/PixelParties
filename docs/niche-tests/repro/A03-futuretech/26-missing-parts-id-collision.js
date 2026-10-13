'use strict';
// A03-futuretech-26 · Debt-O-Tron Model Missing Parts und Scrap Plow: eigener Zielsammler baut IDs aus dem Besitzer statt der Brettseite – fremd beschworene Kreatur verdrängt die gewählte
//
// Kartentext: „You may once per turn choose a target and deal damage equal to 10 times the amount of negative Gold you have to it.“
// Der gemeinsame Sammler `_targeting-shared.js:92` nimmt `_brettSeite(engine, inst)` für die ID; Missing Parts baut seine Liste selbst (`alleZiele`, Z. 47).
// Aufbau: Sitz 0 beschwört Plant Golem (landet bei Sitz 1, Held 0, Slot 0; owner 0, controller 1), außerdem eigene „ZZ Dummy" bei Sitz 0, Held 0, Slot 0; Missing Parts bei Sitz 0, Held 1; Gold −30.
// Schritte: Missing Parts aktivieren, den Eintrag „ZZ Dummy" wählen.
// Erwartet: die ZZ Dummy erhält 300 Schaden, der Golem bleibt unberührt; die beiden Einträge haben verschiedene IDs.
// Beobachtet: beide Einträge heißen `equip-0-0-0`; die Wahl „ZZ Dummy" trifft den Golem (−250 HP), die ZZ Dummy bleibt unversehrt.
// Zweiter Teil: dieselbe Lage mit Scrap Plow (Kent, Fists bei Gold 0 -> Überziehung): IDs `support-0-0-0` doppelt, die Wahl „ZZ Dummy" schickt den Golem in die Ablage.
// Ursache: cards/effects/debt-o-tron-model-missing-parts.js:47 und debt-o-tron-model-scrap-plow.js:63 (`${inst.zone}-${inst.owner}-…`) `id: equip-${inst.owner}-…` (Besitzer statt physischer Brettseite), danach `ziele.find(t => t.id === id)` liefert den ersten Treffer.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Plant Golem'], []], gold: [100, 100] });
  await t.play(0, 'Plant Golem', { hero: 0 });
  const golem = t.inst(c => c.name === 'Plant Golem' && c.zone === 'support')[0];
  const dummy = t.put(0, 0, 0, H.INERT.creature); dummy.turnPlayed = 1;
  const mp = t.put(0, 1, 0, 'Debt-O-Tron Model Missing Parts'); mp.turnPlayed = 1;
  t.gs.players[0].gold = -30;
  let seen = [];
  t.targetFn = (valid) => { seen = valid.filter(v => v.type === 'equip').map(v => [v.id, v.cardName]); const v = valid.find(x => x.cardName === H.INERT.creature && x.owner === 0); return v ? [v.id] : null; };
  t.phase(2);
  const gHp0 = golem.counters.currentHp ?? golem.baseHp;
  await t.activateCreature(0, 1, 0);
  R.check('die Einträge ZZ Dummy und Plant Golem haben verschiedene IDs', new Set(seen.map(s => s[0])).size === seen.length, seen);
  R.check('Wahl „ZZ Dummy" trifft die ZZ Dummy (300 Schaden)', (dummy.counters.currentHp ?? 200) < 200, { dummy: dummy.counters });
  R.check('der Plant Golem bleibt unberührt', (golem.counters.currentHp ?? golem.baseHp) === gHp0, { golem: golem.counters });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  // ── Scrap Plow ──
  {
    const t2 = await H.fresh({ hand: [['Plant Golem', 'Future Tech Fists'], []], gold: [100, 100] });
    t2.setHero(0, 0, 'Kent, the Indebted Apprentice', 400);
    await t2.play(0, 'Plant Golem', { hero: 0 });
    const golem2 = t2.inst(c => c.name === 'Plant Golem' && c.zone === 'support')[0];
    const dummy2 = t2.put(0, 0, 0, H.INERT.creature); dummy2.turnPlayed = 1;
    t2.put(0, 2, 2, 'Debt-O-Tron Model Scrap Plow').turnPlayed = 1;
    t2.gs.players[0].gold = 0;
    let liste = [];
    t2.targetFn = (valid) => { liste = valid.filter(v => v.type === 'equip').map(v => [v.id, v.cardName]); const v = valid.find(x => x.cardName === H.INERT.creature && x.owner === 0); return v ? [v.id] : null; };
    await t2.play(0, 'Future Tech Fists', { hero: 0, slot: 1 });
    R.check('Scrap Plow: ZZ Dummy und Plant Golem haben verschiedene IDs', new Set(liste.map(x => x[0])).size === liste.length, liste);
    R.check('Scrap Plow: Wahl „ZZ Dummy" schickt die ZZ Dummy in die Ablage', dummy2.zone !== 'support', { dummy: dummy2.zone, golem: golem2.zone });
    R.check('Scrap Plow: der Plant Golem bleibt auf dem Brett', golem2.zone === 'support', golem2.zone);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
