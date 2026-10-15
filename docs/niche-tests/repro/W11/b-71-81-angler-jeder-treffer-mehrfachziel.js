// W11b · Q71 (C01-11) + Q81 (C03-16, C01-10) · Angler Angel
// Text: „All damage your other Creatures inflict with their effects is increased by 50."
// Al: „Angler Angel verstärkt explizit alle Treffer eines Effekts, der mehrere Ziele *gleichzeitig* trifft, inklusive beider Salven von Assault Eagle."
// Erwartung: bei Mehrfachzielen bekommt JEDES Ziel +50 (Eagle: 3 Ziele der ersten Salve und beide Ziele der Antwort-Salve, Helden und Kreaturen; Jiggles: zwei Kreaturen);
//   sequenzielle Einzeltreffer (3-Headed Giant, 3 Nutzungen) bleiben beim Ruling 20.8.: nur der erste Schlag +50; am nächsten Zug gibt es wieder den Bonus. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const AA = 'Angler Angel';
  { // Assault Eagle: Salve 1 = Held + zwei Kreaturen, Antwort = Held 1 + eigene Kreatur
    const t = await H.fresh({});
    t.put(0, 0, 0, 'Assault Eagle').turnPlayed = 1; t.put(0, 1, 0, AA).turnPlayed = 1;
    const c1 = t.put(1, 0, 0, H.INERT.big), c2 = t.put(1, 1, 0, H.INERT.big), eigene = t.put(0, 2, 0, H.INERT.big);
    let calls = 0;
    t.targetFn = (valid) => {
      calls++;
      if (calls === 1) return [c1, c2].map(c => valid.find(v => v.owner === 1 && v.heroIdx === c.heroIdx && v.type !== 'hero').id).concat([valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 2).id]);
      return [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 2).id, valid.find(v => v.owner === 0 && v.cardName === H.INERT.big).id];
    };
    t.gs.currentPhase = 2;
    await t.activateCreature(0, 0, 0);
    const s1 = [1000 - c1.counters.currentHp, 1000 - c2.counters.currentHp, 800 - t.hp(1, 2)];
    const a = [800 - t.hp(0, 2), 1000 - eigene.counters.currentHp];
    R.check('Eagle Salve 1: alle drei Ziele 150', s1.every(x => x === 150), s1);
    R.check('Eagle Antwort-Salve: beide Ziele 100 (Held und Kreatur)', a.every(x => x === 100), a);
    R.check('Eagle: keine Engine-/Audit-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // Mr. Jiggles auf zwei Kreaturen
    const t = await H.fresh({});
    t.put(0, 0, 0, AA).turnPlayed = 1; t.put(0, 1, 0, 'Mr. Jiggles').turnPlayed = 1;
    const c1 = t.put(1, 0, 0, H.INERT.big), c2 = t.put(1, 1, 0, H.INERT.big);
    t.targetFn = (valid) => [c1, c2].map(c => valid.find(v => v.owner === 1 && v.heroIdx === c.heroIdx && v.type !== 'hero').id);
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 1, zoneSlot: 0 }));
    const d = [1000 - c1.counters.currentHp, 1000 - c2.counters.currentHp];
    R.check('Jiggles: beide Kreaturen 150', d.every(x => x === 150), d);
  }
  { // 3-Headed Giant: sequenzielle Einzeltreffer
    const t = await H.fresh({});
    t.put(0, 0, 0, AA).turnPlayed = 1; t.put(0, 1, 0, '3-Headed Giant').turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 1).id];
    t.gs.currentPhase = 2;
    const res = [];
    for (let i = 0; i < 3; i++) { const h0 = t.hp(1, 1); await t.activateCreature(0, 1, 0); res.push(h0 - t.hp(1, 1)); }
    R.check('Giant: erster Schlag 130, 2. und 3. je 80 (Ruling 20.8.)', res[0] === 130 && res[1] === 80 && res[2] === 80, res);
    await t.endTurn(); await t.endTurn();
    t.gs.currentPhase = 2;
    const h0 = t.hp(1, 1);
    await t.activateCreature(0, 1, 0);
    R.check('Giant: am nächsten eigenen Zug wieder +50', h0 - t.hp(1, 1) === 130, h0 - t.hp(1, 1));
  }
  R.finish();
})();
