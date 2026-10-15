'use strict';
// W10b · Q40 (A06-rebelliokai-17) · Tanuki Escape: die zurückgemischten Namen sind bei der Suche ausgeschlossen (gewollt; Kartentext präzisiert)
//
// Kartentext (neu): „… Then, search your deck for up to that many cards with different names from each other and from the cards shuffled back this way,
//   reveal them and add them to your hand. Immediately end your turn afterwards."
// ENTSCHIEDEN (Al, Welle 10, Q40): „Ausschließung bleibt, ist gewollt. Formuliere gerne den Kartentext präziser" → Verhalten unverändert, Text in data/cards.json präzisiert.
// Geprüft: (a) die Suchgalerie enthält NICHT den Namen der zurückgemischten Karte (Loyal Beagle), wohl aber andere Namen; (b) der Kartentext enthält die neue Formulierung.
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
  R.check('(a) Suchgalerie ohne „Loyal Beagle" (zurückgemischter Name), mit „Loyal Terrier"', !!galerie && !galerie.includes('Loyal Beagle') && galerie.includes('Loyal Terrier'), galerie);
  const db = require('../../../../data/cards.json');
  const karte = (Array.isArray(db) ? db : Object.values(db)).find(c => c.name === 'Tanuki Escape');
  R.check('(b) Kartentext nennt die Ausschließung ausdrücklich', /different names from each other and from the cards shuffled back this way/.test(karte.effect), karte.effect);
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
