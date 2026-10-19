'use strict';
// W17a · Slippery Snobbit (A02-05, Al 19.10.2026): „Ja" - Slippery Fridge zählt als „Slippery"-Karte.
//
// Kartentext (Slippery Snobbit): „… you may discard any number of cards and draw the same number of cards. If you discard at least 1 "Slippery" card, draw 1 additional card."
// Slippery Fridge trägt keinen Archetyp-Eintrag in cards.json, heißt aber „Slippery …" -> `isSlipperyAnyCard` (Name oder Archetyp). Gegenprobe: eine nicht-Slippery-Karte gibt keinen Bonus.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const SH = require('../../../../cards/effects/_slippery-shared.js');
(async () => {
  const R = H.runner();
  async function draws(disc) {
    const t = await H.fresh({ hand: [[disc], []], deck: [[H.INERT.creature, H.INERT.creature, H.INERT.creature, H.INERT.creature]] });
    const sn = t.put(0, 0, 0, 'Slippery Snobbit'); sn.turnPlayed = 1;
    let n = 0;
    t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => { n++; return n === 1 ? { cardName: disc, handIndex: 0 } : { cancelled: true }; } });
    await t.run(() => SH.moveSlipperyCreature(t.engine, 0, sn, 1, 0));
    return { gezogen: t.pile(0, 'hand').length, fehler: t.errors };
  }
  const fridge = await draws('Slippery Fridge');
  R.check('Abwurf Slippery Fridge zieht 2 (1 + Bonus)', fridge.gezogen === 2 && fridge.fehler.length === 0, fridge);
  const normal = await draws(H.INERT.filler);
  R.check('Gegenprobe: Abwurf einer nicht-Slippery-Karte zieht nur 1', normal.gezogen === 1 && normal.fehler.length === 0, normal);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
