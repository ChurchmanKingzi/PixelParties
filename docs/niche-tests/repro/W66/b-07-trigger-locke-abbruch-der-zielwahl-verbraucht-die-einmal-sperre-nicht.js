'use strict';
// W66b-07 · Auslöser mit „you may"-Zielwahl: ein Abbruch verbraucht die Einmal-Sperre nicht (Locke, the Unseen Saboteur; Al, 23.10.2026)
//
// Locke: „At the start of your turn, you may choose a target your opponent controls — its effects are negated until the beginning of your next turn." (Once per turn.)
// Vorher: `claimHOPT('locke-sabotage')` stand VOR der abbrechbaren Zielwahl — Abbruch ließ die Einmal-Sperre gestempelt (Fund der statischen Suche „Stempel vor abbrechbarer Frage").
// Jetzt: nachsehen vor der Frage, stempeln erst nach der bestätigten Zielwahl; wurde der Effekt in der Zielwahl NEGIERT/abgeblockt (Reaktion/Schutz), ist er für die Runde verbraucht (wie Alice, W35a).
// Beide Sitze. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const LOCKE = 'Locke, the Unseen Saboteur';
const hopt = (t, seat) => (t.gs.hoptUsed || {})[`locke-sabotage:${seat}`] === t.gs.turn;
(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    const label = `[S${seat}] ${LOCKE}`;
    R.section(label);
    const mk = async () => W.reicheSzene({ seat });
    const prepFn = async (t) => { t.setHero(seat, 0, LOCKE, 800); t.gs.activePlayer = seat; };
    const callFn = (t) => t.engine.runHooks('onTurnStart', { turn: t.gs.turn, activePlayer: seat });
    const antwort = (e) => (e.kind === 'target') ? ((e.valid || []).filter(q => !q.ineligible && q.owner === 1 - seat).slice(0, 1).map(q => q.id)) : undefined;
    const d = await W.durchlauf(mk, seat, LOCKE, { seat, hero: 0, maxCancel: 4, prepFn, callFn, answer: antwort, undoneFn: (t) => !hopt(t, seat), aktivierung: true });
    R.check(`${label}: Durchlauf — Zielwahl bestätigt: der Gegner ist negiert, Einmal-Sperre gestempelt`, hopt(d.clean.t, seat) && d.clean.t.errors.length === 0, { hopt: d.clean.t.gs.hoptUsed, err: d.clean.t.errors });
    R.check(`${label}: mindestens eine echte Abbruchstelle (die Zielwahl)`, d.cancels.some(x => x.r.undone), d.cancels.map(x => [x.k, x.r.undone, x.r.cancelled]));
    for (const { k, r, t } of d.cancels) {
      R.check(`${label}: Abbruch an Stelle ${k} — Einmal-Sperre FREI (nichts verbraucht)`, r.undone && !hopt(t, seat), { hopt: t.gs.hoptUsed });
      R.check(`${label}: Abbruch an Stelle ${k} — Zustandsdifferenz nach Abbruch = 0`, (r.zustandsDiff || []).length === 0, (r.zustandsDiff || []).slice(0, 6));
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
