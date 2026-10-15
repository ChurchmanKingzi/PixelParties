'use strict';
// A05-skeletons-22 · Skeleton Necromancer: das als Kosten abgeworfene Skelett ist NICHT sofort wieder wählbar
// Kartentext: „You may once per turn discard a card to choose a "Skeleton" Creature, except "Skeleton Necromancer", from your discard pile and place it into the
//   free Support Zone of any Hero you control."
// ENTSCHIEDEN (Al, Welle 10, Q34: „Nein“): Die Wahl (Galerie) passiert VOR dem Abwerfen aus dem VORHER schon liegenden Ablagestapel; das abgeworfene Skelett
//   ist nicht wählbar, und ohne Skelett im Ablagestapel ist der Necromancer nicht aktivierbar. (Umgestellt von „Lesart B“ auf die verbindliche Lesart A.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // (1) kein Skelett in der Ablage: nicht aktivierbar, das Handskelett wandert nicht aufs Brett
  let t = await H.fresh({ hand: [['Skeleton Archer'], []], discard: [[], []] });
  let n = t.put(0, 0, 0, 'Skeleton Necromancer'); n.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('(1) ohne Skelett in der Ablage: Handskelett landet NICHT auf dem Brett', !t.gs.players[0].supportZones[0].some(z => z[0] === 'Skeleton Archer'), t.gs.players[0].supportZones[0]);
  R.check('(1) Handskelett bleibt auf der Hand', t.pile(0, 'hand').includes('Skeleton Archer'), t.pile(0, 'hand'));
  // (2) ein Skelett in der Ablage: die Galerie bietet nur dieses an, nicht das abzuwerfende Handskelett
  t = await H.fresh({ hand: [['Skeleton Archer'], []], discard: [['Skeleton Bard'], []] });
  n = t.put(0, 0, 0, 'Skeleton Necromancer'); n.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  let angeboten = null;
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { angeboten = (d.cards || []).map(c => c.name); return { cardName: 'Skeleton Bard' }; } });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  const r2 = await t.activateCreature(0, 0, 0);
  R.note('(2) Aktivierung', { r2, prompts: t.prompts.map(p => p.d.type), hand: t.pile(0, 'hand'), errors: t.errors });
  R.check('(2) Galerie bietet nur das schon liegende Skelett an', Array.isArray(angeboten) && angeboten.length === 1 && angeboten[0] === 'Skeleton Bard', angeboten);
  R.check('(2) Handskelett wurde als Kosten abgeworfen und liegt in der Ablage (nicht auf dem Brett)', t.pile(0, 'discardPile').includes('Skeleton Archer') && !t.gs.players[0].supportZones[0].some(z => z[0] === 'Skeleton Archer'), { d: t.pile(0, 'discardPile'), b: t.gs.players[0].supportZones[0] });
  R.check('(2) keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
