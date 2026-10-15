'use strict';
// W11c · Q77 (C03-10) · Mr. Jiggles (gestohlen/geliehen): darf ihren eigenen Wirtsplatz als Gegnerziel wählen
//
// Kartentext: „You may once per turn choose up to 2 targets your opponent controls and inflict 100 damage to them."
// Frage an Al (Q77): „Darf eine geliehene Kreatur ihren eigenen Wirtsplatz als Gegnerziel wählen (ja = Brettseite zählt) oder soll sie herausgefiltert werden
//   (nein = Kontrolle zählt)?" Antwort Al: „Ja". Auftrag W11c: „keine Änderung des heutigen Verhaltens (Absicherungs-Repro)".
// Umsetzung (W11c, Nachtrag): `mr-jiggles.js` fragt mit side 'any' + Bedingung - gleiche Menge wie 'enemy' (Helden der Gegner, Kreaturen nach KONTROLLE)
//   plus die geliehene Jiggles selbst (nur wenn sie auf der Gegnerseite des Leihers liegt). Z1 bleibt: Ziel-IDs nennen die Brettseite.
// Geprüft: (a) Dieb (Sitz 1) bekommt die Zielwahl; (b) Liste: 3 Helden des Gegners, dessen ZZ Dummy UND die geliehene Jiggles selbst; (c) NICHT: eigene Helden/Kreaturen
//   des Diebes; (d) gewählte Ziele nehmen je 100 Schaden; (e) Jiggles wählt sich selbst: 90 HP -> stirbt, Karte in die Ablage des BESITZERS (Sitz 0), keine Fehler;
//   (f) Gegenprobe: Jiggles auf der EIGENEN Seite bietet sich nicht selbst an.
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
  R.check('(b) die geliehene Jiggles selbst ist als Gegnerziel angeboten (Brettseite Sitz 0, Held 0, Zone 0)', valid.some(v => v.type === 'equip' && v.cardName === 'Mr. Jiggles' && v.owner === 0 && v.heroIdx === 0 && v.slotIdx === 0), kreaturen);
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

  R.section('(e) die geliehene Jiggles wählt sich selbst');
  {
    const t2 = await H.fresh({});
    const j2 = t2.put(0, 0, 0, 'Mr. Jiggles'); j2.turnPlayed = 1;
    t2.engine.actionStealCreature(1, j2);
    t2.gs.activePlayer = 1; t2.phase(2);
    t2.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.cardName === 'Mr. Jiggles').id];
    const r2 = await t2.run(() => t2.host.doActivateCreatureEffect(t2.room, 1, { heroIdx: 0, zoneSlot: 0, charmedOwner: 0 }));
    R.check('(e) Aktivierung angenommen', r2 === true, r2);
    R.check('(e) Jiggles (90 HP) ist durch den eigenen Treffer gestorben und liegt in der Ablage des Besitzers (Sitz 0)', (t2.gs.players[0].supportZones[0][0] || []).length === 0 && t2.gs.players[0].discardPile.includes('Mr. Jiggles') && !t2.gs.players[1].discardPile.includes('Mr. Jiggles'), [t2.gs.players[0].supportZones[0][0], t2.gs.players[0].discardPile, t2.gs.players[1].discardPile]);
    R.check('(e) keine Engine-Fehler', t2.errors.length === 0, t2.errors);
    R.check('(e) Zustand sauber', t2.audit().length === 0, t2.audit());
  }

  R.section('(f) Gegenprobe: eigene Jiggles bietet sich nicht selbst an');
  {
    const t3 = await H.fresh({});
    const j3 = t3.put(0, 0, 0, 'Mr. Jiggles'); j3.turnPlayed = 1;
    t3.put(1, 1, 0, H.INERT.creature);
    t3.gs.activePlayer = 0; t3.phase(2);
    t3.targetFn = (valid) => valid.filter(v => v.type === 'hero').slice(0, 1).map(v => v.id);
    await t3.run(() => t3.host.doActivateCreatureEffect(t3.room, 0, { heroIdx: 0, zoneSlot: 0 }));
    const v3 = (t3.targets[0]?.valid || []);
    R.check('(f) Liste: Gegner-Kreatur ja, Jiggles selbst nein, keine eigenen Helden', v3.some(v => v.cardName === H.INERT.creature) && !v3.some(v => v.cardName === 'Mr. Jiggles') && !v3.some(v => v.type === 'hero' && v.owner === 0), v3.map(v => [v.type, v.owner, v.cardName]));
    R.check('(f) keine Engine-Fehler', t3.errors.length === 0, t3.errors);
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
