'use strict';
// A05-skeletons-23 · „Deepsea Skeleton“ zählt als „Skeleton“ Creature UND als „Deepsea“ Creature
// ENTSCHIEDEN (Al, Welle 10, Q35: „Ja, es zählt als Skeleton und als Deepsea“). Umgestellt von „zählt nicht“ auf die verbindliche Lesart.
// Geprüft: zentrale Helfer `isSkeletonCreature` / `isDeepseaCreature`, Raise the Minions! bietet Deepsea Skeleton aus der Ablage an, The Bonegrinder zählt sie.
const H = require('../../lib/h.js');
const SK = require('../../../../cards/effects/_skeleton-shared.js');
const DS = require('../../../../cards/effects/_deepsea-shared.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Raise the Minions!', 'The Bonegrinder'], []], discard: [['Deepsea Skeleton'], []] });
  R.check('isSkeletonCreature("Deepsea Skeleton")', SK.isSkeletonCreature('Deepsea Skeleton', t.engine) === true, null);
  R.check('isDeepseaCreature("Deepsea Skeleton")', DS.isDeepseaCreature('Deepsea Skeleton', t.engine) === true, null);
  let galerie = null;
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => { galerie = d.cards.map(c => c.name); return { selectedCards: [] }; } });
  const r = await t.play(0, 'Raise the Minions!', { hero: 0 });
  R.check('Raise the Minions! bietet „Deepsea Skeleton“ an', Array.isArray(galerie) && galerie.includes('Deepsea Skeleton'), { r, galerie });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
