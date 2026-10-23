'use strict';
// W63a-01 · Reihenfolge der Zonenwahl bei AUTOMATISCHER Wahl: erst die geteilte Zone, dann die erste leere (Al, 22.10.2026)
//
// Kartentext Alice, the Transfer Student: „Creatures with identical names in the Support Zones of a Hero you control share 1 Support Zone. This effect persists even when this
//   Hero is defeated and cannot be negated."
// Al (Rückfrage 2 aus Welle 62): „Nein [kein 'erste freie, keine Wahl'], es sollte immer gelten: erst die geteilte Zone, sofern Alices Effekt aktiv ist, DANN die erste leere."
// W62a hatte „frei vor geteilt" umgesetzt. Jetzt überall, wo die ZONE VOM EFFEKT bestimmt wird (Pinta, Slimes, Auto-Platzierung, CPU, Ushabti, Old Couple …): geteilte Zone zuerst.
// Wo der SPIELER wählt (Hand-Beschwörung auf eine ausdrücklich gewählte Zone, Zonenwahl-Prompts), bleiben BEIDE Optionen wählbar; nur die Standardvorauswahl ist die geteilte Zone.
// Szene (je Sitz): Held 0 = Zone A: 2 gleichnamige Kreaturen (Stapel), Zone B: FREI, Zone C: andere Kreatur. Held 1 = Alice, Held 1/2 voll.
// Exit 0 = korrekt.
const { H, ALICE, BIG, CRE, brett, zoneA, instIn, ohneStapel, sicher, slotsVon, antworten } = require('../../lib/alice-brett.js');
const SLIME = 'Infinitely Reproducing Slime', PINTA = 'Pinta, the Singing Ship';
const { eligibleSummonZones } = require('../../../../cards/effects/_summon-eligibility');
const cpu = require('../../../../cards/effects/_cpu.js')._test;

