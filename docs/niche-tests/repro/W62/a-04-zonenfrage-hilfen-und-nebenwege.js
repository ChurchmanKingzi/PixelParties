'use strict';
// W62a-04 · Die zentrale Zonenfrage und ihre Anschlüsse (Hilfsfunktionen, Sofort-Beschwörung, Surprise-Kreatur, CPU) — Alice-Teilung (Al, 22.10.2026)
//
// Kartentext Alice, the Transfer Student: „Creatures with identical names in the Support Zones of a Hero you control share 1 Support Zone. This effect persists even when this
//   Hero is defeated and cannot be negated."
// Geprüft wird:
//  1. `engine.beschwoerZonenFuer` / `hatBeschwoerZone` / `eligibleSummonZones`: freie Zonen vor geteilten, `shared`/`stackDepth`, nur gleichnamige Stapel, Held-Zustand
//     (Frozen/gefallen), `geteilt: false`, `nurBasis`, übernommener Held der Gegenspalte (Kontrolle statt Seite), Alice beim Gegner.
//  2. `sofortAusHandBeschwoeren` (Albrecht, Ellie, Golden Ladybug …): die Zonenwahl bietet die geteilte Zone an, die Kreatur landet im Stapel.
//  3. `_canHeroActivateSurprise` für Kreatur-Surprises (Jumper Spider): gilt auf vollem Brett mit gleichnamiger Zone als aktivierbar.
//  4. CPU (`_cpu.js`): Heldeneignung, Zonenwahl und Kandidaten-Aufzählung kennen die geteilte Zone.
//  5. `engine.zoneEintragen` (Eintragshelfer der Handplatzierer): stapelt, überschreibt nie.
// Beide Sitze. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const ALICE = 'Alice, the Transfer Student', SLIME = 'Infinitely Reproducing Slime', BIG = H.INERT.big, CRE = H.INERT.creature;
const { eligibleSummonZones, sofortAusHandBeschwoeren } = require('../../../../cards/effects/_summon-eligibility');
const cpu = require('../../../../cards/effects/_cpu.js')._test;

