'use strict';
// W9a · Q13 (A02-deepsea-21) · Al, 15.10.2026: „Ja, das soll zählen“ – die Rückgabe vom Brett auf die Hand des GEGNERS per Effekt (Deepsea-Bounce, Shapeshift, Castle …)
//   gibt Analyzer und Gatherer einen Change Counter (ein Counter je Ereignis, nicht je Karte).
// Erwartet: (1) Gegner bounce-placet eine Deepsea-Kreatur → +1 für Analyzer und Gatherer. (2) Die EIGENE Rückgabe zählt nicht. (3) Ein Ereignis mit 2 Karten (Batch) → +1.
//   (4) Ein Token (verschwindet, landet nie auf der Hand) zählt nicht.
const H = require('../../lib/h.js');
const DS = require('../../../../cards/effects/_deepsea-shared.js');
(async () => {
  const R = H.runner();
  const AN = 'Analyzer from the Cosmic Depths', GA = 'Gatherer from the Cosmic Depths';
  // (1) + (2)
  {
    const t = await H.fresh({ hand: [[], []] });
    const a = t.put(0, 0, 0, AN); a.turnPlayed = 1;
    const g = t.put(0, 0, 1, GA); g.turnPlayed = 1;
    const s = t.put(1, 0, 0, 'Deepsea Skeleton'); s.turnPlayed = 1;
    t.setHand(1, ['Deepsea Zombie']);
    await t.play(1, 'Deepsea Zombie', { hero: 0, slot: 0 });
    R.check('(1) Gegner-Bounce: Analyzer +1', (a.counters.changeCounter || 0) === 1, a.counters.changeCounter || 0);
    R.check('(1) Gegner-Bounce: Gatherer +1', (g.counters.changeCounter || 0) === 1, g.counters.changeCounter || 0);
    // (2) eigene Rückgabe: Sitz 0 gibt eigene Kreatur zurück
    const own = t.put(0, 1, 0, 'Deepsea Skeleton'); own.turnPlayed = 1;
    await t.run(() => DS.returnSupportCreatureToHand(t.engine, own, 'Test'));
    R.check('(2) eigene Rückgabe zählt nicht', (a.counters.changeCounter || 0) === 1 && (g.counters.changeCounter || 0) === 1, [a.counters.changeCounter, g.counters.changeCounter]);
    R.check('(1/2) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (3) Batch + (4) Token
  {
    const t = await H.fresh({ hand: [[], []] });
    const a = t.put(0, 0, 0, AN); a.turnPlayed = 1;
    await t.run(() => DS.fireReturnBatchHook(t.engine, 1, ['Deepsea Skeleton', 'Deepsea Zombie'], [], 'Test-Batch'));
    R.check('(3) Ereignis mit 2 Karten: genau +1', (a.counters.changeCounter || 0) === 1, a.counters.changeCounter || 0);
    const tok = t.put(1, 0, 0, 'Invader Token');
    await t.run(() => DS.returnSupportCreatureToHand(t.engine, tok, 'Test-Token'));
    R.check('(4) Token zählt nicht', (a.counters.changeCounter || 0) === 1, a.counters.changeCounter || 0);
    R.check('(4) Token landet nicht auf der Hand', !t.pile(1, 'hand').includes('Invader Token'), t.pile(1, 'hand'));
    R.check('(3/4) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
