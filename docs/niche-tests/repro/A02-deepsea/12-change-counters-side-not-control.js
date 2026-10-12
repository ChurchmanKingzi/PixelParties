'use strict';
// A02-deepsea-12 · „Cards you control with Change Counters" wird nach physischer Seite gezählt, nicht nach Kontrolle
//
// Kartentexte: Invader Token: „At the end of each turn, if the turn player controls no cards with 1 or more Change Counters on them, that player must discard 1 card or …"
//              Life-Searcher: „… if there are 3 or more Change Counters on cards you control …"
//              Gatherer: „… move any number of Change Counters from a card you control onto a "Cosmic Depths" Creature you control."
// Ausgangslage: Deepsea Succubus: „take control of it until the end of the turn" – die geliehene Kreatur steht weiter auf der Gegenseite (`owner` = Gegner, `controller` = ich);
//   die Zugende-Auslösung (Invader Token) läuft VOR der Rückgabe (`_revertStolenCreatures` erst zu Zugbeginn).
// Erwartung: Ich kontrolliere den geliehenen Analyzer mit Change Counters → der Invader Token bestraft mich nicht; Life-Searcher zählt seine Counter mit.
// Beobachtet: `changeCounterCardsOnSide` (`_cosmic-shared.js`) vergleicht `t.owner === pi` (Brettseite): die geliehene Karte zählt nicht – Strafe wird verhängt,
//   Life-Searcher ist mit 3 Countern auf der geliehenen Karte nicht aktivierbar, Gatherer sieht sie nicht als Quelle.
// Hinweis zur Einordnung: Die Rückgabe erfolgt erst zum nächsten Zugbeginn; ob eine geliehene Karte am „end of the turn" noch als „controlled" gilt, ist die Regelfrage.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const AN = 'Analyzer from the Cosmic Depths', LS = 'Life-Searcher from the Cosmic Depths', INV = 'Invader from the Cosmic Depths';

  R.section('Invader Token bestraft den Zugspieler trotz geliehenem Analyzer mit Counters');
  {
    const t = await H.fresh({ hand: [['Deepsea Succubus'], [H.INERT.filler]] });
    t.put(1, 1, 0, 'Invader Token');
    const an = t.put(1, 0, 0, AN, { counters: { changeCounter: 2 } }); an.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.cardName === AN).id];
    await t.play(0, 'Deepsea Succubus', { hero: 0, slot: 0 });
    t.targetFn = null;
    R.check('Vorbedingung: Analyzer mit 2 Counters ist mir geliehen', an.controller === 0 && an.stolenBy === 0 && an.counters.changeCounter === 2, [an.controller, an.stolenBy, an.counters.changeCounter]);
    t.setHand(0, [H.INERT.filler]);
    t.reset(); t._capture();
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'discard' }) });
    await t.endTurn();
    const strafe = t.prompts.some(p => p.d.title === 'Invader Token');
    R.check('Keine Token-Strafe, weil ich eine Karte mit Counters kontrolliere', !strafe, t.prompts.map(p => p.d.type + ':' + p.d.title));
  }

  R.section('Life-Searcher: 3 Counter auf einer geliehenen Karte zählen für „cards you control"');
  {
    const t = await H.fresh({ hand: [['Deepsea Succubus'], []], deck: [[INV, H.INERT.creature]] });
    const ls = t.put(0, 2, 0, LS); ls.turnPlayed = 1;
    const an = t.put(1, 0, 0, AN, { counters: { changeCounter: 3 } }); an.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.cardName === AN).id];
    await t.play(0, 'Deepsea Succubus', { hero: 0, slot: 0 });
    t.targetFn = null; t.phase(2);
    const script = H.loadCardEffect(LS);
    const ok = script.canActivateCreatureEffect(t.engine._createContext(ls, {}));
    R.check('Life-Searcher ist aktivierbar (3 Counter auf geliehener Karte, die ich kontrolliere)', ok === true, ok);
  }
  R.finish();
})();
