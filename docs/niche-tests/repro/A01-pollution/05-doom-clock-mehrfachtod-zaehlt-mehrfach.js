'use strict';
// A01-pollution-05 · Doom Clock: gleichzeitig besiegte Ziele zählen mehrfach statt als EINE Auslösung
// Kartentext: „At the end of each turn, the turn player must put 1 Doom Counter onto this card. The first 4 times every turn 1 or more
//   targets are defeated, their controller must place 1 Doom Counter onto this card. …“
// Ruling (Kopf von cards/effects/doom-clock.js und _doom-clock-shared.js, Als Ruling 5.8.): „Die Besiegungs-Ausloesung zaehlt PRO ZUG
//   INSGESAMT und ist je Ereignis EINE Ausloesung – auch wenn mehrere Ziele gleichzeitig fallen.“
// Erwartung: ein Flächenschlag, der 3 Kreaturen auf einmal besiegt, legt genau 1 Counter (und verbraucht 1 der 4 Auslösungen des Zuges).
// Beobachtet: 3 Counter, 3 der 4 Auslösungen verbraucht. Der Riegel `gs._doomDefeatTick` wird per `Promise.resolve().then` im nächsten
//   Mikrotask gelöscht; zwischen den `onCreatureDeath`-Hooks des Stapels liegen aber `await`s, der Riegel fällt also schon nach dem ersten Tod.
// Ursache: cards/effects/doom-clock.js, Hook `onCreatureDeath` (statt des Sammel-Fensters `isCreaturesDefeatedReaction` / `_mitNiederlagenSammler`).
// Aufruf: node docs/niche-tests/repro/A01-pollution/05-doom-clock-mehrfachtod-zaehlt-mehrfach.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Pyroblast'], []] });
  const clock = t.putArea(0, 'Doom Clock');
  for (let i = 0; i < 3; i++) t.put(1, 0, i, H.INERT.frail);
  t.targetFn = (v) => v.filter(x => x.type === 'equip' && x.owner === 1).map(x => x.id);   // alle 3 Kreaturen in einem Ereignis
  const r = await t.play(0, 'Pyroblast', { hero: 0 });
  R.check('Pyroblast gespielt, alle 3 Kreaturen besiegt', r === true && t.pile(1, 'discardPile').length === 3, t.pile(1, 'discardPile'));
  R.check('EIN Ereignis = EIN Counter', clock.counters.doom === 1, clock.counters.doom);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
