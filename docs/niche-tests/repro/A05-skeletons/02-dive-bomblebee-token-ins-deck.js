'use strict';
// A05-skeletons-02 · Dive Bomblebee legt einen TOKEN unten ins Gegner-Deck
// Kartentext (Dive Bomblebee): „Once per turn, when a target your opponent controls is defeated, choose a card on your opponent's
//   side of the board that is not a Hero and place it at the bottom of your opponent's deck."
// Regel (Engine-Konvention, CARD_API „Tokens kommen nie in Ablage/Deck", actionMoveCard: Token → Gelöscht): Tokens verlassen das Brett
//   nie in eine Kartenablage; sie verschwinden.
// Erwartung: Wählt man einen Token (Mummy Token), verschwindet er (oder die Wahl wird gar nicht angeboten) – im Deck liegt kein Token.
// Beobachtet: „Mummy Token" steht unten im Deck des Gegners (eine Karte, die es als Deck-Karte nicht geben darf).
// Ursache: dive-bomblebee.js `runOpponentDeathPayload` → `ops.mainDeck.push(cardName)` ohne Token-Prüfung; `pickableOppCards` bietet Tokens an.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const dive = t.put(0, 0, 0, 'Dive Bomblebee'); dive.turnPlayed = 1;
  const opfer = t.put(1, 2, 2, H.INERT.frail);
  t.put(1, 0, 0, 'Mummy Token');
  t.targetFn = (valid) => { const v = valid.find(x => x.cardName === 'Mummy Token'); return v ? [v.id] : [valid[0].id]; };
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, opfer));
  R.check('Token wurde als Ziel gewählt/entfernt (Kontrolle: Effekt lief)', !t.gs.players[1].supportZones[0][0].length, t.gs.players[1].supportZones[0]);
  R.check('kein Token im Deck des Gegners', !t.pile(1, 'mainDeck').some(n => /Token/.test(n)), t.pile(1, 'mainDeck').slice(-2));
  R.finish();
})();
