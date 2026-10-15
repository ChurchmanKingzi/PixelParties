'use strict';
// W9b · Q19 (A03-futuretech-15) · Copy Device als Control Device: ERST Unterhalt bezahlen, DANN abfallen
//
// ENTSCHIEDEN (Al, Welle 9, Q19): „Ja, muss bezahlen, bevor sie abfällt“ → am Zugende zahlt die als Control Device kopierte Copy Device zuerst den Unterhalt (eine Control Device aus
//   der Ablage wird gelöscht) und fällt danach ab (Identität endet, Copy Device in die Ablage).
// Geprüft: (a) Reihenfolge: zum Zeitpunkt der Zahlung (takeFromPile) liegt die Kopie noch am Brett; danach ist sie in der Ablage, genau eine echte Control Device gelöscht;
//   (b) Ablage ohne Control Device (nach dem Mischen ins Deck nur eine vorhanden → nicht zahlbar): nichts wird gelöscht, die Kopie fällt trotzdem ab (Ausrüstung in die Ablage);
//   (c) Kartenbilanz stimmt.
const H = require('../../lib/h.js');
const CD = 'Future Tech Copy Device', CTL = 'Future Tech Control Device';
(async () => {
  const R = H.runner();
  async function lauf(ablage) {
    const t = await H.fresh({ hand: [[CD], []], discard: [ablage, []], gold: 100 });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: CTL }), once: true });
    await t.play(0, CD, { hero: 0, targetOwner: 1 });
    const liegt = t.zone(1, 0, 0) === CD;
    let amBrettBeiZahlung = null;
    const orig = t.engine.takeFromPile.bind(t.engine);
    t.engine.takeFromPile = async (...a) => { if (a[2] === CTL) amBrettBeiZahlung = t.zone(1, 0, 0) === CD; return orig(...a); };
    const vorher = t.census();
    const geloescht0 = t.pile(0, 'deletedPile').length;
    await t.endTurn();
    return { t, liegt, amBrettBeiZahlung, geloescht: t.pile(0, 'deletedPile').slice(geloescht0), vorher };
  }
  let r = await lauf([CTL, CTL, CTL]);
  R.check('Copy Device liegt als Control Device an Sitz 1 Held 0', r.liegt);
  R.check('(a) Unterhalt gezahlt, solange die Kopie noch am Brett liegt', r.amBrettBeiZahlung === true, r.amBrettBeiZahlung);
  R.check('(a) genau eine echte Control Device gelöscht', r.geloescht.length === 1 && r.geloescht[0] === CTL, r.geloescht);
  R.check('(a) danach abgefallen: Brett leer, Copy Device in der Ablage von Sitz 0', r.t.zone(1, 0, 0) === null && r.t.pile(0, 'discardPile').includes(CD), r.t.pile(0, 'discardPile'));
  R.check('(c) keine Engine-Fehler / Zustand sauber', r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });
  r = await lauf([CTL]);   // die einzige Kopie wird zum Kopieren ins Deck gemischt → nichts zu bezahlen
  R.check('(b) nicht zahlbar: nichts gelöscht, Kopie trotzdem abgefallen', r.geloescht.length === 0 && r.t.zone(1, 0, 0) === null && r.t.pile(0, 'discardPile').includes(CD), { g: r.geloescht, d: r.t.pile(0, 'discardPile') });
  R.check('(c) keine Engine-Fehler / Zustand sauber', r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
