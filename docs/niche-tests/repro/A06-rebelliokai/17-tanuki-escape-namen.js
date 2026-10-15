'use strict';
// A06-rebelliokai-17 · Tanuki Escape: zurückgemischte Namen sind bei der Suche ausgeschlossen – steht so nicht im Kartentext
// Kartentext: „Shuffle up to as many cards from your hand … back into your deck (max 3). Then, search your deck for up to that many cards
//   with different names, reveal them and add them to your hand." (Anders als Kitsune Transformation: „…different names from each other
//   and from the Creatures you shuffled back".)
// Beobachtung: tanuki-escape.js (`shuffledSet`, Z. ~211-218) nimmt jeden Namen, der gerade zurückgemischt wurde, aus der Suchgalerie.
//   Der Kopfkommentar nennt es „rule", im Text von Tanuki Escape steht es nicht.
// Frage (Stufe C): Darf Tanuki Escape eine Karte mit dem Namen einer gerade zurückgemischten Karte suchen – Ja oder Nein?
// ★ W10b (Al, Welle 10, Q40: Ausschließung bleibt, ist gewollt): zurückgemischte Namen sind NICHT suchbar; Kartentext präzisiert. Repro umgestellt (siehe W10/b-q40).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const t = await H.fresh({ hand: [['Tanuki Escape', 'Loyal Beagle'], []], discard: [['Rebelliokai Timid Tanuki', 'Rebelliokai Kind Kitsune'], []], deck: [['Loyal Beagle', 'Loyal Terrier', ...Array(8).fill(D)], []] });
  let galerie = null;
  t.script.push({ match: d => d.type === 'handPick', answer: (d) => { const i = t.pile(0, 'hand').indexOf('Loyal Beagle'); return { selectedCards: [{ handIndex: i, cardName: 'Loyal Beagle' }] }; } });
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => { galerie = d.cards.map(c => c.name); return { selectedCards: [d.cards[0].name] }; } });
  await t.play(0, 'Tanuki Escape', { hero: 0 });
  R.note('Suchgalerie', galerie);
  R.check('Al (Q40): Die Suchgalerie enthält Loyal Beagle (zurückgemischter Name) NICHT', !!galerie && !galerie.includes('Loyal Beagle'), galerie);
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
