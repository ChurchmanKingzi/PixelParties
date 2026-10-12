'use strict';
// A02-deepsea-02 · Zweiter Invader über Argos / Life-Searcher: Karte (und Kosten) gehen verloren
//
// Kartentext (Invader from the Cosmic Depths): „… You can only control 1 "Invader from the Cosmic Depths" at a time."
// Argos: „… remove any number of Change Counters … to place a "Cosmic Depths" Creature from your hand or deck whose level
//   is equal to the number of counters you removed into this Hero's free Support Zone."
// Life-Searcher: „… shuffle this Creature … back into your deck to search your deck for a "Cosmic Depths" Creature 1 level higher …
//   and place it into the same Support Zone this Creature occupied."
//
// Erwartung: Die Auswahl bietet einen zweiten Invader gar nicht erst an (wie Arrival und The Cosmic Depths, die
//   `isCreatureSummonable` fragen) – oder, wenn die Platzierung scheitert, bleibt die Karte, wo sie war, und es werden keine Kosten gezahlt.
// Beobachtet: Argos bietet Lv4/Invader an, zieht 4 Counter ab, nimmt den Invader aus Hand/Deck – `Invader.beforeSummon` lehnt ab
//   („already_control_one") → die Karte ist VERSCHWUNDEN (nicht Brett, nicht Ablage, nicht Hand/Deck). Life-Searcher mischt sich ins Deck,
//   nimmt den Invader aus dem Deck, die Platzierung scheitert → Invader weg, Zone leer, Log meldet trotzdem `life_searcher_upgrade`.
// Ursache: `argos-the-eye-of-the-cosmos.js` `cdCreaturesAtLevelInHandOrDeck` und `life-searcher-from-the-cosmic-depths.js` `upgrades`-Filter
//   prüfen nur `canSummonInvaderViaSource` (Quelle "Cosmic"), nicht das 1-Invader-Limit (`countOwnInvaders`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const INV = 'Invader from the Cosmic Depths', LS = 'Life-Searcher from the Cosmic Depths', AN = 'Analyzer from the Cosmic Depths';

  for (const src of ['hand', 'deck']) {
    R.section('Argos (4 Counter), Invader in der ' + src + ', ein Invader liegt schon auf dem Brett');
    const t = await H.fresh({ hand: [src === 'hand' ? [INV] : [], []], deck: [src === 'deck' ? [INV, H.INERT.creature] : [H.INERT.creature], []] });
    t.setHero(0, 0, 'Argos, the Eye of the Cosmos', 400);
    t.hero(0, 0)._changeCounters = 4;
    t.put(0, 1, 0, INV);
    const before = t.census();
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: '4' }) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: INV }) });
    await t.activateHero(0, 0, {});
    const diff = t.censusDiff(before, t.census());
    R.check('Kartenbilanz unverändert (kein Invader verschwunden)', diff.length === 0, diff);
    R.check('Counter nicht für eine gescheiterte Platzierung bezahlt', t.hero(0, 0)._changeCounters === 4, t.hero(0, 0)._changeCounters);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('Life-Searcher (3 Counter auf Analyzer), Invader im Deck, ein Invader liegt schon auf dem Brett');
  {
    const t = await H.fresh({ deck: [[INV, H.INERT.creature, H.INERT.creature], []] });
    t.put(0, 0, 0, LS); t.find(LS, 'support').turnPlayed = 1;
    t.put(0, 1, 0, INV);
    t.put(0, 2, 0, AN, { counters: { changeCounter: 3 } });
    const before = t.census();
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: INV }) });
    t.phase(2);
    await t.activateCreature(0, 0, 0);
    const diff = t.censusDiff(before, t.census());
    R.check('Kartenbilanz unverändert (kein Invader verschwunden)', diff.length === 0, diff);
    R.check('Life-Searcher steht noch auf dem Brett (Effekt nicht angeboten oder abgebrochen)', !!t.find(LS, 'support'), t.gs.players[0].supportZones[0]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
