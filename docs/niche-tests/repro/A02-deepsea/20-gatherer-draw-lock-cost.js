'use strict';
// A02-deepsea-20 · Gatherer from the Cosmic Depths: Zieh-Effekt unter Zieh-Sperre (The Sacred Jewel) zahlt die Counter, zieht nichts
//
// Kartentext (Gatherer): „You may once per turn remove up to 3 Change Counters from this Creature to draw that many cards."
// Kartentext (The Sacred Jewel): „… you may make both players draw 1 card, but if you do, you cannot draw any cards for the rest of the turn afterwards."
// Engine-Vertrag (_engine.js ~Z. 20955): Kreaturen sind von der Hand-Sperren-Auto-Erkennung ausgenommen, weil die Sperre
//   „per Karte über `canActivateCreatureEffect`" behandelt wird (Vorbild: Golden Ladybug prüft `handLocked || drawLocked`).
//
// Erwartung: Nach dem Jewel (drawLocked) ist der Zieh-Effekt nicht aktivierbar – oder zumindest werden keine Counter bezahlt,
//   wenn nichts gezogen werden kann („Abbruch/nichts passiert").
// Beobachtet: `gatherer-from-the-cosmic-depths.js` prüft in `canActivateCreatureEffect`/`onCreatureEffect`/`runDraw` nur
//   `ps.handLocked`, nicht `ps.drawLocked`: die Counter werden entfernt, `actionDrawCards` liefert [] , der Einmal-pro-Zug-Stempel ist gesetzt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['The Sacred Jewel'], []] });
  const g = t.put(0, 0, 0, 'Gatherer from the Cosmic Depths'); g.turnPlayed = 1; g.counters.changeCounter = 3;
  const r1 = await t.play(0, 'The Sacred Jewel');
  R.check('Vorbedingung: Jewel gespielt, Zieh-Sperre aktiv', r1 === true && t.gs.players[0].drawLocked === true, { r1, drawLocked: t.gs.players[0].drawLocked });
  const vorher = g.counters.changeCounter || 0;     // 3 + 1 (der Gegner zog durch das Jewel)
  t.phase(2);
  // Zieh-Teil wählen und die maximale Anzahl nehmen
  t.script.push({ match: d => d.type === 'optionPicker' && /Gatherer/.test(d.title || ''), answer: (d) => ({ optionId: d.options.some(o => o.id === 'draw') ? 'draw' : d.options[d.options.length - 1].id }) });
  const hand0 = t.pile(0, 'hand').length;
  const r = await t.activateCreature(0, 0, 0);
  const bezahlt = vorher - (g.counters.changeCounter || 0);
  const gezogen = t.pile(0, 'hand').length - hand0;
  R.note('Aktivierung', { r, vorher, bezahlt, gezogen });
  R.check('Es werden keine Counter für 0 gezogene Karten bezahlt', bezahlt === 0 || gezogen > 0, { r, vorher, bezahlt, gezogen });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
