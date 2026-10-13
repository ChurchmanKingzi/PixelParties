'use strict';
// F03-artifacts-21 · Treasure Hunter's Backpack legt Summoning Instructions mit X-Wahl an – laut Vorgabe gilt bei Effekt-Anlegen X = 1 ohne Frage
// Vorgabe (summoning-instructions.js `frageX`/`onCardEnterZone`, „Als Vorgabe 21.9. v1263"): „wird die Karte durch einen EFFEKT angelegt (Bill, Treasure Hunter's Backpack — Placement/Verschiebung
//   statt Ausspielen), gibt es keine Wahl: X = 1, also Kosten 10." Kartentext: „…up to X levels higher than its Summoning Magic level."
// Erwartung: Backpack holt Summoning Instructions aus dem Deck ⇒ keine X-Abfrage, `levelGapCoverage` = 1.
// Beobachtet (✗): Es erscheint der Prompt „Summoning Instructions" (optionPicker X = 1/2/3); mit der Standard-Antwort der Engine-CPU (höchstes X) / einer skriptierten Wahl 3 liegt X = 3.
// Ursache: `onCardEnterZone` unterscheidet Effekt-Anlegen über `ctx._isPlacement || ctx._isMove`; der Backpack-Weg (`_equip-shared.ruesteAusStapelAus`, eigene Animation) feuert den Hook ohne dieses Kennzeichen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const B = "Treasure Hunter's Backpack";
  const t = await H.fresh({ hand: [[B], []], deck: [['Summoning Instructions', 'Bird'], []], gold: 100 });
  let xPrompts = 0;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === B, answer: () => ({ cardName: 'Summoning Instructions', source: 'deck' }), once: false });
  t.script.push({ match: d => d.type === 'deckSearchReveal', answer: () => ({}), once: false });
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Summoning Instructions', answer: (d) => { xPrompts++; return { optionId: '3' }; }, once: false });
  await t.play(0, B);
  const inst = t.inst(c => c.name === 'Summoning Instructions' && c.zone === 'support')[0];
  R.check('Aufbau: Summoning Instructions liegt auf dem Brett', !!inst, [0, 1, 2].map(h => [0, 1, 2].map(s => t.zone(0, h, s))));
  R.check('keine X-Abfrage beim Effekt-Anlegen', xPrompts === 0, xPrompts);
  R.check('X = 1', inst && inst.counters.levelGapCoverage === 1, inst && inst.counters);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
