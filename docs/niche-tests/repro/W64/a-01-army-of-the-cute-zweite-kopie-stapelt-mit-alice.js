'use strict';
// W64a-01 · Army of the Cute: eine zweite gleichnamige Kopie darf sich auf die erste stapeln — nur bei aktiver Alice-Teilung (Al, 23.10.2026: „Sofern der Alice-Effekt aktiv ist, ja.")
//
// Kartentext: „Choose "Cute" Creatures from your hand or discard pile whose combined levels do not exceed 1/2/3 and place them into the user's free Support Zones."
// Alice: „Creatures with identical names in the Support Zones of a Hero you control share 1 Support Zone."
// Erwartet: mit Alice kommen zwei gleichnamige Kopien in EINE Zone (Stapel ×2; ist schon eine Kopie da, ×3), die geteilte Zone steht vor der ersten leeren; ohne Alice
//   bleibt es bei einer Kopie je freier Zone (die zweite bleibt auf der Hand). Beide Sitze. Exit 0 = korrekt.
const A = require('../../lib/alice-brett.js');
const { H, brett, zoneA, instIn, ohneStapel } = A;
const BUN = 'Cute Bunny', ARMY = 'Army of the Cute', BIG = H.INERT.big;

async function lauf(seat, o) {
  const t = await brett(seat, { zonen: o.zonen, leer: true, alice: o.alice, hand: [ARMY, BUN, BUN], gold: 100 });
  t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat).forEach(c => { c.turnPlayed = 1; });
  t.setHand(seat, [ARMY, BUN, BUN]);
  t.grantFor(seat, 0, ARMY, 1);   // Summoning Magic Lv2: Budget 2
  // der Client begrenzt die Wahl auf `selectCount` (freie Zonen bzw. 3 mit Alice) — die Antwort tut es auch
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: d => { const n = Math.min(2, d.selectCount || 2); return { selectedCards: Array(n).fill(BUN), selectedIndices: d.cards.map((c, i) => c.name === BUN ? i : -1).filter(i => i >= 0).slice(0, n) }; } });
  const r = await t.play(seat, ARMY, { hero: 0, noGrant: true });
  return { t, r };
}

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} ──`);
    // (a) eine freie Zone, keine Kopie auf dem Brett
    for (const mitAlice of [true, false]) {
      const { t, r } = await lauf(seat, { zonen: [[BIG], [BIG], []], alice: mitAlice });
      const stapel = zoneA(t, seat, 0, 2);
      const hand = t.gs.players[seat].hand.filter(x => x === BUN).length;
      R.check(`[S${seat}] ${mitAlice ? 'mit Alice' : 'ohne Alice'}, 1 freie Zone: ${mitAlice ? 'beide Kopien kommen in die EINE Zone (Stapel ×2), nichts bleibt auf der Hand' : 'nur eine Kopie wird platziert, die zweite bleibt auf der Hand'}`, mitAlice ? (stapel.length === 2 && instIn(t, seat, 0, 2, BUN) === 2 && hand === 0) : (stapel.length === 1 && hand === 1), { r, stapel, hand });
      R.check(`[S${seat}] ${mitAlice ? 'mit Alice' : 'ohne Alice'}: Zustand sauber, keine Engine-Fehler`, ohneStapel(t).length === 0 && t.errors.length === 0, { audit: ohneStapel(t), errors: t.errors });
    }
    // (b) volles Brett, aber eine Kopie liegt schon: die geteilte Zone steht vor — beide kommen dazu (×3); ohne Alice nicht spielbar
    for (const mitAlice of [true, false]) {
      const { t, r } = await lauf(seat, { zonen: [[BUN], [BIG], [BIG]], alice: mitAlice });
      const stapel = zoneA(t, seat, 0, 0);
      R.check(`[S${seat}] ${mitAlice ? 'mit Alice' : 'ohne Alice'}, Brett voll, Kopie liegt: ${mitAlice ? 'beide neuen Kopien stapeln sich dazu (×3)' : 'der Zauber ist nicht spielbar, nichts passiert'}`, mitAlice ? (stapel.length === 3 && instIn(t, seat, 0, 0, BUN) === 3) : (stapel.length === 1 && t.gs.players[seat].hand.filter(x => x === BUN).length === 2 && t.gs.players[seat].hand.includes(ARMY)), { r, stapel });
    }
    // (c) freie Zone UND eine Kopie auf dem Brett: erst die geteilte Zone, nicht die leere
    {
      const { t } = await lauf(seat, { zonen: [[BUN], [BIG], []], alice: true });
      R.check(`[S${seat}] mit Alice, freie Zone + Kopie auf dem Brett: erst die geteilte Zone (×3), die leere bleibt leer`, zoneA(t, seat, 0, 0).length === 3 && zoneA(t, seat, 0, 2).length === 0, { z0: zoneA(t, seat, 0, 0), z2: zoneA(t, seat, 0, 2) });
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
