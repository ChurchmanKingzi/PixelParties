'use strict';
// C01-creatures-15 · Tuscan Artist: Candlestick Squire und Albrecht bieten ihren reinen Zieh-Effekt an und verbrauchen die Einmal-pro-Zug-Sperre, obwohl das Ziehen (2 oder 3 Karten) negiert wird
// Kartentext Tuscan Artist: „While you control this Creature, any effect that would allow your opponent to draw 2 or 3 cards is negated."
// Ruling 16.8. (Kopf von `_draw-block-shared.js`): „Ist der Zug der einzige Nutzen … dann ist die Karte bzw. der aktive Effekt GESPERRT und wird ausgegraut. Ein Effekt, der so nicht feuern kann, verbraucht auch sein Once-per-turn NICHT."
//   Die Karten dafür fragen `drawWouldBeBlocked(engine, pi, N)` in ihrem Gate (13 Skripte); Candlestick Squire und Albrecht gehören nicht dazu.
// Aufbau A: Sitz 0: Candlestick Squire (alt), Sitz 1: Tuscan Artist; N = 2 (bzw. 3) Brennende auf dem Brett; Main Phase 1; Squire aktivieren.
// Aufbau B: Sitz 0: Albrecht (alt) auf dem Brett, ein Double Spell der Stufe 2 („Chaorc Interception") kommt auf die Hand; Sitz 1: Tuscan Artist; Albrecht bestätigt.
// Erwartung: A: Aktivierung wird abgelehnt (`false`), keine Sperre gestempelt. B: kein Angebot „Reveal … to draw 2", keine Sperre `albrecht-draw:<id>`, die Karte wird nicht offengelegt.
// Beobachtet: A: Aktivierung gelingt, 0 Karten gezogen, `hoptUsed['creature-effect:<id>']` gestempelt. B: Angebot erscheint, nach Ja wird die Karte offengelegt, nichts gezogen, `albrecht-draw` gestempelt.
// Ursache: cards/effects/candlestick-squire.js `canActivateCreatureEffect` (nur Zahl der Brennenden); cards/effects/albrecht-the-nerd.js `aufDemBrett` (nur Level > 0 und Deck nicht leer).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const n of [2, 3]) {
    const t = await H.fresh({ hand: [[], []] });
    const gs = t.gs, e = t.engine, ps = gs.players[0];
    const sq = t.put(0, 0, 0, 'Candlestick Squire'); sq.turnPlayed = 1;
    t.put(1, 2, 0, 'Tuscan Artist').turnPlayed = 1;
    for (let i = 0; i < n; i++) await e.addHeroStatus(1, i, 'burned', { duration: 9, appliedBy: 0 });
    gs.currentPhase = 2;
    const h0 = ps.hand.length;
    const r = await t.activateCreature(0, 0, 0);
    const gestempelt = !!(gs.hoptUsed && gs.hoptUsed['creature-effect:' + sq.id]);
    R.note(`A) Squire, ${n} Brennende`, { r, gezogen: ps.hand.length - h0, gestempelt });
    R.check(`A) Squire mit ${n} Brennenden unter Tuscan Artist: gesperrt (false) und nicht gestempelt`, r === false && !gestempelt, { r, gestempelt });
  }
  {
    const t = await H.fresh({ hand: [['Chaorc Interception'], []] });
    const gs = t.gs, e = t.engine, ps = gs.players[0];
    const al = t.put(0, 0, 0, 'Albrecht, the Nerd'); al.turnPlayed = 1;
    t.put(1, 2, 0, 'Tuscan Artist').turnPlayed = 1;
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Albrecht, the Nerd', answer: () => ({ confirmed: true }) });
    await t.run(() => e.runHooks('onCardAddedToHand', { playerIdx: 0, addedCardName: 'Chaorc Interception' }));
    const angebot = t.prompts.some(p => p.d.title === 'Albrecht, the Nerd');
    const gestempelt = !!(gs.hoptUsed && gs.hoptUsed['albrecht-draw:' + al.id]);
    R.note('B) Albrecht, Double Spell Lv2', { angebot, gestempelt });
    R.check('B) Albrecht bietet das (negierte) Ziehen von 2 Karten nicht an / stempelt nichts', !angebot && !gestempelt, { angebot, gestempelt });
  }
  R.finish();
})();
