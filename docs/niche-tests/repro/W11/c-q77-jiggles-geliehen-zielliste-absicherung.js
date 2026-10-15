'use strict';
// W11c · Q77 (C03-10) · Mr. Jiggles (gestohlen/geliehen): wählt sich NIE selbst - Zielliste und Schadensweg abgesichert (keine Codeänderung)
//
// Kartentext: „You may once per turn choose up to 2 targets your opponent controls and inflict 100 damage to them."
// Frage an Al (Q77): „Darf eine geliehene Kreatur ihren eigenen Wirtsplatz als Gegnerziel wählen (ja = Brettseite zählt) oder soll sie herausgefiltert werden
//   (nein = Kontrolle zählt)?" Antwort Al zunächst „Ja", dann klargestellt: „Jiggles sollte sich niemals *selbst* wählen können!"
// ENDGÜLTIG: Jiggles bietet sich nie selbst als Ziel an (auch geliehen nicht); alle anderen Gegnerziele wie bisher (Helden der Gegner, Kreaturen nach KONTROLLE, Z1).
//   Das ist der Stand 4126587 - keine Codeänderung, nur Absicherung.
// Geprüft: (a) Dieb (Sitz 1) bekommt die Zielwahl; (b) Liste: 3 Helden des Gegners und dessen ZZ Dummy, Jiggles selbst NICHT; (c) NICHT: eigene Helden/Kreaturen des Diebes;
//   (d) gewählte Ziele nehmen je 100 Schaden; (e) Jiggles auf der eigenen Seite bietet sich ebenfalls nie selbst an.
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const j = t.put(0, 0, 0, 'Mr. Jiggles'); j.turnPlayed = 1;
  const dummy = t.put(0, 1, 0, H.INERT.creature);
  const eigene = t.put(1, 1, 0, H.INERT.creature);   // Kreatur des Diebes
  t.engine.actionStealCreature(1, j);
  t.gs.activePlayer = 1; t.phase(2);
  const hpVorher = t.hp(0, 0);
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id, valid.find(v => v.type === 'equip' && v.cardName === H.INERT.creature && v.owner === 0).id];
  const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: 0, zoneSlot: 0, charmedOwner: 0 }));
  const valid = t.targets[0]?.valid || [];
  const heldenGegner = valid.filter(v => v.type === 'hero' && v.owner === 0).length;
  const kreaturen = valid.filter(v => v.type === 'equip').map(v => [v.owner, v.heroIdx, v.slotIdx, v.cardName]);
  R.check('(b) die geliehene Jiggles selbst wird NICHT als Gegnerziel angeboten', !valid.some(v => v.type === 'equip' && v.cardName === 'Mr. Jiggles'), kreaturen);
  R.check('(a) Aktivierung angenommen', r === true, r);
  R.check('(a) Zielwahl ging an den Dieb (Sitz 1)', t.targets.length > 0 && t.targets.every(x => x.pi === undefined || x.pi === 1), t.targets.map(x => x.pi));
  R.check('(b) alle drei Helden des Gegners wählbar', heldenGegner === 3, heldenGegner);
  R.check('(b) die Kreatur des Gegners (ZZ Dummy, Seite 0) ist wählbar', kreaturen.some(k => k[0] === 0 && k[1] === 1 && k[3] === H.INERT.creature), kreaturen);
  R.check('(c) die eigene Kreatur des Diebes (Seite 1) ist NICHT wählbar', !kreaturen.some(k => k[0] === 1), kreaturen);
  R.check('(c) keine eigenen Helden des Diebes in der Liste', !valid.some(v => v.type === 'hero' && v.owner === 1), valid.filter(v => v.type === 'hero').map(v => [v.owner, v.heroIdx]));
  R.check('(d) Held 0 des Gegners nahm genau 100 Schaden', t.hp(0, 0) === hpVorher - 100, [hpVorher, t.hp(0, 0)]);
  R.check('(d) ZZ Dummy nahm 100 Schaden (200 -> 100)', dummy.counters.currentHp === 100, dummy.counters);
  R.check('(d) die eigene Kreatur des Diebes blieb unberührt', eigene.zone === 'support', eigene.zone);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());

  R.section('(e) eigene Jiggles bietet sich nicht selbst an');
  {
    const t3 = await H.fresh({});
    const j3 = t3.put(0, 0, 0, 'Mr. Jiggles'); j3.turnPlayed = 1;
    t3.put(1, 1, 0, H.INERT.creature);
    t3.gs.activePlayer = 0; t3.phase(2);
    t3.targetFn = (valid) => valid.filter(v => v.type === 'hero').slice(0, 1).map(v => v.id);
    await t3.run(() => t3.host.doActivateCreatureEffect(t3.room, 0, { heroIdx: 0, zoneSlot: 0 }));
    const v3 = (t3.targets[0]?.valid || []);
    R.check('(e) Liste: Gegner-Kreatur ja, Jiggles selbst nein, keine eigenen Helden', v3.some(v => v.cardName === H.INERT.creature) && !v3.some(v => v.cardName === 'Mr. Jiggles') && !v3.some(v => v.type === 'hero' && v.owner === 0), v3.map(v => [v.type, v.owner, v.cardName]));
    R.check('(e) keine Engine-Fehler', t3.errors.length === 0, t3.errors);
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
