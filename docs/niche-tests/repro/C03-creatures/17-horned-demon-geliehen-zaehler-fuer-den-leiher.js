'use strict';
// C03-creatures-17 · Horned Demon (von Lovely Teddy geliehen): der Leiher legt am Zugende einen Demon Counter auf die GEGNER-Kreatur
// Kartentext Demon: „At the end of each of your turns, place a Demon Counter on this Creature."
// Kartentext Teddy: „You may use that Creature's active effects as if you controlled it for the rest of the turn."
// Aufbau: Sitz 0: Lovely Teddy (alt); Sitz 1: Horned Demon (alt) mit 2 Demon Countern. Sitz 0 leiht den Demon (Teddy), dann endet der Zug von Sitz 0.
// Alte Erwartung: Teddy leiht nur AKTIVE Effekte; „each of YOUR turns" des Demons sind die Züge von Sitz 1 → Zähler bleibt 2.
// Beobachtet: Zähler = 3 – der Leiher füttert am Ende seines eigenen Zuges den Demon des Gegners.
// ENTSCHIEDEN (Al, Welle 11, Q82): „Ja, er bekommt Counter am Ende der Runde seines aktuellen Beherrschers" -> Ist-Zustand (Zähler 3) ist KORREKT.
//   Repro in Welle 11 auf die neue Regel umgestellt (Erwartung 3 statt 2); die Absicherung steht in W11/c-q82-*.
// Ursache: Teddy benutzt actionStealCreature (voller Kontrollwechsel bis Zugende, CARD_API „Lovely Teddy"); der Hook horned-demon.js onTurnEnd
//   prüft `ctx.isMyTurn` gegen den (geliehenen) Kontrolleur → feuert für den Leiher. Gilt für jeden passiven Hook geliehener Kreaturen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const teddy = t.put(0, 0, 0, 'Lovely Teddy'); teddy.turnPlayed = 1;
  const demon = t.put(1, 1, 0, 'Horned Demon'); demon.turnPlayed = 1; demon.counters.demonCounter = 2;
  t.targetFn = (valid) => [valid.find(v => v.cardName === 'Horned Demon').id];
  t.gs.activePlayer = 0; t.phase(2);
  const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
  R.check('Teddy hat den Demon geliehen (Kontrolle Sitz 0)', r === true && demon.controller === 0, [r, demon.controller]);
  await t.endTurn();
  R.check('Demon ist wieder bei Sitz 1', (demon.controller ?? demon.owner) === 1, demon.controller);
  R.check('Zugende des Leihers (aktueller Beherrscher) legt einen Zähler: 2 -> 3 (Q82)', demon.counters.demonCounter === 3, demon.counters.demonCounter);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
