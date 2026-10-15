'use strict';
// W13c · Rückfrage 4 (Gigantisaur Skull) · Al, 15.10.2026: „Ja, Skull ist auch proaktiv nutzbar. Das 'only during opponent's turn.....' ist dazu da, seine genaue Bedingung
//   *falls man ihn reaktiv einsetzen will* zu definieren." → Ist-Zustand, keine Änderung (Absicherung). Lesart (CARD_API „Welle 13 / W13c"): „only …"-Formulierungen in Reaction-Texten
//   definieren die Bedingung der REAKTIVEN Verwendung; proaktive Verwendung ist nur ausgeschlossen, wenn der Text das ausdrücklich so formuliert („may ONLY be activated …"); Ausnahme: die drei
//   Zeitfenster-Reactions (Rückfrage 5).
// Erwartung: (a) Sitz 0 spielt den Skull im EIGENEN Zug: gewählte Kreatur gefroren, Karte verbraucht; (b) dasselbe für Sitz 1 (beide Seiten); (c) Skript trägt `proactivePlay`. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  R.check('Skript: proactivePlay gesetzt', H.loadCardEffect('Gigantisaur Skull')?.proactivePlay === true);
  for (const seat of [0, 1]) {
    const hand = seat === 0 ? [['Gigantisaur Skull'], []] : [[], ['Gigantisaur Skull']];
    const t = await H.fresh({ hand, gold: [100, 100], active: seat });
    const gegner = 1 - seat;
    const c = t.put(gegner, 0, 0, H.INERT.creature);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === gegner).id];
    const r = await t.play(seat, 'Gigantisaur Skull', { hero: 0 });
    R.check(`Sitz ${seat}: Skull im eigenen Zug proaktiv spielbar, Kreatur gefroren`, r === true && !!c.counters.frozen && !t.pile(seat, 'hand').includes('Gigantisaur Skull'), { r, frozen: c.counters.frozen });
    R.check(`Sitz ${seat}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
