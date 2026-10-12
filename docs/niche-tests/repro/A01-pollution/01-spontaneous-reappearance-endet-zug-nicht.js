'use strict';
// A01-pollution-01 · Spontaneous Reappearance beendet den Zug nicht
// Kartentext (data/cards.json): „Choose any number of cards from your discard pile and add them to your hand. Place half that many
//   Pollution Tokens into your free Support Zones (rounded up). This counts as an additional Action. Immediately end your turn afterwards.“
// Erwartung: nach dem Auflösen ist der Zug zu Ende – so wie bei Great Offensive / Tanuki Escape / Open Invitation (`gs._spellEndsTurn = true`,
//   von doPlaySpell nach der Auflösung gelesen). cards/effects/tuscan-prisoner.js (Ruling 16.8.) nennt Spontaneous Reappearance ausdrücklich
//   unter den Karten, die den Zug beenden.
// Beobachtet: das Skript setzt keine Zugende-Flagge; der Zug läuft normal weiter (Sitz 0 bleibt am Zug, Phase 3). Der Kopfkommentar
//   in spontaneous-reappearance.js behauptet „No auto-end-turn“ – das widerspricht dem Kartentext.
// Aufruf: node docs/niche-tests/repro/A01-pollution/01-spontaneous-reappearance-endet-zug-nicht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // Kontrolle: ein Zauber, der laut Text den Zug beendet, tut es in dieser Harness auch (Great Offensive).
  let t = await H.fresh({ hand: [['Great Offensive'], []] });
  t.put(0, 0, 0, 'Pollution Piranha');
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1).id];
  const turn0 = t.gs.turn;
  await t.play(0, 'Great Offensive', { hero: 0 });
  R.check('Kontrolle: Great Offensive beendet den Zug', t.gs.activePlayer === 1 && t.gs.turn === turn0 + 1, { aktiv: t.gs.activePlayer, turn: t.gs.turn });

  t = await H.fresh({ hand: [['Spontaneous Reappearance'], []], discard: [['Fireball', 'Heal', 'Fireball'], []] });
  const turn = t.gs.turn;
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: d.cards.map(c => c.name), selectedIndices: d.cards.map((c, i) => i) }) });
  const r = await t.play(0, 'Spontaneous Reappearance', { hero: 0 });
  R.check('Karte gespielt, 3 Karten zurück auf die Hand, 2 Tokens', r === true && t.pile(0, 'hand').length === 3 && t.inst(c => c.name === 'Pollution Token').length === 2, t.pile(0, 'hand'));
  R.check('Zug ist beendet (Sitz 1 am Zug, Zugnummer +1)', t.gs.activePlayer === 1 && t.gs.turn === turn + 1, { aktiv: t.gs.activePlayer, turn: t.gs.turn, phase: t.gs.currentPhase });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
