'use strict';
// Keine Erneuerung von Betäubung/Frost (Held): ein laufender Stun/Frost wird nicht gegen einen frischen, längeren getauscht; `opts.renew` erlaubt es ausdrücklich.
//   node scripts/skilltest-e2e/status-renewal.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 4 });
  console.log = oL; console.error = oE;
  const { engine, gs } = out;
  const seat = 1, hi = gs.players[seat].heroes.findIndex(h => h && h.name && h.hp > 0);
  const hero = gs.players[seat].heroes[hi];
  const reset = () => { hero.statuses = {}; };

  console.log('Betäubung über addHeroStatus');
  reset();
  await engine.addHeroStatus(seat, hi, 'stunned', { duration: 1, appliedBy: 0 });
  check('Erster Stun landet (Dauer 1)', !!hero.statuses.stunned && hero.statuses.stunned.duration === 1, hero.statuses.stunned);
  await engine.addHeroStatus(seat, hi, 'stunned', { duration: 3, appliedBy: 2 });
  check('Zweiter Stun (Dauer 3) ersetzt den laufenden NICHT', hero.statuses.stunned.duration === 1, hero.statuses.stunned);
  await engine.addHeroStatus(seat, hi, 'stunned', { duration: 3, renew: true });
  check('Mit ausdrücklicher Erlaubnis (renew) wird erneuert', hero.statuses.stunned.duration === 3, hero.statuses.stunned);

  console.log('Frost über addHeroStatus');
  reset();
  await engine.addHeroStatus(seat, hi, 'frozen', { duration: 2 });
  await engine.addHeroStatus(seat, hi, 'frozen', { duration: 5 });
  check('Zweiter Frost ersetzt den laufenden NICHT', hero.statuses.frozen.duration === 2, hero.statuses.frozen);

  console.log('Über den allgemeinen Weg (actionAddStatus)');
  reset();
  await engine.actionAddStatus(hero, 'stunned', { duration: 1 });
  const again = await engine.actionAddStatus(hero, 'stunned', { duration: 4 });
  check('Auch hier keine Erneuerung (liefert false, Dauer bleibt)', again === false && hero.statuses.stunned.duration === 1, { again, st: hero.statuses.stunned });

  console.log('Andere Status bleiben unberührt');
  reset();
  await engine.addHeroStatus(seat, hi, 'stunned', { duration: 1 });
  await engine.addHeroStatus(seat, hi, 'burned', {});
  check('Ein anderer Status lässt sich neben dem Stun setzen', !!hero.statuses.burned && !!hero.statuses.stunned, Object.keys(hero.statuses));
  reset();
  await engine.addHeroStatus(seat, hi, 'poisoned', { stacks: 1 });
  await engine.addHeroStatus(seat, hi, 'poisoned', { addStacks: 1 });
  check('Gift stapelt weiter', hero.statuses.poisoned && hero.statuses.poisoned.stacks === 2, hero.statuses.poisoned);

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Status-Erneuerungs-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
