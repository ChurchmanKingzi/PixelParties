'use strict';
// A05-skeletons-05 · Bomblebee Cluster beschwört Bomblebees über der Summoning-Magic-Stufe des Helden
// Kartentext (Bomblebee Cluster): „Play this card immediately when you summon a "Bomblebee" Creature. Summon up to 2 "Bomblebee" Creatures
//   with different names from your hand with the same Hero as additional Actions. You cannot summon Creatures for the rest of the turn afterwards."
// Regel-Vorbild: „as an additional Action" erlässt nur die Aktion, nicht die Stufe (vgl. _spider-shared.js makeSurpriseCostSummon: „waives the
//   ACTION cost, NOT the Lv1 Summoning Magic level requirement"; Brain/Box Spider verlangen weiter die Schulstufe).
// Aufbau: Held 0 (Tushu) Summoning Magic 1; Held 1 Summoning Magic 2 (damit der Cluster-Zauber Lv2 überhaupt spielbar ist).
//   Hand: Bomblebee, Bomblebee Cluster, Carpet Bomblebee (Lv 2), Dive Bomblebee.
// Erwartung: Carpet Bomblebee (Lv2) wird nicht angeboten/beschworen, weil Held 0 nur Summoning Magic 1 hat.
// Beobachtet: Carpet Bomblebee steht danach in Held 0 Slot 1.
// Ursache: bomblebee-cluster.js `bomblebeeNamesInHand` filtert nur nach Namen, `summonCreatureWithHooks` prüft die Schulstufe nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Bomblebee', 'Bomblebee Cluster', 'Carpet Bomblebee', 'Dive Bomblebee'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  t.setAbilities(0, 1, [['Summoning Magic', 'Summoning Magic'], [], []]);
  t.script.push({ match: d => d.type === 'confirm' && /Bomblebee Cluster/.test(d.title || ''), answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'cardGallery' && /Bomblebee Cluster/.test(d.title || ''), answer: (d) => ({ cardName: d.cards.map(c => c.name).includes('Carpet Bomblebee') ? 'Carpet Bomblebee' : d.cards[0].name }) });
  await t.play(0, 'Bomblebee', { hero: 0, noGrant: true });
  const reihe = t.gs.players[0].supportZones[0].map(z => z[0] || null);
  R.check('Kontrolle: Cluster hat gewirkt (mind. eine zweite Bomblebee steht)', reihe.filter(Boolean).length >= 2, reihe);
  R.check('Carpet Bomblebee (Lv 2) steht NICHT bei einem Helden mit Summoning Magic 1', !reihe.includes('Carpet Bomblebee'), reihe);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
