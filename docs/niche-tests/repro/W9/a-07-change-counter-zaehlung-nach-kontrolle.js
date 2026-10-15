'use strict';
// W9a · Q10 (A02-deepsea-12) · Al, 15.10.2026: „Ja“ – eine per Succubus geliehene Karte zählt für „Cards you control with Change Counters“ als vom Kontrolleur
//   kontrolliert (Zählung nach Kontrolle, nicht nach Brettseite).
// Erwartet: (1) geliehener Analyzer (2 Counter) zählt für den Entleiher (Sitz 0): changeCounterCardsOnSide(0) enthält ihn, (2) für den Verleiher (Sitz 1) nicht mehr;
//   (3) Invader-Token-Strafe entfällt für den Entleiher am Zugende; (4) Gatherer des Entleihers sieht die geliehene Karte als Quelle.
const H = require('../../lib/h.js');
const { changeCounterCardsOnSide } = require('../../../../cards/effects/_cosmic-shared');
(async () => {
  const R = H.runner();
  const AN = 'Analyzer from the Cosmic Depths', GA = 'Gatherer from the Cosmic Depths';
  const t = await H.fresh({ hand: [['Deepsea Succubus'], [H.INERT.filler]] });
  t.put(1, 1, 0, 'Invader Token');
  const an = t.put(1, 0, 0, AN, { counters: { changeCounter: 2 } }); an.turnPlayed = 1;
  const ga = t.put(0, 1, 0, GA); ga.turnPlayed = 1;
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.cardName === AN).id];
  await t.play(0, 'Deepsea Succubus', { hero: 0, slot: 0 });
  t.targetFn = null;
  R.check('Vorbedingung: Analyzer ist mir geliehen', an.controller === 0, an.controller);
  R.check('(1) Entleiher (Sitz 0) zählt den geliehenen Analyzer', changeCounterCardsOnSide(t.engine, 0).some(x => x.ref === an), 'fehlt');
  R.check('(2) Verleiher (Sitz 1) zählt ihn nicht mehr', !changeCounterCardsOnSide(t.engine, 1).some(x => x.ref === an), 'noch drin');
  t.phase(2);
  const gs = H.loadCardEffect(GA);
  R.check('(4) Gatherer (Sitz 0) hat die geliehene Karte als Quelle (Zug-Effekt aktivierbar)', gs.canActivateCreatureEffect(t.engine._createContext(ga, {})) === true, 'nicht aktivierbar');
  t.setHand(0, [H.INERT.filler]);
  t.reset(); t._capture();
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'discard' }) });
  await t.endTurn();
  R.check('(3) keine Token-Strafe für den Entleiher', !t.prompts.some(p => p.d.title === 'Invader Token'), t.prompts.map(p => p.d.title));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
