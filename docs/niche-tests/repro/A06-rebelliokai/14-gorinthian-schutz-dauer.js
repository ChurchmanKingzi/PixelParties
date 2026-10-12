'use strict';
// A06-rebelliokai-14 · Gorinthian War Counselor: der Schadensschutz endet einen Zug VOR der Betäubung
// Kartentext: „…choose a target, except this Creature, and Stun it for 2 turns. Any damage targets Stunned by this effect would take becomes 0."
// Beobachtung: Der Marker `_gorinthianStun = gs.turn + 2` (gorinthian-war-counselor.js `shieldUntil`/`isShielded`) endet in Zug 7, wenn der
//   Effekt in Zug 5 benutzt wird. Der Status `stunned` (Dauer 2) hält aber bis Zug 8 (Gegnerzug) – in diesem Zug ist der Held noch
//   „Stunned by this effect", nimmt aber wieder vollen Schaden. Dasselbe bei einer Kreatur als Ziel.
// Erwartung: solange der Stun dieses Effekts auf dem Ziel liegt, wird Schaden zu 0.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const src = { name: 'Opp Source', owner: 0, heroIdx: 0 };
  const t = await H.fresh({});
  const g = t.put(0, 0, 0, 'Gorinthian War Counselor'); g.turnPlayed = t.gs.turn - 1;
  const c = t.put(0, 0, 1, 'Cykyran War Counselor'); c.turnPlayed = t.gs.turn - 1;
  t.gs.currentPhase = 2; t.resetActions(0);
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  const r = await t.activateCreature(0, 0, 0);
  R.check('Aufbau: Gegner-Held 0 betäubt (Zug ' + t.gs.turn + ')', r === true && !!t.hero(1, 0).statuses.stunned, { r, st: t.hero(1, 0).statuses });
  const zeilen = [];
  for (let i = 0; i < 4; i++) {
    const vor = t.hp(1, 0);
    await t.run(() => t.engine.actionDealDamage(src, t.hero(1, 0), 10, 'creature'));
    const z = { turn: t.gs.turn, aktiv: t.gs.activePlayer, betaeubt: !!t.hero(1, 0).statuses.stunned, schaden: vor - t.hp(1, 0) };
    zeilen.push(z);
    R.check(`Zug ${z.turn}: Schaden ist 0, solange der Held noch von Gorinthian betäubt ist`, !z.betaeubt || z.schaden === 0, z);
    await t.endTurn();
  }
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
