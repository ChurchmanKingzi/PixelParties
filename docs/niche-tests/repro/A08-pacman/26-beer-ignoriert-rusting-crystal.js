// A08-26 · Beer (Nachtrag zu A08-02): zahlt trotz Rusting Crystal den Grundpreis je Ziel
//
// Kartentexte: Beer: „Choose any number of targets you control and heal them from any number of status effects. This Artifact's Cost is multiplied by the number of targets chosen."
// Rusting Crystal: „While this card is in your hand, the Costs of all your other Artifacts are doubled."
// Aufbau: Sitz 0 mit 24 Gold; Held 0 und Held 1 brennen; Beer (Kosten 4) mit zwei Zielen, einmal ohne, einmal mit Rusting Crystal auf der Hand.
// Erwartung: ohne Kristall 2 × 4 = 8 Gold, mit Kristall 2 × 8 = 16 Gold.
// Beobachtet: Die Zielwahl zeigt mit Kristall 8 je Ziel (`dynamicCostPerTarget`), abgebucht werden aber nur 8 insgesamt (Grundpreis aus cards.json, `beer.js:98`; `manualGoldCost: true`).
// Aufruf: node docs/niche-tests/repro/A08-pacman/26-beer-ignoriert-rusting-crystal.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const bezahlt = {};
  for (const rust of [0, 1]) {
    const t = await H.fresh({ hand: [[], []], gold: [24, 100] });
    t.heroStatus(0, 0, 'burned'); t.heroStatus(0, 1, 'burned');
    if (rust) t.engine.handZugangSync(0, 'Rusting Crystal');
    t.targetFn = (v) => v.filter(x => x.type === 'hero').slice(0, 2).map(x => x.id);
    t.script.push({ match: d => d.type === 'statusSelect', answer: (d) => ({ selected: d.statuses.map(s => s.key || s.id || s), selectedStatuses: d.statuses.map(s => s.key || s.id || s) }) });
    await t.play(0, 'Beer', {});
    bezahlt[rust] = 24 - t.gs.players[0].gold;
    R.check(`Rusting ${rust}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.note('bezahlt (ohne / mit Kristall)', JSON.stringify(bezahlt));
  R.check('ohne Kristall: 8 Gold', bezahlt[0] === 8, bezahlt);
  R.check('mit Kristall: 16 Gold (doppelte Kosten)', bezahlt[1] === 16, bezahlt);
  R.finish();
})();