/** Alice = Held 1; Held 0 trägt `zonen` (Namen je Slot 0-2, Stapel = mehrere Namen). Held 1/2: Zonen mit BIG gefüllt. */
async function brett(seat, zonen, o = {}) {
  const alice = o.alice !== false;
  const eigene = ['Tushu, the Knowledge Keeper', alice ? ALICE : 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'];
  const heroes = seat === 0 ? [eigene, null] : [null, eigene];
  const t = await H.fresh({ heroes, hand: o.hand && (seat === 0 ? [o.hand, []] : [[], o.hand]) });
  const ps = t.gs.players[seat];
  zonen.forEach((namen, z) => namen.forEach((n, k) => {
    let i;
    if (k === 0) i = t.put(seat, 0, z, n);
    else { ps.supportZones[0][z].push(n); i = t.engine._trackCard(n, seat, 'support', 0, z); }
    i.turnPlayed = 1;
  }));
  if (o.fuellen) for (const h of [1, 2]) for (let z = 0; z < 3; z++) { const i = t.put(seat, h, z, BIG); i.turnPlayed = 1; }
  t.gs.turn = 5; t.gs.activePlayer = seat;
  return t;
}
const slots = (zs) => zs.filter(z => z.heroIdx === 0).map(z => z.slotIdx + (z.shared ? 's' : ''));

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const S = `Sitz ${seat}: `;

    R.section(S + '1 · `beschwoerZonenFuer` / `eligibleSummonZones`: frei vor geteilt, nur gleichnamige Stapel');
    { const t = await brett(seat, [[SLIME, SLIME], [], [BIG]], { fuellen: true });
      const bz = t.engine.beschwoerZonenFuer(seat, SLIME, { heroIdx: 0 });
      R.check('beschwoerZonenFuer: Slot 1 frei, dann Slot 0 geteilt (×2)', JSON.stringify(bz.map(z => [z.slotIdx, !!z.shared, z.stackDepth || 0])) === JSON.stringify([[1, false, 0], [0, true, 2]]), bz);
      const ez = eligibleSummonZones(t.engine, seite(t, seat), SLIME, { alsAktion: false });
      R.check('eligibleSummonZones (Held 0): Slot 1 frei, Slot 0 geteilt', JSON.stringify(slots(ez)) === JSON.stringify(['1', '0s']), ez);
      R.check('eligibleSummonZones `geteilt: false` → nur die freie Zone', JSON.stringify(slots(eligibleSummonZones(t.engine, seat, SLIME, { alsAktion: false, geteilt: false }))) === '["1"]', null);
      R.check('hatBeschwoerZone: Slime ja, andere Karte nur die freie Zone, BIG-Stapel-Name nicht über Slime', t.engine.hatBeschwoerZone(seat, SLIME, { heroIdx: 0 }) && JSON.stringify(slots(t.engine.beschwoerZonenFuer(seat, CRE, { heroIdx: 0 }))) === '["1"]', null);
      R.check('nurBasis: nur Basisplätze 0-2', t.engine.beschwoerZonenFuer(seat, SLIME, { heroIdx: 0, nurBasis: true }).every(z => z.slotIdx < 3), null);
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + '1b · Held-Zustand: gefallener Held — place (ohne livingHeroesOnly) ja, summon (`eligibleSummonZones`) nein; eingefrorener Held beschwört nicht');
    { const t = await brett(seat, [[SLIME, SLIME], [BIG], [BIG]], { fuellen: true });
      t.gs.players[seat].heroes[0].hp = 0;
      R.check('place: die geteilte Zone des gefallenen Helden zählt (Slime-Effekt „place")', t.engine.hatBeschwoerZone(seat, SLIME, { heroIdx: 0 }), null);
      R.check('place mit livingHeroesOnly: nein', !t.engine.hatBeschwoerZone(seat, SLIME, { heroIdx: 0, livingHeroesOnly: true }), null);
      R.check('summon (`eligibleSummonZones` prüft den Beschwörer): keine Zone des gefallenen Helden', eligibleSummonZones(t.engine, seat, SLIME, { alsAktion: false }).filter(z => z.heroIdx === 0).length === 0, null);
      t.gs.players[seat].heroes[0].hp = 800; t.heroStatus(seat, 0, 'frozen');
      R.check('eingefrorener Held: summon nein, place ja', eligibleSummonZones(t.engine, seat, SLIME, { alsAktion: false }).filter(z => z.heroIdx === 0).length === 0 && t.engine.hatBeschwoerZone(seat, SLIME, { heroIdx: 0 }), null); }

    R.section(S + '1c · gemischte Zone, Alice beim Gegner, kein Alice: keine geteilte Zone');
    { const t = await brett(seat, [[SLIME, BIG], [BIG], [BIG]], { fuellen: true });
      R.check('gemischter Stapel [Slime, BIG]: keine Zone für Slime', t.engine.beschwoerZonenFuer(seat, SLIME, { heroIdx: 0 }).length === 0, null);
      const t2 = await brett(seat, [[SLIME], [BIG], [BIG]], { fuellen: true, alice: false });
      R.check('ohne Alice: keine Zone', t2.engine.beschwoerZonenFuer(seat, SLIME, { heroIdx: 0 }).length === 0 && eligibleSummonZones(t2.engine, seat, SLIME, { alsAktion: false }).length === 0, null);
      const t3 = await brett(seat, [[SLIME], [BIG], [BIG]], { fuellen: true, alice: false });
      t3.gs.players[1 - seat].heroes[0] = { ...t3.gs.players[1 - seat].heroes[0], name: ALICE };
      R.check('Alice beim Gegner: die eigenen Zonen teilen nicht', t3.engine.beschwoerZonenFuer(seat, SLIME, { heroIdx: 0 }).length === 0, null); }

    R.section(S + '1d · übernommener Held der Gegenspalte (Kontrolle statt Seite): sein Slime-Stapel teilt mit MEINER Alice; ein nicht kontrollierter Held nicht');
    { const t = await brett(seat, [[BIG], [BIG], [BIG]], { fuellen: true });
      const gegner = 1 - seat, gps = t.gs.players[gegner];
      for (let h = 0; h < 3; h++) for (let z = 0; z < 3; z++) { const i = t.put(gegner, h, z, BIG); i.turnPlayed = 1; }
      // Gegnerheld 0: Slime-Stapel (×2), von mir kontrolliert (Kreaturen: Kontrolleur = ich, Brettseite = Gegner)
      for (const i of t.inst(c => c.zone === 'support' && c.owner === gegner && c.heroIdx === 0 && c.zoneSlot === 0)) t.engine._untrackCard(i.id);
      gps.supportZones[0][0] = [];
      for (let k = 0; k < 2; k++) { gps.supportZones[0][0].push(SLIME); const i = t.engine._trackCard(SLIME, gegner, 'support', 0, 0); i.turnPlayed = 1; i.controller = seat; }
      const zOhne = t.engine.beschwoerZonenFuer(seat, SLIME, { nachKontrolle: true }).filter(z => z.owner === gegner);
      R.check('Gegnerheld nicht kontrolliert: keine Zone auf der Gegenseite', zOhne.length === 0, zOhne);
      gps.heroes[0].permaControlBy = seat;
      const zMit = t.engine.beschwoerZonenFuer(seat, SLIME, { nachKontrolle: true }).filter(z => z.owner === gegner && z.heroIdx === 0);
      R.check('Gegnerheld von mir übernommen: seine Slime-Zone ist eine geteilte Zone (owner = Gegnerseite)', zMit.length === 1 && zMit[0].shared === true && zMit[0].slotIdx === 0, zMit);
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + '2 · `sofortAusHandBeschwoeren` (Albrecht, Ellie, Golden Ladybug …): Zonenwahl bietet die geteilte Zone an');
    { const t = await brett(seat, [[SLIME, SLIME], [BIG], [BIG]], { fuellen: true, hand: [SLIME] });
      t.grantFor(seat, 0, SLIME);
      let angebot = null;
      t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { angebot = d.zones.map(z => [z.heroIdx, z.slotIdx, !!z.shared]); const z = d.zones.find(q => q.heroIdx === 0 && q.slotIdx === 0) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
      const ok = await t.run(() => sofortAusHandBeschwoeren(t.engine, seat, SLIME, { source: 'Test' }));
      R.check('Beschwörung geglückt, Slime-Stapel auf 3', ok === true && t.gs.players[seat].supportZones[0][0].length === 3, { ok, z: t.gs.players[seat].supportZones[0][0] });
      R.check('Hand leer, Karte nur einmal vorhanden', t.gs.players[seat].hand.length === 0 && t.inst(c => c.name === SLIME && c.zone === 'support' && c.owner === seat).length === 3, t.gs.players[seat].hand);
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
      const t2 = await brett(seat, [[SLIME, SLIME], [BIG], [BIG]], { fuellen: true, hand: [SLIME], alice: false });
      t2.grantFor(seat, 0, SLIME);
      const ok2 = await t2.run(() => sofortAusHandBeschwoeren(t2.engine, seat, SLIME, { source: 'Test' }));
      R.check('GEGENPROBE ohne Alice: keine Beschwörung, Karte bleibt auf der Hand', ok2 === false && t2.gs.players[seat].hand.length === 1 && t2.gs.players[seat].supportZones[0][0].length === 2, ok2); }

    R.section(S + '3 · Kreatur-Surprise (Jumper Spider): auf vollem Brett aktivierbar, wenn eine gleichnamige Zone liegt');
    { const t = await brett(seat, [['Jumper Spider', 'Jumper Spider'], [BIG], [BIG]], { fuellen: true });
      t.grantFor(seat, 0, 'Jumper Spider');
      t.gs.players[seat].heroes[0].statuses = {};
      R.check('mit Alice: _canHeroActivateSurprise ja', t.engine._canHeroActivateSurprise(seat, 0, 'Jumper Spider') === true, null);
      const t2 = await brett(seat, [['Jumper Spider', 'Jumper Spider'], [BIG], [BIG]], { fuellen: true, alice: false });
      t2.grantFor(seat, 0, 'Jumper Spider');
      R.check('GEGENPROBE ohne Alice: nein (keine freie Zone)', t2.engine._canHeroActivateSurprise(seat, 0, 'Jumper Spider') === false, null);
      const t3 = await brett(seat, [[BIG], [BIG], [BIG]], { fuellen: true });
      t3.grantFor(seat, 0, 'Jumper Spider');
      R.check('GEGENPROBE mit Alice, aber keine gleichnamige Kreatur: nein', t3.engine._canHeroActivateSurprise(seat, 0, 'Jumper Spider') === false, null); }

    R.section(S + '4 · CPU: Heldeneignung, Zonenwahl (`pickCreatureZoneSlot`) und Eignungsliste kennen die geteilte Zone');
    { const t = await brett(seat, [[SLIME, SLIME], [BIG], [BIG]], { fuellen: true });
      t.grantFor(seat, 0, SLIME);
      const cd = H.DB[SLIME];
      const eligible = cpu.listEligibleHeroesForActionCard(t.engine, seat, cd);
      R.check('Held 0 ist Kandidat für den Slime (volles Brett, aber geteilte Zone)', eligible.some(e => e.hi === 0), eligible);
      R.check('pickCreatureZoneSlot wählt die geteilte Zone A (Slot 0)', cpu.pickCreatureZoneSlot(t.engine, seat, 0, SLIME) === 0, cpu.pickCreatureZoneSlot(t.engine, seat, 0, SLIME));
      const t2 = await brett(seat, [[SLIME, SLIME], [BIG], [BIG]], { fuellen: true, alice: false });
      t2.grantFor(seat, 0, SLIME);
      R.check('GEGENPROBE ohne Alice: Held 0 ist kein Kandidat, keine Zone (−1)', !cpu.listEligibleHeroesForActionCard(t2.engine, seat, cd).some(e => e.hi === 0) && cpu.pickCreatureZoneSlot(t2.engine, seat, 0, SLIME) === -1, null);
      const t3 = await brett(seat, [[SLIME, SLIME], [], [BIG]], { fuellen: true });
      t3.grantFor(seat, 0, SLIME);
      R.check('freie Zone UND geteilte Zone: die CPU bevorzugt die freie (Slot 1)', cpu.pickCreatureZoneSlot(t3.engine, seat, 0, SLIME) === 1, cpu.pickCreatureZoneSlot(t3.engine, seat, 0, SLIME)); }

    R.section(S + '5 · `engine.zoneEintragen`: stapelt bei Alice, überschreibt nie');
    { const t = await brett(seat, [[SLIME, SLIME], [], [BIG]], { fuellen: true });
      const ps = t.gs.players[seat];
      const a = t.engine.zoneEintragen(seat, 0, 0, SLIME, seat);
      R.check('belegte gleichnamige Zone: gestapelt (true), jetzt 3 Einträge', a === true && ps.supportZones[0][0].length === 3, ps.supportZones[0][0]);
      const b = t.engine.zoneEintragen(seat, 0, 1, SLIME, seat);
      R.check('leere Zone: [Name] (false)', b === false && JSON.stringify(ps.supportZones[0][1]) === JSON.stringify([SLIME]), ps.supportZones[0][1]);
      const t2 = await brett(seat, [[SLIME, SLIME], [], [BIG]], { fuellen: true, alice: false });
      const c = t2.engine.zoneEintragen(seat, 0, 0, SLIME, seat);
      R.check('GEGENPROBE ohne Alice: belegte Zone wird wie bisher überschrieben (der Aufrufer wählt sonst nur freie Zonen)', c === false && t2.gs.players[seat].supportZones[0][0].length === 1, t2.gs.players[seat].supportZones[0][0]); }
  }
  R.finish();
})().catch(e => { process.stdout.write('ABSTURZ ' + (e && e.stack) + '\n'); process.exit(1); });

function seite(t, seat) { return seat; }
