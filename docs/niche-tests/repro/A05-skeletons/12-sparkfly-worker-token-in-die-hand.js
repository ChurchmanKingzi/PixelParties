'use strict';
// A05-skeletons-12 · Sparkfly Worker nimmt einen Token auf die Hand (Token dürfen nie als Karte in Hand/Ablage/Deck landen)
// Kartentext (Sparkfly Worker): „When you summon this Creature while you control a "Sparkfly Queen", you may choose a card on the board that is not a Hero
//   and add it to your hand."
// Engine-Konvention: Tokens (Mummy/Invader/Leprochaun/Pollution/Biomancy Token) verlassen das Brett nie in eine Kartenablage, sie werden gelöscht (CARD_API; `actionMoveCard`).
// Erwartung: Token wird nicht angeboten bzw. verschwindet; in der Hand liegt kein Token.
// Beobachtet: „Mummy Token" liegt danach als Handkarte in Hand 0.
// Ursache: `_sparkfly-shared.js` `collectNonHeroBoardTargets` lässt Tokens zu; `stealBoardCardToHand` ruft `handZugangSync(ps, cardName)` ohne Token-Sonderfall.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Sparkfly Worker'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const q = t.put(0, 0, 1, 'Sparkfly Queen'); q.turnPlayed = 1;
  t.put(1, 0, 0, 'Mummy Token');
  t.targetFn = (valid) => { const v = valid.find(x => x.cardName === 'Mummy Token'); return [v ? v.id : valid[0].id]; };
  await t.play(0, 'Sparkfly Worker', { hero: 0, slot: 0 });
  R.check('Kontrolle: Token ist vom Brett', !t.gs.players[1].supportZones[0][0].length, t.gs.players[1].supportZones[0]);
  R.check('kein Token als Karte in der Hand', !t.pile(0, 'hand').some(n => /Token/.test(n)), t.pile(0, 'hand'));
  R.finish();
})();
