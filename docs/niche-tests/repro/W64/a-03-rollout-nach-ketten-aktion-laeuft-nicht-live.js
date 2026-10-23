'use strict';
// W64-a-03 · Eine Nach-Ketten-Aktion aus einem CPU-Rollout darf im echten Spiel nie laufen
// Bugreport (Aufnahme demo-champion-the-stormbringer 23.10., Spiel gegen Klaus): ab dem Zug, in dem der Spieler Gate to the Armory auf der Hand hatte,
// endeten ALLE seine Züge von selbst (Zug 5 direkt nach Pillage, Züge 7/9/11 gleich in MAIN1).
// Ursache: Die CPU spielt in ihren MCTS-Rollouts auch den Zug des Menschen nach (Horizont 1-4, `_cpuPlayerIdx` wird auf den aktiven Spieler gedreht).
// Spielt der simulierte Mensch Gate to the Armory (Zugende-Klausel), reiht die Karte eine Closure `advanceToPhase(pi, 5)` in `engine._postChainActions` ein.
// Diese Warteschlange steckt nicht im Schnappschuss, `restore()` ließ die Closure also stehen; die nächste Leerung im LIVE-Spiel
// (`.finally` jedes Spielerzugs, auch nach Pillage oder einer abgelehnten Aktion) beendete dann den echten Zug.
// Erwartung: nach `restore()` ist die Warteschlange wieder auf dem Stand des Schnappschusses, und Pillage lässt den Zug offen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({
    heroes: [['Jean, the Pillaging Knight', 'Champion, the Stormbringer', 'Codumbus, the Clueless Voyager'],
             ['Tharx, the Never-Losing General', 'Klaus, the Cult Leader', 'Ingo, Investor of Evil']],
    hp: 400, turn: 5, phase: 4, active: 0, gold: 20,
    deck: [Array(20).fill('ZZ Dummy').concat(['Treasure Chest']), Array(30).fill('ZZ Dummy')],
    hand: [['Gate to the Armory'], []],
  });
  t.setAbilities(0, 0, [[], ['Pillage', 'Pillage', 'Pillage'], []]);
  t.setAbilities(0, 1, [['Magic Arts'], [], []]);
  t.gs.players[0].heroesActedThisTurn = [1]; t.gs.players[0]._actionsPlayedThisPhase = 1;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Gate to the Armory', answer: () => ({ cardName: 'Treasure Chest', source: 'deck' }) });

  // ── Rollout: Schnappschuss, simulierter Mensch spielt Gate, Zurückspulen ──
  const snap = t.engine.snapshot();
  t.engine._inMctsSim = true;
  await t.play(0, 'Gate to the Armory', { hero: 1, phase: 4 });
  R.check('Im Rollout wurde die Zugende-Closure eingereiht', t.engine._postChainActions.length === 1, t.engine._postChainActions.length);
  t.engine.restore(snap);
  t.engine._inMctsSim = false;
  R.check('Nach restore() ist die Warteschlange wieder leer', t.engine._postChainActions.length === 0, t.engine._postChainActions.length);

  // ── Live: der Mensch aktiviert Pillage; danach leert der Handler die Warteschlange (wie `.finally` in server.js) ──
  t.gs.currentPhase = 2; t.gs.players[0].heroesActedThisTurn = [];
  await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 1 }));
  await t.run(() => t.engine._runPostChainActions());
  R.check('Pillage + Leeren der Warteschlange beendet den Zug nicht', t.gs.activePlayer === 0 && t.gs.currentPhase !== 5, `aktiv=${t.gs.activePlayer} phase=${t.gs.currentPhase}`);

  // ── Zweite Absicherung: eine im Rollout eingereihte Closure läuft live auch OHNE restore() nicht ──
  const t2 = await H.fresh({
    heroes: [['Jean, the Pillaging Knight', 'Champion, the Stormbringer', 'Codumbus, the Clueless Voyager'],
             ['Tharx, the Never-Losing General', 'Klaus, the Cult Leader', 'Ingo, Investor of Evil']],
    hp: 400, turn: 5, phase: 2, active: 0,
  });
  let gelaufen = false;
  t2.engine._inMctsSim = true;
  t2.engine.queuePostChainAction(async () => { gelaufen = true; await t2.engine.advanceToPhase(0, 5); });
  t2.engine._inMctsSim = false;
  await t2.run(() => t2.engine._runPostChainActions());
  R.check('Rollout-Closure wird live nicht ausgeführt', !gelaufen && t2.gs.activePlayer === 0, `gelaufen=${gelaufen} aktiv=${t2.gs.activePlayer}`);
  R.finish();
})();
