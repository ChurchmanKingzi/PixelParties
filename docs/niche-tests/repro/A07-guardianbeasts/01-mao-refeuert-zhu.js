'use strict';
// A07-01 · Mao feuert Guardian Beast Zhu im Beschwörungszug und ohne Beachtung von „once per game"
//
// Kartentexte (data/cards.json):
//   Mao, the Vengeful Guardian: „You may once per turn choose a "Guardian Beast" Creature you control that was
//     summoned this turn. Delete 5 cards total from both discard piles to immediately activate that Creature's
//     active effect. Negate that Creature's effects until the beginning of your next turn afterwards."
//   Guardian Beast Zhu: „… You can never activate this effect the turn you summon this Creature. You can only
//     activate this effect once per game."
//
// Erwartung: Zhus Sperren („never … the turn you summon", „once per game") gelten auch, wenn Mao die Aktivierung
//   anstößt – Zhu sollte im Beschwörungszug NICHT feuern (und eine zweite Zhu nach verbrauchtem Spiel-Limit auch nicht).
// Beobachtet: Mao ruft `script.onCreatureEffect` direkt (mao-the-vengeful-guardian.js:162) und prüft weder
//   `canActivateCreatureEffect` noch Zhus Marke; die Sperren stehen nur in Zhus `canActivateCreatureEffect`
//   (guardian-beast-zhu.js:58-68), nicht in `onCreatureEffect`. Folge: Gegner überspringt den Zug.
const H = require('../../lib/h.js');
const F = H.INERT.filler;
const GB = ['Guardian Beast Gou', 'Guardian Beast Hou', 'Guardian Beast Hu'];

async function szene(zhuUsedBefore) {
  const t = await H.fresh({
    heroes: [['Mao, the Vengeful Guardian', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null],
    discard: [[...GB, ...Array(10).fill(F)], Array(8).fill(F)],
  });
  if (zhuUsedBefore) t.gs._guardianBeastZhuUsed = { 0: true };   // Zhu wurde in dieser Partie schon benutzt
  const zhu = t.put(0, 0, 0, 'Guardian Beast Zhu');              // frisch beschworen: turnPlayed = aktueller Zug
  t.gs.activePlayer = 0; t.phase(2);
  t.targetFn = (valid) => [valid.find(v => v.cardName === 'Guardian Beast Zhu').id];
  // Mao-Kosten: 5 Füllkarten aus der eigenen Ablage
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => {
    const idx = []; d.cards.forEach((c, i) => { if (idx.length < 5 && c.name === F) idx.push(i); });
    return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
  // Zhu-Kosten: je 8 (die ersten) aus eigener und gegnerischer Ablage
  for (let k = 0; k < 2; k++) t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => {
    const idx = d.cards.map((c, i) => i).slice(0, 8); return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
  return t;
}

(async () => {
  const R = H.runner();
  R.section('Teil 1: Zhu im Beschwörungszug');
  let t = await szene(false);
  const direkt = await t.activateCreature(0, 0, 0);
  R.check('Kontrolle: Zhu direkt im Beschwörungszug nicht aktivierbar', direkt === false, direkt);
  await t.activateHero(0, 0, {});
  R.check('Zhu feuert über Mao NICHT im Beschwörungszug (Gegner überspringt keinen Zug)', !t.gs.players[1]._skipNextTurn, { skip: t.gs.players[1]._skipNextTurn });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  R.section('Teil 2: Spiel-Limit „once per game" bereits verbraucht');
  t = await szene(true);
  await t.activateHero(0, 0, {});
  R.check('zweite Zhu feuert über Mao NICHT, obwohl once-per-game verbraucht', !t.gs.players[1]._skipNextTurn, { skip: t.gs.players[1]._skipNextTurn });
  R.finish();
})();
