'use strict';
// H04-07 · Sas'Za: eine eigene Token-Kreatur kann „back to your hand" geholt werden
//
// Kartentext: „You may add your Creatures that are defeated by an opponent's card or effect back to your hand instead of sending them to
//   the discard pile."
// Regel (CARD_API.md „Tokens"; README Familie 4): Tokens sind keine Karten – sie gehen nie in Ablage/Hand/Deck, sie werden gelöscht
//   (Engine: `_kreaturTodAbwickeln` schickt Tokens in den Gelöscht-Stapel).
// Beobachtet: `onCreatureDeathClaim` bietet auch einem Token (Mummy Token) die Rückholung an und „Mummy Token" liegt danach als
//   Handkarte in der Hand.
// Ursache: sas-za-the-snaka-adventurer.js `onCreatureDeathClaim` prüft nicht auf Tokens (`hasCardType(cd, 'Token')`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SZ = "Sas'Za, the Snaka Adventurer";
  const deck = Array(20).fill(H.INERT.creature);
  const t = await H.fresh({ heroes: [[SZ, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[], []], deck: [deck, deck] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  const tok = t.put(0, 1, 0, 'Mummy Token'); tok.turnPlayed = 1;
  let gefragt = false;
  t.script.push({ match: d => d.type === 'confirm' && d.title === SZ, answer: () => { gefragt = true; return { confirmed: true }; }, once: true });
  t.gs.activePlayer = 1;
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, controller: 1 }, tok, 999, 'spell', { sourceOwner: 1 }));
  R.check('Token wurde besiegt (Support Zone leer)', t.zone(0, 1, 0) === null, { zone: t.zone(0, 1, 0) });
  R.check('Sas\'Za fragt NICHT nach der Rückholung eines Tokens', !gefragt, { gefragt });
  R.check('Kein Token auf der Hand', !t.pile(0, 'hand').includes('Mummy Token'), t.pile(0, 'hand'));
  R.check('Kein Token in der Ablage', !t.pile(0, 'discardPile').includes('Mummy Token'), t.pile(0, 'discardPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
