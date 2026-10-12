'use strict';
// A07-02 · Niu-Bonus („this turn") überlebt den Zug-Überspringen durch Zhu und wirkt im NÄCHSTEN eigenen Zug
//
// Kartentexte:
//   Guardian Beast Niu: „You may once per turn delete up to 5 cards total from both discard piles to increase the
//     damage the next Attack one of your Heroes performs this turn by 50 for each card deleted this way."
//   Guardian Beast Zhu: „… to skip your opponent's next turn."
//
// Erwartung: Der Niu-Bonus gilt nur „this turn" (= Zug, in dem Niu benutzt wurde). Wer Niu und danach Zhu benutzt,
//   hat im folgenden eigenen Zug KEINEN Niu-Bonus mehr auf seinem Angriff.
// Beobachtet: `niu_enhanced` läuft mit `expiresAtTurn: gs.turn+1, expiresForPlayer: Gegner` ab (guardian-beast-niu.js:~130),
//   d. h. erst, wenn der GEGNER seinen Zug beginnt. Zhus Zug-Überspringen (`_engine.js` switchTurn ~Z. 23666) startet
//   den übersprungenen Zug nie mit `startTurn()` → die Ablauf-Prüfung läuft nicht, der Buff steht im nächsten eigenen
//   Zug noch und macht den ersten Angriff um 50 stärker.
const H = require('../../lib/h.js');
const F = H.INERT.filler;
const GB = ['Guardian Beast Gou', 'Guardian Beast Hou', 'Guardian Beast Hu'];

(async () => {
  const R = H.runner();
  const t = await H.fresh({ discard: [[...GB, ...Array(5).fill(F)], Array(9).fill(F)], deckSize: 30 });
  const niu = t.put(0, 0, 0, 'Guardian Beast Niu'); niu.turnPlayed = 1;
  const zhu = t.put(0, 0, 1, 'Guardian Beast Zhu'); zhu.turnPlayed = 1;
  // Niu: Held 0 wählen, 1 Karte aus der GEGNERISCHEN Ablage löschen (lässt dort 8 für Zhu)
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => {
    const i = d.cards.findIndex(c => c.pileSide === 'opp'); return { selectedIndices: [i], selectedCards: [d.cards[i].name] }; } });
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('Vorbedingung: Niu-Buff liegt (50)', t.hero(0, 0).buffs?.niu_enhanced?.totalDamage === 50);
  // Zhu: je 8 Karten
  for (let k = 0; k < 2; k++) t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => {
    const idx = d.cards.map((c, i) => i).slice(0, 8); return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
  t.phase(2);
  await t.activateCreature(0, 0, 1);
  R.check('Vorbedingung: Zhu hat den gegnerischen Zug markiert', t.gs.players[1]._skipNextTurn === true);
  await t.endTurn();
  R.check('Vorbedingung: wieder Sitz 0 am Zug (Zug 7)', t.gs.activePlayer === 0 && t.gs.turn === 7, [t.gs.activePlayer, t.gs.turn]);
  R.check('Niu-Buff ist im Folgezug abgelaufen', !t.hero(0, 0).buffs?.niu_enhanced, t.hero(0, 0).buffs?.niu_enhanced);

  // Wirkung: erster Angriff in Zug 7 (Basisschaden = ATK des Helden)
  const atk = t.hero(0, 0).atk;
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  const hp0 = t.hp(1, 0);
  await t.play(0, 'Attack', { hero: 0 });
  const dealt = hp0 - t.hp(1, 0);
  R.check('Angriff in Zug 7 ohne Niu-Bonus (Schaden = ATK)', dealt === atk, { dealt, atk });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
