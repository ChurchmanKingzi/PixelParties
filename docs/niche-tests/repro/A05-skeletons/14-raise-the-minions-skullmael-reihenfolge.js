'use strict';
// A05-skeletons-14 · Raise the Minions!: der Skullmael-Bonus hängt von der Wahlreihenfolge ab (Regelfrage)
// Kartentext (Raise the Minions!): „Choose up to 3 "Skeleton" Creatures from your discard pile and place them into free Support Zones of the user."
// Kartentext (Skeleton King Skullmael): „While you control this Creature that was summoned from the discard pile, "Skeleton" Creatures that are summoned from
//   the discard pile may use their active effects the turn they are summoned …"
// Aufbau: Ablage = Skeleton Archer + Skeleton King Skullmael; Raise the Minions! mit beiden.
// Lesart A (Skript): die Karten werden nacheinander gelegt; ein Skelett, das VOR Skullmael landet, bekommt den Bonus nicht.
// Lesart B: „place them" ist eine gleichzeitige Platzierung → Skullmael ist „kontrolliert", wenn die anderen ankommen; Reihenfolge darf keine Rolle spielen.
// Beobachtet: Archer>Skullmael → Archer ohne Eile; Skullmael>Archer → Archer mit Eile.
// ★ W10b (Al, Welle 10, Q31): Lesart A ist gewollt – ein Skelett bekommt den Bonus genau dann, wenn Skullmael beim Platzieren schon auf dem Feld ist.
//   Repro auf diese Regel umgestellt (Archer zuerst: keine Eile; Skullmael zuerst: Eile). Siehe W10/b-q31.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const ergebnis = {};
  for (const order of [['Skeleton Archer', 'Skeleton King Skullmael'], ['Skeleton King Skullmael', 'Skeleton Archer']]) {
    const t = await H.fresh({ hand: [['Raise the Minions!'], []], discard: [['Skeleton Archer', 'Skeleton King Skullmael'], []] });
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: order }) });
    await t.play(0, 'Raise the Minions!', { hero: 0 });
    const arch = t.engine.cardInstances.find(c => c.name === 'Skeleton Archer' && c.zone === 'support');
    ergebnis[order[0]] = !!(arch && arch.counters._hasHaste);
  }
  R.note('Eile des Archers je Wahlreihenfolge', ergebnis);
  R.check('Al (Q31): Archer bekommt den Bonus nur, wenn Skullmael schon auf dem Feld ist', ergebnis['Skeleton Archer'] === false && ergebnis['Skeleton King Skullmael'] === true, ergebnis);
  R.finish();
})();
