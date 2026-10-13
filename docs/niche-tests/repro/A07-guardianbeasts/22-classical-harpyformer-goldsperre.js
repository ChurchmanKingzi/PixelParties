'use strict';
// A07-22 · Classical Harpyformer prüft die Gold-Sperre (Tuscan Aristocrat) nicht – Wealth abgeworfen, kein Gold, Once-per-turn verbraucht
//
// Kartentext Classical Harpyformer: „You may once per turn discard a Wealth Ability from your hand to gain 5 Gold."
// Tuscan Aristocrat: „While you control this Creature, your opponent cannot gain any Gold outside their Resource Phase."
// Ruling `_gold-block-shared.js` (Al 17.8.): „eine Karte, deren einziger Nutzen ein Gold-Gewinn ist, wird gesperrt statt wirkungslos zu
//   feuern … Ein aktiver Effekt, der nur Gold bringt, ist nicht aktivierbar und verbraucht dann auch sein Once-per-turn NICHT."
//   Country Harpyformer (Schwesterkarte: „discard an Adventurousness Ability … to gain 6 Gold") setzt das um (`goldGainWouldBeBlocked`).
// Erwartung: Classical Harpyformer ist bei gegnerischem Tuscan Aristocrat nicht aktivierbar (Wealth bleibt auf der Hand).
// Beobachtet: Classical lässt sich aktivieren, Wealth wird abgeworfen, kein Gold, Once-per-turn gestempelt. Country (Gegenprobe) ist gesperrt.
// Vermutete Ursache: `classical-harpyformer.js canActivateCreatureEffect` ruft `goldGainWouldBeBlocked` (`_gold-block-shared.js`) nicht auf;
//   `country-harpyformer.js` tut es in der ersten Zeile.
const H = require('../../lib/h.js');

async function lauf(karte, faehigkeit) {
  const t = await H.fresh({ hand: [[faehigkeit], []], deckSize: 10, gold: 50 });
  const c = t.put(0, 0, 0, karte); c.turnPlayed = 1;
  t.put(1, 0, 0, 'Tuscan Aristocrat');
  t.script.push({ match: d => d && d.type === 'forceDiscardCancellable', answer: (d) => ({ handIndex: d.eligibleIndices[0], cardName: t.pile(0, 'hand')[d.eligibleIndices[0]] }) });
  t.gs.activePlayer = 0; t.phase(2);
  const r = await t.activateCreature(0, 0, 0);
  return { t, r };
}

(async () => {
  const R = H.runner();
  let x = await lauf('Country Harpyformer', 'Adventurousness');
  R.check('Gegenprobe: Country Harpyformer ist gesperrt (Adventurousness bleibt auf der Hand)', x.t.pile(0, 'hand').includes('Adventurousness'), { r: x.r, hand: x.t.pile(0, 'hand') });
  x = await lauf('Classical Harpyformer', 'Wealth');
  R.check('Classical Harpyformer ist gesperrt (Wealth bleibt auf der Hand, Once-per-turn nicht verbraucht)',
    x.t.pile(0, 'hand').includes('Wealth') && Object.keys(x.t.gs.hoptUsed || {}).length === 0,
    { r: x.r, hand: x.t.pile(0, 'hand'), gold: x.t.gs.players[0].gold, hopt: x.t.gs.hoptUsed });
  R.check('keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  R.finish();
})();
