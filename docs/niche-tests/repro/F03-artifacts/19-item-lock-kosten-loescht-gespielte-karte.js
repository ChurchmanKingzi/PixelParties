'use strict';
// F03-artifacts-19 · Item Lock ("Hammer Throw"): bei Nicht-Equipment-Artefakten dürfen die Kosten „delete a card from your hand" die gerade gespielte Artefakt-Karte selbst treffen
// Kartentext Hammer Throw: „The target's controller must delete a card from their hand whenever they play an Artifact during their next turn."
// Regel (server.js `validateActionPlay` ~7464/12053: Item Lock verlangt ≥ 2 Handkarten): die gespielte Karte ist KEINE Handkarte mehr, die Kosten brauchen eine ANDERE Karte.
// Aufbau: Sitz 0 trägt `itemLocked` (so setzt es Hammer Throw), Hand [Treasure Chest, Fireball]; Sitz 0 spielt Treasure Chest; als Kostenkarte wird die gespielte Treasure Chest gewählt (Mensch) – im
//   Harness-Standard (CPU) wählt die Engine denselben Platz selbst (erster Platz).
// Erwartung: Der Picker bietet die gespielte Treasure Chest nicht an; die Kosten zahlt eine andere Karte (Fireball); Treasure Chest landet in der Ablage.
// Beobachtet (✗): Der Picker listet auch die gespielte Karte (kein `eligibleIndices`); wird sie gewählt (CPU-Standard = erster Platz), wird das Artefakt selbst gelöscht – die Kosten sind frei, Fireball bleibt,
//   und die Karte fehlt in der Ablage (Gold +10 wirkt trotzdem).
// Ursache: `server.js` ~12226 (doUseArtifactEffect, auch Potion-Weg ~11323): `actionPromptForceDiscard(pi, 1, { title: 'Item Lock Cost', deleteMode: true, … })` ohne `eligibleIndices`-Ausschluss der auflösenden
//   Karte (`engine._istAufloesendeHandkarte`, _engine.js ~19630); Wheels/Live Show schließen sie selbst aus. Der Equipment-Weg (doPlayArtifact ~7654) ist nicht betroffen (Warhorse/Smug Coin/Circle löschen einen Bird).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Treasure Chest', 'Fireball'], []], gold: 100 });
  t.gs.players[0].itemLocked = true;
  let angebot = null;
  // Ein Mensch kann im Picker (`forceDiscard`, ohne `eligibleIndices`) jede Handkarte wählen – auch die gerade gespielte Treasure Chest. Wir wählen sie.
  t.script.push({ match: d => d.type === 'forceDiscard' && d.title === 'Item Lock Cost', answer: (d) => {
    const hand = t.gs.players[0].hand.slice();   // Roh-Hand: die gespielte Karte steht bis zur Auflösung noch darin
    angebot = { eligible: d.eligibleIndices ?? 'alle', hand };
    const idx = hand.indexOf('Treasure Chest');
    return { cardName: hand[idx], handIndex: idx };
  }, once: false });
  const r = await t.play(0, 'Treasure Chest');
  const elig = angebot && (angebot.eligible === 'alle' ? angebot.hand.map((_, i) => i) : angebot.eligible);
  R.check('Picker bietet die gespielte Treasure Chest nicht als Kosten an', !!angebot && !elig.some(i => angebot.hand[i] === 'Treasure Chest'), angebot);
  R.check('gelöscht wurde NICHT das gespielte Artefakt (Kosten sind eine andere Karte)', !t.pile(0, 'deletedPile').includes('Treasure Chest'), { r, deleted: t.pile(0, 'deletedPile'), disc: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand'), gold: t.gs.players[0].gold });
  R.check('Treasure Chest liegt in der Ablage', t.pile(0, 'discardPile').includes('Treasure Chest'), t.pile(0, 'discardPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
