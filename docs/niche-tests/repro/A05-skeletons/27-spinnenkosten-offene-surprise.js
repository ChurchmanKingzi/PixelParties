'use strict';
// A05-skeletons-27 · Spinnen-Kosten „send N Surprises you control": zählt eine OFFEN liegende Surprise (Spider Silk Bridge) mit? (Regelfrage)
// Kartentext (Box Spider): „You may send 3 Surprises you control to the discard pile to summon this Creature as an additional Action." (ebenso Brain 1, Diamond 2, Crimson Skull 3)
// Spider Silk Bridge bleibt nach der Aktivierung offen in der Surprise Zone des Nutzers liegen („remains face-up in the user's Surprise Zone"). Sie ist weiter eine Surprise, die man kontrolliert.
// ENTSCHIEDEN (Al, Welle 10, Q36: „ja, generell jede offene Surprise zählt“): Lesart B – jede Surprise in den eigenen Surprise Zones, auch die offene Silk Bridge.
// (Umgestellt: vorher Lesart A, nur verdeckte, `_spider-shared.js listOwnFaceDownSurprises`.)
// Aufbau: Hand [Box Spider]; eine offene Spider Silk Bridge + zwei verdeckte Booby Traps; Main Phase.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Box Spider'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const ssb = t.putSurprise(0, 0, 'Spider Silk Bridge'); ssb.faceDown = false;
  t.putSurprise(0, 1, 'Booby Trap'); t.putSurprise(0, 2, 'Booby Trap');
  t.script.push({ match: d => d.type === 'pickSurprise', answer: (d) => ({ selectedSurprises: d.surprises.slice(0, 3).map(s => ({ instId: s.instId, owner: s.owner, heroIdx: s.heroIdx })) }) });
  t.gs.activePlayer = 0; t.phase(2);
  const r = await t.play(0, 'Box Spider', { hero: 0, slot: 0, phase: 2 });
  R.check('Lesart B: Box Spider ist mit offener Silk Bridge + 2 verdeckten Surprises beschwörbar', r === true && t.gs.players[0].supportZones[0][0][0] === 'Box Spider', { r });
  R.check('Silk Bridge liegt in der Ablage', t.pile(0, 'discardPile').includes('Spider Silk Bridge'), t.pile(0, 'discardPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
