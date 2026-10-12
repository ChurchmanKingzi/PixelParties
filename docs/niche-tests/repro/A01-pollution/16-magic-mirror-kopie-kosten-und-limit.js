'use strict';
// A01-pollution-16 (Stufe C – Regelfrage) · Magic Mirror: die Kopie zahlt manche Kosten nicht und verbraucht das „1 pro Spiel“-Limit des Spiegel-Besitzers
// Kartentext Magic Mirror: „… the user immediately performs a copy of it as an additional Action, ignoring its level. Place a number of Pollution Tokens into your free
//   Support Zones equal to the negated Spell's level.“ (ignoriert wird nur das LEVEL.)
// Kartentexte: Eraser Beam „Place 3 Pollution Tokens into your free Support Zones to use this Spell. … You can only play 1 „Eraser Beam“ per game.“
//              Cold Coffin „Place 2 Pollution Tokens into your free Support Zones to use this Spell.“   Basketskull „Remove any number of Doom Counters … to play this card.“
// Beobachtet (Spiegel-Besitzer = Sitz 1, Angreifer = Sitz 0):
//   • Cold Coffin / Eraser Beam: die Kopie läuft ohne die Token-Kosten (die liegen im Hook `payActivationCost`, den die Kopie nie aufruft) – Sitz 1 legt nur die
//     Mirror-Tokens (Stufe des negierten Zaubers). Basketskull dagegen zahlt seine Kosten (Counter-Entfernung steht in `onPlay`) – die Kopien verhalten sich uneinheitlich.
//   • Die Kopie von Eraser Beam trägt das Limit „1 pro Spiel“ von Sitz 1 ein (`_oncePerGameUsed`) und sperrt weitere Zauber von Sitz 1 für den Zug (`_spellLockTurn`):
//     seine eigene Eraser Beam ist damit für den Rest des Spiels weg, obwohl er sie nie gespielt hat.
// Frage an Al: (1) Muss die Kopie die „… to use this Spell“-Kosten bezahlen (nur das Level wird ignoriert), oder ist der Mirror-Preis alles? (2) Soll die Kopie eines
//   „nur 1 pro Spiel/Zug“-Zaubers das eigene Limit des Spiegel-Besitzers verbrauchen?
// Aufruf: node docs/niche-tests/repro/A01-pollution/16-magic-mirror-kopie-kosten-und-limit.js   (✗ = Verhalten weicht von der wörtlichen Lesart ab)
const H = require('../../lib/h.js');
const tokens = (t, seat) => t.inst(c => c.name === 'Pollution Token' && c.owner === seat).length;
async function lauf(spell) {
  const t = await H.fresh({ hand: [[spell], []] });
  t.putSurprise(1, 0, 'Magic Mirror'); t.grantFor(1, 0, 'Magic Mirror');
  t.put(0, 0, 0, 'Soul Shard Ba');
  let n = 0;
  t.targetFn = (v) => { n++; return [v.find(x => x.type === 'hero' && x.owner === (n === 1 ? 1 : 0) && x.heroIdx === 0).id]; };
  t.policy.confirm = true;
  await t.play(0, spell, { hero: 0 });
  return t;
}
(async () => {
  const R = H.runner();
  let t = await lauf('Cold Coffin');          // Stufe 1: Mirror-Preis 1 Token; Kopie wörtlich + 2 Tokens
  R.check('Cold Coffin-Kopie zahlt ihre 2 Tokens zusätzlich zum Mirror-Preis (Sitz 1 hat 1 + 2 = 3 Tokens)', tokens(t, 1) === 3, tokens(t, 1));
  t = await lauf('Eraser Beam');              // Stufe 2: Mirror-Preis 2 Token; Kopie wörtlich + 3 Tokens
  R.check('Eraser Beam-Kopie zahlt ihre 3 Tokens zusätzlich zum Mirror-Preis (Sitz 1 hat 2 + 3 = 5 Tokens)', tokens(t, 1) === 5, tokens(t, 1));
  R.check('Eraser Beam-Kopie verbraucht NICHT das Limit „1 pro Spiel“ von Sitz 1', !(t.gs.players[1]._oncePerGameUsed && t.gs.players[1]._oncePerGameUsed.has('eraserBeam')), t.gs.players[1]._oncePerGameUsed && [...t.gs.players[1]._oncePerGameUsed]);
  R.finish();
})();
