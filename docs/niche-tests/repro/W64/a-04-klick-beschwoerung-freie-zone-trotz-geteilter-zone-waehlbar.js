'use strict';
// W64a-04 · Klick-/Drop-Beschwörung: der Spieler darf eine FREIE Zone wählen, obwohl eine geteilte Zone (Alice) verfügbar ist — es wird nichts erzwungen
//
// Al (23.10.2026): „Der Spieler darf auch auf eine freie Zone klicken und so den Alice-Effekt quasi 'verschwenden', indem er trotzdem seine Creatures verteilt."
// Server (`doPlayCreature` → `safePlaceInSupport`): die geklickte Zone gilt — leer = normale Beschwörung dorthin (Kopie liegt NICHT im Stapel), belegt-gleichnamig = Stapel (×2).
// Automatische Wege (Auto-Place ohne Wunschplatz, CPU) bleiben „geteilt zuerst". Client: der Slot-Picker bietet geteilte UND ALLE freien Zonen an (geteilte vorn) — Quelltext-Prüfung unten.
// Beide Sitze, mit/ohne Alice. Exit 0 = korrekt.
const fs = require('fs'), path = require('path');
const A = require('../../lib/alice-brett.js');
const { H, brett, zoneA, instIn, ohneStapel } = A;
const SL = 'Infinitely Reproducing Slime', BIG = H.INERT.big;

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} ──`);
    for (const mitAlice of [true, false]) {
      const lbl = mitAlice ? 'mit Alice' : 'ohne Alice';
      // Slime liegt in Zone 0, Zonen 1/2 frei; Spieler klickt FREIE Zone 2
      {
        const t = await brett(seat, { zonen: [[SL], [], []], leer: true, alice: mitAlice, hand: [SL] });
        t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat).forEach(c => { c.turnPlayed = 1; });
        t.setHand(seat, [SL]);
        const r = await t.play(seat, SL, { hero: 0, slot: 2 });
        R.check(`[S${seat}] ${lbl}: Klick auf die FREIE Zone 2 trotz Slime in Zone 0 — die Kopie liegt in Zone 2, Zone 0 bleibt unverändert (kein Zwang zur geteilten Zone)`, zoneA(t, seat, 0, 2).join() === SL && zoneA(t, seat, 0, 0).join() === SL && ohneStapel(t).length === 0, { r, z0: zoneA(t, seat, 0, 0), z2: zoneA(t, seat, 0, 2) });
      }
      // Klick auf die geteilte Zone 0 (nur mit Alice möglich)
      {
        const t = await brett(seat, { zonen: [[SL], [], []], leer: true, alice: mitAlice, hand: [SL] });
        t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat).forEach(c => { c.turnPlayed = 1; });
        t.setHand(seat, [SL]);
        const r = await t.play(seat, SL, { hero: 0, slot: 0 });
        if (mitAlice) R.check(`[S${seat}] mit Alice: Klick auf die geteilte Zone 0 — die Kopie stapelt sich (×2), die freien Zonen bleiben leer`, zoneA(t, seat, 0, 0).length === 2 && instIn(t, seat, 0, 0, SL) === 2 && zoneA(t, seat, 0, 2).length === 0 && ohneStapel(t).length === 0, { r, z0: zoneA(t, seat, 0, 0) });
        else R.check(`[S${seat}] ohne Alice: Klick auf Zone 0 (belegt, gleichnamig) — keine Beschwörung, Karte bleibt auf der Hand`, zoneA(t, seat, 0, 0).length === 1 && t.gs.players[seat].hand.includes(SL), { r, z0: zoneA(t, seat, 0, 0), hand: t.gs.players[seat].hand });
      }
    }
    // Automatische Wege bleiben „geteilt zuerst"
    {
      const t = await brett(seat, { zonen: [[SL], [], []], leer: true, alice: true });
      const r = t.engine.safePlaceInSupport(SL, seat, 0, -1);
      R.check(`[S${seat}] Auto-Place (kein Wunschplatz, CPU/Effekte): die geteilte Zone zuerst (Zone 0 → ×2), nicht die erste leere`, !!r && r.actualSlot === 0 && zoneA(t, seat, 0, 0).length === 2 && zoneA(t, seat, 0, 1).length === 0, { slot: r && r.actualSlot });
      const z = t.engine.beschwoerZonenFuer(seat, SL, { nachKontrolle: true, livingHeroesOnly: true });
      R.check(`[S${seat}] Zonenliste: geteilte Zone vorn, ALLE freien Zonen dahinter wählbar`, z[0].shared === true && z.filter(q => !q.shared && q.heroIdx === 0).length === 2, z.map(q => `${q.heroIdx}/${q.slotIdx}${q.shared ? 's' : ''}`));
    }
  }
  // Client (Slot-Picker des Klickwegs): bietet geteilte UND alle freien Zonen an, geteilte vorn
  const src = fs.readFileSync(path.resolve(__dirname, '../../../../public/app-board.jsx'), 'utf8');
  R.check('Client: der Slot-Picker sammelt über `allSummonSlots` ALLE geteilten und ALLE freien Zonen (nicht nur die erste freie je Held)', /const allSummonSlots = \(playerData, heroIdx, cardName\)/.test(src) && /freeTargets\.push\(\{ heroIdx: hi, slotIdx: sl\.slotIdx \}\)/.test(src) && /normalTargets\.push\(\{ heroIdx: hi, slotIdx: sl\.slotIdx/.test(src), null);
  R.check('Client: Automatische Heldenaktions-Beschwörung nimmt weiter die geteilte Zone zuerst (`findAutoSummonSlot`)', /const findAutoSummonSlot = [\s\S]{0,300}findShareableSupportSlot/.test(src), null);
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
