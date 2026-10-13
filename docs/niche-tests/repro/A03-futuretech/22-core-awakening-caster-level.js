'use strict';
// A03-futuretech-22 · The Core's Awakening: die Staffel „1/2/3" folgt dem ERSTEN tauglichen Helden, nicht dem gewählten Wirker
//
// Kartentext: „Play this card immediately when you play an Artifact. Choose up to **1/2/3** copies of that Artifact from your deck and send them to your discard pile …“
//   (Hausnotation: Stufe 1/2/3 der geforderten Schule des Wirkers, hier Support Magic.)
// Erwartung: Die Engine fragt bei zwei tauglichen Helden, mit welchem die Reaktion gewirkt wird (optionPicker „Cast … with …“); die Kopienzahl richtet sich nach DIESEM Helden.
// Beobachtet: Held 0 Support Magic 1, Held 1 Support Magic 3, gewählt wird Held 1 (`chain[i].casterHeroIdx` = 1): nur 1 Kopie wandert in die Ablage (Stufe von Held 0).
//   Umgekehrt (Held 0 SM 3, Held 1 SM 1, Held 1 gewählt): 3 Kopien. Die Wahl des Spielers ändert nichts.
// Ursache: cards/effects/the-core-s-awakening.js `resolve`: `const heroIdx = wirkenderHeld(gs, pi, engine)` (erster Held mit Stufen-/Statusprüfung) statt `chain[myIndex].casterHeroIdx`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const CA = "The Core's Awakening";
  for (const [label, h0, h1, erwartet] of [['Held 0 SM 1, Held 1 SM 3, Wirker Held 1 -> 3 Kopien', 1, 3, 3], ['Held 0 SM 3, Held 1 SM 1, Wirker Held 1 -> 1 Kopie', 3, 1, 1]]) {
    const t = await H.fresh({ hand: [['Future Tech Gun', CA], []], deck: [['Future Tech Gun', 'Future Tech Gun', 'Future Tech Gun', 'Future Tech Gun', H.INERT.creature], []], gold: [100, 100] });
    t.setAbilities(0, 0, [Array(h0).fill('Support Magic'), [], []]);
    t.setAbilities(0, 1, [Array(h1).fill('Support Magic'), [], []]);
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'hero-1' }) });
    await t.play(0, 'Future Tech Gun', { hero: 2, noGrant: true });
    const gesendet = t.pile(0, 'discardPile').filter(n => n === 'Future Tech Gun').length;   // gespielte Gun liegt am Helden, nicht in der Ablage
    R.check(label, gesendet === erwartet, { gesendet, ablage: t.pile(0, 'discardPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