const ZONEN = [[SLIME, SLIME], [], [BIG]];   // A = geteilt, B = frei, C = fremde Kreatur

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const S = `Sitz ${seat}: `;

    R.section(S + '1 · die zentralen Zonenlisten: geteilt VOR frei');
    { const t = await brett(seat, { zonen: ZONEN, fuellen: true });
      const e = t.engine;
      const bz = e.beschwoerZonenFuer(seat, SLIME, { heroIdx: 0 });
      R.check('beschwoerZonenFuer: [A geteilt, B frei]', JSON.stringify(slotsVon(bz)) === JSON.stringify(['0s', '1']), bz);
      R.check('ersteBeschwoerZone = die geteilte Zone A', e.ersteBeschwoerZone(seat, SLIME, { heroIdx: 0 })?.slotIdx === 0 && e.ersteBeschwoerZone(seat, SLIME, { heroIdx: 0 })?.shared === true, null);
      const nk = e.beschwoerZonenFuer(seat, SLIME, { nachKontrolle: true }).filter(z => z.heroIdx === 0);
      R.check('beschwoerZonenFuer nachKontrolle: ebenfalls geteilt zuerst', JSON.stringify(slotsVon(nk)) === JSON.stringify(['0s', '1']), nk);
      const gf = e.getFreeSupportZones(seat, { shareableFor: SLIME }).filter(z => z.heroIdx === 0);
      R.check('getFreeSupportZones(shareableFor): geteilt zuerst', JSON.stringify(slotsVon(gf)) === JSON.stringify(['0s', '1']), gf);
      const gfo = e.getFreeSupportZones(seat, {}).filter(z => z.heroIdx === 0);
      R.check('getFreeSupportZones OHNE shareableFor: nur die freie Zone (unveraendert)', JSON.stringify(slotsVon(gfo)) === '["1"]', gfo);
      const ez = eligibleSummonZones(e, seat, SLIME, { alsAktion: false }).filter(z => z.heroIdx === 0);
      R.check('eligibleSummonZones: geteilt zuerst', JSON.stringify(slotsVon(ez)) === JSON.stringify(['0s', '1']), ez);
      R.check('eligibleSummonZones geteilt:false → nur die freie Zone', JSON.stringify(slotsVon(eligibleSummonZones(e, seat, SLIME, { alsAktion: false, geteilt: false }).filter(z => z.heroIdx === 0))) === '["1"]', null);
      const t2 = await brett(seat, { zonen: ZONEN, fuellen: true, alice: false });
      R.check('GEGENPROBE ohne Alice: nur die freie Zone, nichts geteilt', JSON.stringify(slotsVon(t2.engine.beschwoerZonenFuer(seat, SLIME, { heroIdx: 0 }))) === '["1"]', null);
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + '2 · Auto-Platzierung der Engine (safePlaceInSupport ohne Wunschplatz): erst die geteilte Zone');
    { const t = await brett(seat, { zonen: ZONEN, fuellen: true });
      const r = t.engine.safePlaceInSupport(SLIME, seat, 0, -1);
      R.check('landet in Zone A (Stapel ×3), die freie Zone B bleibt leer', r?.actualSlot === 0 && zoneA(t, seat).length === 3 && zoneA(t, seat, 0, 1).length === 0, { r: r && r.actualSlot, a: zoneA(t, seat), b: zoneA(t, seat, 0, 1) });
      const t2 = await brett(seat, { zonen: ZONEN, fuellen: true, alice: false });
      const r2 = t2.engine.safePlaceInSupport(SLIME, seat, 0, -1);
      R.check('GEGENPROBE ohne Alice: erste leere Zone B', r2?.actualSlot === 1 && zoneA(t2, seat).length === 2, r2 && r2.actualSlot);
      const t3 = await brett(seat, { zonen: ZONEN, fuellen: true });
      const r3 = t3.engine.safePlaceInSupport(SLIME, seat, 0, 1);
      R.check('Wunschplatz = die FREIE Zone B (Spieler waehlt): bleibt B, der Stapel A waechst nicht', r3?.actualSlot === 1 && zoneA(t3, seat).length === 2, r3 && r3.actualSlot);
      const t4 = await brett(seat, { zonen: ZONEN, fuellen: true });
      const r4 = t4.engine.safePlaceInSupport(SLIME, seat, 0, 2);
      R.check('Wunschplatz C (belegt von einer FREMDEN Kreatur) → Ausweichen: zuerst die geteilte Zone A', r4?.actualSlot === 0 && zoneA(t4, seat).length === 3, r4 && r4.actualSlot);
      const t5 = await brett(seat, { zonen: ZONEN, fuellen: true, alice: false });
      const r5 = t5.engine.safePlaceInSupport(SLIME, seat, 0, 2);
      R.check('GEGENPROBE ohne Alice: Ausweichen auf die erste leere Zone B', r5?.actualSlot === 1, r5 && r5.actualSlot);
      R.check('keine Engine-Fehler', t.errors.length + t2.errors.length + t3.errors.length + t4.errors.length === 0, t.errors.concat(t4.errors)); }

    R.section(S + '3 · Pinta waehlt die Zone selbst (keine Zonenwahl): geteilte Zone A, die freie Zone B bleibt leer');
    { const t = await brett(seat, { zonen: ZONEN, fuellen: true, held0: PINTA, potionDeck: [SLIME, 'Healing Potion', 'Healing Potion', 'Healing Potion', 'Healing Potion'] });
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      t.grantFor(seat, 0, SLIME);
      const r = await t.activateHero(seat, 0);
      R.check('Stapel A = 3 Slimes, B leer', r === true && zoneA(t, seat).length === 3 && zoneA(t, seat, 0, 1).length === 0, { r: sicher(r), a: zoneA(t, seat), b: zoneA(t, seat, 0, 1) });
      R.check('keine Zonenwahl', t.prompts.filter(p => p.d.type === 'zonePick').length === 0, t.prompts.map(p => p.d.type));
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + '4 · Infinitely Reproducing Slime: Zonenwahl-Prompt bietet die geteilte Zone ZUERST an (Standardvorauswahl); die freie bleibt waehlbar');
    for (const wahl of ['standard', 'frei']) {
      const t = await brett(seat, { zonen: ZONEN, fuellen: true, hand: [SLIME] });
      t.gs.activePlayer = seat; t.gs.turn = 7;
      antworten(t, SLIME, { zone: wahl === 'frei' ? [0, 1] : null });
      await t.turnStart(seat);
      const ang = (t.zonenAngebote || [])[0] || [];
      R.check(`(${wahl}) Prompt: erste angebotene Zone ist die geteilte A (Slot 0, shared?)`, ang.length >= 2 && ang[0].slotIdx === 0 && ang[0].heroIdx === 0, ang);
      if (wahl === 'standard') R.check('Standardantwort (erste Zone): der neue Slime stapelt in A (×3), B leer', zoneA(t, seat).length === 3 && zoneA(t, seat, 0, 1).length === 0, { a: zoneA(t, seat), b: zoneA(t, seat, 0, 1) });
      else R.check('Spielerwahl der FREIEN Zone B bleibt moeglich: Slime steht in B, A bleibt ×2', zoneA(t, seat, 0, 1).length === 1 && zoneA(t, seat).length === 2, { a: zoneA(t, seat), b: zoneA(t, seat, 0, 1) });
      R.check(`(${wahl}) keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }

    R.section(S + '5 · Army of the Cute: zwei gleichnamige Karten — die zweite stapelt auf die erste (geteilt zuerst), nicht in die naechste leere Zone');
    { const t = await brett(seat, { zonen: [[], [], [BIG]], fuellen: true, hand: ['Army of the Cute', 'Cute Bunny', 'Cute Bunny'], gold: 100 });
      antworten(t, 'Cute Bunny', { anzahl: 2 });
      const r = await t.play(seat, 'Army of the Cute', { hero: 0 });
      const a = zoneA(t, seat, 0, 0), b = zoneA(t, seat, 0, 1);
      R.check('beide Bunnys in EINER Zone (A leer→erste leere, die zweite teilt sie)', (a.length === 2 && b.length === 0) || (b.length === 2 && a.length === 0), { r: sicher(r), a, b });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + '6 · Forceful Revival waehlt den Platz selbst: geteilte Zone A, nicht die freie Zone B');
    { const t = await brett(seat, { zonen: ZONEN, fuellen: true, discard: [SLIME], hand: ['Forceful Revival'] });
      antworten(t, SLIME);
      const r = await t.play(seat, 'Forceful Revival', { hero: 0 });
      R.check('Slime stapelt in A (×3), B bleibt leer', zoneA(t, seat).length === 3 && zoneA(t, seat, 0, 1).length === 0, { r: sicher(r), a: zoneA(t, seat), b: zoneA(t, seat, 0, 1) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + '7 · CPU: Zonenwahl-Antwort, Heuristik und MCTS-Aufzaehlung bevorzugen die geteilte Zone');
    { const t = await brett(seat, { zonen: ZONEN, fuellen: true });
      t.grantFor(seat, 0, SLIME);
      R.check('pickCreatureZoneSlot → geteilte Zone A (Slot 0)', cpu.pickCreatureZoneSlot(t.engine, seat, 0, SLIME) === 0, cpu.pickCreatureZoneSlot(t.engine, seat, 0, SLIME));
      // Das CPU-Gehirn (Heuristik der zonePick-Antwort): aus einer Liste [frei, geteilt] nimmt es die geteilte Zone — auch wenn der Aufrufer die Eintraege
      // ohne Sortierung liefert (40 Laeufe, die Heuristik waehlt sonst zufaellig). Die Engine-Standardantwort nimmt dagegen `zones[0]` (Reihenfolge = Sache des Erzeugers).
      require('../../../../cards/effects/_cpu.js').installCpuBrain(t.engine);
      t.engine._cpuPlayerIdx = seat;
      const liste = [{ heroIdx: 0, slotIdx: 1 }, { heroIdx: 0, slotIdx: 0, shared: true }];
      const gewaehlt = new Set();
      for (let k = 0; k < 40; k++) { const a = t.engine._getCpuGenericResponse({ type: 'zonePick', zones: liste, title: 'ZZ Test', cancellable: false }, seat); gewaehlt.add(a && a.slotIdx); }
      R.check('CPU-Heuristik: bei [frei, geteilt] immer die geteilte (40 Laeufe)', gewaehlt.size === 1 && gewaehlt.has(0), [...gewaehlt]);
      const ohne = new Set();
      for (let k = 0; k < 40; k++) { const a = t.engine._getCpuGenericResponse({ type: 'zonePick', zones: [{ heroIdx: 0, slotIdx: 1 }, { heroIdx: 0, slotIdx: 2 }], title: 'ZZ Test', cancellable: false }, seat); ohne.add(a && a.slotIdx); }
      R.check('GEGENPROBE ohne geteilte Zone bleibt die Heuristik unveraendert zufaellig (beide Zonen kommen vor)', ohne.size === 2, [...ohne]);
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + '8 · Ushabti (Beschwoerung aus der Hand-Aktivierung): auto-Zone ist die geteilte');
    { const t = await brett(seat, { zonen: ZONEN, fuellen: true });
      const z = t.engine.beschwoerZonenFuer(seat, SLIME, { heroIdx: 0, nurBasis: true })[0];
      R.check('beschwoerZonenFuer(...)[0] (so nimmt Ushabti den Platz) = geteilt', z.slotIdx === 0 && z.shared === true, z); }
  }
  R.finish();
})().catch(e => { process.stdout.write('ABSTURZ ' + (e && e.stack) + '\n'); process.exit(1); });
