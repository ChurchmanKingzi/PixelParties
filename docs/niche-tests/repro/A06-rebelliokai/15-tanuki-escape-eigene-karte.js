'use strict';
// A06-rebelliokai-15 · Tanuki Escape: die gerade aufgelöste Karte selbst ist als „Handkarte zum Zurückmischen" wählbar
// Kartentext: „Shuffle up to as many cards from your hand as you have "Rebelliokai" Creatures with different names in your discard pile
//   back into your deck (max 3). Then, search your deck for up to that many cards …" – die gespielte Karte liegt nicht mehr in der Hand.
// Beobachtung: Eine aufgelöste Karte bleibt bis zum Ende der Auflösung in `ps.hand` (aufgeschobene Entnahme, `_hand-resolve.js`). Das
//   handPick-Angebot in tanuki-escape.js enthält alle Slots (`engine.shuffleBackEligibleHandSlots` kennt `_resolvingCard` nicht); wer Tanuki Escape
//   selbst wählt, mischt den Zauber ins Deck (er landet nicht in der Ablage) und zählt ihn als eine der „Karten aus der Hand".
//   Die Bibliothek kennt das Problem („_hand-resolve.js eligibleIndicesWithoutResolving", Befund 28.8.: „ich darf die gerade benutzte … Karte
//   nochmal abwerfen"); Tanuki Escape benutzt es nicht.
// Erwartung: Index der aufgelösten Karte ist nicht wählbar; Tanuki Escape landet in der Ablage.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const KIT = 'Rebelliokai Kind Kitsune', TAN = 'Rebelliokai Timid Tanuki', BAK = 'Rebelliokai Backup Bakus';
  const t = await H.fresh({ hand: [['Tanuki Escape', 'Fireball'], []], discard: [[TAN, KIT, BAK], []], deck: [['Loyal Beagle', 'Loyal Terrier', ...Array(10).fill(D)], []] });
  let angebot = null;
  t.script.push({ match: d => d.type === 'handPick', answer: (d) => {
    angebot = { elig: d.eligibleIndices.slice(), hand: t.pile(0, 'hand').slice() };
    // „Mensch" klickt die Handkarte an Position 0 – das ist der Zauber selbst
    return { selectedCards: [{ handIndex: 0, cardName: t.pile(0, 'hand')[0] }] };
  } });
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: d.cards.slice(0, d.selectCount).map(c => c.name) }) });
  const r = await t.play(0, 'Tanuki Escape', { hero: 0 });
  R.note('Ergebnis', { r, angebot, deckHatTanukiEscape: t.pile(0, 'mainDeck').includes('Tanuki Escape'), disc: t.pile(0, 'discardPile') });
  R.check('Die aufgelöste Karte (Index 0 = Tanuki Escape) ist nicht als Hand-Karte wählbar', !!angebot && !angebot.elig.includes(0), angebot);
  R.check('Tanuki Escape landet nach der Auflösung in der Ablage, nicht im Deck', t.pile(0, 'discardPile').includes('Tanuki Escape') && !t.pile(0, 'mainDeck').includes('Tanuki Escape'),
    { disc: t.pile(0, 'discardPile'), deckHas: t.pile(0, 'mainDeck').includes('Tanuki Escape') });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
