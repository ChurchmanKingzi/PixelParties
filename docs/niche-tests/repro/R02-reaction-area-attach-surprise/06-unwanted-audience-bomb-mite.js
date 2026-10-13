'use strict';
// R02-06 · Unwanted Audience negiert Bomb Mite (rein passive Kreatur) und verzögert damit die Detonation
// Kartentexte: Unwanted Audience – „Creatures your opponent controls cannot activate their active effects this turn."
//              Bomb Mite – „When you control this Creature at the end of your next turn after summoning it, send it to the discard pile and deal 100 damage to all Heroes your opponent controls. …" (kein aktiver Effekt)
// Aufbau: Sitz 0 hat Bomb Mite (turnPlayed 3) auf dem Brett; Sitz 1 hat Unwanted Audience auf der Hand. Sitz 1 beendet Zug 5; zu Beginn von Zug 6 (Sitz 0) spielt Sitz 1 die Karte (Ja). Sitz 0 beendet Zug 6.
// Erwartet: Bomb Mite hat keinen aktiven Effekt → unberührt → sie detoniert am Ende von Zug 6 (100 Schaden auf alle Helden von Sitz 1, Mite in der Ablage). Kontrolle ohne UA ✓.
// Beobachtet: Bomb Mite wird negiert (`counters.negated`), detoniert nicht, bleibt auf dem Brett (Sitz 1 behält 800 HP).
// Ursache: `bomb-mite.js` exportiert `creatureEffect: true`, obwohl sie weder `onCreatureEffect` noch `canActivateCreatureEffect` hat; `unwanted-audience.js creatureHasActiveEffect()` prüft nur `script.creatureEffect`.
//   Hinzu kommt grundsätzlich: die Negation (`actionNegateCreature`) schaltet ALLE Effekte der Kreatur ab, nicht nur den aktiven (hier wird das erst sichtbar, weil die Mite nur passive Effekte hat).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const mitUA of [false, true]) {
    const t = await H.fresh({ hand: [[], mitUA ? ['Unwanted Audience'] : []], hp: 800 });
    const mite = t.put(0, 0, 0, 'Bomb Mite'); mite.turnPlayed = 3;
    t.grantFor(1, 0, 'Unwanted Audience');
    t.gs.activePlayer = 1; t.gs.turn = 5; t.policy.confirm = true;
    await t.endTurn();
    if (mitUA) R.check('Unwanted Audience wurde gespielt', t.prompts.some(p => p.d.title === 'Unwanted Audience'));
    await t.endTurn();
    const hp1 = t.gs.players[1].heroes.map(h => h.hp);
    R.check(`${mitUA ? 'mit' : 'ohne'} UA: Bomb Mite detoniert am Ende von Zug 6 (Ablage, 100 Schaden auf alle Helden von Sitz 1)`, mite.zone === 'discard' && hp1.every(h => h === 700), { zone: mite.zone, hp1, negated: !!mite.counters.negated });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
