'use strict';
// A05-skeletons-22 · Skeleton Necromancer: Abwerfen als Kosten VOR der Wahl? (Regelfrage)
// Kartentext: „You may once per turn discard a card to choose a "Skeleton" Creature, except "Skeleton Necromancer", from your discard pile and place it into the
//   free Support Zone of any Hero you control."
// Lesart A (Skript): Die Wahl der Kreatur und der Zielzone passiert VOR dem Abwerfen; aktivierbar nur, wenn schon ein Skelett im Ablagestapel liegt.
// Lesart B (Wortlaut „discard a card TO choose …"): Abwerfen ist die Kosten-Voraussetzung, danach wird gewählt – also darf ein soeben abgeworfenes Skelett gewählt werden
//   und die Fähigkeit wäre auch bei leerem Skelett-Ablagestapel nutzbar (Skelett aus der Hand direkt aufs Brett).
// Beobachtet: Hand [Skeleton Archer], Ablage leer von Skeletten → Necromancer ist nicht aktivierbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Skeleton Archer'], []], discard: [[], []] });
  const n = t.put(0, 0, 0, 'Skeleton Necromancer'); n.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  const r = await t.activateCreature(0, 0, 0);
  R.note('Aktivierung', { r, brett: t.gs.players[0].supportZones[0].map(z => z[0] || '-'), hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  R.check('Lesart B: Necromancer wirft das Skelett ab und legt es sofort auf das Brett', t.gs.players[0].supportZones[0].some(z => z[0] === 'Skeleton Archer'), t.gs.players[0].supportZones[0]);
  R.finish();
})();
