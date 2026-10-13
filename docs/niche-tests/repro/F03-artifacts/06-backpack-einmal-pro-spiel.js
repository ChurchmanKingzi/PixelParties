'use strict';
// F03-artifacts-06 · Treasure Hunter's Backpack umgeht „You can only play 1 "Smug Coin" per game" (liest den Stempel nicht, setzt ihn nicht)
// Kartentexte: Backpack „Choose an equippable Artifact with a Cost of 50 or less from your deck and play it immediately without paying its Cost."
//              Smug Coin „You can only play 1 "Smug Coin" per game."
// Erwartung: Das Backpack SPIELT die Ausrüstung („play it immediately") – die Einmal-pro-Spiel-Grenze gilt also: (A) nach einer gespielten Smug Coin ist keine zweite wählbar,
//   (B) eine über das Backpack gespielte Smug Coin sperrt die Smug Coin auf der Hand.
// Beobachtet (✗): (A) die Galerie bietet Smug Coin trotz Stempel an und rüstet eine zweite aus; (B) die Backpack-Smug-Coin setzt keinen Stempel, die Handkarte wird danach ebenfalls gespielt.
// Ursache: `cards/effects/treasure-hunter-s-backpack.js` buildEligibleGallery (Z. ~35–60) prüft Kosten, Subtyp und Träger, aber weder `oncePerGame`/`_oncePerGameUsed` noch stempelt der Spielweg.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const B = "Treasure Hunter's Backpack";
  const gal = (t) => t.script.push({ match: d => d.type === 'cardGallery' && d.title === B, answer: (d) => { t._gal = d.cards.map(c => c.name); return { cardName: 'Smug Coin', source: 'deck' }; }, once: false });
  const reveal = (t) => t.script.push({ match: d => d.type === 'deckSearchReveal', answer: () => ({}), once: false });
  const coins = (t) => t.inst(c => c.name === 'Smug Coin' && c.zone === 'support').length;
  // A
  let t = await H.fresh({ hand: [['Smug Coin', B], []], deck: [['Smug Coin', 'Bird']], gold: 100 });
  await t.play(0, 'Smug Coin', { hero: 0, slot: 0 });
  R.check('A0 Stempel „Smug Coin" gesetzt', !!(t.gs.players[0]._oncePerGameUsed && t.gs.players[0]._oncePerGameUsed.has('Smug Coin')), t.gs.players[0]._oncePerGameUsed && [...t.gs.players[0]._oncePerGameUsed]);
  gal(t); reveal(t);
  await t.play(0, B);
  R.check('A1 Backpack bietet die gestempelte Smug Coin nicht an', !(t._gal || []).includes('Smug Coin'), t._gal);
  R.check('A2 nur 1 Smug Coin liegt auf dem Brett', coins(t) <= 1, coins(t));
  // B
  t = await H.fresh({ hand: [[B, 'Smug Coin'], []], deck: [['Smug Coin', 'Bird']], gold: 100 });
  gal(t); reveal(t);
  await t.play(0, B);
  R.check('B0 Backpack hat eine Smug Coin ausgerüstet', coins(t) === 1, coins(t));
  R.check('B1 Backpack-Smug-Coin hat den Einmal-pro-Spiel-Stempel gesetzt', !!(t.gs.players[0]._oncePerGameUsed && t.gs.players[0]._oncePerGameUsed.has('Smug Coin')), t.gs.players[0]._oncePerGameUsed && [...t.gs.players[0]._oncePerGameUsed]);
  const r2 = await t.play(0, 'Smug Coin', { hero: 1, slot: 0 });
  R.check('B2 zweite Smug Coin aus der Hand wird abgelehnt', r2 === false && coins(t) === 1, { r2, coins: coins(t) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
