'use strict';
// C05-creatures-08 · The Spawn Mother („alles"-Modus): bei gleichzeitigem Aus beider Seiten gewinnt immer Sitz 1 – egal, wer die Karte spielt
// Kartentext: „…deal 100 damage … to all targets on the board, except this Creature." (keine Gleichstand-Klausel)
// Erwartung (Frage an Al): Der Ausgang bei Gleichstand hängt nicht vom Sitz ab (z. B. der Wirker verliert immer, oder der Wirker gewinnt immer).
// Beobachtet: Sitz 0 beschwört -> Sitz 1 gewinnt (`draw_resolved`); Sitz 1 beschwört -> Sitz 1 gewinnt ebenfalls. Der Wirker verliert also nur als Sitz 0.
// Ursache: `_engine.js` ~48379: `const loserIdx = (isSeat(this, hint)) ? hint : 0;` – ohne `_drawLoserIdx` (nur Bunny Bombs/Armageddon … setzen es) verliert Sitz 0.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const winnerWhenCasterIs = {};
  for (const seat of [0, 1]) {
    const hands = [[], []]; hands[seat] = ['The Spawn Mother'];
    const t = await H.fresh({ hand: hands, hp: 100, active: seat });
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'all' }) });
    await t.play(seat, 'The Spawn Mother', { hero: 0 });
    winnerWhenCasterIs[seat] = t.engine.over && t.engine.over.winnerIdx;
    R.note('Wirker Sitz ' + seat, JSON.stringify(t.engine.over));
  }
  R.check('Ausgang unabhängig vom Sitz des Wirkers (Wirker gewinnt in beiden Fällen oder verliert in beiden)',
    (winnerWhenCasterIs[0] === 0) === (winnerWhenCasterIs[1] === 1), winnerWhenCasterIs);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
