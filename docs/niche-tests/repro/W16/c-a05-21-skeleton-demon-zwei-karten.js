'use strict';
// W16c · A05-21 (Gegenprobe): Hat der Gegner genug Deck, zieht Skeleton Mage 2 Karten → Skeleton Demon macht 50 × 2 = 100 Schaden;
// bei genau 1 Karte im Deck nur 50.
const H = require('../../lib/h.js');
async function lauf(deck) {
  const t = await H.fresh({ hand: [[], ['ZZ Filler']], deck: [[], deck] });
  const d = t.put(0, 0, 0, 'Skeleton Demon'); d.turnPlayed = 1;
  const mage = t.put(1, 0, 0, 'Skeleton Mage'); mage.turnPlayed = 1;
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1).id];
  t.script.push({ match: x => x.type === 'forceDiscard' || x.type === 'forceDiscardCancellable', answer: () => ({ handIndex: 0 }) });
  const hp = t.hp(1, 0);
  t.gs.activePlayer = 1; t.phase(2);
  await t.activateCreature(1, 0, 0);
  return hp - t.hp(1, 0);
}
(async () => {
  const R = H.runner();
  R.check('Deck mit 5 Karten: 100 Schaden', (await lauf(Array(5).fill(H.INERT.creature))) === 100);
  R.check('Deck mit 1 Karte: 50 Schaden', (await lauf([H.INERT.creature])) === 50);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
