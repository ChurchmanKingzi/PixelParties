'use strict';
// W75 · Darion (Audit P3a) — Deepsea Treasure legt aufgedeckte Equips in den Stapel (kein zweiter Platz), auch ohne freie Zone.
// Kartentext Deepsea Treasure: „Reveal the top 3 cards of your deck. You may play any Artifacts you find there immediately without paying their Cost. Add all other revealed cards to your hand."
// Erwartet: Darion hat Club / Blade im Stapel in Zone 1, Zone 0 und 2 sind belegt. Die oberste Deckkarte ist Cute Crown, die zweite Hat of Madness: beide landen NACHEINANDER im Stapel (4 Karten, ein Platz),
//   nie ausserhalb; es gibt keine Zonenwahl mit mehreren Plaetzen.
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-03-deepsea-treasure-ausruesten-in-den-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, K = H.INERT.creature;
(async () => {
  const R = H.runner();
  R.section('Deepsea Treasure: zwei Equips aus den obersten 3 Karten, Zonen 0 und 2 belegt');
  const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Deepsea Treasure', F], [F]], gold: 500, deck: [['Cute Crown', 'Hat of Madness', F, ...Array(10).fill(F)], Array(15).fill(F)] });
  const ps = t.gs.players[0];
  ps.supportZones[0][1] = [];
  for (const n of ['Club of Gobbo', 'Blade of the Frostbringer']) { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 0, 'support', 0, 1); i.turnPlayed = 1; }
  t.put(0, 0, 0, K); t.put(0, 0, 2, K);
  const zonenAngebote = [];
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { zonenAngebote.push(d.zones.map(z => `${z.heroIdx}:${z.slotIdx}`)); return { heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }; } });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Deepsea Treasure', answer: (d) => ({ cardName: d.cards[0].name, source: 'hand' }) });
  t.policy.confirm = true;
  await t.play(0, 'Deepsea Treasure', { hero: 0 });
  await t.drain();
  R.note('lauf', JSON.stringify({ zonen: ps.supportZones[0], hand: t.pile(0, 'hand'), zonenAngebote, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
  const z = ps.supportZones[0][1];
  R.check('beide Equips liegen im Stapel (Zone 1)', ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown', 'Hat of Madness'].every(n => z.includes(n)) && z.length === 4, ps.supportZones[0]);
  R.check('Zonen 0 und 2 unveraendert (nur die Kreaturen)', ps.supportZones[0][0].join() === K && ps.supportZones[0][2].join() === K, ps.supportZones[0]);
  R.check('Zonenwahl bot nur den Stapelplatz an', zonenAngebote.every(a => a.length === 1 && a[0] === '0:1'), zonenAngebote);
  R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
