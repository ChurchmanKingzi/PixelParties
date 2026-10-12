'use strict';
// A02-deepsea-05 · Slippery Snobbit: „Slippery"-Bonus-Karte zählt nur Kreaturen
//
// Kartentext (Slippery Snobbit): „When this Creature is moved into a different Hero's Support Zone, you may discard any number
// of cards and draw the same number of cards. If you discard at least 1 "Slippery" card, draw 1 additional card."
// Archetyp „Slippery" tragen laut cards.json auch Slippery Ice (Spell) und Slippery Skates (Artifact); Slippery Fridge heißt so, hat aber kein Archetyp-Feld.
// Erwartung: Wer Slippery Ice oder Slippery Skates abwirft, zieht 1 Karte mehr (wie beim Abwurf einer Slippery-Kreatur).
// Beobachtet: Bonus nur bei Slippery-KREATUREN (`isSlipperyCard` in `_slippery-shared.js` prüft `cardType === 'Creature'`, weil der Helfer
//   für den Zugbeginn-Mover geschrieben wurde; Snobbit benutzt ihn für etwas anderes).
const H = require('../../lib/h.js');
const SH = require('../../../../cards/effects/_slippery-shared.js');
(async () => {
  const R = H.runner();
  async function draws(disc) {
    const t = await H.fresh({ hand: [[disc], []], deck: [[H.INERT.creature, H.INERT.creature, H.INERT.creature, H.INERT.creature]] });
    const sn = t.put(0, 0, 0, 'Slippery Snobbit'); sn.turnPlayed = 1;
    let n = 0;
    t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => { n++; return n === 1 ? { cardName: disc, handIndex: 0 } : { cancelled: true }; } });
    await t.run(() => SH.moveSlipperyCreature(t.engine, 0, sn, 1, 0));   // gemeinsamer Verschiebe-Weg (Ice/Skates/Zugbeginn)
    return { gezogen: t.pile(0, 'hand').length, fehler: t.errors };
  }
  const base = await draws('Slippery Skates');
  const cre = await draws('Slippery Narw');
  R.note('Abwurf Slippery Narw (Kreatur): gezogene Karten', cre.gezogen);
  R.check('Kontrolle: Abwurf einer Slippery-Kreatur zieht 2 (1 + Bonus)', cre.gezogen === 2, cre);
  const ice = await draws('Slippery Ice');
  R.check('Abwurf Slippery Ice (Archetyp Slippery) zieht 2 (1 + Bonus)', ice.gezogen === 2, ice);
  R.check('Abwurf Slippery Skates (Archetyp Slippery) zieht 2 (1 + Bonus)', base.gezogen === 2, base);
  R.finish();
})();
