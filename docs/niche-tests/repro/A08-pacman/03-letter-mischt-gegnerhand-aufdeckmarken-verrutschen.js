// A08-03 · Letter of Misinformations mischt die Gegnerhand an Ort und Stelle – die Aufdeck-Marken (nach Index) bleiben stehen
//
// Kartentext (Letter of Misinformations): „When this card is added from your hand to your opponent's, you may look at your opponent's hand and
//   choose up to 2 cards from it, except "Letter of Misinformations". Add those cards to your hand. You can only activate this effect once per turn."
//   → der Text nennt KEIN Mischen der Gegnerhand.
// Kartentext (Weakening Crystal / Grinning Cat u. a.): „When you draw or add this card to your hand, you must immediately reveal it."
//
// Erwartung: Offen liegen bleiben genau die selbstaufdeckenden Karten (hier Weakening Crystal und Grinning Cat), egal wo sie in der Hand stehen.
// Beobachtet: Das Skript mischt `ops.hand` per Fisher-Yates an Ort und Stelle (`letter-of-misinformations.js:205-210`), ohne den Spleiß-Wächter
//   zu benutzen. `_permanentlyRevealedHandIndices` (Index-Karte) wandert nicht mit: danach gelten andere Karten als aufgedeckt (der Gegner sieht
//   z. B. „ZZ Dummy"/die Letter offen), während der echte Kristall verdeckt wirkt.
// Aufruf: node docs/niche-tests/repro/A08-pacman/03-letter-mischt-gegnerhand-aufdeckmarken-verrutschen.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler, D = H.INERT.creature, T = H.INERT.artifact;
  let verrutscht = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const t = await H.fresh({ seed, hand: [[], []], deck: [[F, F, F, F, F], [F, F, F, F, F]] });
    const g = t.put(0, 0, 0, 'Chatty Town Guard'); g.turnPlayed = 1;
    t.engine.handZugangSync(1, 'Weakening Crystal');
    for (const n of [D, T, 'Grinning Cat', F]) t.engine.handZugangSync(1, n);
    t.engine.handZugangSync(0, 'Letter of Misinformations');
    // Chatty Town Guard schenkt die Letter; Sitz 0 nimmt per Letter-Trigger zwei Nicht-Kristall-Karten.
    t.script.push({ match: d => d.type === 'pickHandCard', once: true, answer: () => ({ cardName: 'Letter of Misinformations', handIndex: t.pile(0, 'hand').indexOf('Letter of Misinformations') }) });
    t.script.push({ match: d => d.type === 'pickFromOppHand', answer: (d) => { const i = d.eligibleIndices.find(k => [F, T].includes(t.pile(1, 'hand')[k])); return i == null ? null : { handIndex: i, cardName: t.pile(1, 'hand')[i] }; } });
    t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 0, 0);
    const hand = t.pile(1, 'hand');
    const flags = Object.keys(t.gs.players[1]._permanentlyRevealedHandIndices || {}).map(k => hand[+k]);
    const soll = hand.filter(n => n === 'Weakening Crystal' || n === 'Grinning Cat');
    const ok = flags.length === soll.length && soll.every(n => flags.includes(n));
    if (!ok) verrutscht++;
    R.check(`Seed ${seed}: offen liegen genau die selbstaufdeckenden Karten`, ok, { hand, alsAufgedecktGefuehrt: flags });
    R.check(`Seed ${seed}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
