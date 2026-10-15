'use strict';
// W11c · Q74 (C02-05) · Drill Sergeant, gestohlen: legt beim Helden, UNTER DEM ER LIEGT (Gegnerseite)
//
// Kartentext: „You may once per turn choose a level 1 or lower Creature from your hand and place it into a free Support Zone of the corresponding Hero."
// ENTSCHIEDEN (Al, Welle 11, Q74 „a"): Ein gestohlener Drill Sergeant legt die Kreatur beim Helden, unter dem er liegt (Gegnerseite; die Karte gehört dem
//   Dieb, die Kreatur kommt aus der Hand des Kontrolleurs). Umsetzung: `drill-sergeant.js` `targetZones(engine, seite, heroIdx)` mit der Brettseite
//   (`physicalSide`), `actionPlaceCreature(…, { heldSeite })` -> `controller` = Dieb + `crossSideControlled`.
// Geprüft: (a) gestohlener Sergeant (Seite 0, Held 1; Dieb Sitz 1): Landeplatz Seite 0 / Held 1, Kontrolle Sitz 1, Hand des Diebes -1;
//   (b) die Kreatur gehört dem Dieb (Tod -> Ablage des Diebes, nicht des Besitzers); (c) Gegenprobe: ungestohlener Sergeant legt wie gehabt beim eigenen Helden;
//   (d) Held-1-Zonen der Gegenseite voll -> der gestohlene Sergeant ist nicht aktivierbar (keine Ausweichzone bei einem anderen Helden).
const H = require('../../lib/h.js');
const D = H.INERT.creature;

(async () => {
  const R = H.runner();
  const gallery = (t, name) => t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: name }) });
  const zone = (t) => t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });

  R.section('(a)+(b) gestohlener Sergeant');
  {
    const t = await H.fresh({ hand: [[], [D]] });
    const ds = t.put(0, 1, 0, 'Drill Sergeant'); ds.turnPlayed = 1;
    t.engine.actionStealCreature(1, ds);
    gallery(t, D); zone(t);
    t.gs.activePlayer = 1; t.phase(2);
    const handVor = t.gs.players[1].hand.length;
    const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: 1, zoneSlot: 0, charmedOwner: 0 }));
    const p = t.inst(c => c.name === D && c.zone === 'support')[0];
    R.note('Aktivierung / Landeplatz [Brettseite, Held, Zone]', [r, p && [p.owner, p.heroIdx, p.zoneSlot]]);
    R.check('(a) Aktivierung angenommen', r === true, r);
    R.check('(a) Kreatur liegt beim Helden unter dem Sergeant (Seite 0, Held 1)', !!p && p.owner === 0 && p.heroIdx === 1, p && [p.owner, p.heroIdx, p.zoneSlot]);
    R.check('(a) Kontrolle liegt beim Dieb (Sitz 1)', !!p && (p.controller ?? p.owner) === 1, p && [p.owner, p.controller]);
    R.check('(a) die Karte kam aus der Hand des Kontrolleurs (Hand -1)', t.gs.players[1].hand.length === handVor - 1 && !t.gs.players[1].hand.includes(D), t.gs.players[1].hand);
    R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('(a) Zustand sauber', t.audit().length === 0, t.audit());
    if (p) {
      const vorher = t.gs.players[1].discardPile.length;
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 0 }, p));
      R.check('(b) stirbt die Kreatur, geht sie in die Ablage des Diebes (Sitz 1)', t.gs.players[1].discardPile.includes(D) && !t.gs.players[0].discardPile.includes(D), [t.gs.players[1].discardPile, t.gs.players[0].discardPile]);
      R.check('(b) keine Engine-Fehler (Tod)', t.errors.length === 0, t.errors);
    }
  }

  R.section('(c) Gegenprobe: ungestohlener Sergeant, eigener Held');
  {
    const t = await H.fresh({ hand: [[D], []] });
    const ds = t.put(0, 1, 0, 'Drill Sergeant'); ds.turnPlayed = 1;
    gallery(t, D); zone(t);
    t.gs.activePlayer = 0; t.phase(2);
    const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 1, zoneSlot: 0 }));
    const p = t.inst(c => c.name === D && c.zone === 'support')[0];
    R.check('(c) Kreatur liegt beim eigenen Helden 1 auf Seite 0, Kontrolle bei Sitz 0', r === true && !!p && p.owner === 0 && p.heroIdx === 1 && (p.controller ?? p.owner) === 0 && !p.counters?.crossSideControlled, p && [p.owner, p.heroIdx, p.controller, p.counters]);
    R.check('(c) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(d) alle Zonen des Wirtshelden belegt: nicht aktivierbar (kein Ausweichen auf andere Helden)');
  {
    const t = await H.fresh({ hand: [[], [D]] });
    const ds = t.put(0, 1, 0, 'Drill Sergeant'); ds.turnPlayed = 1;
    t.put(0, 1, 1, H.INERT.big); t.put(0, 1, 2, H.INERT.big);
    t.engine.actionStealCreature(1, ds);
    gallery(t, D); zone(t);
    t.gs.activePlayer = 1; t.phase(2);
    const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: 1, zoneSlot: 0, charmedOwner: 0 }));
    const p = t.inst(c => c.name === D && c.zone === 'support');
    R.check('(d) Aktivierung abgelehnt, nichts gelegt', r === false && p.length === 0, [r, p.length]);
    R.check('(d) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
