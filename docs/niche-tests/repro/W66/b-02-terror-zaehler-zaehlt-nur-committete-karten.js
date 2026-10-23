'use strict';
// W66b-02 · Der Terror-Zähler („unique resolved effects") zählt nur COMMITTETE Karten — ein Abbruch zählt nicht (Al, 23.10.2026: „Limits/Zähler erst NACH dem Commit")
//
// Fund des Zustands-Differenz-Sweeps (W66/b-08): `server.js` rief `_trackTerrorResolvedEffect` am ANFANG des Spielwegs (Kreatur: vor Opfer-/Tribut-Wahl; Ziel-Artefakte/-Tränke wie Treasure Hunter's
// Backpack, Blood-Soaked Coin, The Yeeting, The Eye of Ren: vor der Artefakt-/Zonenwahl) — ein Abbruch ließ den Eintrag stehen und konnte Terror („nach 5/6/7 verschiedenen Effekten endet der Zug")
// auslösen, obwohl die Karte nie gespielt wurde. Jetzt: `engine.beiCommit(...)` — der Eintrag wartet im Auftritts-Vormerk-Eintrag und läuft beim Commit; ein Abbruch verwirft ihn.
// Beide Sitze. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const KARTEN = ['Archer of Teocuilatl', 'Warrior of Teocuilatl', 'Blue-Ice Dragon', "Treasure Hunter's Backpack", 'Blood-Soaked Coin', 'The Yeeting', 'The Eye of Ren', 'Foresta, the Guard'];
const FAKE = ['Terror-Test A', 'Terror-Test B', 'Terror-Test C', 'Terror-Test D'];
(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    for (const name of KARTEN) {
      const label = `[S${seat}] ${name}`;
      const mk = async () => {
        const t = await W.reicheSzene({ seat, karten: [name] });
        t.setAbilities(seat, 0, [['Terror', 'Terror', 'Terror'], [], []]);            // Terror Lv3: Schwelle 5
        t.gs._terrorTracking = { 0: [], 1: [] }; t.gs._terrorTracking[seat] = FAKE.slice();   // 4 verschiedene Effekte sind schon aufgelöst
        return t;
      };
      const d = await W.durchlauf(mk, seat, name, { seat, hero: 0, maxCancel: 4 });
      const c = d.clean;
      R.check(`${label}: Durchlauf — die Karte ist committed und zählt (5 Einträge) → Terror beendet den Zug`, c.t.logs.some(l => l.type === 'terror_triggered'), { tr: c.t.gs._terrorTracking[seat], logs: c.t.logs.filter(l => /terror/.test(l.type)).map(l => l.type) });   // (Terror beendet den Zug und räumt den Zähler ab — das Log ist der verlässliche Beleg)
      R.check(`${label}: mindestens eine echte Abbruchstelle`, d.cancels.some(x => x.r.undone), d.cancels.map(x => [x.k, x.r.undone]));
      for (const { k, r, t } of d.cancels) {
        if (!r.undone) continue;
        const tr = t.gs._terrorTracking[seat] || [];
        R.check(`${label}: Abbruch an Stelle ${k} — Terror-Zähler unverändert (4), Terror nicht ausgelöst`, tr.length === 4 && !tr.includes(name) && t.gs._terrorForceEndTurn == null && !t.logs.some(l => l.type === 'terror_triggered'), { tr, force: t.gs._terrorForceEndTurn });
        R.check(`${label}: Abbruch an Stelle ${k} — Zustandsdifferenz = 0`, (r.zustandsDiff || []).length === 0, (r.zustandsDiff || []).slice(0, 6));
      }
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
