'use strict';
// A03-futuretech-11 · Iterative Testing: „up to 2“ – es werden immer zwei Kopien gesendet, der Spieler kann die Zahl nicht wählen (Stufe C – Regelfrage)
//
// Kartentext: „Choose a card from your hand and send **up to 2** cards with the same name from your deck to the discard pile.“
// Beobachtet: Nach der Wahl der Handkarte werden automatisch `min(2, Kopien im Deck)` Karten gesendet (cards/effects/iterative-testing.js:103
//   `wieViele = Math.min(MAX_SENDS, …)`); es gibt keine Abfrage 0/1/2. Zum Vergleich: Mysterious Core („up to 3“) lässt den Spieler abbrechen.
// Frage an Al: Soll bei „up to 2“ gewählt werden dürfen, wie viele Kopien (1 oder 2) gesendet werden – ja oder nein?
// ENTSCHIEDEN (Al, Welle 9, Q17): Der Spieler wählt 1 oder 2 (nur eine Kopie im Deck: Default 1 ohne Rückfrage; CPU: Höchstzahl). Dieses Repro prüft, dass eine Anzahl-Abfrage kommt;
//   die Einzelfälle stehen in W9/b-q17-up-to-anzahlwahl.js.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Iterative Testing', 'Future Tech Gun'], []], deck: [['Future Tech Gun', 'Future Tech Gun', 'Future Tech Gun', H.INERT.creature], []] });
  t.setAbilities(0, 0, [['Magic Arts'], [], []]);
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Future Tech Gun' }), once: true });
  await t.play(0, 'Iterative Testing', { hero: 0, noGrant: true });
  const abfragen = t.prompts.map(p => p.d.type);
  R.check('Spieler kann die Anzahl (1 oder 2) wählen', abfragen.some(a => a !== 'cardGallery'), { abfragen, ablage: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
