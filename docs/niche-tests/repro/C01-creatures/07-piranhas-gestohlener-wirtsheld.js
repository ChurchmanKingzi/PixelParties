'use strict';
// C01-creatures-07 · 500 Piranhas: Schaden folgt dem Kontrolleur der Piranhas, nicht dem Kontrolleur des Helden (Wirtsheld gestohlen)
// Kartentext: „The corresponding Hero takes 80 damage at the end of each of its controller's turns."
// Aufbau: Piranhas normal gespielt (Wirtsheld = Gegner-Held 0), danach uebernehme ICH den Wirtsheld (actionStealHero(0, 1, 0)).
// Erwartung (Lesart A, „its" = der Held): der Held steht jetzt unter MEINER Kontrolle -> 80 Schaden am Ende MEINER Zuege (nicht am Ende der Gegnerzuege).
// Beobachtet: Der Schaden faellt weiter am Ende der Zuege des Gegners (Kontrolleur der Piranhas), obwohl der Held unter meiner Kontrolle steht.
// Ursache: cards/effects/500-piranhas-in-a-monster-suit.js `onTurnEnd`: `if (!ctx.isMyTurn) return;` – isMyTurn gilt fuer den Kontrolleur der Piranhas (Gegner).
// Stufe C: Lesart B („its" = die Kreatur; Kontrolleur der Piranhas = Gegner) ist grammatisch ebenfalls moeglich.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const P = '500 Piranhas in a Monster Suit';
  const t = await H.fresh({ hand: [[P], []] });
  const gs = t.gs;
  t.put(1, 0, 1, H.INERT.creature);
  t.targetFn = (valid) => [valid.find(x => x.cardName === H.INERT.creature).id];
  await t.play(0, P);
  t.engine.actionStealHero(0, 1, 0, {});
  const proZug = [];
  for (let i = 0; i < 4; i++) { const h0 = t.hp(1, 0); const wer = gs.activePlayer; await t.endTurn(); proZug.push({ zugVon: wer, schaden: h0 - t.hp(1, 0) }); }
  R.note('Schaden je beendetem Zug', proZug);
  const amEndeMeinerZuege = proZug.filter(z => z.zugVon === 0).reduce((s, z) => s + z.schaden, 0);
  R.check('der von mir kontrollierte Wirtsheld nimmt am Ende MEINER Zuege Schaden', amEndeMeinerZuege > 0, proZug);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
