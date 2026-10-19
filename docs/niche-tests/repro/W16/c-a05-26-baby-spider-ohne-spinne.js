'use strict';
// W16c · A05-26 (Gegenprobe): Ohne irgendeine ANDERE Spinne auf dem Brett zählt die Baby-Spider-Beschwörung weiter als normale Aktion
// (Main Phase 2: nicht beschwörbar); mit zwei Baby Spiders pro Zug nur die erste als Zusatzaktion (Hand-Kap „1 pro Zug").
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  let t = await H.fresh({ hand: [['Baby Spider'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  t.gs.activePlayer = 0; t.phase(4);
  let r = await t.play(0, 'Baby Spider', { hero: 0, slot: 0, phase: 4 });
  R.check('Main Phase 2 ohne andere Spinne: Baby Spider nicht beschwörbar', r === false, { r });
  t = await H.fresh({ hand: [['Baby Spider', 'Baby Spider'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  t.put(0, 0, 2, 'Cute Spider').turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(4);
  r = await t.play(0, 'Baby Spider', { hero: 0, slot: 0, phase: 4 });
  R.check('erste Baby Spider: Zusatzaktion (mit Cute Spider)', r === true, { r });
  const r2 = await t.play(0, 'Baby Spider', { hero: 0, slot: 1, phase: 4 });
  R.check('zweite Baby Spider in Main Phase 2: nicht als Zusatzaktion (nur 1 pro Zug)', r2 === false, { r2 });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
