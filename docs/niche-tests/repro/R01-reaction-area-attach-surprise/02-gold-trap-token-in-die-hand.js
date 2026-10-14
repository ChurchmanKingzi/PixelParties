'use strict';
// R01-02 · Gold Trap legt einen Token („Mummy Token") als Karte in die Hand
// Kartentext: „… Then, you may choose any Creature on the board and add it to your hand."
// Engine-Konvention (README §4 Familie 4, A05-12/A05-02): Tokens kommen nie in Hand/Deck/Ablage.
// Aufbau: Sitz 0 hat verdeckt Gold Trap; Sitz 1 hat einen „Mummy Token" auf dem Brett.
// Schritte: 1. Sitz 1 gewinnt per Effekt 30 Gold (`actionGainGold`) → Gold Trap löst aus. 2. Im Kreaturen-Prompt den Mummy Token wählen.
// Erwartet: Token wird nicht angeboten bzw. verschwindet; die Hand von Sitz 0 enthält keine Token-Karte.
// Beobachtet: Token wird angeboten, „Mummy Token" liegt danach als normale Karte in der Hand von Sitz 0.
// Ursache: gold-trap.js Z. ~99 sammelt alle `getCreatureTargets` ohne Token-Filter; `_bounceCreatureToHand` ruft `actionAddCardToHand(trapperIdx, cardName)`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ gold: [100, 100] });
  t.putSurprise(0, 0, 'Gold Trap'); t.grantFor(0, 0, 'Gold Trap');
  t.put(1, 0, 0, 'Mummy Token');
  t.gs.activePlayer = 1;
  t.targetFn = (valid) => { const v = valid.find(x => x.cardName === 'Mummy Token'); return v ? [v.id] : undefined; };
  await t.run(() => t.engine.actionGainGold(1, 30));
  R.check('Gold Trap hat ausgelöst (Gold umgeleitet: Sitz 0 hat 130)', t.gs.players[0].gold === 130, t.gs.players[0].gold);
  R.check('Mummy Token wird nicht als Karte in die Hand gelegt', !t.pile(0, 'hand').includes('Mummy Token'), t.pile(0, 'hand'));
  R.check('W5a (Al 14.10.2026): Token verschwindet vollständig – auch nicht im Gelöscht-Stapel', [0, 1].every(s => ['hand', 'mainDeck', 'discardPile', 'deletedPile'].every(k => !t.pile(s, k).includes('Mummy Token'))), [0, 1].map(s => t.pile(s, 'deletedPile')));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
