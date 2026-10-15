'use strict';
// W9b · Q20 (A03-futuretech-22) · The Core's Awakening: die Staffel „1/2/3“ folgt dem vom Spieler gewählten Wirker
//
// ENTSCHIEDEN (Al, Welle 9, Q20): „Unbedingt mit dem Wirker skalieren.“ Drei Helden mit Support Magic 2 / 3 / 1; der Spieler wählt jeweils den Wirker (Auswahlfenster
//   „Cast … with …“); Angebotsmaximum (Q17: Anzahlwahl) und gesendete Kopien richten sich nach DESSEN Stufe, nicht nach dem ersten tauglichen Helden.
//   Hand: Gun + Core's Awakening, Deck: 4 Guns; die Gun wird an Held 2 ausgerüstet.
const H = require('../../lib/h.js');
const GUN = 'Future Tech Gun', CA = "The Core's Awakening";
(async () => {
  const R = H.runner();
  for (const [wirker, erwartet] of [[0, 2], [1, 3], [2, 1]]) {
    const t = await H.fresh({ hand: [[GUN, CA], []], deck: [[GUN, GUN, GUN, GUN, H.INERT.creature], []], gold: [100, 100] });
    t.setAbilities(0, 0, [['Support Magic', 'Support Magic'], [], []]);
    t.setAbilities(0, 1, [['Support Magic', 'Support Magic', 'Support Magic'], [], []]);
    t.setAbilities(0, 2, [['Support Magic'], [], []]);
    let angebot = null;
    t.script.push({ match: d => d.type === 'optionPicker' && !d._anzahlWahl, answer: () => ({ optionId: 'hero-' + wirker }) });
    t.script.push({ match: d => d._anzahlWahl, answer: (d) => { angebot = d.options.length; return { optionId: d.options[d.options.length - 1].id }; } });
    await t.play(0, GUN, { hero: 2, noGrant: true });
    const n = t.pile(0, 'discardPile').filter(x => x === GUN).length;
    const aufgetreten = t.pile(0, 'discardPile').includes(CA);
    if (wirker === 2) R.check('Wirker Held 2 (SM 1): Core gewirkt', aufgetreten, t.pile(0, 'discardPile'));
    R.check(`Wirker Held ${wirker}: ${erwartet} Kopien gesendet (Angebot ${erwartet > 1 ? '1..' + erwartet : 'keines'})`, n === erwartet && (erwartet > 1 ? angebot === erwartet : angebot === null), { n, angebot, ablage: t.pile(0, 'discardPile') });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
