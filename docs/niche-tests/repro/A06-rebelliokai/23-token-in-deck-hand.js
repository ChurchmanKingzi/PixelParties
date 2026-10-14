'use strict';
// A06-rebelliokai-23 · Tengu Windstorm und Sculpture Theft holen TOKEN-Karten ins Deck bzw. auf die Hand
// Konvention: Tokens verlassen das Brett nie in Hand/Deck/Ablage, sondern gehen in den Gelöscht-Stapel (z. B. _engine.js `_enforceSupportZoneLock`:
//   „echte Karten kehren in die Hand ihres Besitzers zurück, Tokens gehen ins Deleted"; Tokens → deleted pile beim Tod).
// Beobachtung: `_bounceToDeck` (tengu-windstorm.js) schiebt `inst.name` (z. B. „Mummy Token") oben/unten ins Hauptdeck; Sculpture Theft
//   (sculpture-theft.js `handZugangSync(casterPs, inst.name, …)`) legt „Mummy Token" auf die Hand. Tengu Windstorm bietet Tokens außerdem in der Zielliste an.
//   Ergebnis: eine Token-Karte, die es als Spielkarte nicht gibt, liegt im Deck/in der Hand (zieh-/spielbar nur als Totgewicht).
// Erwartung: ein Token wird gelöscht (Gelöscht-Stapel) oder ist nicht wählbar; er landet nicht im Deck/in der Hand.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  // 1. Tengu Windstorm auf einen Mummy Token
  let t = await H.fresh({ hand: [['Tengu Windstorm'], []], discard: [['Rebelliokai Terror Tengu'], []] });
  t.put(1, 0, 0, 'Mummy Token');
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'top' }) });
  t.targetFn = (valid) => { const a = valid.find(v => v.cardName === 'Mummy Token'); return [a ? a.id : valid[0].id]; };
  await t.play(0, 'Tengu Windstorm', { hero: 0 });
  R.check('Windstorm: „Mummy Token" liegt NICHT im Deck des Gegners', !t.pile(1, 'mainDeck').includes('Mummy Token'), { deckTop: t.pile(1, 'mainDeck')[0] });

  // 2. Sculpture Theft auf einen gefrorenen Mummy Token
  t = await H.fresh({ hand: [['The White Army'], ['Sculpture Theft']] });
  t.put(0, 0, 0, D); t.put(0, 0, 1, D);
  t.put(1, 0, 0, 'Mummy Token');
  t.grantFor(1, 0, 'Sculpture Theft');
  t.targetFn = (valid) => { const a = valid.find(v => v.cardName === 'Mummy Token'); return [a ? a.id : valid[0].id]; };
  await t.play(0, 'The White Army', { hero: 0 });
  R.check('Sculpture Theft: „Mummy Token" liegt NICHT auf der Hand', !t.pile(1, 'hand').includes('Mummy Token'), { hand1: t.pile(1, 'hand') });
  R.check('W5a (Al 14.10.2026): Token verschwindet vollständig – auch nicht im Gelöscht-Stapel', [0, 1].every(s => ['hand', 'mainDeck', 'discardPile', 'deletedPile'].every(k => !t.pile(s, k).includes('Mummy Token'))), [0, 1].map(s => t.pile(s, 'deletedPile')));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
