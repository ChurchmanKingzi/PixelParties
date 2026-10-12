'use strict';
// A07-12 · Guard Duty: eine NEGIERTE Guard Duty verbraucht das „once per game"-Limit nicht
//
// Kartentext Guard Duty: „… You can only play 1 "Guard Duty" per game."
// Ruling CARD_API.md ~Z. 11410-11416 (Divine Gifts, gilt für „You can only activate 1 … per game"): „Der Stempel sitzt dort, wo
//   die Karte die Hand verlässt – ab da IST sie aktiviert, unabhängig davon, ob ein Gegenzug sie später negiert."
//   Dafür gibt es den Vertrag `oncePerGame: true` (CARD_API.md Z. 2118); Guard Duty benutzt stattdessen einen eigenen
//   Schlüssel `gs._guardDutyUsed`, der erst in `onPlay` gestempelt wird (guard-duty.js:45).
// Erwartung: Wird die erste Guard Duty negiert (No Retreat!, The Master's Plan …), ist das Limit trotzdem verbraucht; eine
//   zweite Guard Duty ist nicht spielbar.
// Beobachtet: `onPlay` läuft bei Negierung nie → kein Stempel → die zweite Guard Duty wird gespielt und mischt die Ablage zurück.
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
  R.check('zweite Guard Duty wird abgelehnt (Limit durch die negierte verbraucht)', r === false, { r, deck: t.pile(0, 'mainDeck').length, discard: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
