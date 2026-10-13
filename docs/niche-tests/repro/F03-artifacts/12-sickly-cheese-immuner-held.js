'use strict';
// F03-artifacts-12 · Sickly Cheese: Kosten „inflict 1 Stack of Poison" – bei giftimmunem Helden wird nicht gezahlt, die Suche läuft trotzdem (Stufe C, Regelfrage)
// Kartentext: „Choose a Hero you control and inflict 1 Stack of Poison to it to play this card. Choose a Decay Magic Spell from your deck, reveal it and add it to your hand."
// Aufbau: Sitz 0, Held 1 trägt den Buff `negative_status_immune` (Engine blockt negative Status, `_engine.js` ~44864); Deck mit Accusation (Decay-Spell); Cheese gespielt, Held 1 gewählt.
// Lesart A (Kosten): ohne gezahlte Kosten keine Wirkung – Held 1 ist als Ziel nicht wählbar bzw. die Karte bleibt auf der Hand.
// Lesart B (Skript heute): Gift wird blockiert (Log `status_blocked`), aber die Karte gilt als gespielt und tutort die Karte (Gold gezahlt, Karte verbraucht).
// Beobachtet: Lesart B.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Sickly Cheese'], []], deck: [['Accusation', 'Bird', 'Bird']], gold: 100 });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Sickly Cheese', answer: () => ({ cardName: 'Accusation', source: 'deck' }), once: false });
  t.hero(0, 1).buffs = { negative_status_immune: { source: 'Test' } };
  t.targetFn = (valid) => { const v = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1); return v ? [v.id] : undefined; };
  const r = await t.play(0, 'Sickly Cheese');
  R.note('Ergebnis', { r, poisoned: !!t.hero(0, 1).statuses.poisoned, hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile'), gold: t.gs.players[0].gold, logs: t.logs.map(l => l.type) });
  R.check('Kosten nicht gezahlt (Held 1 nicht vergiftet) ⇒ keine Suche', !!t.hero(0, 1).statuses.poisoned || !t.pile(0, 'hand').includes('Accusation'), { poisoned: !!t.hero(0, 1).statuses.poisoned, hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
