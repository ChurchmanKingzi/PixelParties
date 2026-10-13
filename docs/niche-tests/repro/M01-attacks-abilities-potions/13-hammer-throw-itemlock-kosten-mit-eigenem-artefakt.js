'use strict';
// M01-13 · Hammer Throw (Item Lock): Das gespielte Normal-Artefakt kann sich selbst als „Item Lock Cost" löschen – der Sperrzoll entfällt
// Kartentext Hammer Throw: „The target's controller must delete a card from their hand whenever they play an Artifact during their next turn."
// Server: `doUseArtifactEffect` (server.js ~Z. 12226) ruft `actionPromptForceDiscard(pi, 1, {title:'Item Lock Cost', deleteMode:true})` OHNE `eligibleIndices`,
// während die Artefaktkarte (`beginHandResolve`) noch in der Hand liegt. Der Ausrüstungs-Zweig (server.js ~Z. 7815) übergibt dagegen `eligibleIndicesWithoutResolving(ps)`
// (Kommentar dort: „… koennte der Spieler ausgerechnet sie selbst loeschen"). Der CPU-Pilot (`_cpu.js` ~Z. 8463) schließt die Karte defensiv aus – ein Mensch bekommt sie angeboten.
// Aufbau: Sitz 1 ist itemLocked (Hammer-Throw-Folge, hier direkt gesetzt), Hand [Treasure Chest, ZZ Filler, ZZ Filler], 100 Gold; die Abfrage wird mit der Artefaktkarte selbst beantwortet.
// Erwartet: die Karte selbst ist nicht wählbar (bzw. eine ANDERE Handkarte wird gelöscht): Hand danach = 1 Karte, Treasure Chest in der Ablage, +10 Gold.
// Beobachtet: Treasure Chest wird als Kosten gelöscht (Gelöscht-Stapel), die Hand verliert nur 1 Karte, +10 Gold wirken trotzdem.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], ['Treasure Chest', 'ZZ Filler', 'ZZ Filler']], hp: 800, gold: 100 });
  t.gs.players[1].itemLocked = true; t.gs.activePlayer = 1;
  const gold0 = t.gs.players[1].gold;
  let eligible = 'n/a', handAtPrompt = null;
  t.script.push({ match: d => d.type === 'forceDiscard', answer: (d) => { eligible = d.eligibleIndices; handAtPrompt = t.pile(1, 'hand').slice(); // Z6: ein Mensch kann nur aus `eligibleIndices` waehlen - das Skript tut dasselbe (ohne Liste: die Artefaktkarte selbst, wie zuvor).
    const i = Array.isArray(d.eligibleIndices) ? d.eligibleIndices[0] : 0; const hand = t.pile(1, 'hand'); return { cardName: hand[i], handIndex: i }; } });
  const r = await t.play(1, 'Treasure Chest');
  R.note(`r=${r}; Hand beim Prompt=${JSON.stringify(handAtPrompt)} eligibleIndices=${JSON.stringify(eligible)}; Hand danach=${JSON.stringify(t.pile(1, 'hand'))}; gelöscht=${JSON.stringify(t.pile(1, 'deletedPile'))}; Ablage=${JSON.stringify(t.pile(1, 'discardPile'))}; Gold ${gold0} -> ${t.gs.players[1].gold}`);
  R.check('die gerade gespielte Artefaktkarte steht nicht als Item-Lock-Kosten zur Wahl (eligibleIndices schließt Index 0 aus)', Array.isArray(eligible) && !eligible.includes(0), eligible);
  R.check('Item Lock kostet wirklich eine ANDERE Karte: Hand danach = 1', t.pile(1, 'hand').length === 1, t.pile(1, 'hand'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
