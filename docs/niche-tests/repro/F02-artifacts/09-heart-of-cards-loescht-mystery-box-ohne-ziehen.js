'use strict';
// F02-09 · Heart of Cards löscht eine Mystery Box aus dem Deck, ohne dass Mystery Box zieht
// Kartentext Mystery Box: „The first time every turn a "Mystery Box" is sent to the discard pile or deleted from your deck, draw 2 cards."
// Kartentext Heart of Cards: „Declare a card name and reveal the top card of your deck. If it is the declared card, add it to your hand and draw 2 cards. Otherwise, delete the revealed card. …"
// Aufbau: Sitz 0: Hand [Heart of Cards], Deck [Mystery Box, Attack, ZZ Dummy ×3]; Ansage „Fireball" (Fehlschlag).
// Schritte: 1. Heart of Cards über den echten Weg spielen, Ansage „Fireball". 2. Die oberste Karte (Mystery Box) wird gelöscht.
// Erwartet: Mystery Box wurde aus dem Deck GELÖSCHT → Sitz 0 zieht 2 Karten. (Gegenprobe: Magic Emerald mill auf ein Mystery-Box-Deck löst das Ziehen aus ✓.)
// Beobachtet: keine Handkarte hinzugekommen. `heart-of-cards.js` löscht per `takeFromPile(…)` + `ps.deletedPile.push(oben)` + `_trackCard(…,'deleted')`; der `onMill`-Hook (`mystery-box.js hooks.onMill`) wird nie gerufen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // Gegenprobe: Mill durch den Gegner
  let t = await H.fresh({ hand: [['ZZ Filler'], ['Magic Emerald']], gold: [100, 100], deck: [['Mystery Box', 'Attack', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], ['ZZ Dummy']] });
  t.gs.activePlayer = 1;
  const h0 = t.pile(0, 'hand').length;
  await t.play(1, 'Magic Emerald');
  R.check('Gegenprobe: Mill einer Mystery Box → Besitzer zieht 2', t.pile(0, 'hand').length === h0 + 2, t.pile(0, 'hand'));

  // Befund
  t = await H.fresh({ hand: [['Heart of Cards'], []], deck: [['Mystery Box', 'Attack', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], []] });
  t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: 'Fireball' }) });
  const r = await t.play(0, 'Heart of Cards');
  R.check('Heart of Cards gespielt', r === true, r);
  R.check('Mystery Box liegt gelöscht', t.pile(0, 'deletedPile').includes('Mystery Box'), t.pile(0, 'deletedPile'));
  R.check('Mystery Box löst aus: 2 Karten gezogen', t.pile(0, 'hand').length === 2, { hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
