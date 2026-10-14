'use strict';
// A07-12 · Guard Duty: eine GANZ negierte Guard Duty verbraucht das „once per game"-Limit NICHT (Als Entscheidung, Welle 3)
//
// Kartentext Guard Duty: „… You can only play 1 "Guard Duty" per game."
// REGEL (CARD_API.md „★ Z7b", ersetzt Ruling v1031 / Z7): eine komplett negierte Karte (No Retreat!, The Master's Plan …) hat nie aufgelöst → ihr Einmal-Slot ist
//   unverbraucht, auch „per game". Guard Duty stempelt `gs._guardDutyUsed` erst im `onPlay` — der bei Negation nie läuft, das ist jetzt genau richtig.
// Exit 1 (Fehler tritt auf) = die negierte Guard Duty hat das Limit verbraucht (zweite wird abgelehnt) bzw. die zweite wirkt nicht.
const H = require('../../lib/h.js');
const F = H.INERT.filler;

(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Guard Duty', 'Guard Duty'], ['No Retreat!']], discard: [[F, F, F], [F, F]], deckSize: 10 });
  t.grantFor(1, 0, 'No Retreat!');
  t.script.push({ match: d => d && d.type === 'confirm', answer: () => ({ confirmed: true }) });     // Sitz 1 negiert
  let r = await t.play(0, 'Guard Duty', { hero: 0 });
  R.check('Vorbedingung: erste Guard Duty wurde negiert (Ablage unverändert, Karte in der Ablage)',
    t.pile(0, 'discardPile').length === 4 && t.pile(0, 'mainDeck').length === 10, { discard: t.pile(0, 'discardPile'), deck: t.pile(0, 'mainDeck').length });
  r = await t.play(0, 'Guard Duty', { hero: 0 });
  R.check('zweite Guard Duty ist spielbar und wirkt (mischt die Ablage zurück ins Deck)', r === true && t.pile(0, 'mainDeck').length > 10, { r, deck: t.pile(0, 'mainDeck').length, discard: t.pile(0, 'discardPile') });
  R.check('Kontrolle: die aufgelöste zweite Guard Duty verbraucht das Limit', !!(t.gs._guardDutyUsed && t.gs._guardDutyUsed[0]), t.gs._guardDutyUsed);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
