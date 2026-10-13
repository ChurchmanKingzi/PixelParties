'use strict';
// A09-15 · Gestohlene Kreatur stirbt: Elven Rider und Cycling Demons setzen den Nachfolger in die FALSCHE Zone (gleiche Koordinaten auf der eigenen Seite) oder gar nicht
// Kartentext Elven Rider: „… when an "Elven" Creature you control leaves the board, but you must summon it into the SAME Support Zone that Creature occupied."
// Kartentext Bouldor Demon (alle Cycling Demons analog): „When this Creature is defeated, you may choose 1 "Infernous Demon" from your deck and place it into the Support Zone this Creature occupied."
// Ein gestohlener Elven/Demon steht physisch weiter auf der Seite seines Besitzers (`physicalSide` = owner bei `stolenBy`), sein Kontrolleur ist der Dieb. Beide Skripte prüfen/belegen
// aber `gs.players[<Kontrolleur>].supportZones[heroIdx][zoneSlot]` – also die gleich indizierte Zone auf der EIGENEN Seite des Diebes.
// Aufbau: Seed 1234. Sitz 1: Elven Archer bzw. Bouldor Demon auf Held 0 / Slot 1. Sitz 0 stiehlt die Kreatur (actionStealCreature), Hand [Elven Rider] bzw. Deck [Infernous Demon]; danach wird die Kreatur zerstört.
//   Szene „frei": Sitz 0 Held 0 / Slot 1 ist leer. Szene „belegt": Sitz 0 Held 0 / Slot 1 ist durch eine Kreatur belegt.
// Erwartet: Nachfolger (Rider bzw. Infernous Demon) erscheint in der Zone, die die gestohlene Kreatur belegte (Seite 1, Held 0, Slot 1) – oder, wenn das nicht geht, wird er nicht platziert; auf keinen Fall in einer
//   anderen Zone, und das Ergebnis darf nicht davon abhängen, ob zufällig die gleich indizierte Zone auf der eigenen Seite frei ist.
// Beobachtet: „frei": Nachfolger landet in Sitz 0 / Held 0 / Slot 1 (eigene Seite, ANDERE Zone). „belegt": kein Angebot (Rider-Prompt bleibt aus), nichts passiert.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const rider = async (belegt) => {
    const t = await H.fresh({ hand: [['Elven Rider'], []], gold: [100, 100], deck: [[H.INERT.creature, 'Elven Leader', ...Array(10).fill(H.INERT.creature)], Array(10).fill(H.INERT.creature)] });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Elven Rider', answer: () => ({ cardName: 'Elven Leader' }) });
    const a = t.put(1, 0, 1, 'Elven Archer');
    if (belegt) t.put(0, 0, 1, H.INERT.creature);
    await t.run(() => t.engine.actionStealCreature(0, a));
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, a));
    const r = t.find('Elven Rider', 'support');
    return { ort: r ? { seite: r.owner, held: r.heroIdx, slot: r.zoneSlot } : null, hand: t.pile(0, 'hand'), errors: t.errors };
  };
  const daemon = async (belegt) => {
    const t = await H.fresh({ hand: [[], []], gold: [100, 100], deck: [['Infernous Demon', ...Array(15).fill(H.INERT.creature)], ['Infernous Demon', ...Array(15).fill(H.INERT.creature)]] });
    const d = t.put(1, 0, 1, 'Bouldor Demon');
    if (belegt) t.put(0, 0, 1, H.INERT.creature);
    t.put(1, 1, 0, H.INERT.big);
    await t.run(() => t.engine.actionStealCreature(0, d));
    t.script.push({ match: q => q.type === 'confirm' && q.title === 'Bouldor Demon' && /defeated/.test(q.message || ''), answer: () => ({ confirmed: true }) });
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.cardName === H.INERT.big); return v ? [v.id] : null; };
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, d));
    const r = t.find('Infernous Demon', 'support');
    return { ort: r ? { seite: r.owner, held: r.heroIdx, slot: r.zoneSlot } : null, errors: t.errors };
  };
  const istAlteZone = (o) => o && o.seite === 1 && o.held === 0 && o.slot === 1;
  const okZone = (o) => o === null || istAlteZone(o);                      // alte Zone oder gar nicht – nie eine andere Zone
  R.section('Elven Rider – gestohlener Elven Archer stirbt');
  const r1 = await rider(false), r2 = await rider(true);
  R.check('eigene Zone frei: Rider steht in der alten Zone (Seite 1, Held 0, Slot 1) oder gar nicht', okZone(r1.ort), r1);
  R.check('Rider-Ergebnis hängt nicht davon ab, ob die gleich indizierte EIGENE Zone frei ist', (r1.ort === null) === (r2.ort === null), { frei: r1.ort, belegt: r2.ort });
  R.section('Bouldor Demon – gestohlen, stirbt');
  const d1 = await daemon(false), d2 = await daemon(true);
  R.check('eigene Zone frei: Infernous steht in der alten Zone (Seite 1, Held 0, Slot 1) oder gar nicht', okZone(d1.ort), d1);
  R.check('Demon-Ergebnis hängt nicht davon ab, ob die gleich indizierte EIGENE Zone frei ist', (d1.ort === null) === (d2.ort === null), { frei: d1.ort, belegt: d2.ort });
  R.check('keine Engine-Fehler', [r1, r2, d1, d2].every(x => x.errors.length === 0), [r1, r2, d1, d2].map(x => x.errors));
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
