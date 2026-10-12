'use strict';
// A06-rebelliokai-16 · Kitsune Transformation: der Zauber selbst zählt als eine der abzuwerfenden Karten
// Kartentext: „… Then, discard the same number of cards." (N Karten aus der HAND; die gespielte Karte liegt nicht mehr in der Hand.)
// Beobachtung: kitsune-transformation.js ruft `engine.actionPromptForceDiscard(pi, N, { selfInflicted: true, … })` ohne `eligibleIndices`.
//   Die aufgelöste Karte steht bis zum Ende der Auflösung noch in `ps.hand` und ist wählbar. Wählt der Spieler sie, fließt sie in die
//   Ablage (einmal) und zählt als eine der N Karten – effektiv werden nur N-1 andere Karten abgeworfen.
//   Vorbild für die korrekte Form: Wheels / `_hand-resolve.js eligibleIndicesWithoutResolving` (Befund 28.8.).
// Erwartung: die Wahl enthält den Zauber nicht; es werden N Karten außer dem Zauber abgeworfen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const KIT = 'Rebelliokai Kind Kitsune', BAK = 'Rebelliokai Backup Bakus', TAN = 'Rebelliokai Timid Tanuki';
  const t = await H.fresh({ hand: [['Kitsune Transformation', 'Fireball', 'Fireball'], []], discard: [[KIT, BAK, TAN], []], deck: [['Loyal Beagle', 'Loyal Terrier', 'Loyal Pinpom', ...Array(10).fill(D)], []] });
  t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.cards.some(c => c.source === 'discard'), answer: () => ({ selectedCards: [KIT, BAK, TAN] }) });
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: d.cards.slice(0, d.selectCount).map(c => c.name) }) });
  const angebote = [];
  t.script.push({ match: d => d.type === 'forceDiscard', answer: (d) => {
    const hand = t.pile(0, 'hand').slice();
    angebote.push({ elig: d.eligibleIndices || 'alle', hand });
    // „Mensch" wirft immer die Karte an Position 0 ab (beim ersten Mal der Zauber selbst)
    return { cardName: hand[0], handIndex: 0 };
  } });
  const r = await t.play(0, 'Kitsune Transformation', { hero: 0 });
  const nDiscardedFromHand = t.lg('forced_discard').length;
  R.note('Ergebnis', { r, angebote: angebote.map(a => a.hand), hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile') });
  R.check('Die aufgelöste Karte (Kitsune Transformation) ist beim Abwurf nicht wählbar', angebote.length > 0 && angebote[0].elig !== 'alle' && !angebote[0].elig.includes(angebote[0].hand.indexOf('Kitsune Transformation')), angebote[0]);
  const fremdeAbgeworfen = t.lg('forced_discard').filter(l => l.card !== 'Kitsune Transformation').length;
  R.check('3 andere Karten abgeworfen (N = 3 zurückgemischte Kreaturen)', fremdeAbgeworfen === 3, { fremdeAbgeworfen, alle: t.lg('forced_discard').map(l => l.card) });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
