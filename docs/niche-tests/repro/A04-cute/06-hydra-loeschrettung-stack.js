'use strict';
// A04-cute-06 · Cute Hydra wird auf dem Coolness Stack gelöscht, ohne dass die Löschrettung angeboten wird
//
// Kartentext (Cute Hydra): "If this Creature would be deleted from anywhere while you control a Hero that can summon it and have at
//   least 3 cards in your hand, you may immediately summon this deleted Creature as an additional Action."
// Erwartung: Löschen der Hydra aus dem Coolness Stack (Stack-Spitze löschen wie Bifab/String of Fine/Ragnarock/Wowhalla-Schutz,
//   oder ganzer Stack gelöscht wie Wowhalla-Abgang/Yolomungandr) öffnet die Rettung („Summon!") wie bei jedem anderen Löschweg.
// Beobachtet: Gegenprobe (Hydra im Deck, deleteFromPile) → Rettung greift. Auf dem Stack: kein Prompt, Hydra im Gelöscht-Stapel.
// Ursache: cards/effects/_engine.js actionPopCoolnessStackTo (dest 'delete') und actionDeleteCoolnessStack schieben direkt in
//   `ps.deletedPile`; `_tryBeforeDelete` (die EINE Rettungsstelle) wird nur von den anderen Löschwegen gerufen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function neu(deck) {
    const t = await H.fresh({ hand: [[H.INERT.filler, H.INERT.filler, H.INERT.filler, H.INERT.filler], []], deck: [deck, []] });
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    t.grantFor(0, 0, 'Cute Hydra');
    return t;
  }
  const mk = (t, names) => { const ps = t.gs.players[0]; for (const n of names) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); } };
  let t = await neu([H.INERT.creature, H.INERT.creature]);
  mk(t, ['Cute Bunny', 'Cute Hydra']);
  await t.run(() => t.engine.actionPopCoolnessStackTo(0, 'delete', { source: 'Test' }));
  R.check('A) Stack-Spitze gelöscht: Hydra gerettet (auf dem Brett)', !!t.find('Cute Hydra', 'support'), { geloescht: t.pile(0, 'deletedPile').slice(), prompts: t.prompts.length });
  t = await neu([H.INERT.creature, H.INERT.creature]);
  mk(t, ['Cute Hydra', 'Cute Bunny']);
  await t.run(() => t.engine.actionDeleteCoolnessStack(0, { source: 'Test' }));
  R.check('B) ganzer Stack gelöscht: Hydra gerettet', !!t.find('Cute Hydra', 'support'), { geloescht: t.pile(0, 'deletedPile').slice(), prompts: t.prompts.length });
  t = await neu(['Cute Hydra', H.INERT.creature]);
  await t.run(() => t.engine.deleteFromPile(0, 'deck', 'Cute Hydra', { source: 'Test' }));
  R.check('Gegenprobe: Hydra aus dem DECK gelöscht → gerettet', !!t.find('Cute Hydra', 'support'), { geloescht: t.pile(0, 'deletedPile').slice() });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
