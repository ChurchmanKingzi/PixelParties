'use strict';
// W13c · Rückfrage 5 (Dive Down, Jump in the River, Unwanted Audience; Text „Play this card at the beginning of your opponent's turn") · Al, 15.10.2026:
//   „Nein, diese drei können ausdrücklich NUR zu Beginn der Gegner-Runde eingesetzt werden." → Ist-Zustand, keine Änderung: NICHT proaktiv (Absicherung).
//   Gegenprobe: Cure/Juice/Deepsea Spores/Edge/Burning Fuse (anderes Zeitfenster-Wortlaut) bleiben proaktiv.
// Erwartung: kein `proactivePlay`; im eigenen Zug (alle Phasen, beide Seiten) lehnt der Server das Ausspielen ab, die Karte bleibt auf der Hand, Gold unverändert. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const DREI = ['Dive Down', 'Jump in the River', 'Unwanted Audience'];
  for (const k of DREI) R.check(`${k}: kein proactivePlay-Flag`, !H.loadCardEffect(k)?.proactivePlay);
  for (const k of ['Cure', 'Juice', 'Deepsea Spores', 'Divine Gift of Edge', 'Burning Fuse']) R.check(`Gegenprobe ${k}: proactivePlay`, H.loadCardEffect(k)?.proactivePlay === true);
  for (const seat of [0, 1]) for (const k of DREI) for (const phase of [2, 3, 4]) {
    const hand = seat === 0 ? [[k], []] : [[], [k]];
    const t = await H.fresh({ hand, gold: [100, 100], active: seat });
    t.grantFor(seat, 0, k);
    const g0 = t.gs.players[seat].gold;
    const r = await t.play(seat, k, { hero: 0, phase });
    R.check(`Sitz ${seat} ${k} Phase ${phase}: im eigenen Zug nicht spielbar (abgelehnt, Karte auf der Hand, Gold gleich)`, r === false && t.pile(seat, 'hand').includes(k) && t.gs.players[seat].gold === g0, { r, hand: t.pile(seat, 'hand'), gold: t.gs.players[seat].gold });
    R.check(`Sitz ${seat} ${k} Phase ${phase}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
