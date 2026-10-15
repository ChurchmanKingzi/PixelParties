'use strict';
// W11c · Q77 (C03-10) · Mr. Jiggles (gestohlen/geliehen): Absicherung der Zielliste und des Schadenswegs - KEINE Verhaltensänderung
//
// Kartentext: „You may once per turn choose up to 2 targets your opponent controls and inflict 100 damage to them."
// Frage an Al (Q77): „Darf eine geliehene Kreatur ihren eigenen Wirtsplatz als Gegnerziel wählen (ja = Brettseite zählt) oder soll sie herausgefiltert werden
//   (nein = Kontrolle zählt)?" Antwort Al: „Ja". Auftrag W11c: „keine Änderung des heutigen Verhaltens (Absicherungs-Repro)".
// ACHTUNG (Abgabe W11c): Der Stand 4126587 bietet den geliehenen Jiggles NICHT als Ziel an (Z1, Welle 2: `kreaturPasstZurSeite` -> Kontrolle zählt;
//   Repro C03-10 prüft genau das). Das ist das Gegenteil der wörtlichen Lesart von Als „Ja". Weil der Auftrag ausdrücklich „keine Änderung" sagt, wird der Code
//   NICHT geändert; dieses Repro sichert nur, was in BEIDEN Lesarten gleich sein muss (und notiert den Streitpunkt als Notiz, nicht als Prüfung):
//   (a) der Dieb (Sitz 1) aktiviert den geliehenen Jiggles und bekommt die Zielwahl (Prompt an Sitz 1);
//   (b) alle Helden des Gegners (Sitz 0) und seine eigenen Kreaturen (ZZ Dummy, vom Besitzer geführt) stehen in der Liste;
//   (c) Eigene Helden/Kreaturen des Diebes (Sitz 1) stehen NICHT in der Liste;
//   (d) gewählte Ziele nehmen je 100 Schaden, kein Doppelschaden, keine Engine-Fehler, Zustand sauber.
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
  R.note('Streitpunkt Q77: wird der geliehene Jiggles selbst angeboten?', valid.some(v => v.type === 'equip' && v.cardName === 'Mr. Jiggles') ? 'ja' : 'nein (Stand 4126587)');
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
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
