'use strict';
// A05-skeletons-06 · Bomblebee Cluster: darf die zweite Bomblebee denselben Namen tragen wie die auslösende? (Regelfrage)
// Kartentext: „Summon up to 2 "Bomblebee" Creatures with different names from your hand with the same Hero as additional Actions."
// Lesart 1 (Skript): die zwei Beschworenen müssen auch anders heißen als die auslösende Bomblebee (usedNames enthält die auslösende).
// Lesart 2 (Wortlaut): „different names" gilt nur zwischen den bis zu 2 Beschworenen; eine zweite „Bomblebee" neben der auslösenden wäre erlaubt.
// Aufbau: Hand Bomblebee ×2, Cluster, Dive Bomblebee; Held 0 Summoning Magic 2.
// Beobachtet: Galerie bietet nur „Dive Bomblebee"; die zweite „Bomblebee" bleibt in der Hand.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Bomblebee', 'Bomblebee', 'Bomblebee Cluster', 'Dive Bomblebee'], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic'], [], []]);
  let angeboten = null;
  t.script.push({ match: d => d.type === 'confirm' && /Bomblebee Cluster/.test(d.title || ''), answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'cardGallery' && /Bomblebee Cluster/.test(d.title || ''), answer: (d) => { angeboten = angeboten || d.cards.map(c => c.name); return { cardName: d.cards[0].name }; } });
  await t.play(0, 'Bomblebee', { hero: 0, noGrant: true });
  R.note('erste Galerie', angeboten);
  R.check('Wortlaut-Lesart: auch die zweite „Bomblebee" (gleicher Name wie die auslösende) wird angeboten', Array.isArray(angeboten) && angeboten.includes('Bomblebee'), angeboten);
  R.finish();
})();
