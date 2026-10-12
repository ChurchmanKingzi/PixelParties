'use strict';
// A06-rebelliokai-24 · Thebinxan War Counselor unter Handsperre: der Gegner muss ansagen, die Karte kommt nicht, die Nutzung ist verbraucht
// Kartentext: „You may once per turn make your opponent declare a card type … Reveal the top card of your deck and add it to your hand.
//   If it is not a card of the declared type, deal 50 damage to all targets your opponent controls."
// Beobachtung: `canActivateCreatureEffect` (thebinxan-war-counselor.js) prüft nur „Deck nicht leer". Unter einer Handsperre (z. B. Ice Sculpture Garden:
//   „You cannot draw or add cards to your hand for the rest of the turn") scheitert `actionAddCardFromDeckToHand`; der Effekt endet mit `return true`
//   (Log `thebinxan_fizzle`), also ist die Einmal-pro-Zug-Nutzung weg, der Gegner hat umsonst angesagt und kein Schaden fällt – auch wenn die Ansage falsch gewesen wäre.
//   Vergleich: Camouflaged Kappa und Timid Tanuki sperren ihre Aktivierung bei Handsperre vorab (`ps.handLocked`).
// Frage (Stufe C): Soll Thebinxan bei Handsperre nicht aktivierbar sein (wie Kappa/Tanuki) – oder soll der Schaden bei falscher Ansage trotzdem fallen, weil die Karte „aufgedeckt" wurde?
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const t = await H.fresh({ deck: [['Fireball', ...Array(10).fill(D)], Array(20).fill(D)] });
  const th = t.put(0, 0, 0, 'Thebinxan War Counselor'); th.turnPlayed = t.gs.turn - 1;
  t.gs.players[0].handLocked = true;      // wie nach Ice Sculpture Garden
  t.gs.currentPhase = 2; t.resetActions(0);
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Thebinxan War Counselor', answer: () => ({ optionId: 'potion' }) });   // falsch geraten
  const r = await t.activateCreature(0, 0, 0);
  const abgefragt = t.prompts.some(p => p.d.title === 'Thebinxan War Counselor');
  R.note('Ergebnis', { r, abgefragt, hp1: [0, 1, 2].map(i => t.hp(1, i)), hand: t.pile(0, 'hand'), hoptDa: JSON.stringify(t.gs.hoptUsed || {}).length > 2, fizzleLog: t.lg('thebinxan_fizzle') });
  R.check('Unter Handsperre wird der Gegner nicht umsonst zur Ansage gezwungen (Aktivierung gesperrt)', !abgefragt, { r, abgefragt });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
