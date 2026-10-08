'use strict';
// Spielbeginn-Hooks im Skill Test (headless): Karten mit „At the start of the game"-Abfrage dürfen den Kampfstart nicht blockieren.
//   node scripts/skilltest-e2e/start-hooks.test.js
const Rules = require('../../public/skilltest-rules.js');
const { getCardDB } = require('../../cards/effects/_card-db');
const { runGame } = require('../../skilltest/sim');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };
const cards = getCardDB();
const env = { cards, areaLimitOf: () => undefined };

(async () => {
  console.log('Kassaran: keine Namensabfrage ohne Deck');
  const t0 = Date.now();
  const out = await runGame({
    seats: 3, setupOnly: true, seed: 12,        // fester Tisch: andere Helden mit Eröffnungs-Verzögerung (Vena 3,8 s) würden die Zeitmessung verfälschen
    mutatePrep: (prep) => {
      const ps = prep.players[0]; ps.ready = false;
      ps.hand.push('Kassaran, Seer of Everything');
      const r = Rules.applyMove(env, ps, { type: 'place', from: { kind: 'hand', idx: ps.hand.length - 1 }, to: { kind: 'hero', hi: 0 } });
      if (!r.ok) throw new Error(r.reason);
      prep.players[0] = Object.assign(r.ps, { ready: true });
    },
  });
  const ms = Date.now() - t0;
  const hero = out.gs.players[0].heroes.find(h => h && h.name === 'Kassaran, Seer of Everything');
  check('Kassaran steht im Spiel', !!hero);
  check('Keine Hook-Timeouts beim Kampfstart', !out.engine._hookTimeouts, out.engine._hookTimeoutsByCard);
  check('Kein offener Prompt (Spieler wird nicht nach Namen gefragt)', !out.engine._pendingPrompt && !out.engine._pendingGenericPrompt);
  check('Kampfstart ohne 5-s-Wartezeit', ms < 4500, ms);
  check('Keine Namen deklariert (es gibt kein Deck)', !hero || !hero._kassaranDeclared || hero._kassaranDeclared.length === 0, hero && hero._kassaranDeclared);
  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Start-Hook-Tests grün');
  process.exit(fails ? 1 : 0);
})();
