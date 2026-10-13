'use strict';
// S02-16 · Divine Zeal: die Statuswahl (2. Stufe der Auswahl) ist nicht abbrechbar – ein Abbruch verbrennt die Karte
// Regel (CARD_API.md Z. 367ff.): „Jede Zielwahl hat einen Cancel-Button – Ziel-Prompt, Galerie, Zonenwahl, jede Stufe einer mehrstufigen Auswahl: `cancellable: true`. Ausnahme ist nur,
//   was nach dem Zusagepunkt kommt … oder eine Pflichtwahl, die der Kartentext erzwingt – dann steht der Grund als Kommentar daneben."; „Abbruch heißt: nichts ist passiert. Die Karte bleibt auf der Hand."
// Kartentext: „Remove any number of status effects from any number of targets. If you remove 3 or more effects, draw 2 cards." („any number" erlaubt auch 0 Effekte.)
// Aufbau: Gegnerheld 0 brennt und ist vergiftet. Divine Zeal wird gespielt, das Ziel gewählt; die folgende `statusSelect`-Abfrage wird abgebrochen (null).
// Erwartet: die Statuswahl ist abbrechbar; Abbruch ⇒ Karte bleibt auf der Hand, Status unverändert.
// Beobachtet: `statusSelect` kommt mit `cancellable: false` (kein Begründungskommentar); die Abbruch-Antwort wird als „0 Effekte gewählt" verbucht: Karte in der Ablage, nichts entfernt.
// Ursache: `cards/effects/divine-zeal.js` Z. 169–176 (`promptGeneric({ type: 'statusSelect', … cancellable: false })`) und Z. ~178 (`result?.selectedStatuses || []`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Divine Zeal'], []], deckSize: 30 });
  await t.engine.addHeroStatus(1, 0, 'burned', { duration: 3, appliedBy: 0 });
  await t.engine.addHeroStatus(1, 0, 'poisoned', { duration: 3, appliedBy: 0 });
  let cancellable = null;
  t.targetFn = (valid) => valid.map(v => v.id);
  t.script.push({ match: d => d.type === 'statusSelect', answer: (d) => { cancellable = d.cancellable; return null; } });
  const r = await t.play(0, 'Divine Zeal', { hero: 0 });
  t.say('gespielt:', r, '| cancellable laut Prompt:', cancellable, '| Hand', t.pile(0, 'hand'), '| Ablage', t.pile(0, 'discardPile'));
  R.check('Statuswahl ist abbrechbar', cancellable !== false, cancellable);
  R.check('Abbruch: Karte bleibt auf der Hand', t.pile(0, 'hand').includes('Divine Zeal'), { hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
