'use strict';
// S01-02 · Ganz negiertes Big Oopsie / Butterfly Cloud zählt NICHT gegen „1 pro Zug" bzw. „nicht in 2 aufeinanderfolgenden Zügen" (Als Entscheidung, Welle 3)
// Kartentexte: Big Oopsie: „You can only play 1 "Big Oopsie" per turn."  Butterfly Cloud: „You cannot play "Butterfly Cloud" on 2 consecutive turns."
// REGEL (CARD_API.md „★ Z7b"): eine komplett negierte Karte (Silence) hat nie aufgelöst → das Limit ist unverbraucht. Löst sie auf und nur das Ergebnis wird
//   verhindert, ist es verbraucht.
// Exit 1 (Fehler tritt auf) = das negierte Exemplar hat den Slot verbraucht (zweites Big Oopsie nicht spielbar / Butterfly Cloud im nächsten Zug gesperrt).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // ── Big Oopsie ──
  let t = await H.fresh({ hand: [['Big Oopsie', 'Big Oopsie'], ['Silence']] });
  t.grantFor(1, 0, 'Silence');
  t.policy.confirm = true;
  await t.play(0, 'Big Oopsie', { hero: 0 });
  R.check('(Big Oopsie) Voraussetzung: erstes wurde negiert (keine Gegner-HP verloren, Silence verbraucht)', t.gs.players[1].heroes.every(h => h.hp === 800) && !t.pile(1, 'hand').includes('Silence'));
  t.policy.confirm = false;
  const r2 = await t.play(0, 'Big Oopsie', { hero: 0 });
  const getroffen = t.gs.players[1].heroes.some(h => h.hp < 800);
  R.check('(Big Oopsie) zweites im selben Zug ist spielbar und wirkt (das negierte hat den Slot nicht verbraucht)', r2 === true && getroffen, { r2, hp1: t.gs.players[1].heroes.map(h => h.hp) });
  // Kontrollfall: ein aufgelöstes Big Oopsie verbraucht den Slot sehr wohl
  const r3 = await t.play(0, 'Big Oopsie', { hero: 0 });
  R.check('(Big Oopsie) Kontrolle: nach dem aufgelösten zweiten ist ein drittes im selben Zug gesperrt', r3 === false || t.pile(0, 'hand').includes('Big Oopsie'), { r3 });
  // ── Butterfly Cloud ──
  t = await H.fresh({ hand: [['Butterfly Cloud', 'Butterfly Cloud'], ['Silence']] });
  t.grantFor(1, 0, 'Silence');
  t.policy.confirm = true;
  await t.play(0, 'Butterfly Cloud', { hero: 0 });
  R.check('(Butterfly Cloud) Voraussetzung: erste wurde negiert (keine Gegner-HP verloren)', t.gs.players[1].heroes.every(h => h.hp === 800));
  t.policy.confirm = false;
  await t.endTurn(); await t.endTurn();               // Gegnerzug, dann wieder Sitz 0 (nächster eigener Zug)
  const handVor = t.pile(0, 'hand').filter(n => n === 'Butterfly Cloud').length;
  const r4 = await t.play(0, 'Butterfly Cloud', { hero: 0 });
  const handNach = t.pile(0, 'hand').filter(n => n === 'Butterfly Cloud').length;
  R.check('(Butterfly Cloud) im nächsten eigenen Zug nach ganz negierter Butterfly Cloud NICHT gesperrt', r4 === true && handNach < handVor, { r4, handVor, handNach, turn: t.gs.turn });
  R.finish();
})();
