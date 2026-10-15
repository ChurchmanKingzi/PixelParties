'use strict';
// W11c · Q82 (C03-17) · Horned Demon (von Lovely Teddy geliehen): Counter am Ende des Zuges des AKTUELLEN Beherrschers (Absicherung)
//
// Kartentext Demon: „At the end of each of your turns, place a Demon Counter on this Creature."
// Kartentext Teddy: „You may use that Creature's active effects as if you controlled it for the rest of the turn."
// ENTSCHIEDEN (Al, Welle 11, Q82): „Ja, er bekommt Counter am Ende der Runde seines aktuellen Beherrschers." -> Ist-Zustand bleibt (Absicherungs-Repro, keine Codeänderung).
// Geprüft: (a) Sitz 0 leiht den Demon von Sitz 1 (Teddy), am Ende des Zuges von Sitz 0 steigt der Zähler 2 -> 3; (b) der Demon ist danach wieder bei Sitz 1 und
//   bekommt am Ende von Sitz 1's EIGENEM Zug den nächsten Zähler (3 -> 4) - genau einen je Zugende, nie zwei; (c) Gegenprobe ohne Leihe: am Ende des Zuges des
//   NICHT-Beherrschers (hier Sitz 0, Demon gehört Sitz 1 und ist nicht geliehen) bleibt der Zähler stehen.
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();

  R.section('(a)+(b) geliehener Demon');
  {
    const t = await H.fresh({});
    const teddy = t.put(0, 0, 0, 'Lovely Teddy'); teddy.turnPlayed = 1;
    const demon = t.put(1, 1, 0, 'Horned Demon'); demon.turnPlayed = 1; demon.counters.demonCounter = 2;
    t.targetFn = (valid) => [valid.find(v => v.cardName === 'Horned Demon').id];
    t.gs.activePlayer = 0; t.phase(2);
    const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
    R.check('(a) Teddy hat den Demon geliehen (Kontrolle Sitz 0)', r === true && demon.controller === 0, [r, demon.controller]);
    await t.endTurn();
    R.check('(a) Ende des Leiher-Zuges: Zähler 2 -> 3', demon.counters.demonCounter === 3, demon.counters.demonCounter);
    R.check('(a) Demon ist wieder bei Sitz 1', (demon.controller ?? demon.owner) === 1, demon.controller);
    await t.endTurn();
    R.check('(b) Ende des Besitzer-Zuges (Sitz 1): Zähler 3 -> 4 (genau einer)', demon.counters.demonCounter === 4, demon.counters.demonCounter);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }

  R.section('(c) Gegenprobe: ungeliehen zählt nur der Zug des Besitzers');
  {
    const t = await H.fresh({});
    const demon = t.put(1, 1, 0, 'Horned Demon'); demon.turnPlayed = 1; demon.counters.demonCounter = 2;
    t.gs.activePlayer = 0; t.phase(2);
    await t.endTurn();
    R.check('(c) Ende des Zuges von Sitz 0: Zähler bleibt 2', demon.counters.demonCounter === 2, demon.counters.demonCounter);
    await t.endTurn();
    R.check('(c) Ende des Zuges von Sitz 1: Zähler 3', demon.counters.demonCounter === 3, demon.counters.demonCounter);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
