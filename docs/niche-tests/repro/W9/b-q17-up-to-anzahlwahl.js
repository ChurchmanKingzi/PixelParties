'use strict';
// W9b · Q17 (A03-futuretech-11) · „up to N“ – der Spieler wählt die Anzahl (Iterative Testing „up to 2“, The Core's Awakening „up to 1/2/3“)
//
// ENTSCHIEDEN (Al, Welle 9, Q17): Der Spieler soll wählen können (außer es gibt nur eine Kopie, dann Default 1 ohne Rückfrage). Core's Awakening: 1 bis zum Maximum der Staffel
//   (Skalierung mit dem gewählten Wirker, Q20), begrenzt durch die Kopien im Deck. CPU: Höchstzahl.
// Geprüft: Iterative Testing – (a) 3 Kopien im Deck, Wahl 1 → 1 gesendet; (b) Wahl 2 → 2; (c) nur 1 Kopie → KEINE Anzahl-Abfrage, 1 gesendet; (d) keine Kopie im Deck → nichts;
//   (e) CPU-Antwort (Engine-Default ohne Skript) → 2 (Höchstzahl). The Core's Awakening (Support Magic 3): (f) Wahl 2 von max 3 → 2; (g) nur 2 Kopien im Deck → Angebot 1..2;
//   (h) nur 1 Kopie → keine Abfrage; (i) Default ohne Skript → 3.
const H = require('../../lib/h.js');
const GUN = 'Future Tech Gun', CA = "The Core's Awakening", IT = 'Iterative Testing';
const anzahlAbfragen = (t) => t.prompts.filter(p => p.d.type === 'optionPicker' && p.d._anzahlWahl);
(async () => {
  const R = H.runner();
  async function iter(kopien, antwort) {
    const t = await H.fresh({ hand: [[IT, GUN], []], deck: [[...Array(kopien).fill(GUN), H.INERT.creature, H.INERT.creature], []] });
    t.setAbilities(0, 0, [['Magic Arts'], [], []]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: GUN }), once: true });
    if (antwort) t.script.push({ match: d => d._anzahlWahl, answer: () => ({ optionId: 'count-' + antwort }) });
    await t.play(0, IT, { hero: 0, noGrant: true });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    return { n: t.pile(0, 'discardPile').filter(x => x === GUN).length, abf: anzahlAbfragen(t) };
  }
  let r = await iter(3, 1); R.check('(a) Iterative Testing, 3 Kopien, Wahl 1 → 1 gesendet', r.n === 1 && r.abf.length === 1 && r.abf[0].d.options.length === 2, r);
  r = await iter(3, 2); R.check('(b) Wahl 2 → 2 gesendet', r.n === 2, r);
  r = await iter(1, null); R.check('(c) nur 1 Kopie → keine Abfrage, 1 gesendet', r.n === 1 && r.abf.length === 0, r);
  r = await iter(0, null); R.check('(d) keine Kopie im Deck → nichts gesendet', r.n === 0, r);
  r = await iter(3, null); R.check('(e) CPU-Default (ohne Skript) → Höchstzahl 2', r.n === 2 && r.abf.length === 1, r);

  async function core(deckGuns, sm, antwort) {
    const t = await H.fresh({ hand: [[GUN, CA], []], deck: [[...Array(deckGuns).fill(GUN), H.INERT.creature], []], gold: [100, 100] });
    t.setAbilities(0, 0, [Array(sm).fill('Support Magic'), [], []]);
    if (antwort) t.script.push({ match: d => d._anzahlWahl, answer: () => ({ optionId: 'count-' + antwort }) });
    await t.play(0, GUN, { hero: 2, noGrant: true });
    R.check('keine Engine-Fehler / Zustand sauber (Core)', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    return { n: t.pile(0, 'discardPile').filter(x => x === GUN).length, abf: anzahlAbfragen(t) };
  }
  r = await core(4, 3, 2); R.check('(f) Core, Support Magic 3, Wahl 2 → 2 gesendet, Angebot 1..3', r.n === 2 && r.abf.length === 1 && r.abf[0].d.options.length === 3, r);
  r = await core(2, 3, null); R.check('(g) Core, SM 3, nur 2 Kopien im Deck → Angebot 1..2, Default (CPU) 2', r.abf.length === 1 && r.abf[0].d.options.length === 2 && r.n === 2, r);
  r = await core(1, 3, null); R.check('(h) Core, nur 1 Kopie → keine Abfrage, 1 gesendet', r.abf.length === 0 && r.n === 1, r);
  r = await core(4, 3, null); R.check('(i) Core, Default ohne Skript → Höchstzahl 3', r.n === 3, r);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
