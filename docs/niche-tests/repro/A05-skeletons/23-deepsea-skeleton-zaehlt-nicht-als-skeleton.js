'use strict';
// A05-skeletons-23 · „Deepsea Skeleton" ist kein „Skeleton" Creature im Sinne der Skeleton-Karten (Regelfrage)
// Kartentexte: Raise the Minions!/Skeleton Necromancer/Bonegrinder/Skullmael/Bard/Winged Skeleton sprechen von „Skeleton" Creatures. „Loyal Bone Dog" sagt zusätzlich ausdrücklich
//   „This Creature is also treated as a "Skeleton" Creature." (er heißt nicht so).
// Lesart A (Skript): „Skeleton" = Archetyp-Feld `Skeletons` (+ Bone Dog als Ausnahme in `_skeleton-shared.js:TREATED_AS_SKELETON`). „Deepsea Skeleton" hat `archetype: "Deepsea"` → zählt nicht.
// Lesart B (Namensregel wie bei anderen „…"-Karten): jede Kreatur mit „Skeleton" im Namen ist ein „Skeleton" Creature (zugleich „Deepsea").
// Beobachtet: Raise the Minions! bietet Deepsea Skeleton aus der Ablage nicht an; Bonegrinder senkt ihre Stufe nicht um Deepsea Skeleton in der Ablage.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Raise the Minions!', 'The Bonegrinder'], []], discard: [['Deepsea Skeleton'], []] });
  let galerie = null;
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => { galerie = d.cards.map(c => c.name); return { selectedCards: [] }; } });
  const r = await t.play(0, 'Raise the Minions!', { hero: 0 });
  R.note('Raise the Minions!', { r, galerie });
  R.check('Lesart B: Raise the Minions! bietet „Deepsea Skeleton" an (Spell überhaupt spielbar)', Array.isArray(galerie) && galerie.includes('Deepsea Skeleton'), { r, galerie });
  R.finish();
})();
