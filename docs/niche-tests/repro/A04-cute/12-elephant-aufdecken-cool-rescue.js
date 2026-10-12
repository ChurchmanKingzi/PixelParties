'use strict';
// A04-cute-12 · Fun-Fun Circus Elephant wird per Cool Rescue (Coolness Stack → Hand) nicht dauerhaft aufgedeckt
//
// Kartentext (Elephant): "When you draw this card or add it to your hand, reveal it permanently. While this card is revealed in
//   your hand, put an Applause Counter onto it whenever …"; Cool Rescue: "Add the top card of your Coolness Stack to your hand."
// Erwartung: Der Elephant wird beim Hinzufügen zur Hand aufgedeckt – egal auf welchem Weg (Ziehen ✓, Bifab-Suche ✓, Cool Rescue ?).
// Beobachtet: Ziehen und Bifab-Suche decken auf; Cool Rescue (`actionPopCoolnessStackTo(…,'hand')`) legt die Karte per
//   `ps.hand.push` auf die Hand, ohne die Auto-Aufdeck-Stelle (`_autoRevealOnEnterHand`) zu rufen. Der Gegner sieht den Elephant
//   nie; gleichzeitig zählt er in der Hand trotzdem Applause mit (`collectsApplauseInHand` prüft die Aufdeckung nicht).
// Ursache: cards/effects/_engine.js actionPopCoolnessStackTo (dest === 'hand') – Hand-Zugang ohne `handZugang`/Reveal-Hook.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const EL = 'Fun-Fun Circus Elephant';
  const rev = (t) => { const i = t.pile(0, 'hand').indexOf(EL); return i >= 0 && !!(t.gs.players[0]._permanentlyRevealedHandIndices || {})[i]; };
  let t = await H.fresh({ deck: [[EL, H.INERT.creature], []] });
  await t.run(() => t.engine.actionDrawCards(0, 1));
  R.check('Gegenprobe Ziehen: aufgedeckt', rev(t), t.pile(0, 'hand'));
  t = await H.fresh({ deck: [[H.INERT.creature], []], hand: [['Cool Rescue'], []] });
  t.putArea(0, 'Wowhalla, the Hall of the Cool');
  const ps = t.gs.players[0]; ps.coolnessStack.push(EL); t.engine._trackCard(EL, 0, 'coolnessStack');
  const r = await t.play(0, 'Cool Rescue', { hero: 0 });
  R.check('Cool Rescue gespielt, Elephant auf der Hand', r === true && ps.hand.includes(EL), { r, hand: ps.hand.slice() });
  R.check('Elephant ist dauerhaft aufgedeckt', rev(t), JSON.stringify(ps._permanentlyRevealedHandIndices));
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
