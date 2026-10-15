'use strict';
// A02-deepsea-21 · Analyzer / Gatherer: „adds cards to their hand via an effect" zählt die Rückgabe vom Brett (Deepsea-Bounce) nicht
//
// Kartentext (Analyzer / Gatherer): „Whenever your opponent draws or adds cards to their hand via an effect, place 1 Change Counter onto this Creature."
// Kartentext (Deepsea-Kreaturen, Shapeshift, Castle): „You may ADD a "Deepsea" Creature … to your hand to place this Creature …" /
//   „Choose a Creature … and ADD it to your hand."; Teppes: „when 1 or more cards are ADDED from your Heroes' Support Zones to your hand".
// Die Skripte lauschen auf `onCardAddedToHand` / `onCardAddedFromDiscardToHand` / `beforeDrawBatch`, nicht auf
// `onCardsReturnedToHand` (so feuern Deepsea-Bounce, Shapeshift, Castle, Encounter, Monstrosity – nicht).
//
// WELLE 9 (Al, 15.10.2026, Q13): „Ja, das soll zählen“ – Lesart A ist entschieden und umgesetzt (Hook `onCardsReturnedToHand` in Analyzer/Gatherer; neues Repro W9/a-13).
// Lesart A (Wortlaut): jede Karte, die der Gegner per Effekt auf die Hand nimmt, zählt – auch vom Brett (+1 je Effekt).
// Lesart B (Engine-Vokabular): „add" = Suchen/Einsammeln aus Deck/Ablage; Brett→Hand ist ein „return" und zählt nicht.
// Das Repro prüft Lesart A (✗ = Counter bleibt aus); die Kontrolle (Deck→Hand) zählt wie erwartet.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();

  R.section('Kontrolle: Gegner nimmt per Effekt eine Karte aus dem Deck auf die Hand');
  {
    const t = await H.fresh({ hand: [[], []] });
    const a = t.put(0, 0, 0, 'Analyzer from the Cosmic Depths'); a.turnPlayed = 1;
    t.setDeck(1, ['Fireball']);
    await t.run(() => t.engine.actionAddCardFromDeckToHand(1, 'Fireball', { source: 'x' }));
    R.check('Analyzer erhält 1 Counter (Deck→Hand)', (a.counters.changeCounter || 0) === 1, a.counters.changeCounter);
  }

  R.section('Gegner bounce-placet eine Deepsea-Kreatur (Zombie über Skeleton): „You may add a Deepsea Creature … to your hand"');
  {
    const t = await H.fresh({ hand: [[], []] });
    const a = t.put(0, 0, 0, 'Analyzer from the Cosmic Depths'); a.turnPlayed = 1;
    const g = t.put(0, 0, 1, 'Gatherer from the Cosmic Depths'); g.turnPlayed = 1;
    const s = t.put(1, 0, 0, 'Deepsea Skeleton'); s.turnPlayed = 1;
    t.setHand(1, ['Deepsea Zombie']);
    await t.play(1, 'Deepsea Zombie', { hero: 0, slot: 0 });
    R.check('Skeleton liegt auf der Hand des Gegners (Vorbedingung)', t.pile(1, 'hand').includes('Deepsea Skeleton'), t.pile(1, 'hand'));
    R.check('Analyzer erhält 1 Counter (Brett→Hand per Effekt)', (a.counters.changeCounter || 0) === 1, a.counters.changeCounter || 0);
    R.check('Gatherer erhält 1 Counter (Brett→Hand per Effekt)', (g.counters.changeCounter || 0) === 1, g.counters.changeCounter || 0);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('Gegner spielt Shapeshift (Brett→Hand)');
  {
    const t = await H.fresh({ hand: [[], []] });
    const a = t.put(0, 0, 0, 'Analyzer from the Cosmic Depths'); a.turnPlayed = 1;
    const p = t.put(1, 0, 0, 'Deepsea Poltergeister'); p.turnPlayed = 1;
    t.setHand(1, ['Shapeshift', H.INERT.creature]);
    // Harness-Korrektur Welle 9: Zonen- und Handwahl von Shapeshift beantworten (vorher blieb der Zauber in der Zonenwahl hängen)
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    t.script.push({ match: d => d.type === 'pickHandCard', answer: () => { const i = t.pile(1, 'hand').indexOf(H.INERT.creature); return { cardName: H.INERT.creature, handIndex: i, selectedCards: [{ cardName: H.INERT.creature, handIndex: i }] }; } });
    await t.play(1, 'Shapeshift', { hero: 0 });
    R.check('Analyzer erhält 1 Counter (Shapeshift: „add it to your hand")', (a.counters.changeCounter || 0) === 1, a.counters.changeCounter || 0);
  }
  R.finish();
})();
